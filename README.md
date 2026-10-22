# CareFiji — Bula Maternity

A Pacific-inspired maternity hospital workflow prototype for Fiji, now implemented as a Next.js application for Vercel.

> **Synthetic demonstration data only.** This application is not approved for real patient information, clinical decisions, or production healthcare use.

## What changed

- Next.js App Router provides the web entry point and Vercel serverless API routes.
- Signed, HTTP-only cookies replace Charming identity for six seeded demonstration users.
- Server-side role permissions protect every read and mutation.
- Upstash Redis provides shared durable state and audit-event storage.
- The original Pacific Reef responsive interface is implemented in React.

## Local development

Requires Node.js 20.9 or newer.

```bash
npm install
npm run dev
```

Without Redis variables, the app uses in-memory demonstration data that resets when the server process restarts. Set the variables from `.env.example` to test durable storage locally.

Run the quality checks with:

```bash
npm test
npm run lint
npm run build
```

## Deploying to Vercel

1. Import this GitHub repository into Vercel. Framework detection should select Next.js automatically.
2. Deploy immediately for zero-configuration demonstration mode, which uses resettable in-memory data and the public demo session flow.
3. For durable shared state, open **Storage / Marketplace**, connect an Upstash Redis database, and confirm the integration provides `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`.
4. Optionally add a long random `SESSION_SECRET` in project environment variables to replace the public demo signing fallback. Do not commit its value.
5. Redeploy after changing environment variables.

The checked-in `vercel.json` selects the Next.js framework and reproducible `npm ci` / `npm run build` commands. In Vercel project settings, leave **Root Directory** at the repository root and clear any legacy **Output Directory** override left from the former static prototype.

## Demonstration identities

The sign-in screen supplies the corresponding password when a role is selected. The accounts are intentionally public demo identities and must not be treated as production authentication.

| Username | Role |
| --- | --- |
| `admin` | Administrator |
| `doctor` | Doctor |
| `midwife` | Midwife |
| `reception` | Receptionist |
| `finance` | Finance |
| `patient` | Patient |

## Production limitations

The zero-configuration mode is intentionally ephemeral and its session-signing fallback is public because every demonstration role is public. Before real-world clinical use, replace the demo identity flow with a managed identity provider and verified staff/patient accounts. Independent security testing, privacy and regulatory review, clinical governance, backups and disaster recovery, retention policies, tamper-evident audit logging, and validated infrastructure are also required.

## Production patient data and iOS app

The public browser demo remains isolated from the production patient data plane. Production mobile endpoints live under `/api/mobile/v1` and require a Supabase access token; they never accept the demo session cookie.

1. Create separate Supabase staging and production projects.
2. Run `supabase/migrations/202610220001_mobile_sync.sql` in each project.
3. Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` to the corresponding Vercel environment. Never expose a service-role key.
4. Configure Supabase email templates to deliver a six-digit OTP and set the allowed application redirect domains.
   Provision approved patients in Supabase Auth before sign-in; the app deliberately disables public account creation.
5. In `ios`, install XcodeGen (`brew install xcodegen`) and run `xcodegen generate`.
6. Configure `CAREFIJI_API_BASE_URL`, `SUPABASE_URL`, and `SUPABASE_ANON_KEY` in local or CI build settings, then open `CareFiji.xcodeproj` in Xcode.
7. Select a development team, use the `CareFiji` scheme, and run on an iOS 15+ simulator or device.

The native app renders cached Core Data immediately, polls every three minutes while active, syncs on launch/resume/manual refresh, queues explicit patient actions offline, and requests Apple-controlled background refresh. iOS does not guarantee background execution every three minutes.

Do not use production patient information until identity, consent, privacy, clinical governance, penetration testing, backup/restore, incident response, Supabase contractual controls, and Fiji data-residency requirements have been independently approved.

The former Charming implementation remains in `src/` as migration reference and is not included in the Next.js runtime.

Copyright @ BASA
