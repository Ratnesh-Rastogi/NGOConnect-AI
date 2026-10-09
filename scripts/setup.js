import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";

const root = process.cwd();
const envFile = `${root}/.env`;
if (!existsSync(envFile)) {
  console.error(".env not found. Run: Copy-Item .env.example .env");
  process.exit(1);
}
try {
  loadEnvFile(envFile);
} catch {
  console.error("Could not read .env. Check the file and try again.");
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is missing from .env");
  process.exit(1);
}
if (!process.env.SESSION_SECRET) {
  console.error("SESSION_SECRET is missing from .env");
  process.exit(1);
}

const npm = process.platform === "win32" ? "npm.cmd" : "npm";
function run(args) {
  execFileSync(npm, args, { cwd: root, env: process.env, stdio: "inherit" });
}
console.log("\n[1/2] Preparing PostgreSQL schema...");
run(["run", "db:migrate"]);
console.log("\n[2/2] Seeding demo data...");
run(["run", "seed"]);
console.log("\nSetup complete.");
console.log("Start the backend:  npm run dev:backend");
console.log("Start the frontend: npm run dev:frontend");
