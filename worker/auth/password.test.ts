import { describe, expect, it } from "vitest";
import { hashPassword, validatePassword, verifyPassword } from "./password";
describe("password hashing", () => {
  it("enforces the no-MFA length policy without composition rules", () => { expect(validatePassword("short").valid).toBe(false); expect(validatePassword("uma senha longa 🔐").valid).toBe(true); });
  it("stores a salted versioned hash and verifies with the pepper", async () => { const password = "uma senha longa e segura"; const hash = await hashPassword(password, "test-pepper", 600_000); expect(hash).toMatch(/^\$pbkdf2-sha256\$i=600000\$/); expect(hash).not.toContain(password); await expect(verifyPassword(password, hash, "test-pepper")).resolves.toBe(true); await expect(verifyPassword("outra senha muito longa", hash, "test-pepper")).resolves.toBe(false); }, 15_000);
});
