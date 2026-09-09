import { execFileSync } from "node:child_process";
import { createHash, randomBytes, randomUUID } from "node:crypto";

const [emailInput, ...nameParts] = process.argv.slice(2).filter((arg) => arg !== "--remote");
const remote = process.argv.includes("--remote");
const email = emailInput?.trim().toLowerCase();
const displayName = nameParts.join(" ").trim();
if (!email || !/^.+@.+\..+$/.test(email) || displayName.length < 2) {
  console.error("Usage: pnpm admin:bootstrap -- user@example.com 'Display Name' [--remote]");
  process.exit(1);
}

const token = randomBytes(32).toString("base64url");
const digest = createHash("sha256").update(token).digest("hex");
const userId = randomUUID();
const invitationId = randomUUID();
const now = new Date();
const expiresAt = new Date(now.getTime() + 48 * 3_600_000).toISOString();
const quote = (value) => `'${String(value).replaceAll("'", "''")}'`;
const sql = `
INSERT INTO users (id, email, display_name, is_active, created_at, updated_at)
VALUES (${quote(userId)}, ${quote(email)}, ${quote(displayName)}, 1, ${quote(now.toISOString())}, ${quote(now.toISOString())});
INSERT INTO user_roles (user_id, role_id, granted_at)
SELECT ${quote(userId)}, id, ${quote(now.toISOString())} FROM roles WHERE key = 'admin';
INSERT INTO account_invitations (id, user_id, email_snapshot, token_digest, expires_at, created_at)
VALUES (${quote(invitationId)}, ${quote(userId)}, ${quote(email)}, ${quote(digest)}, ${quote(expiresAt)}, ${quote(now.toISOString())});
`;

execFileSync("pnpm", ["exec", "wrangler", "d1", "execute", "feedback", remote ? "--remote" : "--local", "--command", sql], { stdio: "inherit" });
console.log("\nOpen this one-time invitation link privately. It is shown only once:\n");
console.log(`https://ino.praiasertao.com.br/accept-invite#token=${token}`);
console.log(`\nExpires: ${expiresAt}`);
