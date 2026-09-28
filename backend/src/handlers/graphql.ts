/**
 * AWS Lambda GraphQL Handler
 *
 * Serverless execution entry point for API Gateway HTTP API v2 requests.
 * Reuses the Phase 5 executable schema and GraphQL Yoga engine without duplicating business logic.
 */

import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2, Context } from 'aws-lambda';
import { createYoga, createSchema } from 'graphql-yoga';
import { typeDefs } from '@/graphql/schema/typeDefs';
import { resolvers } from '@/graphql/resolvers';
import { Logger } from '../utils/logger';
import { createWebRequestFromEvent, createApiGatewayResultFromResponse } from '../utils/apigateway';

const logger = new Logger('weather-gpt-graphql');

// Initialize Yoga server instance once per Lambda execution environment (container reuse)
const yoga = createYoga({
  schema: createSchema({
    typeDefs,
    resolvers,
  }),
  graphqlEndpoint: '/graphql',
  fetchAPI: { Response, Request, Headers },
  maskedErrors: false,
});

export async function handler(
  event: APIGatewayProxyEventV2,
  context?: Context
): Promise<APIGatewayProxyResultV2> {
  const startTime = Date.now();
  const requestId = context?.awsRequestId || event.requestContext?.requestId || 'local-req';
  logger.setRequestId(requestId);

  const method = event.requestContext?.http?.method?.toUpperCase() || 'POST';

  logger.info('GraphQL request received', {
    method,
    rawPath: event.rawPath,
    sourceIp: event.requestContext?.http?.sourceIp,
    userAgent: event.requestContext?.http?.userAgent,
  });

  // Fast preflight handling for CORS OPTIONS requests
  if (method === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        'access-control-allow-origin': '*',
        'access-control-allow-methods': 'GET,POST,OPTIONS',
        'access-control-allow-headers': 'Content-Type,Authorization',
      },
    };
  }

  try {
    const webRequest = createWebRequestFromEvent(event);
    const webResponse = await yoga.fetch(webRequest);
    const result = await createApiGatewayResultFromResponse(webResponse);

    const durationMs = Date.now() - startTime;
    logger.info('GraphQL request completed', {
      statusCode: result.statusCode,
      durationMs,
    });

    return result;
  } catch (err: unknown) {
    const durationMs = Date.now() - startTime;
    logger.error('Unhandled error executing GraphQL Lambda handler', err, { durationMs });

    return {
      statusCode: 500,
      headers: {
        'content-type': 'application/json',
        'access-control-allow-origin': '*',
      },
      body: JSON.stringify({
        errors: [
          {
            message: 'Internal server error executing GraphQL query.',
            extensions: { code: 'INTERNAL_SERVER_ERROR' },
          },
        ],
      }),
    };
  }
}
