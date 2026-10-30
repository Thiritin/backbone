// docs/design/terminal-shell.md, apt: what is due on a server, shown as Debian packages, and the same updates the Software
// app runs. docs/design/software.md, section 6: software installs and uninstalls from the machine's shell, by its package
// or by the line its website prints.
import { t } from "../../i18n/en";
import { nowHours, yearOf } from "../00-core/time";
import { SOFTWARE, softwareById, type Software } from "../10-catalog/platforms";
import type { GameState } from "../50-state";
import { installBlock, installSoftware, uninstallSoftware, upgradable, upgradeServer } from "../90-actions/software";
import { machineOf } from "./cluster";
import { DESK, releaseOf, treeOf } from "./fs";
import { osUp } from "./oob";
import type { CommandResult, Watch } from "./terminal";

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
    case "remove": {
      const pkg = args.find((a) => a !== op && !a.startsWith("-"));
      if (!pkg) return { output: lines("term.apt.nothing"), failed: true };
      if (!root) return { output: lines("term.apt.lock"), failed: true };
      return op === "install" ? install(s, host, pkg, yes) : remove(s, host, pkg);
    }
    default:
      return { output: lines("term.apt.invalid", { op }), failed: true };
  }
}

const norm = (line: string) => line.trim().split(/\s+/).join(" ");
// Packages a software's site has installed before its own, which apt sets up at once.
const EXTRA = new Set(SOFTWARE.flatMap((sw) => sw.install.commands.map((c) => /^apt-get install -y (\S+)$/.exec(c)?.[1]).filter((p): p is string => !!p && p !== sw.install.package)));
const pkgOf = (sw: Software) => sw.install.package ?? sw.id;

// The repo line has written its file: the software's package is in the lists from then on.
function repoAdded(s: GameState, host: string, sw: Software): boolean {
  const line = sw.install.commands.find((c) => c.startsWith("echo ")), m = line && /^echo "(.*)" > (\S+)$/.exec(line);
  if (!m) return true;
  const text = treeOf(s, host)[m[2]];
  return typeof text === "string" && text.split("\n").includes(m[1]);
}

// The progress lines a started install prints over its install hours, by the software's install method.
export const INSTALL_STEPS = 3;
const watching = (host: string, machineId: string, sw: Software): Watch => ({ host, install: { machineId, softwareId: sw.id, step: 0 } });

function install(s: GameState, host: string, pkg: string, yes: boolean): CommandResult {
  const sw = SOFTWARE.find((x) => x.install.kind === "apt" && x.install.package === pkg);
  const known = sw && yearOf(s.hour) >= sw.from && repoAdded(s, host, sw);
  if (!known) return EXTRA.has(pkg) && host !== DESK ? { output: [...lines("term.apt.state"), t("term.apt.setup", { pkg, to: releaseOf(s, host).version })] } : { output: lines("term.apt.locate", { pkg }), failed: true };
  if (machineOf(s, host)?.software?.some((x) => x.id === sw.id)) return { output: [...lines("term.apt.state"), t("term.apt.newest", { pkg })] };
  const why = installBlock(s, host, sw.id);
  if (why) return { output: [...lines("term.apt.state"), `E: ${t(why)}`], failed: true };
  const plan = [...lines("term.apt.state"), t("term.apt.new"), `  ${pkg}`, t("term.apt.installs", { n: 1 })];
  if (!yes) return { output: plan, confirm: true };
  return { output: plan, action: [installSoftware, host, sw.id], watch: watching(host, host, sw) };
}

function remove(s: GameState, host: string, pkg: string): CommandResult {
  const sw = SOFTWARE.find((x) => pkgOf(x) === pkg);
  if (!sw) return { output: lines("term.apt.locate", { pkg }), failed: true };
  if (!machineOf(s, host)?.software?.some((x) => x.id === sw.id)) return { output: [...lines("term.apt.state"), t("term.apt.notInstalled", { pkg })] };
  return { output: [...lines("term.apt.state"), t("term.apt.removing", { pkg })], action: [uninstallSoftware, host] };
}

// A line that is one of a script software's install lines, after whitespace normalisation: the install starts on the
// machine. Undefined for every other line, which the shell then runs segment by segment.
export function installScript(s: GameState, machineId: string, line: string): CommandResult | undefined {
  const typed = norm(line), sw = SOFTWARE.find((x) => x.install.kind === "script" && x.install.commands.some((c) => norm(c) === typed));
  if (!sw || !osUp(s, machineId)) return undefined;
  const why = installBlock(s, machineId, sw.id);
  if (why) return { output: [t(why)], failed: true };
  return { output: lines("term.install.script", { name: sw.name }), action: [installSoftware, machineId, sw.id], watch: watching(machineOf(s, machineId)?.hostname ?? machineId, machineId, sw) };
}

// One refresh of an install the screen watches: the progress lines due since the last one and the watch to keep, null
// once the install is done or gone.
export function installStep(s: GameState, w: Watch): { output: string[]; next: Watch | null } {
  const { machineId, softwareId, step } = w.install!, sw = softwareById(softwareId);
  const x = machineOf(s, machineId)?.software?.find((y) => y.id === softwareId), now = nowHours(s);
  const kind = sw.install.kind === "apt" ? "apt" : "script", p = { pkg: pkgOf(sw), name: sw.name };
  const line = (i: number) => t(`term.install.${kind}${i}`, p);
  if (!x) return { output: [], next: null };
  const done = x.doneAt === null || x.doneAt <= now;
  const reached = done ? INSTALL_STEPS : Math.min(INSTALL_STEPS, Math.floor((1 - (x.doneAt! - now) / sw.installHours) * (INSTALL_STEPS + 1)));
  const output = Array.from({ length: Math.max(0, reached - step) }, (_, i) => line(step + i));
  if (done) return { output: [...output, t("term.install.done", p)], next: null };
  return { output, next: reached > step ? { ...w, install: { ...w.install!, step: reached } } : w };
}

// dpkg -l: the software on the machine with its version; ii installed, iU still unpacking.
export function dpkg(s: GameState, host: string, args: string[]): CommandResult {
  if (!args.includes("-l")) return { output: lines("term.dpkg.usage"), failed: true };
  const now = nowHours(s), rows = (machineOf(s, host)?.software ?? []).map((x) => {
    const sw = softwareById(x.id);
    return t("term.dpkg.row", { st: x.doneAt !== null && x.doneAt > now ? "iU" : "ii", pkg: pkgOf(sw), version: x.version, name: sw.name });
  });
  return { output: [...lines("term.dpkg.head"), ...rows] };
}
