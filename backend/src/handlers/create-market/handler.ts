import { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const MARKETS_TABLE = process.env.MARKETS_TABLE!;

const HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
};

interface JwtAuthorizerContext {
  jwt?: {
    claims?: Record<string, string>;
  };
}

function getInitialStatus(openAt: string, closeAt: string): string {
  const now = new Date();
  if (now < new Date(openAt)) return "scheduled";
  if (now <= new Date(closeAt)) return "open";
  return "closed";
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

  const adminIds = (process.env.ADMIN_USER_IDS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (!adminIds.includes(userId)) {
    return {
      statusCode: 403,
      headers: HEADERS,
      body: JSON.stringify({ error: "Admin access required" }),
    };
  }

  let body: {
    title?: string;
    description?: string;
    openAt?: string;
    closeAt?: string;
  };

  try {
    body = JSON.parse(event.body ?? "{}");
  } catch {
    return {
      statusCode: 400,
      headers: HEADERS,
      body: JSON.stringify({ error: "Invalid JSON" }),
    };
  }

  const { title, description, openAt, closeAt } = body;

  if (!title || !description || !openAt || !closeAt) {
    return {
      statusCode: 400,
      headers: HEADERS,
      body: JSON.stringify({
        error: "Missing required fields: title, description, openAt, closeAt",
      }),
    };
  }

  const market = {
    marketId: crypto.randomUUID(),
    title,
    description,
    status: getInitialStatus(openAt, closeAt),
    yesPrice: 50,
    noPrice: 50,
    volume: 0,
    yesVolume: 100,
    noVolume: 100,
    openAt,
    closeAt,
    createdAt: new Date().toISOString(),
    createdBy: userId,
  };

  await ddb.send(new PutCommand({ TableName: MARKETS_TABLE, Item: market }));

  return {
    statusCode: 201,
    headers: HEADERS,
    body: JSON.stringify({ market }),
  };
};
