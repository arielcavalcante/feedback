import { describe, expect, it } from "vitest";
import { hashPassword, validatePassword, verifyPassword } from "./password";
import { bytesToHex, hexToBytes, pepperPassword } from "./crypto";
describe("password hashing", () => {
  it("preserves the standard Web Crypto PBKDF2 encoding", async () => {
    const password = "compatibility test passphrase";
    const hash = await hashPassword(password, "test-pepper", 100_000);
    const salt = hexToBytes(hash.split("$")[3]);
    const material = await pepperPassword(password, "test-pepper");
    const key = await crypto.subtle.importKey("raw", material, "PBKDF2", false, ["deriveBits"]);
    const expected = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: salt.buffer as ArrayBuffer, iterations: 100_000 }, key, 256);
    expect(hash.split("$")[4]).toBe(bytesToHex(new Uint8Array(expected)));
  });
  it("enforces the no-MFA length policy without composition rules", () => { expect(validatePassword("short").valid).toBe(false); expect(validatePassword("uma senha longa 🔐").valid).toBe(true); });
  it("stores a salted versioned hash and verifies with the pepper", async () => { const password = "uma senha longa e segura"; const hash = await hashPassword(password, "test-pepper", 100_000); expect(hash).toMatch(/^\$pbkdf2-sha256\$i=100000\$/); expect(hash).not.toContain(password); await expect(verifyPassword(password, hash, "test-pepper")).resolves.toBe(true); await expect(verifyPassword("outra senha muito longa", hash, "test-pepper")).resolves.toBe(false); await expect(verifyPassword(password, hash, "wrong-pepper")).resolves.toBe(false); }, 15_000);
  it("rejects missing peppers and unsupported work factors", async () => {
    await expect(hashPassword("test password with length", "", 100_000)).rejects.toThrow("pepper");
    await expect(hashPassword("test password with length", "test-pepper", 600_000)).rejects.toThrow("work factor");
  });
});
