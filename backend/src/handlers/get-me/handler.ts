import { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const USERS_TABLE = process.env.USERS_TABLE!;

const HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
};

// The HTTP API v2 payload includes a jwt authorizer context not fully typed in @types/aws-lambda
interface JwtAuthorizerContext {
  jwt?: {
    claims?: Record<string, string>;
  };
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

  const result = await ddb.send(
    new GetCommand({
      TableName: USERS_TABLE,
      Key: { userId },
    })
  );

  if (!result.Item) {
    return {
      statusCode: 404,
      headers: HEADERS,
      body: JSON.stringify({ error: "User not found" }),
    };
  }

  const { email, balance } = result.Item as {
    userId: string;
    email: string;
    balance: number;
  };

  return {
    statusCode: 200,
    headers: HEADERS,
    body: JSON.stringify({ userId, email, balance }),
  };
};
