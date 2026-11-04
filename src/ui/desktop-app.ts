// Hooks for the Tauri desktop app. Every export is inert in a normal browser, and the plugins load only inside the app.
import { parseChangelog, type ChangelogDay } from "./changelog";

export const isDesktopApp = (w: object = globalThis): boolean => "__TAURI_INTERNALS__" in w;

export interface AppUpdate { changes: ChangelogDay[]; install: () => Promise<void> }

// The release notes group their bullets under "## YYYY-MM-DD" days; bullets without a day are shown under today.
export function releaseChanges(notes: string | null | undefined, today: string = new Date().toISOString().slice(0, 10)): ChangelogDay[] {
  const text = notes ?? "";
  const days = parseChangelog(text).filter((d) => d.items.length > 0);
  if (days.length) return days.map(({ date, items }) => ({ date, items }));
  const items = text.split("\n").filter((l) => /^\s*[-*]\s/.test(l)).map((l) => l.replace(/^\s*[-*]\s+/, "").trim());
  return items.length ? [{ date: today, items }] : [];
}

export async function checkAppUpdate(): Promise<AppUpdate | null> {
  const { check } = await import("@tauri-apps/plugin-updater");
  const update = await check();
  if (!update) return null;
  return {
    changes: releaseChanges(update.body),
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
