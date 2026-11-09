/**
 * First Shift online server (Cloudflare Worker).
 *
 * Serves the game itself (the built dist/ folder) and a small JSON API:
 *   POST /api/signup   {username, password}  -> {token, username}
 *   POST /api/login    {username, password}  -> {token, username}
 *   POST /api/logout
 *   GET  /api/me                             -> {username}
 *   GET  /api/save                           -> {data, updatedAt}
 *   PUT  /api/save     {data}                -> {updatedAt}
 *   POST /api/menu-import {text} or {image}  -> {menu}
 * Sign-in uses a bearer token (Authorization header), not cookies.
 */
import { checkCredentials, hashPassword, newToken, randomHex, safeEqual, sha256 } from './auth';
import { MENU_SCHEMA, menuPrompt, normalizeMenu } from './menuImport';
// The single-file game (built by `npm run build:file`).
import GAME_HTML from '../../play/First-Shift.html';

export interface Env {
  DB: D1Database;
  AI?: Ai;
  ASSETS?: Fetcher;
  /** Imports allowed per player per day (keeps usage inside the free AI allowance). */
  DAILY_IMPORTS?: string;
}

const SESSION_DAYS = 60;
const MAX_SAVE_BYTES = 300_000;
const MAX_IMAGE_BYTES = 4_000_000;
const TEXT_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
const VISION_MODEL = '@cf/meta/llama-3.2-11b-vision-instruct';

const CORS = {
  // Tokens travel in a header (no cookies), so allowing any origin is safe and
  // lets the double-click version of the game sign in too.
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...CORS } });
const fail = (message: string, status = 400) => json({ error: message }, status);

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) {
      if (env.ASSETS) return env.ASSETS.fetch(request);
      if (url.pathname === '/' || url.pathname === '/index.html') {
        return new Response(GAME_HTML, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' } });
      }
      return new Response('Not found', { status: 404 });
    }
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    try {
      return await route(request, env, url.pathname.slice(5));
    } catch (e) {
      console.error(e);
      return fail('Something went wrong on the server. Please try again.', 500);
    }
  },
};

async function route(req: Request, env: Env, path: string): Promise<Response> {
  const m = req.method;
  if (path === 'signup' && m === 'POST') return signup(req, env);
  if (path === 'login' && m === 'POST') return login(req, env);
  const user = await authenticate(req, env);
  if (!user) return fail('Please sign in again.', 401);
  if (path === 'logout' && m === 'POST') {
    await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(user.tokenHash).run();
    return json({ ok: true });
  }
  if (path === 'me' && m === 'GET') return json({ username: user.username });
  if (path === 'save' && m === 'GET') {
    const row = await env.DB.prepare('SELECT data, updated_at FROM saves WHERE user_id = ?').bind(user.id).first<{ data: string; updated_at: number }>();
    return json(row ? { data: JSON.parse(row.data), updatedAt: row.updated_at } : { data: null, updatedAt: 0 });
  }
  if (path === 'save' && m === 'PUT') {
    const text = await req.text();
    if (text.length > MAX_SAVE_BYTES) return fail('Your save is too large to store.', 413);
    const body = parse(text) as { data?: unknown } | null;
    if (!body || typeof body.data !== 'object' || body.data === null) return fail('Missing save data.');
    const now = Date.now();
    await env.DB.prepare('INSERT INTO saves (user_id, data, updated_at) VALUES (?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at')
      .bind(user.id, JSON.stringify(body.data), now)
      .run();
    return json({ updatedAt: now });
  }
  if (path === 'menu-import' && m === 'POST') return importMenu(req, env, user.id);
  return fail('Not found.', 404);
}

const parse = (text: string): unknown => {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

async function startSession(env: Env, userId: number, username: string): Promise<Response> {
  const { token, hash } = await newToken();
  const expires = Date.now() + SESSION_DAYS * 86_400_000;
  await env.DB.batch([
    env.DB.prepare('DELETE FROM sessions WHERE user_id = ? AND expires_at < ?').bind(userId, Date.now()),
    env.DB.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)').bind(hash, userId, expires),
  ]);
  return json({ token, username });
}

async function signup(req: Request, env: Env): Promise<Response> {
  const body = parse(await req.text()) as { username?: unknown; password?: unknown } | null;
  const problem = checkCredentials(body?.username, body?.password);
  if (problem) return fail(problem);
  const username = String(body!.username);
  const exists = await env.DB.prepare('SELECT 1 FROM users WHERE username = ?').bind(username).first();
  if (exists) return fail('That username is taken. Try another one.', 409);
  const salt = randomHex(16);
  const hash = await hashPassword(String(body!.password), salt);
  const res = await env.DB.prepare('INSERT INTO users (username, pass_hash, salt, created_at) VALUES (?, ?, ?, ?)').bind(username, hash, salt, Date.now()).run();
  return startSession(env, Number(res.meta.last_row_id), username);
}

