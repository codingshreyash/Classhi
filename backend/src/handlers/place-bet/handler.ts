import { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  TransactWriteCommand,
} from "@aws-sdk/lib-dynamodb";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const USERS_TABLE = process.env.USERS_TABLE!;
const MARKETS_TABLE = process.env.MARKETS_TABLE!;
const POSITIONS_TABLE = process.env.POSITIONS_TABLE!;

const HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
};

interface JwtAuthorizerContext {
  jwt?: {
    claims?: Record<string, string>;
  };
}

interface Market {
  marketId: string;
  status: string;
  yesPrice: number;
  noPrice: number;
  yesVolume?: number;
  noVolume?: number;
  volume: number;
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const ctx = event.requestContext as typeof event.requestContext & {
    authorizer?: JwtAuthorizerContext;
  };
  const userId = ctx.authorizer?.jwt?.claims?.sub;
  if (!userId) {
    return {
      statusCode: 401,
      headers: HEADERS,
      body: JSON.stringify({ error: "Unauthorized" }),
    };
  }

  const marketId = event.pathParameters?.marketId;
  if (!marketId) {
    return {
      statusCode: 400,
      headers: HEADERS,
      body: JSON.stringify({ error: "marketId is required" }),
    };
  }

  let body: { side?: string; amount?: number };
  try {
    body = JSON.parse(event.body ?? "{}");
  } catch {
    return {
      statusCode: 400,
      headers: HEADERS,
      body: JSON.stringify({ error: "Invalid JSON" }),
    };
  }

  const side = body.side;
  const amount = Number(body.amount);

  if (side !== "YES" && side !== "NO") {
    return {
      statusCode: 400,
      headers: HEADERS,
      body: JSON.stringify({ error: "side must be YES or NO" }),
    };
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return {
      statusCode: 400,
      headers: HEADERS,
      body: JSON.stringify({ error: "amount must be a positive number" }),
    };
  }

  // Read current market state (need current price for shares calc and volumes for new price)
  const marketResult = await ddb.send(
    new GetCommand({ TableName: MARKETS_TABLE, Key: { marketId } })
  );
  if (!marketResult.Item) {
    return {
      statusCode: 404,
      headers: HEADERS,
      body: JSON.stringify({ error: "Market not found" }),
    };
  }
  const market = marketResult.Item as Market;
  if (market.status !== "open") {
    return {
      statusCode: 400,
      headers: HEADERS,
      body: JSON.stringify({ error: "Market is not open" }),
    };
  }

  // Compute new volumes and prices (DynamoDB UpdateExpression cannot reference 2 attributes)
  const currentYesVolume = market.yesVolume ?? 100;
  const currentNoVolume = market.noVolume ?? 100;
  const newYesVolume = currentYesVolume + (side === "YES" ? amount : 0);
  const newNoVolume = currentNoVolume + (side === "NO" ? amount : 0);
  const total = newYesVolume + newNoVolume;
  const newYesPrice = total > 0 ? Math.round((newYesVolume / total) * 100) : 50;
  const newNoPrice = 100 - newYesPrice;

  // Shares at CURRENT side price (price before this bet)
  const sidePrice = side === "YES" ? market.yesPrice : market.noPrice;
  if (sidePrice <= 0 || sidePrice >= 100) {
    return {
      statusCode: 400,
      headers: HEADERS,
      body: JSON.stringify({ error: "Market pricing is invalid" }),
    };
  }
  const shares = Math.round((amount / (sidePrice / 100)) * 100) / 100;

  const idempotencyKey = `${userId}-${marketId}-${event.requestContext.requestId}`.slice(0, 36);

  const params = {
    ClientRequestToken: idempotencyKey,
    TransactItems: [
      {
        Update: {
          TableName: USERS_TABLE,
          Key: { userId },
          ConditionExpression: "balance >= :amount",
          UpdateExpression: "SET balance = balance - :amount",
          ExpressionAttributeValues: { ":amount": amount },
        },
      },
      {
        Update: {
          TableName: MARKETS_TABLE,
          Key: { marketId },
          ConditionExpression: "#status = :open",
          UpdateExpression:
            "SET yesVolume = :yv, noVolume = :nv, yesPrice = :yp, noPrice = :np, volume = volume + :amount",
          ExpressionAttributeNames: { "#status": "status" },
          ExpressionAttributeValues: {
            ":open": "open",
            ":yv": newYesVolume,
            ":nv": newNoVolume,
            ":yp": newYesPrice,
            ":np": newNoPrice,
            ":amount": amount,
          },
        },
      },
      {
        Update: {
          TableName: POSITIONS_TABLE,
          Key: { userId, marketId },
          UpdateExpression:
            "ADD shares :shares, costBasis :cost SET side = :side, createdAt = if_not_exists(createdAt, :now), updatedAt = :now",
          ExpressionAttributeValues: {
            ":shares": shares,
            ":cost": amount,
            ":side": side,
            ":now": new Date().toISOString(),
          },
        },
      },
    ],
  };

  // Retry loop: 3 attempts with 100ms/200ms/400ms backoff on TransactionConflict only
  const maxAttempts = 3;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      await ddb.send(new TransactWriteCommand(params));
      break; // success
    } catch (err: unknown) {
      const e = err as { name?: string; CancellationReasons?: Array<{ Code?: string }> };
      if (e.name === "TransactionCanceledException") {
        const reasons = e.CancellationReasons ?? [];
        // Index 0 = users balance check; 1 = market status check; 2 = positions (no condition)
        if (reasons[0]?.Code === "ConditionalCheckFailed") {
          return {
            statusCode: 400,
            headers: HEADERS,
            body: JSON.stringify({ error: "Insufficient balance" }),
          };
        }
        if (reasons[1]?.Code === "ConditionalCheckFailed") {
          return {
            statusCode: 400,
            headers: HEADERS,
            body: JSON.stringify({ error: "Market is not open" }),
          };
        }
        const isConflict = reasons.some((r) => r?.Code === "TransactionConflict");
        if (isConflict && attempt < maxAttempts - 1) {
          await sleep(100 * Math.pow(2, attempt));
          continue;
        }
        if (isConflict) {
          return {
            statusCode: 503,
            headers: HEADERS,
            body: JSON.stringify({ error: "Too many simultaneous bets, please try again." }),
          };
        }
      }
      throw err;
    }
  }

  // Fetch updated user balance for response convenience
  const userResult = await ddb.send(
    new GetCommand({ TableName: USERS_TABLE, Key: { userId } })
  );
  const newBalance = (userResult.Item as { balance?: number } | undefined)?.balance ?? null;

  return {
    statusCode: 200,
    headers: HEADERS,
    body: JSON.stringify({
      shares,
      costBasis: amount,
      yesPrice: newYesPrice,
      noPrice: newNoPrice,
      newBalance,
      side,
    }),
  };
};
