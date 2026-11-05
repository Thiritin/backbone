import { useSyncExternalStore } from "react";

// Whether a server's boot menu is on screen, so the boot card can say what to press next.
let open = false;
const subs = new Set<() => void>();
export function setBootMenu(on: boolean): void {
  if (open === on) return;
  open = on;
  subs.forEach((f) => f());
}
export const useBootMenu = (): boolean => useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f); }; }, () => open, () => false);
