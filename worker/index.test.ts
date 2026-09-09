import { describe, expect, it } from "vitest";
import worker from "./index";
import type { Env } from "./env";

describe("asynchronous API errors", () => {
  const origin = "https://ino.praiasertao.com.br";
  const env = { APP_ORIGIN: origin } as Env;
  it("returns a JSON 404 for an invalid invitation instead of rejecting the Worker request", async () => {
    const response = await worker.fetch(new Request(`${origin}/api/auth/invitations/resolve`, {
      method: "POST", headers: { Origin: origin, "Content-Type": "application/json" }, body: "{}",
    }), env);
    expect(response.status).toBe(404);
    const body = await response.json() as { error: { code: string } };
    expect(body.error.code).toBe("invitation_unavailable");
  });
  it("returns a JSON 401 when an anonymous caller tries to invite a user", async () => {
    const response = await worker.fetch(new Request(`${origin}/api/admin/invitations`, {
      method: "POST", headers: { Origin: origin, "Content-Type": "application/json" }, body: "{}",
    }), env);
    expect(response.status).toBe(401);
  });
});
