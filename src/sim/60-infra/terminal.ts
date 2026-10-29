// GDD, The desktop (Terminal) and Network and DDoS (path and latency). The parser behind the Terminal app: a pure function from a line to
// output, so the UI keeps the screen and dispatches the action through the store.
import { t } from "../../i18n/en";
import { hashRng, rand } from "../00-core/rng";
import { dateOf } from "../00-core/time";
import { modelById } from "../10-catalog/hardware";
import { JITTER } from "../10-catalog/network";
import { fqdn } from "../30-customers/domains";
import type { GameState } from "../50-state";
import type { Call } from "../90-actions/index";
import { recover } from "../90-actions/vms";
import { privateIp, publicV4, publicV6, ipmiIp } from "./addresses";
import { serverOf, vmOf, workloadOnline, type Workload } from "./cluster";
import { latency } from "./network";
import { hopDown, pathTo, powered, working, type Hop } from "./status";
import { nodeUsage, workloadUse } from "./usage";
import { RECOVER_HOURS } from "./power";
import { restart, shutdown } from "../90-actions/hardware";

// An open ssh session on a server; null at the desk.
export interface Session { host: string; deviceId: string }
// A recovery the screen reports on once it is done.
export interface Watch { workloadId: string; host: string }
export interface CommandResult { output: string[]; session?: Session | null; action?: Call; clear?: boolean; watch?: Watch }

export const DESK_PROMPT = "you@desk $";
export const promptOf = (session: Session | null): string => (session ? `root@${session.host}:~#` : DESK_PROMPT);

// What a name or address points at: a server, a workload (a VM or a customer service) or a server's management controller.
interface Target { label: string; ip: string; kind: "server" | "workload" | "bmc"; deviceId: string; name: string; workload?: Workload }

// The basement router the desk is plugged into.
export const deskRouter = (s: GameState): string | undefined => {
  const home = s.locations.find((l) => !l.dc);
  return s.devices.find((d) => modelById(d.model).kind === "gateway" && d.panel === home?.id)?.id;
};

const addressOf = (s: GameState, id: string): string => {
  const own = publicV4(s, id);
  return (own && !own.shared ? own.ip : privateIp(s, id)) ?? "0.0.0.0";
};

function resolveTarget(s: GameState, raw: string): Target | null {
  const key = raw.toLowerCase().replace(/\.$/, "");
  const named = (h: string | undefined) => !!h && (h === key || fqdn(s, h) === key);
  const isIp = /^\d{1,3}(\.\d{1,3}){3}$/.test(key);
  for (const d of s.devices) {
    if (d.hostname === undefined) continue;
    if (named(d.hostname) || (isIp && (privateIp(s, d.id) === key || (publicV4(s, d.id)?.ip === key && !publicV4(s, d.id)!.shared)))) {
      return { label: isIp ? key : fqdn(s, d.hostname), ip: addressOf(s, d.id), kind: "server", deviceId: d.id, name: d.hostname };
    }
    if (isIp && ipmiIp(s, d.id) === key) return { label: key, ip: key, kind: "bmc", deviceId: d.id, name: d.hostname };
  }
  const owned = (w: Workload) => (named(w.hostname) || (isIp && privateIp(s, w.id) === key) ? w.hostname : undefined);
  const service = s.services.find((v) => named(v.hostname));
  const w = s.workloads.find((x) => owned(x)) ?? (service && s.workloads.find((x) => x.serviceId === service.id));
  const deviceId = w && serverOf(s, w);
  if (!w || !deviceId) return null;
  const name = w.hostname ?? service?.hostname ?? w.id;
  return { label: isIp ? key : fqdn(s, name), ip: privateIp(s, w.id) ?? "0.0.0.0", kind: "workload", deviceId, name, workload: w };
}

// Whether the target answers: a server needs a working OS, a workload to be online, a controller power and no hang.
function answers(s: GameState, tg: Target): boolean {
  if (tg.kind === "bmc") return powered(s, tg.deviceId) && !s.devices.find((d) => d.id === tg.deviceId)!.bmcHung;
  return tg.kind === "workload" ? workloadOnline(s, tg.workload!) : working(s, tg.deviceId);
}

// The route to a target that works, or null when the desk cannot reach it or it does not answer.
function reach(s: GameState, tg: Target): Hop[] | null {
  const desk = deskRouter(s);
  const hops = desk ? pathTo(s, desk, tg.deviceId) : null;
  return hops && answers(s, tg) ? hops : null;
}

