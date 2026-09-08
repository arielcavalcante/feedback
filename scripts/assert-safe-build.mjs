import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const forbiddenNames = new Set([".dev.vars", ".env", ".env.local"]);
const forbiddenPatterns = [/PASSWORD_PEPPER\s*=/, /RESEND_API_KEY\s*=/, /BEGIN (?:RSA |EC )?PRIVATE KEY/];
const failures = [];

function walk(directory) {
  for (const name of readdirSync(directory)) {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) walk(path);
    else {
      if (forbiddenNames.has(name)) failures.push(`${relative("dist", path)} has a forbidden secret filename`);
      if (statSync(path).size < 2_000_000) {
        const content = readFileSync(path, "utf8");
        for (const pattern of forbiddenPatterns) if (pattern.test(content)) failures.push(`${relative("dist", path)} matches ${pattern}`);
      }
    }
  }
}

if (!existsSync("dist")) failures.push("dist does not exist");
else walk("dist");
if (failures.length) {
  console.error(`Unsafe build output:\n${failures.map((failure) => `- ${failure}`).join("\n")}`);
  process.exit(1);
}
