import { spawnSync } from "node:child_process";

const binSuffix = process.platform === "win32" ? ".cmd" : "";
const env = { ...process.env, NODE_ENV: "production" };

function run(command, args) {
  const result = spawnSync(`${command}${binSuffix}`, args, {
    env,
    stdio: "inherit",
  });

  if (result.error) {
    console.error(result.error);
    process.exit(1);
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

run("prisma", ["generate"]);
run("next", ["build"]);
