import { Maximize, Minimize } from "lucide-react";
import { useSyncExternalStore } from "react";
import { t } from "../i18n/en";
import { isDesktopApp } from "./desktop-app";

const subscribe = (fn: () => void) => {
  document.addEventListener("fullscreenchange", fn);
  return () => document.removeEventListener("fullscreenchange", fn);
};

export function FullscreenButton({ className }: { className: string }) {
  const on = useSyncExternalStore(subscribe, () => document.fullscreenElement !== null);
  if (!document.fullscreenEnabled || isDesktopApp()) return null;
  const label = t(on ? "desktop.fullscreen.exit" : "desktop.fullscreen.enter");
  return (
    <button className={className} aria-label={label} title={label}
      onClick={() => void (on ? document.exitFullscreen() : document.documentElement.requestFullscreen()).catch(() => {})}>
      {on ? <Minimize /> : <Maximize />}
    </button>
  );
}
