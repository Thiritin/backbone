import { useEffect, useState } from "react";

// UI state that survives a reload of the tab (open windows, what an app has selected), but not a closed tab.
export function readSession<T>(key: string, fallback: T): T {
  try {
    const raw = sessionStorage.getItem(`raid0.ui.${key}`);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function writeSession(key: string, value: unknown): void {
  try {
    sessionStorage.setItem(`raid0.ui.${key}`, JSON.stringify(value));
  } catch {
    // Storage blocked; the state just does not outlive the page.
  }
}

// Installer and wizard drafts live under "inst."; they belong to one game and go when another begins.
export function clearDrafts(): void {
  try {
    for (let i = sessionStorage.length - 1; i >= 0; i--) {
      const k = sessionStorage.key(i);
      if (k?.startsWith("raid0.ui.inst.")) sessionStorage.removeItem(k);
    }
  } catch {
    // Storage blocked; nothing was kept.
  }
}

export function useSessionState<T>(key: string, fallback: T): [T, (v: T | ((p: T) => T)) => void] {
  const [value, setValue] = useState(() => readSession(key, fallback));
  useEffect(() => writeSession(key, value), [key, value]);
  return [value, setValue];
}
