import { progress } from '../progress';
import { api } from './api';

/**
 * Keeps your progress in step with your account. On sign-in it downloads the
 * online save and merges it with this device's; after that, every change is
 * uploaded a couple of seconds later. Offline play keeps working; the next
 * successful sync catches up.
 */
export class Sync {
  status: 'off' | 'syncing' | 'ok' | 'error' = 'off';
  message = '';
  lastSynced = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private applying = false;
  private listeners: (() => void)[] = [];

  constructor() {
    progress.onChange(() => {
      if (!this.applying) this.schedule();
    });
    if (api.signedIn) void this.pullAndMerge();
  }

  onChange(fn: () => void): void {
    this.listeners.push(fn);
  }

  private set(status: Sync['status'], message = ''): void {
    this.status = status;
    this.message = message;
    for (const fn of this.listeners) fn();
  }

  /** Downloads the account's save, merges it in, and uploads the combined result. */
  async pullAndMerge(): Promise<void> {
    if (!api.signedIn) return this.set('off');
    this.set('syncing');
    try {
      const remote = await api.getSave();
      const data = remote.data as { progress?: unknown } | null;
      if (data?.progress) {
        this.applying = true;
        progress.mergeIn(data.progress);
        this.applying = false;
      }
      await this.push();
    } catch (e) {
      this.applying = false;
      this.set('error', (e as Error).message);
    }
  }

  schedule(): void {
    if (!api.signedIn) return;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.push(), 2000);
  }

  async push(): Promise<void> {
    if (!api.signedIn) return this.set('off');
    this.set('syncing');
    try {
      await api.putSave({ progress: progress.export() });
      this.lastSynced = Date.now();
      this.set('ok');
    } catch (e) {
      this.set(api.signedIn ? 'error' : 'off', (e as Error).message);
    }
  }
}
