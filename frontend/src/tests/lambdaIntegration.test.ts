/**
 * Phase 6 AWS Lambda Integration & Simulation Test Suite
 *
 * Simulates API Gateway HTTP API v2 events and EventBridge scheduled events
 * against the backend Lambda handlers to verify offline compatibility,
 * CORS headers, error mapping, and CloudWatch execution safety.
 */

import assert from 'node:assert';
import type { APIGatewayProxyEventV2, Context, ScheduledEvent } from 'aws-lambda';
import { handler as graphqlLambdaHandler } from '../../../backend/src/handlers/graphql';
import { handler as syncLambdaHandler } from '../../../backend/src/handlers/sync';

function createMockContext(awsRequestId = 'test-request-123'): Context {
  return {
    callbackWaitsForEmptyEventLoop: true,
    functionName: 'weather-gpt-graphql',
    functionVersion: '$LATEST',
    invokedFunctionArn: 'arn:aws:lambda:us-east-1:123456789012:function:weather-gpt-graphql',
    memoryLimitInMB: '512',
    awsRequestId,
    logGroupName: '/aws/lambda/weather-gpt-graphql',
    logStreamName: '2026/09/28/[$LATEST]mockstream',
    getRemainingTimeInMillis: () => 10000,
    done: () => {},
    fail: () => {},
    succeed: () => {},
  };
}

function createApiGatewayV2PostEvent(query: string, variables?: Record<string, unknown>): APIGatewayProxyEventV2 {
  return {
    version: '2.0',
    routeKey: 'POST /graphql',
    rawPath: '/graphql',
    rawQueryString: '',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json',
      host: 'api.weathergpt.com',
      'user-agent': 'Mozilla/5.0 (MockClient/1.0)',
    },
    requestContext: {
      accountId: '123456789012',
      apiId: 'mockapiid',
      domainName: 'api.weathergpt.com',
      domainPrefix: 'api',
      http: {
        method: 'POST',
        path: '/graphql',
        protocol: 'HTTP/1.1',
        sourceIp: '127.0.0.1',
        userAgent: 'MockClient/1.0',
      },
      requestId: 'test-gw-req-1',
      routeKey: 'POST /graphql',
      stage: 'dev',
      time: '28/Sep/2026:15:00:00 +0000',
      timeEpoch: Date.now(),
    },
    body: JSON.stringify({
      query,
      variables,
    }),
    isBase64Encoded: false,
  };
}

function createApiGatewayV2OptionsEvent(): APIGatewayProxyEventV2 {
  return {
    version: '2.0',
    routeKey: 'OPTIONS /graphql',
    rawPath: '/graphql',
    rawQueryString: '',
    headers: {
      origin: 'http://localhost:3000',
      'access-control-request-method': 'POST',
      host: 'api.weathergpt.com',
    },
    requestContext: {
      accountId: '123456789012',
      apiId: 'mockapiid',
      domainName: 'api.weathergpt.com',
      domainPrefix: 'api',
      http: {
        method: 'OPTIONS',
        path: '/graphql',
        protocol: 'HTTP/1.1',
        sourceIp: '127.0.0.1',
        userAgent: 'Browser/1.0',
      },
      requestId: 'test-cors-req-1',
      routeKey: 'OPTIONS /graphql',
      stage: 'dev',
      time: '28/Sep/2026:15:00:00 +0000',
      timeEpoch: Date.now(),
    },
    isBase64Encoded: false,
  };
}

