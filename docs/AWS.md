# WeatherGPT — AWS Serverless Infrastructure

## 1. AWS Services Matrix

| AWS Service | Configuration | Role | Status |
| :--- | :--- | :--- | :--- |
| **AWS AppSync** | Managed GraphQL API, Direct Lambda Data Source, `API_KEY` & `AWS_IAM` auth | Managed production GraphQL entry point routing operations to domain Lambda resolver. | **Deployed & Operational (API ID: `lae4htbgzfbcvjnczbgzio3w6q`)** |
| **AWS Lambda** | Node.js 20.x, ARM64, 512 MB memory, 25s/30s timeout | Executes domain resolver adapter (`WeatherFunction`) and background sync worker (`ForecastSyncFunction`). | **Deployed & Operational (`WeatherFunction`, `ForecastSyncFunction`)** |
| **Amazon EventBridge** | Scheduled rule: `rate(30 minutes)` | Automatically invokes background forecast sync worker to warm hourly and 7-day forecasts for tracked locations. | **Deployed & Operational (`ForecastSyncFunctionHalfHourlySchedule`)** |
| **Amazon CloudWatch** | Structured JSON log group (`/aws/lambda/weather-gpt-*`), 7-day retention | Centralized logging, correlation via `requestId`, execution metrics, and error debugging. | **Deployed & Active (CloudWatch Logs)** |
| **IAM** | Least-privilege execution roles | Grants Lambda functions permission to write logs, and permits AppSync to invoke backend Lambda resolver. | **Deployed (`AppSyncLambdaServiceRole`, `WeatherFunctionRole`, `ForecastSyncFunctionRole`)** |
| **API Gateway (HTTP API v2)** | Payload Format 2.0, CORS enabled, `/graphql` route | Phase 6 HTTP proxy endpoint verifying local Lambda integration; superseded by AWS AppSync for managed GraphQL production traffic. | **Historical Foundation (Phase 6 / Frozen in `serverless.yml`)** |
| **AWS Systems Manager (SSM) / Secrets Manager** | SecureString parameters (`/weather-gpt/{stage}/*`) | Stores backend credentials securely in production where required. | **Configured in IaC Templates** |

---

## 2. Architecture Boundary & Data Flow

### A. Deployed Production Flow: AWS AppSync (Canonical Managed Backend)

```text
Next.js Frontend (via graphqlClient.ts)
           │
           │ HTTPS POST (x-api-key: NEXT_PUBLIC_APPSYNC_API_KEY)
           ▼
[ AWS AppSync Managed GraphQL API ] (https://64xz24nnqbdktigtxjwstte234.appsync-api.us-east-1.amazonaws.com/graphql)
           │
           ▼ Direct Lambda Resolver (WeatherLambdaDataSource)
[ WeatherFunction Lambda ] (dist/handlers/appsync.handler, Node.js 20.x ARM64)
           │
           ▼ (Thin Adapter Delegation)
   weatherService.ts (In-memory 5m cache, tiered freshness, request deduplication)
           │
           ▼
   Open-Meteo REST API (https://api.open-meteo.com/v1/forecast)
```

> **Deployed Scope Notice**:
> - Only `WeatherFunction` is deployed as an AppSync Lambda resolver (resolving `Query.weatherByCoordinates`).
> - Location search and saved locations are handled directly by frontend domain services querying Open-Meteo Geocoding and Supabase PostgreSQL.
> - The Weather Chatbot is served directly by the Next.js server route `/api/chat` (Groq Cloud Qwen 3.8 27B); no `assistantFunction` is deployed to AWS AppSync.

---

### B. EventBridge Background Forecast Warming Flow

