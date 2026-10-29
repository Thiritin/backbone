// A context menu entry; null draws a separator. An item with items opens a submenu.
export interface MenuItem { label: string; run?: () => void; disabled?: boolean; checked?: boolean; items?: MenuEntry[] }
export type MenuEntry = MenuItem | null | false | undefined;

// Drops falsy entries and the separators that would sit at either end or next to each other.
export function tidy(entries: MenuEntry[]): (MenuItem | null)[] {
  const out: (MenuItem | null)[] = [];
  for (const e of entries) {
    if (e) out.push(e);
    else if (e === null && out.length && out[out.length - 1] !== null) out.push(null);
  }
  while (out.length && out[out.length - 1] === null) out.pop();
  return out;
}

const live = (e: MenuItem | null): e is MenuItem => !!e && !e.disabled;

// The next enabled item from `from` in direction dir, wrapping; -1 starts before the first item.
export function step(entries: (MenuItem | null)[], from: number, dir: 1 | -1): number {
  const n = entries.length;
  if (!entries.some(live)) return -1;
  let i = from < 0 ? (dir === 1 ? -1 : n) : from;
  do i = (i + dir + n) % n; while (!live(entries[i]));
  return i;
}

// Keeps a w by h menu opened at (x, y) inside the viewport, flipping up, or left to end at flipX, when it would overflow.
export function place(x: number, y: number, w: number, h: number, vw: number, vh: number, flipX = x, pad = 6) {
  const left = x + w > vw - pad ? Math.max(pad, flipX - w) : x;
  const top = y + h > vh - pad ? Math.max(pad, Math.min(y - h, vh - pad - h)) : y;
  return { left, top };
}