// The same line of a command run twice differs through nonce, so repeated pings do not repeat themselves.
const noise = (s: GameState, name: string, nonce: number, i: number) => hashRng(s.seed, s.hour, [...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7), nonce, i);
const jitter = (ms: number, r: ReturnType<typeof hashRng>) => ms * (1 + (rand(r) * 2 - 1) * JITTER);
const fixed = (v: number) => v.toFixed(1);
const lines = (key: string, p: Record<string, string | number> = {}) => t(key, p).split("\n");

const PINGS = 4;

function ping(s: GameState, arg: string | undefined, nonce: number): string[] {
  if (!arg) return lines("term.ping.usage");
  const tg = resolveTarget(s, arg);
  if (!tg) return lines("term.ping.resolve", { host: arg });
  const hops = reach(s, tg), p = { name: tg.label, ip: tg.ip };
  const out = lines("term.ping.head", p);
  const times: number[] = [];
  if (hops) {
    const { ms, loss } = latency(s, hops), rtt = ms.reduce((a, b) => a + b, 0);
    for (let i = 0; i < PINGS; i++) {
      const r = noise(s, tg.name, nonce, i);
      if (rand(r) < loss) continue;
      const time = jitter(rtt, r);
      times.push(time);
      out.push(t("term.ping.reply", { ...p, seq: i + 1, ttl: Math.max(1, 64 - hops.length), ms: fixed(time) }));
    }
  }
  out.push("", t("term.ping.stats", { name: tg.label }));
  out.push(t("term.ping.summary", { sent: PINGS, got: times.length, loss: Math.round(((PINGS - times.length) / PINGS) * 100), time: 3000 + Math.round(times.reduce((a, b) => a + b, 0)) }));
  if (times.length) {
    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    const mdev = Math.sqrt(times.reduce((a, b) => a + (b - avg) ** 2, 0) / times.length);
    out.push(t("term.ping.rtt", { min: fixed(Math.min(...times)), avg: fixed(avg), max: fixed(Math.max(...times)), mdev: fixed(mdev) }));
  }
  return out;
}

function traceroute(s: GameState, arg: string | undefined, nonce: number): string[] {
  if (!arg) return lines("term.trace.usage");
  const tg = resolveTarget(s, arg);
  if (!tg) return lines("term.trace.resolve", { host: arg });
  const out = lines("term.trace.head", { name: tg.label, ip: tg.ip });
  const desk = deskRouter(s), live = reach(s, tg);
  // Without a working route the cabled one shows where it ends: the hops before the first stopped one answer.
  const hops = live ?? (desk ? pathTo(s, desk, tg.deviceId, false) : null) ?? [];
  const { ms } = latency(s, hops);
  const last = hops.length - 1;
  let at = 0, reached = true;
  hops.forEach((h, i) => {
    const down = i === last ? !live : hopDown(s, h);
    if (down) reached = false;
    if (!reached) { out.push(t("term.trace.lost", { n: i + 1 })); return; }
    at += ms[i];
    const r = noise(s, h.name, nonce, i), name = i === last ? `${tg.label} (${tg.ip})` : h.name;
    out.push(t("term.trace.hop", { n: i + 1, name, a: fixed(jitter(at, r)), b: fixed(jitter(at, r)), c: fixed(jitter(at, r)) }));
  });
  if (!hops.length) out.push(t("term.trace.lost", { n: 1 }));
  return out;
}

function host(s: GameState, arg: string | undefined): string[] {
  if (!arg) return lines("term.host.usage");
  const tg = resolveTarget(s, arg);
  if (!tg) return lines("term.host.missing", { host: arg });
  if (/^\d/.test(arg)) return lines("term.host.pointer", { arpa: `${arg.split(".").reverse().join(".")}.in-addr.arpa`, name: tg.label });
  const v6 = tg.kind === "bmc" ? null : publicV6(s, tg.workload?.id ?? tg.deviceId);
  return [t("term.host.address", { name: tg.label, ip: tg.ip }), ...(v6 ? [t("term.host.address6", { name: tg.label, ip: v6 })] : [])];
}

function ssh(s: GameState, args: string[]): CommandResult {
  const arg = args.filter((a) => !a.startsWith("-")).at(-1)?.replace(/^.*@/, "");
  if (!arg) return { output: lines("term.ssh.usage") };
  const tg = resolveTarget(s, arg);
  if (!tg) return { output: lines("term.ssh.resolve", { host: arg }) };
  const timeout = { output: lines("term.ssh.timeout", { host: arg }) };
  if (tg.kind === "bmc") return pathTo(s, deskRouter(s) ?? "", tg.deviceId) && answers(s, tg) ? { output: lines("term.ssh.refused", { host: arg }) } : timeout;
  if (!reach(s, tg)) return timeout;
  if (tg.kind === "workload") return { output: lines("term.ssh.denied", { host: tg.name }) };
  return { output: lines("term.ssh.welcome", { host: tg.name }), session: { host: tg.name, deviceId: tg.deviceId } };
}

