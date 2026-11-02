// docs/design/terminal-shell.md, apt: what is due on a server, shown as Debian packages, and the same updates the Software
// app runs. docs/design/software.md, section 6: software installs and uninstalls from the machine's shell, by its package
// or by the line its website prints.
import { t } from "../../i18n/en";
import { nowHours, yearOf } from "../00-core/time";
import { installKeyBlock } from "./licence";
import { versionAt } from "../10-catalog/software-versions";
import { phpAt, SOFTWARE, softwareById, type Software } from "../10-catalog/platforms";
import type { GameState } from "../50-state";
import { installBlock, phpPackage, uninstallSoftware, upgradable, upgradeServer } from "../90-actions/software";
import { clustersOn, machineOf } from "./cluster";
import { supportOf } from "./lifecycle";
import { DESK, releaseOf, treeOf } from "./fs";
import { installFromSite, upgradeHours, upgradeOs, upgradeTarget } from "../90-actions/console";
import { machineNet, osUp } from "./oob";
import { consoleSuffix } from "../80-business/consoles";
import { fqdn } from "../30-customers/domains";
import { machineAddress } from "./addresses";
import type { CommandResult, Watch } from "./terminal";
import { UPS_PACKAGE } from "./ups";
import { setUpsAgent } from "../90-actions/hardware";

const lines = (key: string, p: Record<string, string | number> = {}) => t(key, p).split("\n");

// apt and apt-get. root is false at the desk without sudo; yes skips the confirmation.
export function apt(s: GameState, host: string, args: string[], root: boolean): CommandResult {
  const op = args.find((a) => !a.startsWith("-")), yes = args.some((a) => a === "-y" || a === "--yes" || a === "--assume-yes");
  const due = host === DESK ? [] : upgradable(s, host), r = releaseOf(s, host);
  if (!op) return { output: lines("term.apt.usage"), failed: true };
  if (["update", "upgrade", "full-upgrade", "dist-upgrade"].includes(op) && !root) return { output: lines("term.apt.lock"), failed: true };
  switch (op) {
    case "update":
      if (host !== DESK && machineNet(s, host)) return unresolved(s, host, r.codename);
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
    case "full-upgrade":
    case "dist-upgrade": {
      // docs/design/software.md, section 4.4: the next release when one is out, else the same as upgrade.
      const next = host === DESK ? null : upgradeTarget(s, host);
      if (!next) return apt(s, host, args.map((a) => (a === op ? "upgrade" : a)), root);
      if (machineNet(s, host)) return unresolved(s, host, r.codename);
      const minutes = Math.round(upgradeHours(s, host) * 60), codename = next.name.toLowerCase();
      const plan = [...lines("term.apt.reading"), t("term.apt.release", { version: next.version, codename }), t("term.apt.downtime", { minutes })];
      if (!yes) return { output: plan, confirm: true };
      return { output: [...plan, t("term.apt.setup", { pkg: "base-files", to: next.version })], action: [upgradeOs, host] };
    }
    case "install":
    case "remove": {
      const pkg = args.find((a) => a !== op && !a.startsWith("-"));
      if (!pkg) return { output: lines("term.apt.nothing"), failed: true };
      if (!root) return { output: lines("term.apt.lock"), failed: true };
      if (pkg === UPS_PACKAGE) return upsAgent(s, host, op === "install", yes);
      return op === "install" ? install(s, host, pkg, yes) : remove(s, host, pkg);
    }
    default:
      return { output: lines("term.apt.invalid", { op }), failed: true };
  }
}

