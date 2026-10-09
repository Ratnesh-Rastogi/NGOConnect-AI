# NGOConnect AI

NGOConnect AI is a full-stack resource coordination platform for NGOs and donors. It helps organizations manage surplus resources, create and fulfill requests, track transactions, receive notifications, and connect needs with suitable resources.

## Tech Stack

- **Frontend:** React, Vite, JavaScript, JSX, Tailwind CSS
- **Backend:** Node.js, Express.js, JavaScript, JWT, bcrypt
- **Database:** PostgreSQL
- **Database driver:** `pg` (node-postgres), using parameterized SQL
- **API:** REST, OpenAPI, Zod, React Query
- **Containers:** Docker and Docker Compose

## Project Structure

```text
NGOConnect-AI/
├── backend/
│   └── src/
│       ├── middleware/       # Authentication and authorization
│       ├── routes/           # Feature-specific REST endpoints
│       ├── utils/             # JWT, password hashing, logging
│       ├── app.js             # Express app and middleware
│       ├── index.js           # Backend entry point
│       └── seed.js            # Idempotent demo data seeding
├── frontend/
│   └── src/
│       ├── components/        # Shared UI pieces
│       ├── hooks/             # Reusable React hooks
│       ├── lib/               # Frontend utilities
│       ├── pages/             # Application screens
│       ├── App.jsx
│       └── main.jsx
├── shared/
│   ├── api-client-react/      # Generated React API client
│   ├── api-spec/             # OpenAPI definition
│   ├── api-zod/              # Zod request/response validators
│   └── db/
│       ├── schema.sql        # PostgreSQL tables, enums, indexes
│       └── src/              # PostgreSQL connection/query helpers
├── scripts/
│   ├── dev-docker.js
│   ├── setup-docker.js
│   └── setup.js
├── Dockerfile
├── compose.yaml
├── .env.example
├── package.json
└── package-lock.json
```

## Requirements

For the simplest setup, install:

- Docker Desktop (Docker Engine and Docker Compose)
- Node.js 22.18 or later
- npm (included with Node.js)
- Git

You do **not** need to install PostgreSQL locally. Docker runs PostgreSQL for the project.

Check the tools:

```powershell
docker --version
docker compose version
node -v
npm -v
```

## Recommended Setup: Docker

Docker gives developers the same PostgreSQL and Node.js runtime environment. The setup service prepares the schema and seeds demo data automatically.

### 1. Clone the repository

```powershell
git clone https://github.com/Ratnesh-Rastogi/NGOConnect-AI.git
cd NGOConnect-AI
```

### 2. Build the Docker image (first time, or after dependency/config changes)

```powershell
docker build -t ngo-connect-ai:dev .
```

### 3. Start everything

```powershell
npm run dev
```

On first startup, the helper creates `.env.docker` with random local-development secrets, then Docker Compose:

1. Starts PostgreSQL and waits for its health check.
2. Creates or updates the database schema from `shared/db/schema.sql`.
3. Inserts demo data (without duplicating existing seed records).
4. Starts the Express backend.
5. Starts the React/Vite frontend.

Open:

- Frontend: <http://localhost:5173>
- Backend health check: <http://localhost:3000/api/healthz>
- PostgreSQL from the host, if needed: `localhost:5433`

Keep the terminal running while you use the website. Press `Ctrl+C` to stop the attached services.

### Normal daily development

After the image has been built, run only:

```powershell
npm run dev
```

If `package.json`, `package-lock.json`, `Dockerfile`, or OS-level dependencies change, rebuild the image first:

```powershell
docker build -t ngo-connect-ai:dev .
npm run dev
```

### Stop/reset Docker services

Stop containers but preserve the database volume:

```powershell
docker compose --env-file .env.docker down
```

Completely reset the local Docker database (this deletes its stored data):

```powershell
docker compose --env-file .env.docker down -v
```

The next `npm run dev` will recreate the schema and seed demo records.

## Manual Local Setup (without Docker)

Use this only if you want to run PostgreSQL and Node.js directly on your machine.

1. Install and start PostgreSQL; create a database named `ngoconnect`.
2. Install project dependencies:

```powershell
npm ci
```

3. Create your environment file:

```powershell
Copy-Item .env.example .env
```

4. Edit `.env` and set your database connection string. Generate a session secret with:

```powershell
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

Set the generated output as `SESSION_SECRET`. Example `.env` shape:

```env
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/ngoconnect
SESSION_SECRET=PASTE_YOUR_RANDOM_SECRET_HERE
NODE_ENV=development
PORT=3000
```

5. Create/update tables and indexes, then insert demo data:

```powershell
npm run db:migrate
npm run seed
```

6. Start the backend in Terminal 1:

```powershell
npm run dev:backend
```

7. Start the frontend in Terminal 2:

```powershell
npm run dev:frontend
```

Open <http://localhost:5173>.

## Database

The database layer uses `pg` directly—there is no ORM. All application SQL runs through a shared PostgreSQL connection pool and uses parameterized query values.

The schema lives in `shared/db/schema.sql`. Running `npm run db:migrate` applies this idempotent SQL schema. This command creates required PostgreSQL enums, tables, indexes and the foreign key used by NGO verification metadata; it also adds missing NGO verification columns to an older compatible database.

Main tables:

- `users`
- `ngos`
- `resources`
- `resource_requests`
- `transactions`
- `notifications`

## Main Features

- NGO registration and login
- Resource listings and availability
- NGO resource requests
- Request acceptance/rejection and transaction tracking
- Rule-based recommended matches
- Notifications and read status
- Admin dashboard and NGO verification status

## Demo Accounts

Seeded development accounts:

```text
admin@ngoconnect.demo
ngo1@ngoconnect.demo
ngo2@ngoconnect.demo
ngo3@ngoconnect.demo
donor1@ngoconnect.demo
donor2@ngoconnect.demo
```

The demo password is defined in `backend/src/seed.js` (`DemoPass123!`). These accounts are for local development only; do not use them in production.

## Useful Commands

```powershell
npm ci
npm run db:migrate
npm run seed
npm run build
npm run dev:backend
npm run dev:frontend
npm test --workspace=ngo-connect-api
```

For Docker-based development, the main commands are:

```powershell
docker build -t ngo-connect-ai:dev .
npm run dev
```

## Security

- `.env` and `.env.docker` are ignored by Git.
- Never commit database passwords, session secrets, JWT secrets, or API keys.
- SQL query values are passed as parameters rather than concatenated into SQL strings.
- Docker-generated secrets are intended only for local development.
