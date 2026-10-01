# WeatherGPT — AWS Serverless Infrastructure

## 1. AWS Services Matrix

| AWS Service | Configuration | Role | Status |
| :--- | :--- | :--- | :--- |
| **AWS AppSync** | Managed GraphQL API, Direct Lambda Data Sources, `API_KEY` & `AWS_IAM` auth | Managed production GraphQL entry point routing operations to domain-grouped Lambda functions. | **Deployed & Operational (Phase 8.5.7)** |
| **AWS Lambda** | Node.js 20.x, ARM64, 512 MB memory, 10s timeout | Executes domain-grouped resolver adapters (`weatherFunction`, `locationFunction`) and background sync worker (`forecastSyncWorker`). | **Deployed & Operational (`weatherFunction`, `forecastSyncWorker`) (Phase 8.5.7)** |
| **API Gateway (HTTP API v2)** | Payload Format 2.0, CORS enabled, `/graphql` route | Phase 6 HTTP proxy endpoint verifying local Lambda integration; superseded by AWS AppSync for managed GraphQL production traffic. | **Implemented & Verified Locally (Phase 6)** |
| **Amazon EventBridge** | Scheduled rule: `rate(30 minutes)` | Automatically invokes background forecast sync worker to warm hourly and 7-day forecasts for tracked locations. | **Deployed & Operational (Phase 8.5.7)** |
| **AWS Systems Manager (SSM) / Secrets Manager** | SecureString parameters (`/weather-gpt/{stage}/*`) | Stores Supabase credentials and server API keys securely in production. | **Configured in IaC Templates** |
| **Amazon CloudWatch** | Structured JSON log group (`/aws/lambda/weather-gpt-*`), 7-day retention | Centralized logging, correlation via `requestId`, execution metrics, and error debugging. | **Deployed & Active (CloudWatch Logs)** |
| **IAM** | Least-privilege execution role (`AWSLambdaBasicExecutionRole` + SSM read) | Grants Lambda functions permission to write logs, read parameters, and allow AppSync execution invocation. | **Deployed (Least Privilege)** |

---

## 2. Architecture Boundary & Data Flow

### A. Target Production Flow: AWS AppSync (Phase 8.5 Target)

```text
Next.js Frontend (via weatherAdapter & graphqlClient)
           │
           │ HTTPS POST (x-api-key / IAM)
           ▼
[ AWS AppSync (Managed GraphQL Transport) ]
           │
           ├────────────────────────┬────────────────────────┐
           ▼                        ▼                        ▼
[ weatherFunction Lambda ] [ locationFunction Lambda ] [ assistantFunction Lambda ]
(Thin Adapter: Node.js)   (Thin Adapter: Node.js)   (Thin Adapter — Phase 9)
           │                        │                        │
           ▼                        ▼                        ▼
   weatherService.ts         geocodingService.ts            LLM Provider
   (Open-Meteo REST API)     locationPersistenceService.ts  (Weather Grounded)
                             (Supabase PostgreSQL)
```

### B. Phase 6 Local Serverless Foundation (Frozen / Verified Locally)

```text
Next.js Frontend (or local test runner)
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
```   ▼                        ▼
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

### Single Canonical IaC Source: AWS SAM (`backend/template.yaml`)
For the Phase 8.5 AWS AppSync architecture, **AWS SAM (`backend/template.yaml`) is the single canonical IaC source**.
- Defines the managed `AWS::AppSync::GraphQLApi`, `AWS::AppSync::ApiKey`, GraphQL schema, AppSync data sources, and least-privilege IAM execution roles.
- Defines domain-grouped Lambda functions (`weatherFunction`, `locationFunction`, `assistantFunction`).
- Zero proprietary framework lock-in; compiles directly to standard AWS CloudFormation.

### Frozen Foundation: Serverless Framework (`backend/serverless.yml`)
- `backend/serverless.yml` remains **strictly frozen** at the Phase 6 foundation.
- It preserves the verified HTTP API v2 + monolithic Yoga Lambda setup used for earlier local validation.
- **`serverless.yml` is NOT an active or secondary AppSync IaC source.** Do not use it for AppSync resource provisioning.

---

## 3.1. Lambda Resolver Topology (Domain-Grouped Direction)

AppSync delegates GraphQL operations to domain-grouped Lambda functions rather than a monolithic handler:

