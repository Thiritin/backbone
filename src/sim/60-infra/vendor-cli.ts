// The command line tool each software installs on its machine: version, status, updates and licence for all of them,
// and the daily jobs of its kind. Commands that change state need root, as apt does, and run their action through the store.
import { t } from "../../i18n/en";
import { formatClock } from "../00-core/time";
import { tiersOf } from "../10-catalog/licence-tiers";
import { BINARIES, softwareById, type Software, type SoftwareKind } from "../10-catalog/platforms";
import type { GameState } from "../50-state";
import type { Call } from "../90-actions/index";
import { drain, setHa, upgradePhp } from "../90-actions/clusters";
import { softwareTarget, softwareUpgradeBlock, upgradeSoftware } from "../90-actions/console";
import { activateLicence, setLicenceTier, startLicenceTrial } from "../90-actions/licence";
import { setSecondary } from "../90-actions/netsvc-dns";
import { deleteQueue, flushQueue, setMailRelay } from "../90-actions/netsvc-mail";
import { renewCert, revokeCert, setAutoEnroll } from "../90-actions/netsvc-vpn";
import { takeSnapshot } from "../90-actions/snapshots";
import { setAutoUpdate, setChannel, softwareOn, updateSoftware } from "../90-actions/software";
import { renewCertificate, setAutoSsl, unbanIp } from "../90-actions/webpanel";
import { mailAddress } from "./addresses";
import { CHANNELS, channelOf, type Channel } from "./channel";
import type { Cluster, Workload } from "./cluster";
import { assignedKey, installedVersion, licenceStatus, trialOf } from "./licence";
import { dnsZones, zoneOf } from "./netsvc-dns";
import { certsOf, vpnOnCluster } from "./netsvc-vpn";
import type { CommandResult } from "./terminal";
import { accountsOf } from "./webpanel";

const lines = (key: string, p: Record<string, string | number> = {}) => t(key, p).split("\n");
const fail = (key: string, p: Record<string, string | number> = {}): CommandResult => ({ output: lines(key, p), failed: true });

// id names the description on the vendor site's docs page; root commands change state.
export interface CliCommand { id: string; syntax: string; root: boolean }
const cmd = (id: string, syntax: string, root = true): CliCommand => ({ id, syntax, root });

const EXTRAS: Record<SoftwareKind, (sw: Software) => CliCommand[]> = {
  panel: (sw) => [
    cmd("php", "php upgrade [--keep]"), cmd("sslRenew", "ssl renew <domain>"),
    ...(sw.id === "cpanic" ? [cmd("autossl", "autossl on|off")] : []), ...(sw.id === "pleskit" ? [cmd("unban", "unban <ip>")] : []),
  ],
  cloud: () => [cmd("vmList", "vm list", false), cmd("nodeDrain", "node drain <host>"), cmd("ha", "ha live|balance|failover on|off"), cmd("snapshot", "snapshot <vm>")],
  dns: () => [cmd("zoneList", "zone list", false), cmd("secondary", "secondary <zone> on|off")],
  vpn: (sw) => [
    cmd("certRenew", "cert renew <service>"), cmd("certRevoke", "cert revoke <service> <user>"),
    ...(sw.id === "anyconnekt" ? [cmd("autoenroll", "autoenroll <service> on|off")] : []),
  ],
  mail: () => [cmd("queueFlush", "queue flush"), cmd("queueDelete", "queue delete"), cmd("relay", "relay <host> [off]")],
  game: () => [cmd("serverList", "server list", false)],
  storage: () => [cmd("shareList", "share list", false)],
  backup: () => [],
};

// Every command of the software's tool; trial only where the product has one, tier only on licensed panels.
export function cliCommands(sw: Software): CliCommand[] {
  const licensed = sw.trialDays !== undefined;
  return [
    cmd("version", "version", false), cmd("status", "status", false), cmd("update", "update"), cmd("upgrade", "upgrade [--key <key>]"), cmd("channel", "channel stable|release|edge"), cmd("autoupdate", "autoupdate on|off"),
    ...(licensed ? [cmd("licenseSet", "license set <key>"), cmd("licenseShow", "license show", false)] : []),
    ...(licensed && sw.trialDays !== null ? [cmd("trial", "trial")] : []),
    ...(licensed && sw.kind === "panel" ? [cmd("licenseTier", "license tier <tier>")] : []),
    ...EXTRAS[sw.kind](sw),
  ];
}

