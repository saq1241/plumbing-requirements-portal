# Plumbing Requirements Portal

A private, mobile-first requirements-gathering portal for Qontrac Industries. It gathers requirements for a future Android application for a wholesale plumbing materials business; it is not the ecommerce application itself.

## Getting started

Install the locked dependencies and run the development server:

```bash
npm install
npm run dev
```

Open `http://localhost:3000`. The interactive questionnaire is available at `/preview` in development only. It uses in-memory state; answers are not saved to a server and are cleared on refresh or when leaving the page.

## Source of truth

`requirements_form_spec.yaml` is the canonical questionnaire definition. It contains 16 sections and 86 unique question definitions. Applicable path counts are T1 49, T2 78, T3 85; A1 `Not sure` uses the YAML fallback to T2. Do not duplicate question content in application code.

## Current implementation

- Qontrac welcome and preparation screens.
- YAML-driven development questionnaire with tier selection, notes, recommendations, wireframe examples, progress, review, and local completion actions.
- Generic unavailable response at `/q/[token]`; private-token loading and persistence are not implemented.
- Typed Supabase browser/server clients, database types, token hash helpers, and an admin-session helper exist, but no questionnaire persistence or admin route uses them yet.

See [the client portal guide](docs/client-portal.md), [architecture](docs/architecture.md), [questionnaire model](docs/questionnaire-model.md), and [database notes](docs/database.md) for implementation status and constraints.

## Commands

```bash
npm run dev
npm test
npx tsc --noEmit
npm run lint
npm run build
npm run start
```

The test command runs questionnaire domain tests using Node's TypeScript type stripping. No end-to-end browser suite is configured.

## Environment

`.env.local` is Git-ignored. The current client factories require `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Never place a service-role or secret key in a `NEXT_PUBLIC_` variable or browser code.
