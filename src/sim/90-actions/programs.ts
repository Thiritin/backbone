// docs/design/web-hosting.md 4.4: a free desktop program downloads into Downloads and installs from there.
import { MS_PER_HOUR, yearOf } from "../00-core/time";
import { programById, programRelease } from "../10-catalog/programs";
import type { GameState } from "../50-state";
import type { ActionResult } from "./hardware";
import { downloadMbps } from "./media";

const fail = (error: string): ActionResult => ({ ok: false, error });

export function downloadProgram(s: GameState, id: string): ActionResult {
  const p = programById(id);
  if (!p || p.from > yearOf(s.hour)) return fail("error.unknownProgram");
  if (s.installers[id]) return fail("error.programDownloaded");
  const mbps = downloadMbps(s);
  if (!mbps) return fail("error.booksOffline");
  const hours = Math.max(1, Math.ceil((programRelease(p, yearOf(s.hour)).mb * 8 * 1000) / mbps / MS_PER_HOUR));
  s.installers = { ...s.installers, [id]: { startedAt: s.hour, readyAt: s.hour + hours } };
  return { ok: true };
}

export function installProgram(s: GameState, id: string): ActionResult {
  const d = s.installers[id];
  if (!programById(id) || !d) return fail("error.booksNotDownloaded");
  if (s.hour < d.readyAt) return fail("error.booksDownloading");
  if (s.installed.includes(id)) return fail("error.installed");
  s.installed = [...s.installed, id];
  return { ok: true };
}

// Downloaded programs and the bookkeeping program go to the Trash; the bookkeeping data stays for the next program.
export const removable = (id: string): boolean => id === "Books" || !!programById(id);

export function uninstallApp(s: GameState, id: string): ActionResult {
  if (!removable(id)) return fail("error.unknownProgram");
  if (!s.installed.includes(id)) return fail("error.notInstalled");
  s.installed = s.installed.filter((a) => a !== id);
  s.docs = s.docs.filter((d) => !(d.kind === "app" && d.title === id));
  if (id === "Books") s.books = { ...s.books, vendor: null, edition: null, seats: 0 };
  return { ok: true };
}