// Remote shell ---------------------------------------------------------------------------------------------------------

const clock = (s: GameState) => `${String(dateOf(s.hour).getUTCHours()).padStart(2, "0")}:00:00`;
const unit = (gb: number) => (gb >= 1000 ? `${(gb / 1000).toFixed(1)}T` : `${Math.round(gb)}G`);

// The hour the server last booted: its purchase, or the end of its latest boot.
const bootedAt = (s: GameState, deviceId: string) => {
  const d = s.devices.find((x) => x.id === deviceId)!;
  return Math.max(d.boughtAt, d.bootUntil ?? 0);
};

function up(s: GameState, deviceId: string): string {
  const hours = Math.max(0, s.hour - bootedAt(s, deviceId)), days = Math.floor(hours / 24), h = hours % 24;
  if (!days) return h ? `${h}:00` : "0 min";
  return `${days} day${days === 1 ? "" : "s"}, ${h}:00`;
}

function loadAverage(s: GameState, deviceId: string): [string, string, string] {
  const load = nodeUsage(s, deviceId).used.vcpu;
  return [load, load * 0.95, load * 0.9].map((v) => v.toFixed(2)) as [string, string, string];
}

function df(s: GameState, deviceId: string): string[] {
  const { used, physical } = nodeUsage(s, deviceId), d = s.devices.find((x) => x.id === deviceId)!;
  const pct = (a: number, b: number) => (b > 0 ? Math.min(100, Math.round((a / b) * 100)) : 0);
  const shm = physical.ramGb / 2;
  return [
    t("term.df.head"),
    t("term.df.row", { fs: d.raid === "none" ? "/dev/sda1" : "/dev/md0", size: unit(physical.diskGb), used: unit(used.diskGb), avail: unit(Math.max(0, physical.diskGb - used.diskGb)), pct: pct(used.diskGb, physical.diskGb), mount: "/" }),
    t("term.df.row", { fs: "tmpfs", size: unit(shm), used: "0", avail: unit(shm), pct: 0, mount: "/dev/shm" }),
  ];
}

// RAM figures in MiB: what the workloads use on top of a small base, a tenth of the rest as cache.
function memory(s: GameState, deviceId: string) {
  const { used, physical } = nodeUsage(s, deviceId), total = physical.ramGb * 1024;
  const inUse = Math.min(total, used.ramGb * 1024 + 300), cache = (total - inUse) * 0.1;
  return { total, used: inUse, cache, free: total - inUse - cache, avail: total - inUse };
}

function top(s: GameState, deviceId: string): string[] {
  const { used, physical } = nodeUsage(s, deviceId), m = memory(s, deviceId), mib = (v: number) => v.toFixed(1);
  const mine = s.workloads.filter((w) => w.deviceId === deviceId && !w.stopped);
  const rows = mine.map((w) => ({ w, u: workloadUse(s, w) })).sort((a, b) => b.u.vcpu - a.u.vcpu).slice(0, 8);
  const busy = physical.vcpu > 0 ? Math.min(100, (used.vcpu / physical.vcpu) * 100) : 0, sy = busy * 0.12;
  const [a, b, c] = loadAverage(s, deviceId);
  const gb = (v: number) => (v >= 10 ? `${Math.round(v)}g` : `${v.toFixed(1)}g`);
  return [
    t("term.uptime", { clock: `top - ${clock(s)}`, up: up(s, deviceId), a, b, c }).trimStart(),
    t("term.top.tasks", { total: 90 + mine.length, running: Math.min(1 + Math.round(used.vcpu), 9) }),
    t("term.top.cpu", { us: mib(busy - sy), sy: mib(sy), id: mib(100 - busy) }),
    t("term.top.mem", { total: mib(m.total), free: mib(m.free), used: mib(m.used), cache: mib(m.cache) }),
    t("term.top.swap", { total: mib(2048), avail: mib(m.avail) }),
    "",
    t("term.top.head"),
    ...rows.map(({ w, u }, i) => t("term.top.row", {
      pid: 1000 + i * 37, user: "qemu", virt: gb(w.ramGb), res: gb(u.ramGb), cpu: mib(u.vcpu * 100), mem: mib(physical.ramGb ? (u.ramGb / physical.ramGb) * 100 : 0),
      time: `${Math.max(0, s.hour - w.placedAt) * 60}:00.00`, cmd: w.hostname ?? w.id,
    })),
    t("term.top.row", { pid: 1, user: "root", virt: "0.2g", res: "0.0g", cpu: "0.0", mem: "0.0", time: "0:04.00", cmd: "systemd" }),
    t("term.top.row", { pid: 812, user: "root", virt: "0.0g", res: "0.0g", cpu: "0.0", mem: "0.0", time: "0:00.00", cmd: "sshd" }),
  ];
}