const TWO: Record<string, Record<string, string>> = {
  license: { set: "licenseSet", show: "licenseShow", tier: "licenseTier" }, php: { upgrade: "php" }, ssl: { renew: "sslRenew" }, vm: { list: "vmList" },
  node: { drain: "nodeDrain" }, zone: { list: "zoneList" }, cert: { renew: "certRenew", revoke: "certRevoke" }, queue: { flush: "queueFlush", delete: "queueDelete" },
  server: { list: "serverList" }, share: { list: "shareList" },
};
// The command the words name and the arguments after it.
const parse = ([a = "", b = "", ...rest]: string[]): [string, string[]] =>
  Object.hasOwn(TWO, a) ? [TWO[a][b] ?? "", rest] : [a, b ? [b, ...rest] : rest];

// The machine's tools by binary name, for completion.
export const binariesOn = (s: GameState, machineId: string): string[] => softwareOn(s, machineId).map((x) => BINARIES[x.id]).filter(Boolean);
// The first words a tool takes after its name.
export function cliWords(s: GameState, machineId: string, bin: string): string[] {
  const x = softwareOn(s, machineId).find((i) => BINARIES[i.id] === bin);
  return x ? [...new Set(cliCommands(softwareById(x.id)).map((c) => c.syntax.split(" ")[0]))] : [];
}

// A vendor tool run on the machine, or undefined when no installed software has that binary.
export function vendorCli(s: GameState, machineId: string, bin: string, args: string[], root: boolean): CommandResult | undefined {
  const x = softwareOn(s, machineId).find((i) => BINARIES[i.id] === bin);
  if (!x) return undefined;
  const sw = softwareById(x.id), cmds = cliCommands(sw), [id, rest] = parse(args), c = cmds.find((k) => k.id === id);
  if (!c) return { output: [...lines("term.vendor.usage", { bin }), ...cmds.map((k) => `  ${bin} ${k.syntax}`)], failed: true };
  if (c.root && !root) return fail("term.vendor.root", { bin });
  if (x.doneAt !== null) return fail("term.vendor.installing", { name: sw.name });
  if (!x.cluster) return fail("error.noSoftware");
  const r = run(s, machineId, sw, x.cluster, c.id, rest, bin);
  return r ?? fail("term.vendor.usageOne", { line: `${bin} ${c.syntax}` });
}

const act = (...action: Call): CommandResult => ({ output: [], action });
const onOff = (w: string | undefined): boolean | undefined => (w === "on" ? true : w === "off" ? false : undefined);
const same = (a: string | undefined, b: string | undefined) => !!a && !!b && a.toLowerCase() === b.toLowerCase();
const table = (rows: [string, string][]): string[] => (rows.length ? rows.map(([a, b]) => `${a.padEnd(28)} ${b}`) : lines("term.vendor.none"));
const nameOf = (w: Workload) => w.hostname ?? w.id;
const workloadsOf = (s: GameState, c: Cluster) => s.workloads.filter((w) => w.clusterId === c.id);
const servicesOf = (s: GameState, c: Cluster) => { const ids = new Set(workloadsOf(s, c).map((w) => w.serviceId)); return s.services.filter((v) => ids.has(v.id) && v.endedAt === null); };
const running = (w: Workload) => t(w.stopped ? "term.vendor.stopped" : "term.vendor.running");
// A panel host by its name or the hostname of the machine it runs on.
const panelNamed = (s: GameState, arg: string): Cluster | undefined => s.clusters.find((p) => p.kind === "panel" && (same(p.name, arg)
  || [p.vm, ...p.nodes.map((n) => n.deviceId)].some((id) => same(s.devices.find((d) => d.id === id)?.hostname ?? s.workloads.find((w) => w.id === id)?.hostname, arg))));

function licenceLine(s: GameState, machineId: string, sw: Software): string[] {
  const status = licenceStatus(s, machineId, sw.id), trial = trialOf(s, machineId, sw.id);
  return lines(`term.vendor.licence.${status ?? "free"}`, { until: trial ? formatClock(trial.until) : "" });
}

