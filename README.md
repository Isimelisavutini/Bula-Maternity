# CareFiji — Bula Maternity

A Pacific-inspired digital maternity hospital management prototype for Fiji.

## Prototype capabilities

- Charming-authenticated identity
- Server-enforced role permissions for Administrator, Doctor, Midwife, Receptionist, Finance, and Patient roles
- Synthetic patient registry and appointments
- Validated appointment status transitions
- Draft → Reviewed clinical note workflow
- Maternity ward board
- Billing workflow
- Application audit events
- Pacific Reef responsive UI
- Copyright @ BASA

## Important safety notice

**Synthetic demonstration data only.** This repository and the deployed prototype are not approved for real patient information, clinical decision-making, or production healthcare use.

Before any real-world clinical deployment, independent security testing, privacy and regulatory review, clinical governance, backup/disaster-recovery controls, production infrastructure validation, retention policies, and tamper-evident audit logging would be required.

## Source layout

- `src/backend.js` — Charming manifest, server-side RBAC, persistence, validation, audit and clinical workflow routes.
- `src/ui.js` — browser UI and workflow interactions.
- `src/styles.css` — Pacific Reef design system and responsive styling.

## Deployment

Current prototype platform: Charming.

Copyright @ BASA
