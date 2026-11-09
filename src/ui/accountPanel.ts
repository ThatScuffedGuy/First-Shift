import { api } from '../online/api';
import type { Sync } from '../online/sync';
import { createPanel, el, esc } from './dom';
import type { Panels } from './panels';

/** Sign in, create an account, sync and sign out. */
export class AccountPanel {
  private overlay: HTMLElement;
  private body: HTMLElement;
  private onClose: () => void = () => {};
  private busy = false;
  private message: { text: string; bad: boolean } | null = null;

  constructor(private panels: Panels, private sync: Sync) {
    const { overlay, pad, titleId } = createPanel();
    this.overlay = overlay;
    pad.append(el(`<div class="scroll"><h2 id="${titleId}">Your account</h2><div data-body></div></div>`), el('<div class="foot"><span></span><button class="ink" type="button" data-close>Back</button></div>'));
    this.body = pad.querySelector('[data-body]')!;
    pad.querySelector('[data-close]')!.addEventListener('click', () => this.close());
    overlay.addEventListener('keydown', (e) => e.key === 'Escape' && this.close());
    sync.onChange(() => this.isOpen && this.render());
    api.onChange(() => this.isOpen && this.render());
    this.body.addEventListener('submit', (e) => {
      e.preventDefault();
      const submitter = (e as SubmitEvent).submitter as HTMLElement | null;
      void this.signIn(submitter?.dataset.mode === 'signup');
    });
    this.body.addEventListener('click', (e) => {
      const t = e.target as HTMLElement;
      if (t.closest('[data-sync]')) void this.sync.pullAndMerge();
      if (t.closest('[data-signout]')) void api.logout().finally(() => this.render());
    });
  }

  get isOpen(): boolean {
    return !this.overlay.hidden;
  }

  open(onClose: () => void): void {
    this.onClose = onClose;
    this.message = null;
    this.render();
    this.panels.show(this.overlay, this.body.querySelector<HTMLElement>('input, button')!);
  }

  close(): void {
    this.panels.hide(this.overlay);
    this.onClose();
  }

  private async signIn(create: boolean): Promise<void> {
    if (this.busy) return;
    const form = this.body.querySelector('form')!;
    const username = (form.elements.namedItem('username') as HTMLInputElement).value.trim();
    const password = (form.elements.namedItem('password') as HTMLInputElement).value;
    this.busy = true;
    this.message = { text: create ? 'Creating your account…' : 'Signing in…', bad: false };
    this.render(username);
    try {
      await (create ? api.signup(username, password) : api.login(username, password));
      this.message = { text: create ? 'Account created. Your progress now saves online.' : 'Signed in. Your progress is syncing.', bad: false };
      await this.sync.pullAndMerge();
    } catch (e) {
      this.message = { text: (e as Error).message, bad: true };
    } finally {
      this.busy = false;
      this.render(username);
    }
  }

  private render(username = ''): void {
    const msg = this.message ? `<p class="status${this.message.bad ? ' bad' : ''}" role="status">${esc(this.message.text)}</p>` : '';
    if (!api.available) {
      this.body.innerHTML = `<p>Accounts work in the online version of First Shift, opened from its website. This copy of the game saves progress on this device only.</p>`;
      return;
    }
    if (api.session) {
      const s = this.sync;
      const state =
        s.status === 'syncing' ? 'Syncing…' : s.status === 'error' ? `Couldn’t sync: ${s.message}` : s.lastSynced ? `Last saved online at ${new Date(s.lastSynced).toLocaleTimeString()}.` : 'Saved online.';
      this.body.innerHTML = `
        <p>Signed in as <b>${esc(api.session.username)}</b>. Your progress, practice phrases and imported menus save to your account automatically, so you can carry on from any device.</p>
        <p class="status${s.status === 'error' ? ' bad' : ''}">${esc(state)}</p>${msg}
        <div class="row" style="margin-top:10px"><button class="ghost" type="button" data-sync>Sync now</button><button class="ghost" type="button" data-signout>Sign out</button></div>`;
      return;
    }
    this.body.innerHTML = `
      <p>Sign in to save your progress online and use it on any device. Playing without an account still saves on this device.</p>
      <form class="account-form" autocomplete="on">
        <label class="field" for="acct-user">Username</label>
        <input id="acct-user" name="username" autocomplete="username" required minlength="3" maxlength="20" pattern="[A-Za-z0-9_]+" value="${esc(username)}" ${this.busy ? 'disabled' : ''}>
        <label class="field" for="acct-pass">Password (8 or more characters)</label>
        <input id="acct-pass" name="password" type="password" autocomplete="current-password" required minlength="8" ${this.busy ? 'disabled' : ''}>
        <div class="row" style="margin-top:12px">
          <button class="ink" type="submit" data-mode="login" ${this.busy ? 'disabled' : ''}>Sign in</button>
          <button class="ghost" type="submit" data-mode="signup" ${this.busy ? 'disabled' : ''}>Create account</button>
        </div>
      </form>${msg}
      <p class="status">We store only your username, a scrambled version of your password, and your game progress. There’s no email, so write your password down: it can’t be recovered.</p>`;
  }
}
