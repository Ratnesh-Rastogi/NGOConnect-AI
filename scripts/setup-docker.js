
import { execFileSync } from "node:child_process";

const npm = process.platform === "win32" ? "npm.cmd" : "npm";

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is missing inside the Docker setup container.");
  process.exit(1);
}

if (!process.env.SESSION_SECRET) {
  console.error("SESSION_SECRET is missing inside the Docker setup container.");
  process.exit(1);
}

function run(args) {
  execFileSync(npm, args, {
    cwd: process.cwd(),
    env: process.env,
    stdio: "inherit",
  });
}

console.log("\nRunning PostgreSQL migrations...");
run(["run", "db:migrate"]);

console.log("\nDocker database migration complete.");
