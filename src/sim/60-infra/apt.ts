// docs/design/terminal-shell.md, apt: what is due on a server, shown as Debian packages, and the same updates the Software
// app runs.
import { t } from "../../i18n/en";
import type { GameState } from "../50-state";
import { upgradable, upgradeServer } from "../90-actions/software";
import { DESK, releaseOf } from "./fs";
import type { CommandResult } from "./terminal";

const lines = (key: string, p: Record<string, string | number> = {}) => t(key, p).split("\n");

// apt and apt-get. root is false at the desk without sudo; yes skips the confirmation.
export function apt(s: GameState, host: string, args: string[], root: boolean): CommandResult {
  const op = args.find((a) => !a.startsWith("-")), yes = args.some((a) => a === "-y" || a === "--yes" || a === "--assume-yes");
  const due = host === DESK ? [] : upgradable(s, host), r = releaseOf(s, host);
  if (!op) return { output: lines("term.apt.usage"), failed: true };
  if ((op === "update" || op === "upgrade") && !root) return { output: lines("term.apt.lock"), failed: true };
  switch (op) {
    case "update":
      return { output: [...lines("term.apt.hit", { codename: r.codename }), ...lines(due.length ? "term.apt.count" : "term.apt.current", { n: due.length })] };
    case "list":
      return { output: [t("term.apt.listing"), ...due.map((u) => t("term.apt.row", { pkg: u.pkg, codename: r.codename, to: u.to, from: u.from }))] };
    case "upgrade": {
      const head = lines("term.apt.reading");
      if (!due.length) return { output: [...head, t("term.apt.summary", { n: 0 })] };
      const minutes = Math.max(...due.map((u) => u.minutes));
      const plan = [...head, t("term.apt.will"), `  ${due.map((u) => u.pkg).join(" ")}`, t("term.apt.summary", { n: due.length }), ...(minutes ? [t("term.apt.downtime", { minutes })] : [])];
      if (!yes) return { output: plan, confirm: true };
      return { output: [...plan, ...due.map((u) => t("term.apt.setup", { pkg: u.pkg, to: u.to }))], action: [upgradeServer, host] };
    }
    case "install":
    case "remove":
      return { output: args.filter((a) => a !== op && !a.startsWith("-")).map((pkg) => t("term.apt.locate", { pkg })), failed: true };
    default:
      return { output: lines("term.apt.invalid", { op }), failed: true };
  }
}