// Undefined when the arguments do not fit the command, which prints its usage.
function run(s: GameState, m: string, sw: Software, c: Cluster, id: string, rest: string[], bin: string): CommandResult | undefined {
  const [a, b] = rest, missing = (arg: string) => fail("term.vendor.notFound", { bin, arg });
  switch (id) {
    case "version":
      return { output: lines("term.vendor.version", { name: sw.name, version: installedVersion(s, m, sw.id) ?? c.version, channel: channelOf(c) }) };
    case "status":
      return { output: [...lines(c.switching ? "term.vendor.updating" : "term.vendor.up", { name: sw.name }), ...licenceLine(s, m, sw)] };
    case "update": return act(updateSoftware, c.id);
    case "upgrade": {
      if (a !== undefined && (a !== "--key" || !b)) return undefined;
      const blocked = softwareUpgradeBlock(s, m, sw.id, b);
      if (blocked) return fail(blocked);
      const to = softwareTarget(s, m, sw.id)!;
      return { output: lines("term.vendor.upgrading", { name: sw.name, version: to.version, hours: sw.installHours }), action: [upgradeSoftware, m, sw.id, ...(b ? [b] : [])] };
    }
    case "channel": return CHANNELS.includes(a as Channel) ? act(setChannel, c.id, a as Channel) : undefined;
    case "autoupdate": { const on = onOff(a); return on === undefined ? undefined : act(setAutoUpdate, c.id, on); }
    case "licenseSet": return a ? act(activateLicence, m, sw.id, a) : undefined;
    case "licenseShow": {
      const k = assignedKey(s, m, sw.id);
      if (!k) return { output: licenceLine(s, m, sw) };
      const edition = tiersOf(sw.id).find((x) => x.id === k.edition)?.name ?? sw.name;
      const expires = k.covers.kind === "term" ? formatClock(k.covers.until) : t("term.vendor.perpetual", { major: k.covers.major });
      return { output: lines("term.vendor.key", { key: k.key, edition, expires }) };
    }
    case "trial": return act(startLicenceTrial, m, sw.id);
    case "licenseTier": {
      if (!a) return undefined;
      const tier = tiersOf(sw.id).find((x) => same(x.id, a) || same(x.name.replaceAll(" ", ""), a.replaceAll(" ", "")));
      return tier ? act(setLicenceTier, c.id, tier.id) : missing(a);
    }
    case "php": return a === undefined || a === "--keep" ? act(upgradePhp, c.id, a === "--keep") : undefined;
    case "sslRenew": {
      if (!a) return undefined;
      const v = accountsOf(s, c.id).find((x) => same(x.label, a) || same(x.domain, a));
      return v ? act(renewCertificate, v.id) : missing(a);
    }
    case "autossl": { const on = onOff(a); return on === undefined ? undefined : act(setAutoSsl, c.id, on); }
    case "unban": return a ? act(unbanIp, c.id, a) : undefined;
    case "vmList": case "serverList":
      return { output: table(workloadsOf(s, c).map((w) => [nameOf(w), running(w)])) };
    case "nodeDrain": {
      if (!a) return undefined;
      const d = s.devices.find((x) => same(x.hostname, a) && c.nodes.some((n) => n.deviceId === x.id));
      return d ? act(drain, d.id, c.id) : missing(a);
    }
    case "ha": {
      const on = onOff(b);
      return (a === "live" || a === "balance" || a === "failover") && on !== undefined ? act(setHa, c.id, a, on) : undefined;
    }
    case "snapshot": {
      if (!a) return undefined;
      const w = workloadsOf(s, c).find((x) => same(x.hostname, a));
      return w ? act(takeSnapshot, w.id) : missing(a);
    }
    case "zoneList": {
      const primary = servicesOf(s, c).filter((v) => v.product === "dns").flatMap((v) => dnsZones(s, v));
      const secondary = s.services.filter((v) => v.product === "dns" && v.endedAt === null).flatMap((v) => dnsZones(s, v)).filter((z) => zoneOf(s, z).secondary === c.id);
      return { output: table([...primary.map((z): [string, string] => [z, t("term.vendor.primary")]), ...secondary.map((z): [string, string] => [z, t("term.vendor.secondary")])]) };
    }
    case "secondary": { const on = onOff(b); return a && on !== undefined ? act(setSecondary, a, on ? c.id : null) : undefined; }
    case "certRenew": case "certRevoke": case "autoenroll": {
      if (!a) return undefined;
      const v = vpnOnCluster(s, c.id).find((x) => same(x.hostname, a) || same(x.label, a));
      if (!v) return missing(a);
      if (id === "certRenew") return act(renewCert, v.id);
      if (id === "autoenroll") { const on = onOff(b); return on === undefined ? undefined : act(setAutoEnroll, v.id, on); }
      if (!b) return undefined;
      const cert = certsOf(s, v).find((x) => same(x.cn, b));
      return cert ? act(revokeCert, v.id, cert.index) : missing(b);
    }
    case "queueFlush": case "queueDelete": {
      const addr = mailAddress(s, c.id);
      return addr ? act(id === "queueFlush" ? flushQueue : deleteQueue, addr.id) : fail("error.unknownAddress");
    }
    case "relay": {
      if (!a || (b !== undefined && b !== "off")) return undefined;
      const p = panelNamed(s, a);
      return p ? act(setMailRelay, p.id, b === "off" ? null : c.id) : missing(a);
    }
    case "shareList": {
      const rows = servicesOf(s, c).flatMap((v) => (s.netsvc.shares[v.id] ?? []).map((x): [string, string] => [x.name, x.expiresAt === null ? t("term.vendor.noExpiry") : formatClock(x.expiresAt)]));
      return { output: table(rows) };
    }
  }
  return undefined;
}
