import { bytesToHex, constantTimeEqual, hexToBytes, pepperPassword } from "./crypto";
import { pbkdf2 } from "node:crypto";

function derivePassword(material: ArrayBuffer, salt: Uint8Array, iterations: number, length: number): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    pbkdf2(new Uint8Array(material), salt, iterations, length, "sha256", (error, key) => error ? reject(error) : resolve(key));
  });
}

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
  if (iterations !== 100_000) throw new Error("Unsupported MVP password work factor");
  if (!pepper) throw new Error("Password pepper is not configured");

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const material = await pepperPassword(password, pepper);
  const derived = await derivePassword(material, salt, iterations, 32);
  return `$pbkdf2-sha256$i=${iterations}$${bytesToHex(salt)}$${bytesToHex(derived)}`;
}

export async function verifyPassword(password: string, encoded: string, pepper: string): Promise<boolean> {
  const match = /^\$pbkdf2-sha256\$i=(\d+)\$([0-9a-f]+)\$([0-9a-f]+)$/i.exec(encoded);
  if (!match) return false;
  const iterations = Number.parseInt(match[1], 10);
  if (iterations !== 100_000) return false;
  if (!pepper) throw new Error("Password pepper is not configured");
  const salt = hexToBytes(match[2]);
  const expected = hexToBytes(match[3]);
  const material = await pepperPassword(password, pepper);
  const actual = await derivePassword(material, salt, iterations, expected.length);
  return constantTimeEqual(actual, expected);
}
