import { execFileSync } from "node:child_process";
import { createHash, randomBytes, randomUUID } from "node:crypto";

// Operator-only bridge to the existing invitation API. No raw token is printed
// or persisted; the five-minute session is revoked even when delivery fails.
const email = process.argv[2]?.trim().toLowerCase();
if (!email || !/^.+@.+\..+$/.test(email)) throw new Error("Usage: node scripts/send-bootstrap-invite.mjs admin@example.com");
const quote = (value) => `'${String(value).replaceAll("'", "''")}'`;
function query(sql) {
  const output = execFileSync("pnpm", ["exec", "wrangler", "d1", "execute", "feedback", "--remote", "--json", "--command", sql], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  return JSON.parse(output)[0].results;
}
const [user] = query(`SELECT u.id, u.display_name FROM users u WHERE u.email = ${quote(email)} AND u.is_active = 1 AND EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = u.id AND ur.revoked_at IS NULL AND r.key = 'admin') AND NOT EXISTS (SELECT 1 FROM auth_credentials c WHERE c.user_id = u.id)`);
if (!user) throw new Error("Expected an active bootstrap administrator without a password.");
const sessionId = randomUUID();
const token = randomBytes(32).toString("base64url");
const digest = createHash("sha256").update(token).digest("hex");
const now = new Date().toISOString();
const expires = new Date(Date.now() + 300_000).toISOString();
query(`INSERT INTO auth_sessions (id,user_id,token_digest,created_at,last_seen_at,expires_at,idle_expires_at) VALUES (${quote(sessionId)},${quote(user.id)},${quote(digest)},${quote(now)},${quote(now)},${quote(expires)},${quote(expires)})`);
try {
  const response = await fetch("https://ino.praiasertao.com.br/api/admin/invitations", {
    method: "POST",
    redirect: "error",
    signal: AbortSignal.timeout(30_000),
    headers: { Origin: "https://ino.praiasertao.com.br", "Content-Type": "application/json", Cookie: `feedback_session=${token}` },
    body: JSON.stringify({ email, displayName: user.display_name, roles: ["admin"] }),
  });
  if (response.status !== 201) throw new Error(`Invitation delivery failed with HTTP ${response.status}; inspect sanitized Worker errors before retrying.`);
  console.log("Bootstrap invitation accepted by the email provider.");
} finally {
  query(`UPDATE auth_sessions SET revoked_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ${quote(sessionId)}; INSERT INTO audit_logs (id,occurred_at,actor_user_id,action,resource_type,resource_id,outcome) VALUES (${quote(randomUUID())},strftime('%Y-%m-%dT%H:%M:%fZ','now'),${quote(user.id)},'account.bootstrap_session_revoked','session',${quote(sessionId)},'success')`);
  console.log("Operator session revoked.");
}
