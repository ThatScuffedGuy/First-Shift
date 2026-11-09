/**
 * Password hashing and session tokens, using the Web Crypto API built into
 * Cloudflare Workers (and Node, for tests).
 */

const enc = new TextEncoder();
/** PBKDF2 rounds. 100,000 is the maximum Cloudflare Workers allows. */
const ITERATIONS = 100_000;

const toHex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');

export function randomHex(bytes: number): string {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return toHex(a.buffer);
}

/** Scrambles a password with a per-user salt (PBKDF2-SHA256). */
export async function hashPassword(password: string, saltHex: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const salt = new Uint8Array(saltHex.match(/../g)!.map((h) => parseInt(h, 16)));
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: ITERATIONS }, key, 256);
  return toHex(bits);
}

/** Compares two strings in constant time, so timing doesn't leak how much matched. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function sha256(text: string): Promise<string> {
  return toHex(await crypto.subtle.digest('SHA-256', enc.encode(text)));
}

/** A new random session token (sent to the player) and its hash (stored). */
export async function newToken(): Promise<{ token: string; hash: string }> {
  const token = randomHex(32);
  return { token, hash: await sha256(token) };
}

export const USERNAME_RULE = /^[a-zA-Z0-9_]{3,20}$/;

export function checkCredentials(username: unknown, password: unknown): string | null {
  if (typeof username !== 'string' || !USERNAME_RULE.test(username)) return 'Usernames are 3 to 20 letters, numbers or underscores.';
  if (typeof password !== 'string' || password.length < 8) return 'Passwords need at least 8 characters.';
  if (password.length > 200) return 'That password is too long.';
  return null;
}
