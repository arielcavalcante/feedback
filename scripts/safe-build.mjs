import { execFileSync } from "node:child_process";
import { existsSync, globSync, renameSync, rmSync } from "node:fs";

const localSecrets = ".dev.vars";
const temporarySecrets = ".dev.vars.safe-build-backup";
if (existsSync(temporarySecrets)) throw new Error(`${temporarySecrets} already exists; restore or remove it before building`);
const shouldRestore = existsSync(localSecrets);

try {
  if (shouldRestore) renameSync(localSecrets, temporarySecrets);
  rmSync("dist", { recursive: true, force: true });
  execFileSync("pnpm", ["exec", "vite", "build"], { stdio: "inherit" });
  for (const metadataFile of globSync("dist/**/.DS_Store")) rmSync(metadataFile, { force: true });
  execFileSync("node", ["scripts/assert-safe-build.mjs"], { stdio: "inherit" });
} finally {
  if (shouldRestore && existsSync(temporarySecrets)) renameSync(temporarySecrets, localSecrets);
}
