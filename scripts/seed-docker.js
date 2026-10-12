
import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const envFile = `${root}/.env.docker`;

if (!existsSync(envFile)) {
  console.error(".env.docker not found. Run npm run dev once first.");
  process.exit(1);
}

const env = readFileSync(envFile, "utf8");
if (!/^POSTGRES_PASSWORD=.+$/m.test(env) ||
    !/^SESSION_SECRET=.+$/m.test(env)) {
  console.error(".env.docker is missing required values.");
  process.exit(1);
}

const result = spawnSync(
  "docker",
  ["compose", "--env-file", envFile, "run", "--rm", "seed"],
  { cwd: root, stdio: "inherit", shell: false },
);

if (result.error) {
  console.error(`Could not run Docker seed: ${result.error.message}`);
  process.exit(1);
}

process.exit(result.status ?? 1);