```text
[ Amazon EventBridge Rule: rate(30 minutes) ]
           │
           │ ScheduledEvent
           ▼
[ AWS Lambda: ForecastSyncFunction (dist/handlers/sync.handler) ]
           │
           ├─► getRecentPersistedLocations(5) (Falls back to preset coordinates if empty)
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

### C. Historical Phase 6 Foundation (Frozen in `backend/serverless.yml`)

During Phase 6, a local serverless foundation using API Gateway HTTP API v2 and a monolithic GraphQL Yoga Lambda handler (`backend/src/handlers/graphql.ts`) was implemented and validated offline.
- **Frozen State**: `backend/serverless.yml` remains frozen as an immutable reference of that local foundation.
- **Do NOT use `serverless.yml` for production deployments**: AWS SAM (`backend/template.yaml`) is the single canonical IaC source.

---

## 3. Infrastructure as Code (IaC)

### Single Canonical IaC Source: AWS SAM (`backend/template.yaml`)
For the production AWS AppSync architecture, **AWS SAM (`backend/template.yaml`) is the single canonical IaC source**.
- Defines the managed `AWS::AppSync::GraphQLApi`, `AWS::AppSync::ApiKey`, `AWS::AppSync::GraphQLSchema`, and data source resources.
- Defines direct Lambda resolvers (`WeatherByCoordinatesResolver`).
- Defines background worker `ForecastSyncFunction` with EventBridge schedule `rate(30 minutes)`.
- Defines least-privilege IAM execution roles (`AppSyncLambdaServiceRole`, `WeatherFunctionRole`, `ForecastSyncFunctionRole`).
- Compiles directly to standard AWS CloudFormation without proprietary framework lock-in.

---

## 3.1. Lambda Resolver & Function Topology

| Function Name | Handler Path | Trigger / Role | Deployed Status |
| :--- | :--- | :--- | :--- |
| **`WeatherFunction`** | `dist/handlers/appsync.handler` | AppSync Direct Lambda Resolver (`Query.weatherByCoordinates`) | **Deployed & Operational (CloudFormation)** |
| **`ForecastSyncFunction`** | `dist/handlers/sync.handler` | EventBridge Schedule (`rate(30 minutes)`) | **Deployed & Operational (CloudFormation)** |
| *`locationFunction`* | N/A | Handled directly by frontend domain services and Supabase | **Not Deployed to AWS (Client Managed)** |
| *`assistantFunction`* | N/A | Handled directly by Next.js `/api/chat` (Groq Cloud Qwen 3.8 27B) | **Not Deployed to AWS (Next.js Route)** |

> **Packaging Strategy**:
> Lambda resolvers importing shared domain code from `frontend/src/lib` are pre-bundled using `esbuild` (`npm run bundle:lambda`) to `backend/dist/handlers/` prior to `sam build`. SAM packages the standalone, tree-shaken CommonJS bundle directly without monorepo path-isolation conflicts.

---

## 4. Environment Variables & Secret Safety

| Environment Variable | Target Service | Classification | Storage Strategy |
| :--- | :--- | :--- | :--- |
| `NEXT_PUBLIC_APPSYNC_GRAPHQL_URL` | Frontend | Public Configuration | `.env.local` / Render Web Service build env |
| `NEXT_PUBLIC_APPSYNC_API_KEY` | Frontend | Public Safe Token | `.env.local` / Render Web Service build env |
| `NEXT_PUBLIC_SUPABASE_URL` | Frontend | Public Configuration | `.env.local` / Render Web Service build env |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Frontend | Public Safe Token | `.env.local` / Render Web Service build env |
| `GROQ_API_KEY` | Frontend Server Runtime | Server Secret | Render Web Service Environment Secret (Never in build-args) |
| `SUPABASE_URL` | Backend Lambda | Server Configuration | AWS SAM Parameter / Template Variable |
| `SUPABASE_ANON_KEY` | Backend Lambda | Server Safe Token | AWS SAM Parameter (NoEcho) |

### Security Rules:
- **AppSync API Key is NOT a Secret**: `NEXT_PUBLIC_APPSYNC_API_KEY` is sent in request headers (`x-api-key`) and is visible to browser users. It must **NEVER** be treated or described as user authentication.
- **Chatbot Secret Safety**: `GROQ_API_KEY` is consumed strictly at container runtime by the Next.js server for `/api/chat`. It is never bundled into client JS or stored in image layers.
- **Local Autonomy**: AWS credentials are **NOT** required for local development. The Next.js frontend uses direct services or local `/api/graphql` without contacting AWS.

---

## 5. Structured Observability (CloudWatch)

All backend handlers utilize `backend/src/utils/logger.ts` to emit single-line, structured JSON log events.

Example CloudWatch Log Output:
```json
{
  "timestamp": "2026-09-30T08:54:34.717Z",
  "level": "INFO",
  "message": "WeatherByCoordinates resolved successfully",
  "service": "weather-gpt-appsync",
  "requestId": "c280a69d-7ef7-48ec-8726-158ad6be391b",
  "context": {
    "latitude": 22.5726,
    "longitude": 88.3639,
    "cached": true,
    "durationMs": 1.42
  }
}
```

Benefits:
- Directly indexable and filterable using **CloudWatch Logs Insights** queries (e.g. `fields @timestamp, message, context.durationMs | filter level = "ERROR"`).
- End-to-end request correlation using AWS `awsRequestId`.
- Sanitized outputs: internal file paths and credentials are automatically redacted.

---

## 6. Verified AWS Deployment Details

- **CloudFormation Stack Name**: `weather-gpt-backend`
- **AWS Region**: `us-east-1`
- **Stack Status**: `CREATE_COMPLETE` (verified live)
- **AppSync GraphQL API ID**: `lae4htbgzfbcvjnczbgzio3w6q`
- **AppSync Managed Endpoint**: `https://64xz24nnqbdktigtxjwstte234.appsync-api.us-east-1.amazonaws.com/graphql`
- **Authentication**: `API_KEY` (`da2-***`, redacted) and `AWS_IAM`
- **Provisioned Cloud Resources**:
  - `AWS::AppSync::GraphQLApi` (`WeatherAppSyncApi`)
  - `AWS::AppSync::GraphQLSchema` (`WeatherAppSyncSchema`)
  - `AWS::AppSync::ApiKey` (`WeatherAppSyncApiKey`)
  - `AWS::AppSync::DataSource` (`WeatherLambdaDataSource`)
  - `AWS::AppSync::Resolver` (`WeatherByCoordinatesResolver`)
  - `AWS::Lambda::Function` (`WeatherFunction`, `ForecastSyncFunction`)
  - `AWS::Events::Rule` (`ForecastSyncFunctionHalfHourlySchedule`)
  - `AWS::Lambda::Permission` (`ForecastSyncFunctionHalfHourlySchedulePermission`)
  - `AWS::IAM::Role` (`WeatherFunctionRole`, `ForecastSyncFunctionRole`, `AppSyncLambdaServiceRole`)
