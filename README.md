# NGOConnect AI

A full-stack resource coordination platform that helps NGOs and donors coordinate surplus resources, manage requests, track transactions, and discover potential resource matches.

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Getting Started with Docker](#getting-started-with-docker)
- [Database Workflow](#database-workflow)
- [Manual Local Setup](#manual-local-setup)
- [Demo Accounts](#demo-accounts)
- [Useful Commands](#useful-commands)
- [Troubleshooting](#troubleshooting)
- [Security Notes](#security-notes)

## Overview

NGOConnect AI is designed to improve coordination between NGOs and donors by providing a centralized platform for resource listings, resource requests, transactions, notifications, and administrative verification workflows.

The application uses a React frontend, an Express backend, and PostgreSQL for persistent data storage. Docker Compose provides a consistent local development environment.

## Features

- **Authentication:** User registration, login, and JWT-based authentication.
- **Resource Management:** Create and manage resource listings and availability.
- **Request Management:** Submit and manage requests for resources.
- **Transaction Tracking:** Track accepted requests and associated transactions.
- **Recommended Matches:** Discover potential matches between resource requests and available resources.
- **Notifications:** Receive notifications about relevant platform activity.
- **NGO Verification:** Track NGO verification status through administrative workflows.
- **Containerized Development:** Run the frontend, backend, and database using Docker Compose.

## Tech Stack

| Layer | Technologies |
|---|---|
| Frontend | React, Vite, JavaScript, JSX, Tailwind CSS |
| Backend | Node.js, Express.js, JavaScript |
| Authentication | JWT, bcrypt |
| Database | PostgreSQL |
| Database Access | `pg` (node-postgres), parameterized SQL |
| API | REST, OpenAPI, Zod |
| Data Fetching | React Query |
| Development Environment | Docker, Docker Compose |
| Package Management | npm workspaces |

## Architecture

```text
                 React + Vite
                 localhost:5173
                       |
                       | REST API
                       v
                Express Backend
                 localhost:3000
                       |
                       | PostgreSQL
                       v
                PostgreSQL Database
                 localhost:5433
```

The frontend communicates with the backend through REST API endpoints. The backend handles application logic, authentication, authorization, and database operations.

The shared database package provides PostgreSQL connection and query helpers. SQL migrations maintain the database schema.

## Project Structure

```text
NGOConnect-AI/
├── backend/
│   └── src/
│       ├── middleware/       # Authentication and authorization
│       ├── routes/           # API routes
│       ├── utils/            # Shared backend utilities
│       ├── app.js            # Express application
│       ├── index.js          # Backend entry point
│       └── seed.js           # Demo data seeding
├── frontend/
│   └── src/
│       ├── components/       # Reusable UI components
│       ├── hooks/            # Custom React hooks
│       ├── lib/              # Frontend utilities
│       ├── pages/            # Application pages
│       ├── App.jsx
│       └── main.jsx
├── shared/
│   ├── api-client-react/     # React API client
│   ├── api-spec/             # OpenAPI specification
│   ├── api-zod/              # Zod validators
│   └── db/
│       ├── schema.sql        # Database schema
│       └── src/
│           ├── index.js      # Database helpers
│           └── migrate.js    # Schema migration entry point
├── scripts/
│   ├── dev-docker.js         # Docker development launcher
│   ├── setup-docker.js       # Docker database migration step
│   ├── seed-docker.js        # Explicit Docker seeding command
│   └── setup.js              # Local setup script
├── Dockerfile
├── compose.yaml
├── package.json
├── package-lock.json
└── .env.example
```

## Prerequisites

For the recommended Docker setup, install:

- [Git](https://git-scm.com/)
- [Node.js 22 or later](https://nodejs.org/)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/)

npm is included with Node.js. PostgreSQL does not need to be installed locally when using Docker.

Verify your installation:

```powershell
git --version
node -v
npm -v
docker --version
docker compose version
```

## Getting Started with Docker

### 1. Clone the repository

```powershell
git clone https://github.com/Ratnesh-Rastogi/NGOConnect-AI.git
cd NGOConnect-AI
```

### 2. Build the development image

Build the image before the first startup:

```powershell
npm run docker:build
```

Rebuild it when dependencies, the Dockerfile, or other image-build inputs change.

### 3. Start the application

```powershell
npm run dev
```

The development launcher creates `.env.docker` with local development secrets if the file does not exist, then starts Docker Compose.

The startup workflow:

1. Starts PostgreSQL and waits for its health check.
2. Runs the database migration step.
3. Starts the backend after the migration step succeeds.
4. Starts the frontend.

**Demo data is not automatically seeded during normal startup.** Use the separate seeding command in the Database Workflow section when demo data is needed.

### 4. Open the application

| Service | URL |
|---|---|
| Frontend | http://localhost:5173 |
| Backend health check | http://localhost:3000/api/healthz |
| PostgreSQL from the host | `localhost:5433` |

Keep the terminal running while using the application. Press `Ctrl+C` to stop the attached development session.

### 5. Daily development

After the image has been built, start the environment with:

```powershell
npm run dev
```

If you change dependencies or Docker image configuration, rebuild first:

```powershell
npm run docker:build
npm run dev
```

Source files mounted through Compose are available to the running development containers, so ordinary source changes generally do not require rebuilding the image.

## Database Workflow

NGOConnect AI separates schema migrations from demo data seeding.

### Run migrations

The Docker startup workflow runs the migration step automatically. To invoke the existing migration command directly in a compatible local environment, use:

```powershell
npm run db:migrate
```

The migration logic is located in `shared/db/src/migrate.js`, and the database schema is defined in `shared/db/schema.sql`.

### Seed demo data in Docker

To insert demo accounts and sample resources, requests, transactions, and notifications, run:

```powershell
npm run db:seed:docker
```

Run this command only when you want demo data. It uses the Docker database and does not require you to expose the database password in the command line.

The seed script checks for existing records in several places, but repeated runs are not guaranteed to leave every record unchanged. In particular, sample transaction setup can affect resource quantities.

### Stop the development containers

To stop and remove the Compose containers while preserving the database volume:

```powershell
docker compose --env-file .env.docker down
```

### Reset the local database

**Warning: This permanently deletes the PostgreSQL data stored in the Compose-managed volumes.** Do not run this command if you need to preserve existing records.

```powershell
docker compose --env-file .env.docker down -v
```

After a reset, run `npm run dev` to recreate the database schema. Run `npm run db:seed:docker` separately if you also want demo data.

## Manual Local Setup

Use this workflow only when running the backend and frontend directly on your computer instead of through Docker.

### 1. Install PostgreSQL

Install and start PostgreSQL, then create a database named `ngoconnect`.

### 2. Install dependencies

From the repository root:

```powershell
npm ci
```

### 3. Configure environment variables

Create a local environment file:

```powershell
Copy-Item .env.example .env
```

Update `.env` with the connection details for your local PostgreSQL instance and a secure development session secret.

You can generate a random secret with:

```powershell
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

Example configuration:

```env
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/ngoconnect
SESSION_SECRET=YOUR_GENERATED_SECRET
NODE_ENV=development
PORT=3000
```

Replace the example values with your actual local configuration. Never commit real secrets.

### 4. Prepare the database

```powershell
npm run db:migrate
```

Seed sample records only if needed:

```powershell
npm run seed
```

### 5. Start the backend

In Terminal 1:

```powershell
npm run dev:backend
```

### 6. Start the frontend

In Terminal 2:

```powershell
npm run dev:frontend
```

Open http://localhost:5173.

## Demo Accounts

The development seed script defines these demo accounts:

| Role | Email |
|---|---|
| Administrator | `admin@ngoconnect.demo` |
| NGO | `ngo1@ngoconnect.demo` |
| NGO | `ngo2@ngoconnect.demo` |
| NGO | `ngo3@ngoconnect.demo` |
| Donor | `donor1@ngoconnect.demo` |
| Donor | `donor2@ngoconnect.demo` |

The current demo password is defined in `backend/src/seed.js`. These accounts are intended for local development only.

Do not use demo credentials or seed data in a production environment.

## Useful Commands

| Command | Purpose |
|---|---|
| `npm ci` | Install dependencies from the lockfile |
| `npm run docker:build` | Build the Docker development image |
| `npm run dev` | Start the Docker development environment |
| `npm run db:migrate` | Run database migrations |
| `npm run db:seed:docker` | Explicitly seed demo data in Docker |
| `npm run seed` | Seed data using the local backend workspace configuration |
| `npm run build` | Build available workspaces |
| `npm run dev:backend` | Run the backend locally |
| `npm run dev:frontend` | Run the frontend locally |
| `npm test --workspace=ngo-connect-api` | Run the backend test script |

## Troubleshooting

### Docker Desktop is not running

Start Docker Desktop and wait until its engine is ready. Then retry:

```powershell
npm run dev
```

### The Docker image is missing or outdated

Rebuild it:

```powershell
npm run docker:build
```

### The database is not ready

Check the Compose services:

```powershell
docker compose --env-file .env.docker ps
```

Inspect database logs:

```powershell
docker compose --env-file .env.docker logs db
```

### The backend fails to start

Inspect the backend logs:

```powershell
docker compose --env-file .env.docker logs backend
```

Check the setup logs:

```powershell
docker compose --env-file .env.docker logs setup
```

### Demo data is missing

Starting the application does not seed demo data. Run:

```powershell
npm run db:seed:docker
```

### The `.env` file warning appears in Docker logs

The local and Docker environment files are separate. The Docker setup supplies the database connection through the container environment. A message about a missing optional `.env` file does not necessarily mean the migration or seed operation failed; check the command's final exit status and output.

## Security Notes

- Never commit `.env`, `.env.docker`, passwords, API keys, or session secrets.
- Use `.env.example` for placeholder configuration only.
- Demo accounts and sample data are for local development only.
- Keep database credentials out of source code and shell history.
- Use parameterized SQL queries for database operations.
- Do not use development secrets or demo credentials for a production deployment.

## Contributing

1. Create a branch for your changes.
2. Keep changes focused and consistent with the existing project structure.
3. Run the relevant checks before submitting changes.
4. Update this README when setup commands, architecture, or development workflows change.

---

**NGOConnect AI** — connecting community needs with available resources.
