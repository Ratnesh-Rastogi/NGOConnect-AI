import { execFileSync, spawn } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";

const root = process.cwd();
const envFile = `${root}/.env.docker`;
const image = "ngo-connect-ai:dev";

function run(command, args, options = {}) {
  return execFileSync(command, args, {
    cwd: root,
    stdio: "inherit",
    ...options,
  });
}

function check(command, args) {
  try {
    execFileSync(command, args, { cwd: root, stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

if (!check("docker", ["info"])) {
  console.error("Docker Desktop is not running or Docker is not installed.");
  process.exit(1);
}

if (!check("docker", ["image", "inspect", image])) {
  console.error(`Docker image '${image}' was not found.`);
  console.error("Run this once before npm run dev:");
  console.error("  docker build -t ngo-connect-ai:dev .");
  process.exit(1);
}

if (!existsSync(envFile)) {
  const postgresPassword = randomBytes(24).toString("hex");
  const sessionSecret = randomBytes(64).toString("hex");
  writeFileSync(
    envFile,
    [
      `POSTGRES_PASSWORD=${postgresPassword}`,
      `SESSION_SECRET=${sessionSecret}`,
      "",
    ].join("\n"),
    "utf8",
  );
  console.log("Created .env.docker with fresh local development secrets.");
} else {
  const existing = readFileSync(envFile, "utf8");
  if (!existing.includes("POSTGRES_PASSWORD=") || !existing.includes("SESSION_SECRET=")) {
    console.error(".env.docker exists but is missing required values.");
    process.exit(1);
  }
}

const child = spawn(
  "docker",
  ["compose", "--env-file", envFile, "up"],
  {
    cwd: root,
    stdio: "inherit",
    shell: false,
  },
);

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
  }
  process.exit(code ?? 1);
});

child.on("error", (error) => {
  console.error(`Could not start Docker Compose: ${error.message}`);
  process.exit(1);
});
