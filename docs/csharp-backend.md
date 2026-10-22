# C# backend deployment and cutover

The new API is ASP.NET Core on .NET 10 LTS. Next.js stays on Vercel; Supabase Auth and Postgres remain the patient data platform. The C# API uses the patient's verified bearer token for every Supabase operation. It never uses a service-role key. The Redis store contains synthetic demonstration records only.

## Local development

Install Node.js 20.9+ and the .NET 10 SDK. From the repository root:

```bash
ASPNETCORE_ENVIRONMENT=Development ASPNETCORE_URLS=http://127.0.0.1:5080 dotnet run --project backend/CareFiji.Api
```

In a second terminal:

```bash
BACKEND_API_URL=http://127.0.0.1:5080 npm run dev
```

Set `SESSION_SECRET`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `UPSTASH_REDIS_REST_URL`, and `UPSTASH_REDIS_REST_TOKEN` as shell environment variables when testing configured services. The backend does not automatically read `.env` files. Development without Redis uses process-local demo data; Production never falls back to memory. Production requires a session secret and durable Redis. `/health/live` checks the process; `/health/ready` checks session configuration, Redis, and Supabase connectivity without exposing their values.

```bash
dotnet test backend/CareFiji.slnx --configuration Release
BACKEND_CONTRACT_URL=http://127.0.0.1:5080 node --test tests/backend-contract.test.mjs
```

CI also runs the browser contracts through a real Next.js external rewrite to verify `Set-Cookie`, session, and logout behavior. iOS tests decode C# timestamps with fractional seconds and offsets as well as existing Supabase timestamps.

## Azure prerequisites

Use a separate staging Supabase project and synthetic patient accounts before connecting real data. Apply the existing checked-in Supabase migration once to each new project; do not rerun it over an existing schema. Configure email OTP templates and provision registered patient accounts as described in the main README.

Create the Azure resource group in the chosen subscription/region and a Microsoft Entra application/service principal for GitHub Actions. Grant its identity Contributor on that resource group. Configure its federated credential with issuer `https://token.actions.githubusercontent.com`, audience `api://AzureADTokenExchange`, and subject `repo:Isimelisavutini/Bula-Maternity:environment:azure-production`. Create that GitHub environment. Both infrastructure provisioning and deployment use this identity; no Azure password or publish profile is stored.

Configure the following GitHub repository variables:

| Variable | Value |
| --- | --- |
| `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID` | Federated Azure identity and subscription |
| `AZURE_RESOURCE_GROUP`, `AZURE_LOCATION` | Existing resource group and Azure region |
| `AZURE_API_APP_NAME` | Globally unique App Service name |
| `SUPABASE_URL` | Target Supabase project URL |
| `UPSTASH_REDIS_REST_URL` | Existing synthetic-demo Redis URL |
| `AZURE_DEPLOY_ENABLED` | Leave unset until provisioning is complete; then `true` |

Configure `SUPABASE_ANON_KEY`, `UPSTASH_REDIS_REST_TOKEN`, and `SESSION_SECRET` as secrets in the `azure-production` GitHub environment. Reuse the existing Vercel `SESSION_SECRET` and Redis instance to preserve demo sessions/data. If Vercel was using the public fallback, choose a new private secret; users will sign in again. Never point the old and new backends at the same Redis dataset while both are accepting mutations: the legacy writer has no compare-and-set protection.

Run **Provision Azure API** from GitHub Actions. It validates .NET 10 runtime availability and deploys `infra/azure/main.bicep` using secure parameters. This provisions a paid Standard S1 Linux App Service plan, production app, staging slot, Log Analytics workspace, and Application Insights. S1 is selected because staging slots require Standard or above. Infrastructure provisioning is manual and never runs merely because a commit was pushed.

## Release and traffic cutover

1. Set `AZURE_DEPLOY_ENABLED=true` after provisioning. Push a validated change to `main` or rerun Verify for its current main commit. The deployment workflow runs only after the backend, web, and iOS verification jobs pass for a push to this repository's main branch. It downloads the artifact from that exact verification run.
2. Deployment publishes to the Azure staging slot, waits for `/health/ready`, swaps to production, and verifies readiness again. Failed production readiness automatically swaps back. The prior production build remains in the staging slot until the next deployment.
3. Run `node scripts/verify-patient-staging.mjs` with `PATIENT_STAGING_API_URL`, `PATIENT_STAGING_TOKEN_A`, and `PATIENT_STAGING_TOKEN_B` for two synthetic patients. The script creates one kick and one appointment request and checks real authentication, patient isolation, idempotent retries, and sync. Obtain the two short-lived access tokens through normal OTP sign-in; do not log or commit them. Also verify a clinical deletion fixture and offline iOS reconnection in staging.
4. Pause demo writes during the Vercel cutover. On Vercel set server-only `BACKEND_API_URL` to the verified Azure production origin, retaining `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` for browser OTP. Trigger the frontend deployment from GitHub. Confirm `/api/session`, all demo roles, logout, patient OTP, and sync through the website before resuming writes.
5. Configure the iOS build's existing `CAREFIJI_API_BASE_URL` setting to the Azure origin **with a trailing slash**; keep its Supabase settings. Release to TestFlight against synthetic staging first. The app's foreground polling, Core Data cache, and durable command outbox remain unchanged.

The migration is deliberately staged: without `BACKEND_API_URL`, Vercel retains the original handlers so this code can be shipped before cloud credentials exist. With it configured, `beforeFiles` rewrites route every `/api/*` request to C# before the legacy handlers can run. The GitHub Actions deployment workflow defaults to disabled until configured. No cloud resources or databases are provisioned by local builds.

After Azure and client acceptance checks pass, retire the temporary legacy API handlers plus `lib/domain.js`, `lib/session.js`, `lib/store.js`, `lib/supabase-server.js`, their superseded Node tests, and `@upstash/redis`. Preserve the cross-language reference fixtures before deleting the reference module. This cleanup is deferred until live cutover; removing the fallback beforehand would break the current Vercel deployment.

## Rollback and operational checks

To reverse an Azure release, run `az webapp deployment slot swap --resource-group <group> --name <app> --slot staging --target-slot production` from an authenticated GitHub workflow using the same OIDC identity. To revert the frontend migration, pause demo writes, remove `BACKEND_API_URL` in Vercel and redeploy the last verified GitHub revision. Never run independent old/new writers concurrently against the same demo Redis key.

The Redis key stays `carefiji:bula-maternity:v1`; existing documents are accepted without transformation. C# adds an internal revision and atomically compares the serialized version read before writing. The internal revision and audit collection are omitted from role data responses. Retries are bounded and return `TEMPORARY_UNAVAILABLE` rather than silently overwriting a concurrent write.

Application Insights request/dependency auto-tracking is disabled so patient URLs, database queries, headers, and payloads are not collected. Default logs are warnings with lifecycle information only. Use Azure health-check status and slot deployment outcomes for rollout monitoring. No new patient schema migration is required for this backend port.
