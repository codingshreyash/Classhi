import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const MARKETS_TABLE = process.env.MARKETS_TABLE!;

interface SchedulerEvent {
  marketId: string;
  action: "open" | "close";
}

export const handler = async (event: SchedulerEvent): Promise<void> => {
  const { marketId, action } = event;
  const expectedStatus = action === "open" ? "scheduled" : "open";
  const nextStatus = action === "open" ? "open" : "closed";

  try {
    await ddb.send(
      new UpdateCommand({
        TableName: MARKETS_TABLE,
        Key: { marketId },
        ConditionExpression: "#s = :expected",
        UpdateExpression: "SET #s = :next",
        ExpressionAttributeNames: { "#s": "status" },
        ExpressionAttributeValues: {
          ":expected": expectedStatus,
          ":next": nextStatus,
        },
      }),
    );
    console.log(
      `[scheduler-handler] ${marketId}: ${expectedStatus} -> ${nextStatus}`,
    );
  } catch (err: unknown) {
    const e = err as { name?: string };
    if (e.name === "ConditionalCheckFailedException") {
      // Idempotent: market already past expected status (e.g., admin manually
      // resolved early, or market was created in a different status). Swallow
      // so EventBridge Scheduler does not retry.
      console.warn(
        `[scheduler-handler] ${marketId}: skipped action=${action} (status was not ${expectedStatus})`,
      );
      return;
    }
    throw err;
  }
};
