// Hooks for the Tauri desktop app. Every export is inert in a normal browser, and the plugins load only inside the app.
import type { ChangelogDay } from "./changelog";

export const isDesktopApp = (w: object = globalThis): boolean => "__TAURI_INTERNALS__" in w;

export interface AppUpdate { changes: ChangelogDay[]; install: () => Promise<void> }

// The release notes hold the day's bullets; the update version is the date without leading zeros (2026.11.4).
export function releaseChanges(version: string, notes: string | null | undefined): ChangelogDay[] {
  const items = (notes ?? "").split("\n").filter((l) => /^\s*[-*]\s/.test(l)).map((l) => l.replace(/^\s*[-*]\s+/, "").trim());
  const date = version.split(".").map((p) => p.padStart(2, "0")).join("-");
  return items.length ? [{ date, items }] : [];
}

export async function checkAppUpdate(): Promise<AppUpdate | null> {
  const { check } = await import("@tauri-apps/plugin-updater");
  const update = await check();
  if (!update) return null;
  return {
    changes: releaseChanges(update.version, update.body),
    install: async () => {
      await update.downloadAndInstall();
      const { relaunch } = await import("@tauri-apps/plugin-process");
      await relaunch();
    },
  };
}

// Webviews ignore anchor downloads, so the app saves through a native file dialog.
export async function saveFile(name: string, text: string): Promise<void> {
  const { save } = await import("@tauri-apps/plugin-dialog");
  const path = await save({ defaultPath: name, filters: [{ name: "JSON", extensions: ["json"] }] });
  if (!path) return;
  const { writeTextFile } = await import("@tauri-apps/plugin-fs");
  await writeTextFile(path, text);
}
