/**
 * Talking to the First Shift server (accounts, saves, menu import).
 *
 * Where the server is:
 * - When the game is opened from the server's website, it's the same address.
 * - Otherwise (the double-click file, or local development) it's the address
 *   set in VITE_SERVER_URL at build time. With neither, online features are off.
 */

const SESSION_KEY = 'first-shift.session';

function serverBase(): string | null {
  const configured = (import.meta.env.VITE_SERVER_URL as string | undefined)?.replace(/\/$/, '');
  if (configured) return configured;
  if (location.protocol.startsWith('http') && !import.meta.env.DEV) return '';
  return null;
}

export interface Session {
  token: string;
  username: string;
}

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

function loadSession(): Session | null {
  try {
    const s = JSON.parse(localStorage.getItem(SESSION_KEY) ?? 'null');
    return s?.token && s?.username ? s : null;
  } catch {
    return null;
  }
}

class Api {
  readonly base = serverBase();
  session: Session | null = loadSession();
  private listeners: (() => void)[] = [];

  /** False when there's no server to talk to (online features are hidden). */
  get available(): boolean {
    return this.base !== null;
  }

  get signedIn(): boolean {
    return !!this.session;
  }

  onChange(fn: () => void): void {
    this.listeners.push(fn);
  }

  private setSession(s: Session | null): void {
    this.session = s;
    try {
      if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s));
      else localStorage.removeItem(SESSION_KEY);
    } catch {
      // Not remembered between visits; still signed in for now.
    }
    for (const fn of this.listeners) fn();
  }

  private async call<T>(method: string, path: string, body?: unknown): Promise<T> {
    if (this.base === null) throw new ApiError('Online features aren’t available in this copy of the game.', 0);
    let res: Response;
    try {
      res = await fetch(`${this.base}/api/${path}`, {
        method,
        headers: { 'Content-Type': 'application/json', ...(this.session ? { Authorization: `Bearer ${this.session.token}` } : {}) },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch {
      throw new ApiError('Couldn’t reach the server. Check your internet connection.', 0);
    }
    const data = (await res.json().catch(() => ({}))) as T & { error?: string };
    if (res.status === 401 && this.session && path !== 'login') this.setSession(null);
    if (!res.ok) throw new ApiError(data.error ?? `The server said no (${res.status}).`, res.status);
    return data;
  }

  async signup(username: string, password: string): Promise<void> {
    this.setSession(await this.call<Session>('POST', 'signup', { username, password }));
  }

  async login(username: string, password: string): Promise<void> {
    this.setSession(await this.call<Session>('POST', 'login', { username, password }));
  }

  async logout(): Promise<void> {
    try {
      await this.call('POST', 'logout');
    } finally {
      this.setSession(null);
    }
  }

  getSave(): Promise<{ data: unknown; updatedAt: number }> {
    return this.call('GET', 'save');
  }

  putSave(data: unknown): Promise<{ updatedAt: number }> {
    return this.call('PUT', 'save', { data });
  }

  importMenu(input: { text?: string; image?: string }): Promise<{ menu: unknown }> {
    return this.call('POST', 'menu-import', input);
  }
}

export const api = new Api();
