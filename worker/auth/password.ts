import { bytesToHex, constantTimeEqual, hexToBytes, pepperPassword } from "./crypto";

const MIN_LENGTH = 15;
const MAX_LENGTH = 128;
const BLOCKED = new Set(["passwordpassword", "123456789012345", "qwertyqwertyqwerty", "letmeinletmeinletmein"]);

export type PasswordPolicyResult = { valid: true } | { valid: false; message: string };

export function validatePassword(password: string): PasswordPolicyResult {
  const length = Array.from(password).length;
  if (length < MIN_LENGTH) return { valid: false, message: `Use at least ${MIN_LENGTH} characters.` };
  if (length > MAX_LENGTH) return { valid: false, message: `Use no more than ${MAX_LENGTH} characters.` };
  if (BLOCKED.has(password.normalize("NFKC").toLowerCase())) return { valid: false, message: "Choose a less common password." };
  return { valid: true };
}

export async function hashPassword(password: string, pepper: string, iterations: number): Promise<string> {
  const policy = validatePassword(password);
  if (!policy.valid) throw new Error(policy.message);
  if (!Number.isSafeInteger(iterations) || iterations < 600_000) throw new Error("Password work factor is below the approved minimum");

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const material = await pepperPassword(password, pepper);
  const key = await crypto.subtle.importKey("raw", material, "PBKDF2", false, ["deriveBits"]);
  const derived = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, key, 256);
  return `$pbkdf2-sha256$i=${iterations}$${bytesToHex(salt)}$${bytesToHex(new Uint8Array(derived))}`;
}

export async function verifyPassword(password: string, encoded: string, pepper: string): Promise<boolean> {
  const match = /^\$pbkdf2-sha256\$i=(\d+)\$([0-9a-f]+)\$([0-9a-f]+)$/i.exec(encoded);
  if (!match) return false;
  const iterations = Number.parseInt(match[1], 10);
  if (!Number.isSafeInteger(iterations) || iterations < 1 || iterations > 2_000_000) return false;
  const salt = hexToBytes(match[2]);
  const expected = hexToBytes(match[3]);
  const material = await pepperPassword(password, pepper);
  const key = await crypto.subtle.importKey("raw", material, "PBKDF2", false, ["deriveBits"]);
  const actual = new Uint8Array(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: salt.buffer as ArrayBuffer, iterations }, key, expected.length * 8));
  return constantTimeEqual(actual, expected);
}