async function login(req: Request, env: Env): Promise<Response> {
  const body = parse(await req.text()) as { username?: unknown; password?: unknown } | null;
  const wrong = () => fail('Wrong username or password.', 401);
  if (typeof body?.username !== 'string' || typeof body?.password !== 'string') return wrong();
  const user = await env.DB.prepare('SELECT id, username, pass_hash, salt, failed_logins, locked_until FROM users WHERE username = ?')
    .bind(body.username)
    .first<{ id: number; username: string; pass_hash: string; salt: string; failed_logins: number; locked_until: number }>();
  if (!user) {
    await hashPassword(body.password, '00'.repeat(16)); // same timing as a real check
    return wrong();
  }
  if (user.locked_until > Date.now()) return fail('Too many wrong passwords. Try again in 15 minutes.', 429);
  const ok = safeEqual(await hashPassword(body.password, user.salt), user.pass_hash);
  if (!ok) {
    const fails = user.failed_logins + 1;
    const lock = fails >= 10 ? Date.now() + 15 * 60_000 : 0;
    await env.DB.prepare('UPDATE users SET failed_logins = ?, locked_until = ? WHERE id = ?').bind(lock ? 0 : fails, lock, user.id).run();
    return wrong();
  }
  await env.DB.prepare('UPDATE users SET failed_logins = 0, locked_until = 0 WHERE id = ?').bind(user.id).run();
  return startSession(env, user.id, user.username);
}

async function authenticate(req: Request, env: Env): Promise<{ id: number; username: string; tokenHash: string } | null> {
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!/^[0-9a-f]{64}$/.test(token)) return null;
  const tokenHash = await sha256(token);
  const row = await env.DB.prepare('SELECT u.id, u.username, s.expires_at FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ?')
    .bind(tokenHash)
    .first<{ id: number; username: string; expires_at: number }>();
  if (!row || row.expires_at < Date.now()) return null;
  return { id: row.id, username: row.username, tokenHash };
}

async function importMenu(req: Request, env: Env, userId: number): Promise<Response> {
  if (!env.AI) return fail('Menu import isn’t set up on this server yet.', 503);
  const text = await req.text();
  if (text.length > MAX_IMAGE_BYTES * 1.4) return fail('That photo is too large. Try a smaller one.', 413);
  const body = parse(text) as { text?: unknown; image?: unknown } | null;
  const day = new Date().toISOString().slice(0, 10);
  const limit = Number(env.DAILY_IMPORTS ?? 10);
  const used = await env.DB.prepare('SELECT imports FROM usage WHERE user_id = ? AND day = ?').bind(userId, day).first<{ imports: number }>();
  if ((used?.imports ?? 0) >= limit) return fail(`You've imported ${limit} menus today. Try again tomorrow.`, 429);

  let menuText = typeof body?.text === 'string' ? body.text.trim() : '';
  if (!menuText && typeof body?.image === 'string') {
    const match = body.image.match(/^data:image\/(png|jpe?g|webp);base64,([A-Za-z0-9+/=]+)$/);
    if (!match) return fail('Please use a JPG, PNG or WebP photo.');
    menuText = await readPhoto(env.AI, match[2]);
  }
  if (menuText.length < 20) return fail('Paste the menu text or add a photo of the menu first.');

  await env.DB.prepare('INSERT INTO usage (user_id, day, imports) VALUES (?, ?, 1) ON CONFLICT(user_id, day) DO UPDATE SET imports = imports + 1').bind(userId, day).run();
  const out = (await env.AI.run(TEXT_MODEL as never, {
    messages: [{ role: 'user', content: menuPrompt(menuText) }],
    response_format: { type: 'json_schema', json_schema: MENU_SCHEMA },
    max_tokens: 6000,
  } as never)) as { response?: unknown };
  const result = normalizeMenu(out?.response);
  return 'error' in result ? fail(result.error, 422) : json(result);
}

/** Transcribes a menu photo with the vision model. */
async function readPhoto(ai: Ai, base64: string): Promise<string> {
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const run = () =>
    ai.run(VISION_MODEL as never, {
      prompt: 'Transcribe this restaurant menu: every dish and drink with its description and price, one per line. Text only.',
      image: [...bytes],
      max_tokens: 2048,
    } as never) as Promise<{ response?: string }>;
  try {
    return (await run()).response ?? '';
  } catch (e) {
    // This model needs its licence accepted once per Cloudflare account.
    if (String((e as Error)?.message).toLowerCase().includes('agree')) {
      await ai.run(VISION_MODEL as never, { prompt: 'agree' } as never);
      return (await run()).response ?? '';
    }
    throw e;
  }
}
