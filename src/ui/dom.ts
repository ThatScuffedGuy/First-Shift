/** Escapes text for safe use inside HTML templates. */
export const esc = (s: unknown): string =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** Builds an element from an HTML string (one root element). */
export function el<T extends HTMLElement = HTMLElement>(html: string): T {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild as T;
}

export const money = (n: number): string => `$${(Number(n) || 0).toFixed(2)}`;

export const mmss = (s: number): string => {
  const t = Math.max(0, Math.round(s));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
};

let uid = 0;
/** An order-pad panel (overlay + paper sheet) added to the page, hidden. */
export function createPanel(opts: { alert?: boolean } = {}): { overlay: HTMLElement; pad: HTMLElement; titleId: string } {
  const titleId = `panel-title-${++uid}`;
  const overlay = el(`<div class="overlay" hidden><section class="pad" role="${opts.alert ? 'alertdialog' : 'dialog'}" aria-modal="true" aria-labelledby="${titleId}"></section></div>`);
  document.body.appendChild(overlay);
  const pad = overlay.querySelector<HTMLElement>('.pad')!;
  return { overlay, pad, titleId };
}
