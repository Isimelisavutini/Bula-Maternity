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

Without Redis variables, local development uses in-memory data that resets when the server restarts. Set the variables from `.env.example` to test durable storage locally.

Run the quality checks with:

```bash
npm test
npm run lint
npm run build
```

## Deploying to Vercel

1. Import this GitHub repository into Vercel. Framework detection should select Next.js automatically.
2. In the Vercel project, open **Storage / Marketplace** and create or connect an Upstash Redis database.
3. Confirm the integration provides `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` to the project.
4. Add `SESSION_SECRET` in project environment variables. Generate a long random value; do not commit it.
5. Redeploy the project.

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

Before real-world clinical use, replace the demo identity flow with a managed identity provider and verified staff/patient accounts. Independent security testing, privacy and regulatory review, clinical governance, backups and disaster recovery, retention policies, tamper-evident audit logging, and validated infrastructure are also required.

The former Charming implementation remains in `src/` as migration reference and is not included in the Next.js runtime.

Copyright @ BASA
