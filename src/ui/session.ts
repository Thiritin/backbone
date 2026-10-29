import { useEffect, useState } from "react";

// UI state that survives a reload of the tab (open windows, what an app has selected), but not a closed tab.
export function readSession<T>(key: string, fallback: T): T {
  try {
    const raw = sessionStorage.getItem(`backbone.ui.${key}`);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function writeSession(key: string, value: unknown): void {
  try {
    sessionStorage.setItem(`backbone.ui.${key}`, JSON.stringify(value));
  } catch {
    // Storage blocked; the state just does not outlive the page.
  }
}

export function useSessionState<T>(key: string, fallback: T): [T, (v: T) => void] {
  const [value, setValue] = useState(() => readSession(key, fallback));
  useEffect(() => writeSession(key, value), [key, value]);
  return [value, setValue];
}