| Lambda Function | Resolved GraphQL Fields | Domain Service Delegated To | Status |
| :--- | :--- | :--- | :--- |
| **`weatherFunction`** | `weatherByCoordinates`, `refreshWeather` | `weatherService.ts` | **Implemented & Deployed (Phase 8.5.7)** |
| **`locationFunction`** | `searchLocations`, `savedLocations` | `geocodingService.ts`, `locationPersistenceService.ts` | **Preserved on Client / Direct Supabase (Phase 8.5.6)** |
| **`assistantFunction`** | `askWeatherAssistant` | LLM Provider + `weatherService.ts` context grounding | **Planned (Phase 9 Only)** |

> **Architectural Guardrail**:
> Lambda resolver handlers act strictly as **thin adapters**. They must NOT become the business logic layer. All caching, deduplication, meteorological conversions, coordinate validation, and external REST API integrations remain inside the existing domain services.
> 
> **Packaging Strategy (Phase 8.5.5)**:
> In this monorepo layout, Lambda resolvers importing shared domain code from `frontend/src/lib` are pre-bundled using `esbuild` (`npm run bundle:lambda`) to `backend/dist/handlers/` prior to `sam build`. SAM packages the standalone, tree-shaken CommonJS bundle directly without monorepo path-isolation conflicts.
> 
> *Note: These functions are verified locally and offline; real AWS deployment occurs in Phase 8.5.6.*

---

## 4. Environment Variables & Secret Safety

| Environment Variable | Target Service | Classification | Storage Strategy |
| :--- | :--- | :--- | :--- |
| `NEXT_PUBLIC_APPSYNC_ENDPOINT` | Frontend | Public Configuration | `.env.local` / CI build env (Phase 8.5.8) |
| `NEXT_PUBLIC_APPSYNC_API_KEY` | Frontend | Public Safe Token | `.env.local` / CI build env (Phase 8.5.8) |
| `NEXT_PUBLIC_SUPABASE_URL` | Frontend | Public Configuration | `.env.local` / CI build env |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Frontend | Public Safe Token | `.env.local` / CI build env |
| `SUPABASE_URL` | Backend Lambda | Server Secret | SSM Parameter Store (`/weather-gpt/prod/SUPABASE_URL`) |
| `SUPABASE_SERVICE_ROLE_KEY` | Backend Lambda | Server Secret (High Security) | SSM Parameter Store (SecureString) |
| `WEATHER_API_KEY` | Backend Lambda | Server Secret (Optional) | SSM Parameter Store (SecureString) |
| `LLM_API_KEY` | Backend Lambda | Server Secret (Future AI) | SSM Parameter Store (SecureString) |

### Security Rules:
- **AppSync API Key is NOT a Secret**: `NEXT_PUBLIC_APPSYNC_API_KEY` is sent in request headers (`x-api-key`) and is visible to browser users. It must **NEVER** be treated or described as user authentication.
- **Phase 9 Chatbot Access Control (Unfinalized)**: Because LLM calls consume paid tokens, chatbot operations cannot rely on a public API key alone. Authorization mechanisms (e.g., Supabase Auth/OIDC, Lambda authorizers, rate limiting) will be finalized in Phase 9.
- **Zero Client Exposure of Secrets**: `SUPABASE_SERVICE_ROLE_KEY` and AWS credentials are NEVER prefixed with `NEXT_PUBLIC_` and are NEVER included in browser bundles.
- **Local Autonomy**: AWS credentials are **NOT** required for local development. The Next.js frontend uses direct services or local `/api/graphql` without contacting AWS.

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

- **Phase 6 Serverless Foundation (Implemented & Verified Locally)**:
  - `backend/src/handlers/graphql.ts`: API Gateway HTTP API v2 adapter for GraphQL Yoga.
  - `backend/src/handlers/sync.ts`: EventBridge scheduled worker warming top tracked locations with per-location error isolation.
  - `backend/src/utils/apigateway.ts`: Bi-directional HTTP API v2 event transformer.
  - `backend/src/utils/logger.ts`: CloudWatch JSON logger.
  - Integration tests: `src/tests/lambdaIntegration.test.ts` (4/4 passed).
