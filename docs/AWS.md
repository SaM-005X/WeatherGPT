# Simple Weather Web Application — AWS Serverless Infrastructure

## 1. AWS Services Matrix

| AWS Service | Configuration | Role | Status |
| :--- | :--- | :--- | :--- |
| **AWS Lambda** | Node.js 20.x, ARM64, 512 MB memory, 10s timeout | Executes GraphQL Yoga engine (`graphqlHandler`) and background cache warming worker (`forecastSyncWorker`). | **Implemented & Verified Locally** |
| **API Gateway (HTTP API v2)** | Payload Format 2.0, CORS enabled, `/graphql` route | Lightweight, low-latency HTTPS endpoint proxying client requests directly to Lambda. | **Implemented & Verified Locally** |
| **Amazon EventBridge** | Scheduled rule: `rate(30 minutes)` | Automatically invokes background forecast sync worker to warm hourly and 7-day forecasts for tracked locations. | **Implemented & Verified Locally** |
| **AWS Systems Manager (SSM) / Secrets Manager** | SecureString parameters (`/weather-gpt/{stage}/*`) | Stores Supabase credentials and API keys securely in production. | **Configured in IaC Templates** |
| **Amazon CloudWatch** | Structured JSON log group (`/aws/lambda/weather-gpt-*`), 7-day retention | Centralized logging, correlation via `requestId`, execution metrics, and error debugging. | **Implemented & Verified Locally** |
| **IAM** | Least-privilege execution role (`AWSLambdaBasicExecutionRole` + SSM read) | Grants Lambda functions permission to write logs and read environment parameters. | **Configured in IaC Templates** |

---

## 2. Architecture Boundary & Data Flow

```text
Next.js Frontend (or external client)
           │
           │ HTTPS POST /graphql
           ▼
[ Amazon API Gateway (HTTP API v2) ]
           │
           │ APIGatewayProxyEventV2
           ▼
[ AWS Lambda: graphqlHandler (src/handlers/graphql.ts) ]
           │
           ├─► apigateway.ts (Transforms EventV2 <-> Web Request/Response)
           ├─► logger.ts (CloudWatch Structured JSON Logger)
           │
           ▼
[ GraphQL Yoga Engine (Reusable Schema & Resolvers) ]
           │
           ├────────────────────────┬────────────────────────┐
           ▼                        ▼                        ▼
[ weatherResolvers.ts ]   [ locationResolvers.ts ]   [ assistantResolvers.ts ]
           │                        │                        │
           ▼                        ▼                        ▼
  weatherService.ts         geocodingService.ts       Contract Stub
  (Open-Meteo REST)        (Supabase PostgreSQL)
```

### EventBridge Background Processing Flow

```text
[ Amazon EventBridge Rule: rate(30 minutes) ]
           │
           │ ScheduledEvent
           ▼
[ AWS Lambda: forecastSyncWorker (src/handlers/sync.ts) ]
           │
           ├─► getRecentPersistedLocations(5) (Falls back to PRESET_LOCATIONS if empty)
           │
           ▼
[ syncLocations(locations) Engine ]
           │
           ├─► Sequential execution to prevent provider rate spikes
           ├─► Per-location try/catch isolation (failures do not abort the job)
           ├─► fetchWeatherData(lat, lon, { forceRefresh: true })
           │
           ▼
[ Open-Meteo REST API ] ──► Warm In-Memory Caches
           │
           ▼
[ Return SyncResult ]
  { success, locationsAttempted, locationsSucceeded, locationsFailed, durationMs, details }
```

---

## 3. Infrastructure as Code (IaC)

The repository provides two production-grade IaC templates in `backend/` to prevent vendor lock-in:

### Option A: Serverless Framework (`backend/serverless.yml`)
Configured for Serverless Framework v3/v4 targeting AWS HTTP API v2, Node.js 20, ARM64 architecture, and SSM Parameter Store secret resolution:

