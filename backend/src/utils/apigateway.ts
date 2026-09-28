/**
 * API Gateway HTTP API v2 Adapter
 *
 * Bridges AWS API Gateway v2 Payload Format events (APIGatewayProxyEventV2)
 * with the standard Web Request / Response interface used by GraphQL Yoga.
 */

import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from 'aws-lambda';

/**
 * Converts an APIGatewayProxyEventV2 into a standard Web API Request.
 */
export function createWebRequestFromEvent(event: APIGatewayProxyEventV2): Request {
  const domain = event.requestContext?.domainName || 'localhost';
  const rawPath = event.rawPath || '/graphql';
  const query = event.rawQueryString ? `?${event.rawQueryString}` : '';
  const url = `https://${domain}${rawPath}${query}`;

  const method = event.requestContext?.http?.method?.toUpperCase() || 'POST';

  const headers = new Headers();
  if (event.headers) {
    for (const [key, value] of Object.entries(event.headers)) {
      if (value !== undefined) {
        headers.set(key, value);
      }
    }
  }

  let body: string | undefined;
  if (method !== 'GET' && method !== 'HEAD' && event.body) {
    body = event.isBase64Encoded
      ? Buffer.from(event.body, 'base64').toString('utf8')
      : event.body;
  }

  return new Request(url, {
    method,
    headers,
    body,
  });
}

/**
 * Converts a standard Web API Response into an APIGatewayProxyResultV2.
 */
export async function createApiGatewayResultFromResponse(
  response: Response,
  allowedOrigin = '*'
): Promise<APIGatewayProxyStructuredResultV2> {
  const headers: Record<string, string> = {
    'access-control-allow-origin': allowedOrigin,
    'access-control-allow-methods': 'GET,POST,OPTIONS',
    'access-control-allow-headers': 'Content-Type,Authorization',
  };

  response.headers.forEach((value, key) => {
    headers[key.toLowerCase()] = value;
  });

  const body = await response.text();

  return {
    statusCode: response.status,
    headers,
    body,
  };
}
