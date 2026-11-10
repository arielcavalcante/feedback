// Uploads the email images to the public R2 bucket that EMAIL_ASSETS_URL points at (ADR-029).
// Usage: pnpm email:assets [--bucket ino-assets] [--prefix email/v1]
// Bump the prefix (v2, v3…) when an image changes: the objects are cached as immutable, and
// EMAIL_ASSETS_URL in wrangler.jsonc must then point at the new prefix.
import { execFileSync } from "node:child_process";
import { readdirSync } from "node:fs";

const arg = (name, fallback) => {
  const index = process.argv.indexOf(`--${name}`);
  return index > -1 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
};
const bucket = arg("bucket", "ino-assets");
const prefix = arg("prefix", "email/v1").replace(/^\/+|\/+$/g, "");
const files = readdirSync("public/assets/email").filter((name) => name.endsWith(".png")).sort();

for (const file of files) {
  const key = `${bucket}/${prefix}/${file}`;
  console.log(`→ ${key}`);
  execFileSync("pnpm", ["exec", "wrangler", "r2", "object", "put", key,
    "--file", `public/assets/email/${file}`,
    "--content-type", "image/png",
    "--cache-control", "public, max-age=31536000, immutable",
    "--remote"], { stdio: "inherit" });
}
console.log(`\nDone. Check: curl -I https://assets.praiasertao.com.br/${prefix}/${files[0]}`);
