import type { APIGatewayProxyWebsocketHandlerV2 } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const CONNECTIONS_TABLE = process.env.CONNECTIONS_TABLE!;
const TTL_SECONDS = 7200; // 2 hours — TTL safety net for orphaned connections

// @types/aws-lambda omits queryStringParameters on the WebSocket event type;
// the actual APIGW payload includes it on $connect. Cast via intersection.
type WsEvent = Parameters<APIGatewayProxyWebsocketHandlerV2>[0] & {
  queryStringParameters?: Record<string, string>;
};

export const handler: APIGatewayProxyWebsocketHandlerV2 = async (rawEvent) => {
  const event = rawEvent as WsEvent;
  const connectionId = event.requestContext.connectionId;
  const marketId = event.queryStringParameters?.marketId;

  if (!marketId) {
    return { statusCode: 400, body: "marketId required" };
  }

  const ttl = Math.floor(Date.now() / 1000) + TTL_SECONDS;

  await ddb.send(new PutCommand({
    TableName: CONNECTIONS_TABLE,
    Item: {
      connectionId,
      subscribedMarketId: marketId,
      ttl,
      connectedAt: new Date().toISOString(),
    },
  }));

  return { statusCode: 200, body: "Connected" };
};
