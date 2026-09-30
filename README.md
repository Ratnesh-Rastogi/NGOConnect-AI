# NGOConnect AI

NGOConnect AI is a full-stack resource coordination workspace for NGOs and donors. It helps organizations list surplus essentials, create and fulfill requests, and review transparent rule-based matches.

## Stack

- React + Vite + JavaScript/TypeScript frontend
- Node.js + Express API
- PostgreSQL + Drizzle ORM
- JWT authentication with bcrypt password hashing
- OpenAPI-first REST contract with generated React Query hooks and Zod schemas

## Run locally

1. Provision PostgreSQL and set `DATABASE_URL`.
2. Set `SESSION_SECRET` to a long random value. See `.env.example`.
3. Install dependencies:

   ```bash
   pnpm install
   ```

4. Apply the current database schema:

   ```bash
   npm run push --workspace=@ngoconnect/db
   ```

5. Seed the repeatable demo dataset:

   ```bash
   npm run seed --workspace=ngo-connect-api
   ```

6. Run the managed API and web workflows from Replit, or run the package commands with `PORT` and `BASE_PATH` configured by the workflow.

Useful checks:

```bash
pnpm run typecheck
npm run test --workspace=ngo-connect-api
pnpm run build
```

## Demo credentials

All demo accounts use `DemoPass123!`.

| Role | Email |
| --- | --- |
| Admin | `admin@ngoconnect.demo` |
| NGO | `ngo1@ngoconnect.demo` |
| NGO | `ngo2@ngoconnect.demo` |
| NGO | `ngo3@ngoconnect.demo` |
| Donor | `donor1@ngoconnect.demo` |
| Donor | `donor2@ngoconnect.demo` |

These are local/demo credentials only. Change them before using a non-demo environment.

## API overview

- `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`
- `GET /api/dashboard`
- `GET/POST /api/resources`, `GET/PATCH/DELETE /api/resources/:id`
- `GET/POST /api/requests`, `GET /api/requests/:id`
- `POST /api/requests/:id/accept`, `/reject`, and `/complete`
- `GET /api/transactions`
- `GET /api/notifications`, `POST /api/notifications/:id/read`
- `GET /api/recommendations`
- `GET /api/admin/stats`, `GET /api/admin/ngos`, `POST /api/admin/ngos/:id/verify`

All protected endpoints require `Authorization: Bearer <jwt>`. Role checks are enforced on the server.

## Recommendation and trust model

Recommendations never use an LLM to decide a match. The deterministic score rewards:

- compatible category or exact resource type: 40 points
- available quantity coverage: 25 points
- exact location match when the stored location strings match: 10 points
- quantity-fit efficiency: up to 20 points
- application-generated NGO trust score: up to 5 points

Missing distance data receives no fabricated distance value. The trust score is based on the NGO verification state and application data available in the database; it is not an official certification.

## Database and seed behavior

The schema is normalized across users, NGOs, resources, resource requests, transactions, and notifications. Foreign keys, enum constraints, unique email indexes, searchable indexes, timestamps, and transaction-safe request acceptance are included.

The seed script checks stable demo identifiers before inserting records, so rerunning it does not duplicate demo users, organizations, or notifications.

## Limitations

- No email, push, maps, payment, or external AI integrations are included.
- Distance scoring is intentionally skipped when reliable coordinates are not stored.
- Donors can browse needs and activity in this first version; payment and donation settlement are out of scope.