```yaml
service: weather-gpt-api
frameworkVersion: '3'

provider:
  name: aws
  runtime: nodejs20.x
  architecture: arm64
  region: ${opt:region, 'us-east-1'}
  stage: ${opt:stage, 'dev'}
  memorySize: 512
  timeout: 10
  logRetentionInDays: 7
  httpApi:
    cors:
      allowedOrigins:
        - 'http://localhost:3000'
        - 'https://${self:custom.domainName}'
      allowedHeaders:
        - Content-Type
        - Authorization
      allowedMethods:
        - GET
        - POST
        - OPTIONS
  environment:
    STAGE: ${self:provider.stage}
    SUPABASE_URL: ${ssm:/weather-gpt/${self:provider.stage}/SUPABASE_URL}
    SUPABASE_SERVICE_ROLE_KEY: ${ssm:/weather-gpt/${self:provider.stage}/SUPABASE_SERVICE_ROLE_KEY}
    LLM_API_KEY: ${ssm:/weather-gpt/${self:provider.stage}/LLM_API_KEY, ''}
    WEATHER_API_KEY: ${ssm:/weather-gpt/${self:provider.stage}/WEATHER_API_KEY, ''}

custom:
  domainName: weather.yourdomain.com

functions:
  graphqlHandler:
    handler: dist/handlers/graphql.handler
    events:
      - httpApi:
          path: /graphql
          method: post
      - httpApi:
          path: /graphql
          method: get

  forecastSyncWorker:
    handler: dist/handlers/sync.handler
    timeout: 60
    memorySize: 256
    events:
      - schedule:
          rate: rate(30 minutes)
          enabled: true
          description: "Periodically warm hourly and 7-day forecasts"
```

### Option B: AWS SAM / CloudFormation (`backend/template.yaml`)
Provides a native AWS Serverless Application Model (SAM) template defining `AWS::Serverless::HttpApi`, `AWS::Serverless::Function`, and `AWS::Events::Rule` with least-privilege IAM execution roles.

---

## 4. Environment Variables & Secret Safety

| Environment Variable | Target Service | Classification | Storage Strategy |
| :--- | :--- | :--- | :--- |
| `NEXT_PUBLIC_SUPABASE_URL` | Frontend | Public Configuration | `.env.local` / CI build env |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Frontend | Public Safe Token | `.env.local` / CI build env |
| `SUPABASE_URL` | Backend Lambda | Server Secret | SSM Parameter Store (`/weather-gpt/prod/SUPABASE_URL`) |
| `SUPABASE_SERVICE_ROLE_KEY` | Backend Lambda | Server Secret (High Security) | SSM Parameter Store (SecureString) |
| `WEATHER_API_KEY` | Backend Lambda | Server Secret (Optional) | SSM Parameter Store (SecureString) |
| `LLM_API_KEY` | Backend Lambda | Server Secret (Future AI) | SSM Parameter Store (SecureString) |

### Security Rules:
- **Zero Client Exposure**: `SUPABASE_SERVICE_ROLE_KEY` and AWS credentials are NEVER prefixed with `NEXT_PUBLIC_` and are NEVER referenced in frontend browser bundles.
- **Zero Repository Secrets**: `.env.local`, `.env`, and secret values are excluded in `.gitignore`.
- **Local Autonomy**: AWS credentials are **NOT** required for local development. The Next.js frontend uses `/api/graphql` directly in development without contacting AWS.

---

## 5. Structured Observability (CloudWatch)

All backend handlers utilize `backend/src/utils/logger.ts` to emit single-line, structured JSON log events.

Example CloudWatch Log Output:
```json
{
  "timestamp": "2026-09-28T09:51:20.162Z",
  "level": "INFO",
  "message": "GraphQL request received",
  "service": "weather-gpt-graphql",
  "requestId": "c280a69d-7ef7-48ec-8726-158ad6be391b",
  "context": {
    "method": "POST",
    "rawPath": "/graphql",
    "sourceIp": "127.0.0.1",
    "userAgent": "Mozilla/5.0..."
  }
}
```

Benefits:
- Directly indexable and filterable using **CloudWatch Logs Insights** queries (e.g. `fields @timestamp, message, context.durationMs | filter level = "ERROR"`).
- End-to-end request correlation using AWS `awsRequestId`.
- Sanitized outputs: sensitive tokens and request payloads are never logged.

---

## 6. Implementation & Verification Status

- **Code Implemented**:
  - `backend/src/handlers/graphql.ts`: API Gateway HTTP API v2 adapter for GraphQL Yoga.
  - `backend/src/handlers/sync.ts`: EventBridge scheduled worker warming top tracked locations with per-location error isolation and structured results.
  - `backend/src/utils/apigateway.ts`: Bi-directional HTTP API v2 event and response transformer with CORS.
  - `backend/src/utils/logger.ts`: CloudWatch JSON logger.
  - `backend/serverless.yml` & `backend/template.yaml`: IaC configuration files.
- **Local Verification**:
  - `src/tests/lambdaIntegration.test.ts`: Automated simulation of API Gateway v2 POST, OPTIONS preflight, BAD_USER_INPUT coordinate validation error handling, and EventBridge sync execution. All 4 tests passing.
  - `src/tests/weatherFreshness.test.ts`: Automated simulation of background sync worker with partial failures and complete execution. All 12 tests passing.
- **AWS Deployment**:
  - **DEFERRED / UNPROVISIONED**: Actual cloud deployment to an AWS account is intentionally deferred until account credentials, domain configuration, and production pipelines are provided.
