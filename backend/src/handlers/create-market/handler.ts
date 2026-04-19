import { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import {
  SchedulerClient,
  CreateScheduleCommand,
  ActionAfterCompletion,
  ConflictException,
} from "@aws-sdk/client-scheduler";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const MARKETS_TABLE = process.env.MARKETS_TABLE!;

const scheduler = new SchedulerClient({});
const SCHEDULER_ROLE_ARN = process.env.SCHEDULER_ROLE_ARN!;
const SCHEDULER_HANDLER_ARN = process.env.SCHEDULER_HANDLER_ARN!;

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

async function createMarketSchedule(
  marketId: string,
  atTime: string,
  action: "open" | "close",
): Promise<void> {
  // Guard: skip if time is already past (EventBridge Scheduler would fire
  // immediately, hitting ConditionalCheckFailedException for "open" if the
  // market was created with an already-past openAt).
  if (new Date(atTime) <= new Date()) return;

  // at() expression requires `at(yyyy-mm-ddThh:mm:ss)` — strip the .SSSZ
  // suffix that toISOString() produces. Failing to strip yields ValidationException.
  const expr = `at(${new Date(atTime).toISOString().replace(/\.\d{3}Z$/, "")})`;

  try {
    await scheduler.send(
      new CreateScheduleCommand({
        Name: `market-${action}-${marketId}`,
        ScheduleExpression: expr,
        ScheduleExpressionTimezone: "UTC",
        FlexibleTimeWindow: { Mode: "OFF" },
        ActionAfterCompletion: ActionAfterCompletion.DELETE,
        Target: {
          Arn: SCHEDULER_HANDLER_ARN,
          RoleArn: SCHEDULER_ROLE_ARN,
          Input: JSON.stringify({ marketId, action }),
        },
      }),
    );
  } catch (err) {
    if (err instanceof ConflictException) {
      // Schedule already exists from a prior Lambda retry — treat as success.
      return;
    }
    throw err;
  }
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

  // Phase 6: schedule automatic status transitions. Open is skipped if openAt
  // is already past (market already in "open" status from getInitialStatus).
  // Close is always scheduled if in the future. Failures here do NOT roll back
  // the market — the admin can re-trigger or transition manually.
  try {
    await createMarketSchedule(market.marketId, openAt, "open");
    await createMarketSchedule(market.marketId, closeAt, "close");
  } catch (err) {
    console.error("[create-market] schedule creation failed", err);
    // Intentionally non-fatal: market is already persisted. Surface to logs only.
  }

  return {
    statusCode: 201,
    headers: HEADERS,
    body: JSON.stringify({ market }),
  };
};