- **Live Endpoint Verification**:
  - Live `Query.weatherByCoordinates` returns HTTP 200 OK with normalized meteorological observations in < 2ms under cached conditions.

---

## 7. Rollback & Failover Strategy

### Automatic Runtime Failover
In production, `fetchWeatherByCoordinates` includes an automatic fast-failover guard:
- If the AppSync request times out (> 8000ms) or returns an HTTP/GraphQL error, the client instantly falls back to direct `weatherService.ts`.
- In the Phase 12 release gate audit (`src/tests/finalEndpointAudit.ts`), this failover operated in **1.58ms** (< 2ms requirement), ensuring zero user-facing downtime.

### CloudFormation Stack Teardown
If the backend cloud infrastructure needs to be decommissioned or recreated:
```bash
sam delete --stack-name weather-gpt-backend --region us-east-1
```

---

## 8. Related Documentation

- **[Deployment Guide](DEPLOYMENT.md)**: End-to-end production deployment guide and live endpoints.
- **[Architecture](ARCHITECTURE.md)**: System topology, Mermaid diagrams, and data pipelines.
- **[GraphQL Specification](GRAPHQL.md)**: Schema SDL, operations, and resolver mappings.
- **[Troubleshooting Runbook](TROUBLESHOOTING.md)**: CloudWatch logs and AppSync error diagnosis.