- **Phase 8.5 AppSync Target (Implemented & Verified Live — Phase 8.5.7)**:
  - Architecture audits (8.5.1 and 8.5.1-C) completed.
  - AWS SAM (`backend/template.yaml`) established as canonical IaC source.
  - Thin domain Lambda adapter `weatherFunction` implemented and bundled via `esbuild`.
  - Offline AppSync resolver simulation suite (`appsyncResolver.test.ts`) 100% passing (8/8 tests).
  - CloudFormation Change Set `samcli-deploy1790757616` executed and completed successfully.
- **AWS Cloud Deployment (Deployed & Operational)**:
  - **Stack Name**: `weather-gpt-backend` (Region: `us-east-1`)
  - **Stack Status**: `CREATE_COMPLETE` (verified 2026-09-30)
  - **AppSync GraphQL API ID**: `lae4htbgzfbcvjnczbgzio3w6q`
  - **AppSync GraphQL HTTPS Endpoint**: `https://64xz24nnqbdktigtxjwstte234.appsync-api.us-east-1.amazonaws.com/graphql`
  - **Authentication**: `API_KEY` (`da2-***`, redacted) and `AWS_IAM`
  - **Provisioned Cloud Resources**:
    - `AWS::AppSync::GraphQLApi` (`WeatherAppSyncApi`)
    - `AWS::AppSync::GraphQLSchema` (`WeatherAppSyncSchema`)
    - `AWS::AppSync::ApiKey` (`WeatherAppSyncApiKey`)
    - `AWS::AppSync::DataSource` (`WeatherLambdaDataSource`)
    - `AWS::AppSync::Resolver` (`WeatherByCoordinatesResolver`, `RefreshWeatherResolver`)
    - `AWS::Lambda::Function` (`WeatherFunction`, `ForecastSyncFunction`)
    - `AWS::Events::Rule` (`ForecastSyncSchedule`)
    - `AWS::IAM::Role` (`WeatherFunctionRole`, `ForecastSyncFunctionRole`, `AppSyncLambdaServiceRole`)
  - **Live Verification Query (2026-09-30)**:
    - Executed live `weatherByCoordinates` GraphQL query for coordinates `{ latitude: 22.5726, longitude: 88.3639 }`.
    - **Result**: HTTP 200 OK, zero GraphQL errors.
    - **Payload Verified**:
      ```json
      {
        "data": {
          "weatherByCoordinates": {
            "current": {
              "temperature": 32.4,
              "weatherCode": 3,
              "windSpeed": 7.6,
              "humidity": 58
            },
            "timezone": "Asia/Kolkata",
            "lastUpdated": "2026-09-30T08:54:34.717Z"
          }
        }
      }
      ```
    - Confirmed direct resolver invocation of `WeatherFunction` and integration with upstream Open-Meteo REST service.

---

## 7. Rollback Strategy & Git Recovery Checkpoint

### Local Development Rollback
In local development, switching data transport between GraphQL and direct services is instantaneous:
- The GraphQL client can be configured to point to `/api/graphql` or bypassed in favor of direct `weatherService.ts` via local code or configuration toggles.
- Zero cloud teardown or external network operations are required.

### Production AWS Rollback
- **Build Invariant**: Modifying `.env.local` or environment variables locally does **NOT** roll back an already compiled, bundled, and deployed Next.js production build.
- **Deployment Strategy**: Reverting production transport from AppSync back to direct services or a previous release requires a deliberate deployment action:
  - Re-deploying the previous release artifact via the CI/CD pipeline.
  - Edge routing adjustments (e.g., Cloudflare edge rules routing API traffic).
- **Git Recovery Checkpoint**:
  - The verified recovery checkpoint is commit `72990f1` (`chore: checkpoint before AppSync integration`).
  - This commit guarantees a 100% clean, verified pre-AppSync codebase if any fundamental architectural rollback is needed.

---

## 8. Performance & Cost Benchmarking (Guidance)

- **No Unmeasured Claims**: Performance metrics (such as AppSync latency in ms, Lambda cold starts in ms, bundle size reduction, or exact monthly cloud costs) have **NOT** been measured on live deployed AWS infrastructure.
- **Benchmarking Protocol**: Real performance benchmarking, cold start profiling, and cloud cost accounting will be conducted during **Phase 8.5.7 (Real AWS Deployment & Cloud Verification)** using active CloudWatch telemetry.
- Hypothetical or speculative calculations must not be cited as measured facts.