async function runLambdaTests() {
  console.log('=== RUNNING PHASE 6 AWS LAMBDA INTEGRATION TESTS ===\n');

  // -------------------------------------------------------------------------
  // Test 1: API Gateway HTTP API v2 POST /graphql execution
  // -------------------------------------------------------------------------
  console.log('[1/4] Testing API Gateway v2 -> Lambda GraphQL POST invocation...');
  const weatherQuery = /* GraphQL */ `
    query GetWeather($coords: CoordinatesInput!) {
      weatherByCoordinates(coordinates: $coords) {
        locationId
        lastUpdated
        current {
          temperature
          condition
        }
      }
    }
  `;

  const postEvent = createApiGatewayV2PostEvent(weatherQuery, {
    coords: { latitude: 51.5074, longitude: -0.1278 },
  });
  const mockContext = createMockContext();

  const postResult = await graphqlLambdaHandler(postEvent, mockContext);

  assert.strictEqual(typeof postResult, 'object', 'Handler must return result object.');
  assert.strictEqual((postResult as { statusCode: number }).statusCode, 200, 'HTTP status must be 200.');
  
  const headers = (postResult as { headers: Record<string, string> }).headers;
  assert.strictEqual(headers['access-control-allow-origin'], '*', 'CORS Allow-Origin header must be present.');
  
  const body = JSON.parse((postResult as { body: string }).body);
  assert.ok(body.data?.weatherByCoordinates?.current, 'Data payload must contain weatherByCoordinates.');
  assert.ok(typeof body.data.weatherByCoordinates.current.temperature === 'number', 'Temperature must be numeric.');
  console.log(`   Lambda returned status 200 with temperature: ${body.data.weatherByCoordinates.current.temperature}°C`);
  console.log('✔ API Gateway v2 POST /graphql execution passed.\n');

  // -------------------------------------------------------------------------
  // Test 2: CORS Preflight OPTIONS /graphql
  // -------------------------------------------------------------------------
  console.log('[2/4] Testing API Gateway v2 CORS OPTIONS preflight...');
  const optionsEvent = createApiGatewayV2OptionsEvent();
  const optionsResult = await graphqlLambdaHandler(optionsEvent, mockContext);

  assert.strictEqual((optionsResult as { statusCode: number }).statusCode, 204, 'OPTIONS preflight must return 204 No Content.');
  const optHeaders = (optionsResult as { headers: Record<string, string> }).headers;
  assert.ok(optHeaders['access-control-allow-origin'], 'Allow-Origin must be set.');
  assert.ok(optHeaders['access-control-allow-methods'].includes('POST'), 'Allow-Methods must include POST.');
  console.log('✔ CORS OPTIONS preflight passed.\n');

  // -------------------------------------------------------------------------
  // Test 3: Coordinate bounds error handling via Lambda
  // -------------------------------------------------------------------------
  console.log('[3/4] Testing invalid coordinates rejection via Lambda...');
  const badCoordsEvent = createApiGatewayV2PostEvent(weatherQuery, {
    coords: { latitude: 999.0, longitude: 999.0 },
  });
  const badCoordsResult = await graphqlLambdaHandler(badCoordsEvent, mockContext);

  assert.strictEqual((badCoordsResult as { statusCode: number }).statusCode, 200, 'GraphQL errors return HTTP 200.');
  const badBody = JSON.parse((badCoordsResult as { body: string }).body);
  assert.ok(badBody.errors && badBody.errors.length > 0, 'GraphQL error array must be populated.');
  assert.strictEqual(badBody.errors[0].extensions?.code, 'BAD_USER_INPUT');
  console.log(`   Received expected GraphQL error code: ${badBody.errors[0].extensions?.code}`);
  console.log('✔ Lambda GraphQL error mapping passed.\n');

  // -------------------------------------------------------------------------
  // Test 4: EventBridge scheduled sync worker execution
  // -------------------------------------------------------------------------
  console.log('[4/4] Testing EventBridge scheduled forecast sync worker...');
  const scheduledEvent: ScheduledEvent = {
    version: '0',
    id: 'mock-event-id',
    'detail-type': 'Scheduled Event',
    source: 'aws.events',
    account: '123456789012',
    time: new Date().toISOString(),
    region: 'us-east-1',
    resources: ['arn:aws:events:us-east-1:123456789012:rule/weather-gpt-forecast-sync'],
    detail: {},
  };

  const syncResult = await syncLambdaHandler(scheduledEvent, mockContext);
  assert.strictEqual(syncResult.success, true, 'Sync worker should report success.');
  assert.ok(typeof syncResult.durationMs === 'number', 'Duration must be recorded.');
  console.log(`   Sync worker completed: Attempted=${syncResult.locationsAttempted}, Succeeded=${syncResult.locationsSucceeded} in ${syncResult.durationMs}ms`);
  console.log('✔ EventBridge forecast sync worker passed.\n');

  console.log('======================================================');
  console.log('ALL 4 PHASE 6 AWS LAMBDA INTEGRATION TESTS PASSED! ✔');
  console.log('======================================================');
}

runLambdaTests().catch((err) => {
  console.error('Lambda integration test failed:', err);
  process.exit(1);
});