const norm = (line: string) => line.trim().split(/\s+/).join(" ");
// docs/design/software.md, section 4.2: the host a software's install lines download from, the OS mirror without a repo line.
export const MIRROR = "deb.debiant.org";
const siteOf = (line: string | undefined) => (line && /https?:\/\/([^/\s"]+)/.exec(line)?.[1]) ?? MIRROR;
const repoSite = (sw: Software) => siteOf(sw.install.commands.find((c) => c.startsWith("echo ")));

// apt-get update without network: every list it reads fails to resolve, the mirror's and the repos the shell added.
function unresolved(s: GameState, host: string, codename: string): CommandResult {
  const sites = [MIRROR, ...SOFTWARE.filter((sw) => sw.install.kind === "apt" && repoSite(sw) !== MIRROR && repoAdded(s, host, sw)).map(repoSite)];
  return { output: [...sites.flatMap((site, i) => lines("term.apt.err", { n: i + 1, site, codename })), ...lines("term.apt.reading").slice(0, 1), ...sites.flatMap((site) => lines("term.apt.fetchFail", { site, codename })), t("term.apt.ignored")], failed: true };
}
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

// The progress lines a started install prints over its install hours, by the software's install method; a GUI install
// shows the script's.
export function installLog(sw: Software, year = 2005): string[] {
  const pulled = pulledIn(sw, year).map(([p, v]) => `${p} ${v}`).join("|");
  return lines(sw.install.kind === "apt" ? "term.install.apt" : "term.install.scriptLog", { pkg: pkgOf(sw), name: sw.name, ports: sw.ports.join(", "), with: pulled });
}
// docs/design/plans/webmail-server.md, 2.1: Postfixit brings Dovecoat, Sieve from 2010; a mail front end its web server, PHP
// and database driver.
const step = (year: number, rows: [number, string][]): string => rows.filter(([y]) => y <= year).at(-1)![1];
export function pulledIn(sw: Software, year: number): [string, string][] {
  if (sw.id === "postfixit") {
    const v = step(year, [[2005, "1.0.beta3"], [2007, "1.0.5"], [2009, "1.2.9"], [2010, "2.0.13"], [2013, "2.2.9"], [2017, "2.3.19"]]);
    return [["dovecoat-core", v], ["dovecoat-imapd", v], ["dovecoat-pop3d", v], ...(year >= 2010 ? [["dovecoat-sieve", v], ["dovecoat-managesieved", v]] as [string, string][] : [])];
  }
  if (sw.kind !== "mailweb") return [];
  const php = phpPackage(phpAt(year)), web = step(year, [[2005, "2.0.54"], [2007, "2.2.3"], [2015, "2.4.10"]]);
  return [["apache2", web], [php, phpAt(year)], [`${php}-imap`, phpAt(year)], [`${php}-mysql`, phpAt(year)], ["dbconfig-common", step(year, [[2005, "1.8.29"], [2015, "2.0.4"]])]];
}

// What a finished install prints: the address its console answers at, if it has one, and the reboot. The address is the
// fqdn once the company has a domain and the machine's private address before, with the console's port.
export function installDone(s: GameState, machineId: string, sw: Software): string[] {
  const m = machineOf(s, machineId), host = m?.hostname, at = host && (s.company.domain ? fqdn(s, host) : machineAddress(s, m.id));
  const c = clustersOn(s, machineId).find((x) => [x.panel, x.platform, x.switching?.to].includes(sw.id)), port = c && consoleSuffix(s, c);
  const url = at && typeof port === "string" ? `https://${at}${port}/` : null;
  return [t("term.install.done", { name: sw.name }), ...(url ? [t("term.install.reach", { url })] : []), t("term.install.reboot")];
}
// The first line prints as the install starts, the rest across its install hours.
const HEAD = 1;
const started = (s: GameState, sw: Software) => installLog(sw, yearOf(s.hour)).slice(0, HEAD);
const watching = (host: string, machineId: string, sw: Software): Watch => ({ host, install: { machineId, softwareId: sw.id, step: HEAD } });

function install(s: GameState, host: string, pkg: string, yes: boolean): CommandResult {
  const sw = SOFTWARE.find((x) => x.install.kind === "apt" && x.install.package === pkg);
  const known = sw && yearOf(s.hour) >= sw.from && repoAdded(s, host, sw);
  if (!known) return EXTRA.has(pkg) && host !== DESK ? { output: [...lines("term.apt.state"), t("term.apt.setup", { pkg, to: releaseOf(s, host).version })] } : { output: lines("term.apt.locate", { pkg }), failed: true };
  if (machineOf(s, host)?.software?.some((x) => x.id === sw.id)) return { output: [...lines("term.apt.state"), t("term.apt.newest", { pkg })] };
  const why = installBlock(s, host, sw.id);
  if (why) return { output: [...lines("term.apt.state"), `E: ${t(why)}`], failed: true };
  const plan = [...lines("term.apt.state"), t("term.apt.new"), `  ${pkg}`, t("term.apt.installs", { n: 1 })];
  if (machineNet(s, host)) return { output: [...plan, ...lines("term.apt.archives", { site: repoSite(sw), pkg, codename: releaseOf(s, host).codename })], failed: true };
  if (!yes) return { output: plan, confirm: true };
  return { output: [...plan, ...started(s, sw)], action: [installFromSite, host, sw.id], watch: watching(host, host, sw) };
}

// The UPS shutdown agent, from the OS mirror; it only runs on a server's own OS.
function upsAgent(s: GameState, host: string, on: boolean, yes: boolean): CommandResult {
  const d = s.devices.find((x) => x.id === host), pkg = UPS_PACKAGE;
  if (!d) return { output: lines("term.apt.locate", { pkg }), failed: true };
  if (!on) return d.upsAgent ? { output: [...lines("term.apt.state"), t("term.apt.removing", { pkg })], action: [setUpsAgent, d.id, false] } : { output: [...lines("term.apt.state"), t("term.apt.notInstalled", { pkg })] };
  if (d.upsAgent) return { output: [...lines("term.apt.state"), t("term.apt.newest", { pkg })] };
  const plan = [...lines("term.apt.state"), t("term.apt.new"), `  ${pkg}`, t("term.apt.installs", { n: 1 })];
  if (machineNet(s, host)) return { output: [...plan, ...lines("term.apt.archives", { site: MIRROR, pkg, codename: releaseOf(s, host).codename })], failed: true };
  if (!yes) return { output: plan, confirm: true };
  return { output: [...plan, t("term.apt.setup", { pkg, to: releaseOf(s, host).version })], action: [setUpsAgent, d.id, true] };
}

function remove(s: GameState, host: string, pkg: string): CommandResult {
  const sw = SOFTWARE.find((x) => pkgOf(x) === pkg);
  if (!sw) return { output: lines("term.apt.locate", { pkg }), failed: true };
  if (!machineOf(s, host)?.software?.some((x) => x.id === sw.id)) return { output: [...lines("term.apt.state"), t("term.apt.notInstalled", { pkg })] };
  return { output: [...lines("term.apt.state"), t("term.apt.removing", { pkg })], action: [uninstallSoftware, host] };
}

// A line that is one of a script software's install lines, after whitespace normalisation and with an optional
// `--key <licence key>`: the install starts on the machine. Undefined for every other line, which the shell then runs
// segment by segment.
export function installScript(s: GameState, machineId: string, line: string): CommandResult | undefined {
  const key = /\s--key\s+(\S+)/.exec(` ${line}`)?.[1], typed = norm(` ${line}`.replace(/\s--key\s+\S+/, ""));
  const sw = SOFTWARE.find((x) => x.install.kind === "script" && x.install.commands.some((c) => norm(c) === typed));
  if (!sw || !osUp(s, machineId)) return undefined;
  const why = installBlock(s, machineId, sw.id) ?? installKeyBlock(s, machineId, sw.id, versionAt(sw.id, s.hour).version, key);
  if (why) return { output: [t(why)], failed: true };
  if (machineNet(s, machineId)) return { output: lines(typed.startsWith("wget") ? "term.wget.resolve" : "term.curl.resolve", { host: siteOf(typed) }), failed: true };
  return { output: [...lines("term.install.script", { name: sw.name }), ...started(s, sw)], action: [installFromSite, machineId, sw.id, ...(key ? [key] : [])], watch: watching(machineOf(s, machineId)?.hostname ?? machineId, machineId, sw) };
}

// One refresh of an install the screen watches: the progress lines due since the last one and the watch to keep, null
// once the install is done or gone.
export function installStep(s: GameState, w: Watch): { output: string[]; next: Watch | null } {
  const { machineId, softwareId, step } = w.install!, sw = softwareById(softwareId);
  const x = machineOf(s, machineId)?.software?.find((y) => y.id === softwareId), now = nowHours(s), log = installLog(sw, yearOf(x?.installedAt ?? s.hour));
  if (!x) return { output: [], next: null };
  const done = x.doneAt === null || x.doneAt <= now;
  const head = HEAD, rest = log.length - head;
  const reached = done ? log.length : Math.min(log.length, head + Math.floor((1 - (x.doneAt! - now) / sw.installHours) * (rest + 1) + 1e-9));
  const output = log.slice(step, Math.max(step, reached));
  if (done) return { output: [...output, ...installDone(s, machineId, sw)], next: null };
  return { output, next: reached > step ? { ...w, install: { ...w.install!, step: reached } } : w };
}

// dpkg -l: the software on the machine with its version; ii installed, iU still unpacking.
export function dpkg(s: GameState, host: string, args: string[]): CommandResult {
  if (!args.includes("-l")) return { output: lines("term.dpkg.usage"), failed: true };
  const now = nowHours(s), rows = (machineOf(s, host)?.software ?? []).map((x) => {
    const sw = softwareById(x.id);
    const support = supportOf(x.id, x.version, s.hour), name = support === "supported" ? sw.name : `${sw.name} (${t(`software.support.${support}`)})`;
    return t("term.dpkg.row", { st: x.doneAt !== null && x.doneAt > now ? "iU" : "ii", pkg: pkgOf(sw), version: x.version, name });
  });
  return { output: [...lines("term.dpkg.head"), ...rows] };
}