function remote(s: GameState, session: Session, cmd: string, args: string[]): CommandResult {
  const { host, deviceId } = session;
  switch (cmd) {
    case "uptime": {
      const [a, b, c] = loadAverage(s, deviceId);
      return { output: [t("term.uptime", { clock: clock(s), up: up(s, deviceId), a, b, c })] };
    }
    case "df": return { output: df(s, deviceId) };
    case "free": {
      const m = memory(s, deviceId), n = (v: number) => Math.round(v);
      return { output: [t("term.free.head"), t("term.free.mem", { total: n(m.total), used: n(m.used), free: n(m.free), cache: n(m.cache), avail: n(m.avail) }), t("term.free.swap", { total: 2048 })] };
    }
    case "top": return { output: top(s, deviceId) };
    case "shutdown":
    case "reboot": {
      const off = cmd === "shutdown";
      if (off && args.join(" ") !== "-h now") return { output: lines("term.shutdown.usage") };
      const down = [...lines(off ? "term.shutdown.off" : "term.shutdown.reboot", { host }), t("term.ssh.lost", { host })];
      // A reboot goes through a clean shutdown and boots again; nothing is pulled, so nothing corrupts.
      return { output: down, session: null, action: [off ? shutdown : restart, deviceId] };
    }
    case "recover": return recoverCommand(s, session, args[0]);
    case "exit": return { output: [t("term.logout"), t("term.ssh.closed", { host })], session: null };
    default: return { output: lines("term.notFound", { cmd }) };
  }
}

function recoverCommand(s: GameState, { deviceId }: Session, arg: string | undefined): CommandResult {
  if (!arg) return { output: lines("term.recover.usage") };
  const key = arg.toLowerCase();
  // A web space inside a panel VM is repaired through the VM, which is what a pulled plug corrupts.
  const here = s.workloads.filter((w) => serverOf(s, w) === deviceId && !!w.hostname && (w.hostname === key || fqdn(s, w.hostname) === key)).map((w) => (w.deviceId ? w : vmOf(s, w) ?? w));
  const w = here.find((x) => x.corrupted) ?? here[0];
  const p = { name: arg };
  if (!w) return { output: lines("term.recover.none", p) };
  if (!w.corrupted) return { output: lines("term.recover.clean", p) };
  if (w.recoverDoneAt !== undefined) return { output: lines("term.recover.running", p) };
  if (w.recoverFailed) return { output: lines("term.recover.restore", p) };
  return { output: [t("term.recover.start", p), t("term.recover.eta", { ...p, minutes: RECOVER_HOURS * 60 })], action: [recover, w.id], watch: { workloadId: w.id, host: arg } };
}

// The lines for a recovery that has finished, or null while it is still under way.
export function recoveryReport(s: GameState, watch: Watch): string[] | null {
  const w = s.workloads.find((x) => x.id === watch.workloadId);
  if (w?.recoverDoneAt !== undefined) return null;
  return lines(w && w.corrupted ? "term.recover.failed" : "term.recover.done", { name: watch.host });
}

// Runs one line. session is the open ssh session, or null at the desk; nonce varies the jitter of repeated commands.
export function runCommand(s: GameState, session: Session | null, line: string, nonce = 0): CommandResult {
  const [cmd, ...args] = line.trim().split(/\s+/);
  if (!cmd) return { output: [] };
  if (cmd === "clear") return { output: [], clear: true };
  if (cmd === "help") return { output: lines(session ? "term.help.remote" : "term.help.desk") };
  if (session) {
    if (!working(s, session.deviceId)) return { output: lines("term.ssh.lost", { host: session.host }), session: null };
    if (["uptime", "df", "free", "top", "shutdown", "reboot", "recover", "exit"].includes(cmd)) return remote(s, session, cmd, args);
  } else if (cmd === "ssh") return ssh(s, args);
  else if (cmd === "ping") return { output: ping(s, args[0], nonce) };
  else if (cmd === "traceroute") return { output: traceroute(s, args[0], nonce) };
  else if (cmd === "host") return { output: host(s, args[0]) };
  return { output: lines("term.notFound", { cmd }) };
}
