import type { APIGatewayRequestAuthorizerHandler } from "aws-lambda";
import { CognitoJwtVerifier } from "aws-jwt-verify";

const verifier = CognitoJwtVerifier.create({
  userPoolId: process.env.USER_POOL_ID!,
  tokenUse: "id",
  clientId: process.env.USER_POOL_CLIENT_ID!,
});

export const handler: APIGatewayRequestAuthorizerHandler = async (event) => {
  const token = event.queryStringParameters?.token;
  const methodArn = event.methodArn;

  try {
    if (!token) throw new Error("No token");
    const payload = await verifier.verify(token);
    return {
      principalId: payload.sub,
      policyDocument: {
        Version: "2012-10-17",
        Statement: [
          { Action: "execute-api:Invoke", Effect: "Allow", Resource: methodArn },
        ],
      },
      context: { userId: payload.sub },
    };
  } catch (err) {
    console.error("[ws-authorizer] verify failed:", err);
    return {
      principalId: "deny",
      policyDocument: {
        Version: "2012-10-17",
        Statement: [
          { Action: "execute-api:Invoke", Effect: "Deny", Resource: methodArn },
        ],
      },
    };
  }
};
