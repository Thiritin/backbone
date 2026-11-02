import { useSyncExternalStore } from "react";

// Keyboard Lock API, Chromium only: https://developer.chrome.com/docs/capabilities/web-apis/keyboard-lock
type Keyboard = { lock: (codes?: string[]) => Promise<void>; unlock: () => void };
const keyboard = () => (navigator as Navigator & { keyboard?: Keyboard }).keyboard;

export const canImmerse = () => document.fullscreenEnabled && typeof keyboard()?.lock === "function";

export async function immerse() {
  await document.documentElement.requestFullscreen();
  await keyboard()?.lock();
}

export function leaveImmersive() {
  keyboard()?.unlock();
  if (document.fullscreenElement) void document.exitFullscreen();
}

const subscribe = (fn: () => void) => {
  document.addEventListener("fullscreenchange", fn);
  return () => document.removeEventListener("fullscreenchange", fn);
};
export const useImmersive = () => useSyncExternalStore(subscribe, () => document.fullscreenElement !== null);
