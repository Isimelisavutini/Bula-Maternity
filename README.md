# CareFiji — Bula Maternity

A Pacific-inspired maternity hospital workflow prototype for Fiji, with a Next.js frontend for Vercel and an ASP.NET Core (.NET 10 LTS) backend for Azure.

> **Synthetic demonstration data only.** This application is not approved for real patient information, clinical decisions, or production healthcare use.

## What changed

- Next.js App Router provides the web entry point; a server-only `BACKEND_API_URL` rewrite sends API requests to C# on Azure.
- The C# backend ports demo workflows and patient/iOS sync APIs without changing their client contracts. Temporary JavaScript handlers remain available until the Azure cutover is verified.
- Signed, HTTP-only cookies replace Charming identity for demonstration identities across six roles, including three care-pod midwives.
- Server-side role permissions protect every read and mutation.
- Upstash Redis provides shared synthetic-demo state and audit storage; C# uses atomic version-checked writes. Supabase Auth/Postgres remain separate for production patients.
- The original Pacific Reef responsive interface is implemented in React.

## Local development

Requires Node.js 20.9 or newer. C# backend development also requires the .NET 10 SDK.

```bash
npm install
npm run dev
```

Without Redis variables, the app uses in-memory demonstration data that resets when the server process restarts. Set the variables from `.env.example` to test durable storage locally.

For the new C# backend, start `dotnet run --project backend/CareFiji.Api` with `ASPNETCORE_ENVIRONMENT=Development` and `ASPNETCORE_URLS=http://127.0.0.1:5080`, then run the frontend with `BACKEND_API_URL=http://127.0.0.1:5080 npm run dev`. See [backend deployment and cutover](docs/csharp-backend.md) for environment variables, Azure OIDC setup, tests, staging verification, and rollback. C# permits in-memory demo storage only in Development.

Run the quality checks with:

```bash
npm test
npm run lint
npm run build
```

## Deploying to Vercel

1. Import this GitHub repository into Vercel. Framework detection should select Next.js automatically.
2. Until Azure is configured, leave `BACKEND_API_URL` unset to retain the existing demonstration API. This is the temporary migration fallback.
3. For durable shared state, open **Storage / Marketplace**, connect an Upstash Redis database, and confirm the integration provides `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`.
4. Optionally add a long random `SESSION_SECRET` in project environment variables to replace the public demo signing fallback. Do not commit its value.
5. After the GitHub Azure workflow deploys successfully and `/health/ready` passes, set `BACKEND_API_URL` on Vercel to the Azure origin and trigger redeployment through GitHub. Redis and `SESSION_SECRET` settings then belong on Azure. Keep public Supabase configuration on Vercel for patient sign-in.

The checked-in `vercel.json` selects the Next.js framework and reproducible `npm ci` / `npm run build` commands. In Vercel project settings, leave **Root Directory** at the repository root and clear any legacy **Output Directory** override left from the former static prototype.

## Demonstration identities

The sign-in screen supplies the corresponding password when a role is selected. The accounts are intentionally public demo identities and must not be treated as production authentication.

| Username | Role |
| --- | --- |
| `admin` | Administrator |
| `doctor` | Doctor |
| `midwife` | Midwife |
| `kesa` | Midwife · pod buddy |
| `litia` | Midwife · pod buddy |
| `reception` | Receptionist |
| `finance` | Finance |
| `patient` | Patient |

## Care-pod communication prototype

The synthetic workspace includes “Ask My Midwife” for patients and a shared care-pod queue for midwives, doctors, and administrators. It supports safety checks, buddy coverage, questions and voice notes, replies, appointment requests, and alert acknowledgement. See [care-pod workflow and limits](docs/care-pod.md). These screens use the isolated demo data plane; they are not connected to a live staffed triage service or the production Supabase patient portal.

## Production limitations

The zero-configuration mode is intentionally ephemeral and its session-signing fallback is public because every demonstration role is public. Before real-world clinical use, replace the demo identity flow with a managed identity provider and verified staff/patient accounts. Independent security testing, privacy and regulatory review, clinical governance, backups and disaster recovery, retention policies, tamper-evident audit logging, and validated infrastructure are also required.

## Production patient data and iOS app

The public browser demo remains isolated from the production patient data plane. Production mobile endpoints live under `/api/mobile/v1` and require a Supabase access token; they never accept the demo session cookie. Both web and iOS use the same C# endpoints after cutover.

1. Create separate Supabase staging and production projects.
2. Run `supabase/migrations/202610220001_mobile_sync.sql` in each project.
3. Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` to Vercel, and `SUPABASE_URL` and `SUPABASE_ANON_KEY` to Azure. Never expose or use a service-role key in the client or patient API.
4. Configure Supabase email templates to deliver a six-digit OTP and set the allowed application redirect domains.
   Provision approved patients in Supabase Auth before sign-in; the app deliberately disables public account creation.
5. In `ios`, install XcodeGen (`brew install xcodegen`) and run `xcodegen generate`.
6. Configure `CAREFIJI_API_BASE_URL` to the Azure origin with a trailing slash, plus `SUPABASE_URL` and `SUPABASE_ANON_KEY` in local or CI build settings, then open `CareFiji.xcodeproj` in Xcode.
7. Select a development team, use the `CareFiji` scheme, and run on an iOS 15+ simulator or device.

The native app renders cached Core Data immediately, polls every three minutes while active, syncs on launch/resume/manual refresh, queues explicit patient actions offline, and requests Apple-controlled background refresh. iOS does not guarantee background execution every three minutes.

Do not use production patient information until identity, consent, privacy, clinical governance, penetration testing, backup/restore, incident response, Supabase contractual controls, and Fiji data-residency requirements have been independently approved.

The former Charming implementation remains in `src/` as migration reference and is not included in the Next.js runtime.

Copyright @ BASA
