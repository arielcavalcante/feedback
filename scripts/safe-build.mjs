import { execFileSync } from "node:child_process";
import { existsSync, renameSync } from "node:fs";

const localSecrets = ".dev.vars";
const temporarySecrets = ".dev.vars.safe-build-backup";
if (existsSync(temporarySecrets)) throw new Error(`${temporarySecrets} already exists; restore or remove it before building`);
const shouldRestore = existsSync(localSecrets);

try {
  if (shouldRestore) renameSync(localSecrets, temporarySecrets);
  execFileSync("pnpm", ["exec", "vite", "build"], { stdio: "inherit" });
  execFileSync("node", ["scripts/assert-safe-build.mjs"], { stdio: "inherit" });
} finally {
  if (shouldRestore && existsSync(temporarySecrets)) renameSync(temporarySecrets, localSecrets);
}
