// docs/design/lan.md, Shell: a Lunix server's interface names, /etc/network/interfaces and /etc/resolv.conf, and what
// ip, ifconfig and dhclient print. Pure text in and out; lan.ts supplies the facts.
import { t } from "../../i18n/en";
import type { BondMode, IfaceConfig } from "../50-state";

export type { IfaceConfig };
export interface Addr { ip: string; prefix: number; dynamic?: number }
// up is the admin state, carrier the cable; master names the bond a port is enslaved to.
export interface Nic { name: string; mac: string; up: boolean; carrier: boolean; master?: string; addr?: Addr | null }

export const IFACES = "/etc/network/interfaces";
export const RESOLV = "/etc/resolv.conf";

// Debiant 9 renamed eth0 and eth1 to their PCI slot names.
export const nicNames = (version: string): [string, string] => (Number(version) >= 9 ? ["enp1s0f0", "enp1s0f1"] : ["eth0", "eth1"]);

const octets = (ip: string) => ip.split(".").map(Number);
export const isIp = (ip: string) => /^\d{1,3}(\.\d{1,3}){3}$/.test(ip) && octets(ip).every((n) => n <= 255);
const num = (ip: string) => octets(ip).reduce((a, n) => a * 256 + n, 0);
const dotted = (n: number) => [24, 16, 8, 0].map((b) => Math.floor(n / 2 ** b) % 256).join(".");
export const maskOf = (prefix: number) => dotted(2 ** 32 - 2 ** (32 - prefix));
// The prefix length of a contiguous netmask, null for anything else.
export function prefixOf(mask: string): number | null {
  if (!isIp(mask)) return null;
  const p = [...Array(33).keys()].find((n) => maskOf(n) === mask);
  return p ?? null;
}
const block = (prefix: number) => 2 ** (32 - prefix);
export const networkOf = (ip: string, prefix: number) => dotted(num(ip) - (num(ip) % block(prefix)));
export const broadcastOf = (ip: string, prefix: number) => dotted(num(ip) - (num(ip) % block(prefix)) + block(prefix) - 1);
export const sameNet = (a: string, b: string, prefix: number) => networkOf(a, prefix) === networkOf(b, prefix);

const BOND_MODE: Record<BondMode, string> = { none: "active-backup", failover: "active-backup", balance: "802.3ad" };

// The file as the installer writes it: loopback, then the primary interface, a bond over both ports when bonded.
export function renderInterfaces(dev: string, iface: IfaceConfig, bond: { slaves: string[]; mode: BondMode } | null): string {
  const method = iface.mode === "dhcp" ? "dhcp" : iface.ip ? "static" : "manual";
  const opts = [
    ...(iface.mode === "static" && iface.ip ? [`address ${iface.ip}`, `netmask ${maskOf(iface.prefix ?? 24)}`, ...(iface.gw ? [`gateway ${iface.gw}`] : []), ...(iface.dns ? [`dns-nameservers ${iface.dns}`] : [])] : []),
    ...(bond ? [`bond-slaves ${bond.slaves.join(" ")}`, `bond-mode ${BOND_MODE[bond.mode]}`, "bond-miimon 100"] : []),
  ];
  return [
    "# This file describes the network interfaces available on your system",
    "# and how to activate them. For more information, see interfaces(5).",
    "",
    "# The loopback network interface",
    "auto lo",
    "iface lo inet loopback",
    "",
    "# The primary network interface",
    `${bond ? "auto" : "allow-hotplug"} ${dev}`,
    `iface ${dev} inet ${method}`,
    ...opts.map((o) => `\t${o}`),
    "",
  ].join("\n");
}

export const renderResolv = (dns: string | null) => (dns ? `nameserver ${dns}\n` : "");

const STANZAS = new Set(["iface", "mapping", "auto", "allow-auto", "allow-hotplug", "source", "source-directory", "no-auto-down", "no-scripts"]);
const METHODS = new Set(["loopback", "static", "dhcp", "manual"]);

// ifupdown's reading of the file for one interface: its setting, or the lines ifup prints when it refuses. A stanza for
// another interface is read for errors and otherwise left alone.
export function parseInterfaces(text: string, dev: string): { ok: true; iface: IfaceConfig } | { ok: false; error: string[] } {
  const bad = (n: number, why: string) => ({ ok: false as const, error: [t("term.ifup.parse", { file: IFACES, n, why: t(`term.ifup.${why}`) }), t("term.ifup.read", { file: IFACES })] });
  type Stanza = { name: string; method: string; opts: Record<string, string> };
  let current: Stanza | null = null, mine: Stanza | null = null;
  const rows = text.split("\n");
  for (let i = 0; i < rows.length; i++) {
    const words = rows[i].replace(/#.*/, "").trim().split(/\s+/).filter(Boolean);
    if (!words.length) continue;
    const [key, ...rest] = words;
    if (key === "iface") {
      if (rest.length < 3) return bad(i + 1, "few");
      if (rest[1] !== "inet") return bad(i + 1, "family");
      if (!METHODS.has(rest[2])) return bad(i + 1, "method");
      current = { name: rest[0], method: rest[2], opts: {} };
      if (rest[0] === dev) mine = current;
    } else if (STANZAS.has(key)) current = key === "mapping" ? null : current;
    else if (!current) return bad(i + 1, "misplaced");
    else current.opts[key] = rest.join(" ");
  }
  if (!mine || mine.method === "manual" || mine.method === "loopback") return { ok: true, iface: { mode: "static" } };
  if (mine.method === "dhcp") return { ok: true, iface: { mode: "dhcp" } };
  const fail = (why: string) => ({ ok: false as const, error: [why, t("term.ifup.failed", { dev })] });
  const o = mine.opts, [ip, slash] = (o.address ?? "").split("/");
  if (!o.address) return fail(t("term.ifup.missing", { name: "address" }));
  const prefix = slash !== undefined ? Number(slash) : o.netmask ? prefixOf(o.netmask) : 24;
  if (!isIp(ip) || prefix === null || !Number.isInteger(prefix) || prefix < 1 || prefix > 32) return fail(t("term.ip.prefix", { arg: o.netmask && slash === undefined ? o.netmask : o.address }));
  const gw = o.gateway?.split(" ")[0], dns = o["dns-nameservers"]?.split(" ")[0];
  if (gw && !isIp(gw)) return fail(t("term.ip.inet", { arg: gw }));
  return { ok: true, iface: { mode: "static", ip, prefix, ...(gw ? { gw } : {}), ...(dns && isIp(dns) ? { dns } : {}) } };
}

// ip a: loopback first, then each interface in iproute2's layout.
export function ipAddr(nics: Nic[]): string[] {
  const lo = [
    "1: lo: <LOOPBACK,UP,LOWER_UP> mtu 65536 qdisc noqueue state UNKNOWN group default qlen 1000",
    "    link/loopback 00:00:00:00:00:00 brd 00:00:00:00:00:00",
    "    inet 127.0.0.1/8 scope host lo",
    "       valid_lft forever preferred_lft forever",
  ];
  return [...lo, ...nics.flatMap((n, i) => {
    const flags = ["BROADCAST", "MULTICAST", ...(n.master ? ["SLAVE"] : []), ...(n.name.startsWith("bond") ? ["MASTER"] : []), ...(n.up ? ["UP"] : []), ...(n.up && n.carrier ? ["LOWER_UP"] : [])];
    const head = `${i + 2}: ${n.name}: <${n.up && !n.carrier ? "NO-CARRIER," : ""}${flags.join(",")}> mtu 1500 qdisc ${n.name.startsWith("bond") ? "noqueue" : "pfifo_fast"}${n.master ? ` master ${n.master}` : ""} state ${n.up && n.carrier ? "UP" : "DOWN"} group default qlen 1000`;
    const a = n.addr, life = a?.dynamic !== undefined ? `${a.dynamic}sec` : "forever";
    return [head, `    link/ether ${n.mac} brd ff:ff:ff:ff:ff:ff`, ...(a ? [
      `    inet ${a.ip}/${a.prefix} brd ${broadcastOf(a.ip, a.prefix)} scope global ${a.dynamic !== undefined ? "dynamic " : ""}${n.name}`,
      `       valid_lft ${life} preferred_lft ${life}`,
    ] : [])];
  })];
}

// ip route: the default route, then the connected network.
export function ipRoute(dev: string, addr: Addr | null, gw: string | null, up: boolean): string[] {
  if (!addr || !up) return [];
  return [
    ...(gw ? [`default via ${gw} dev ${dev}${addr.dynamic !== undefined ? " proto dhcp" : ""}`] : []),
    `${networkOf(addr.ip, addr.prefix)}/${addr.prefix} dev ${dev} proto kernel scope link src ${addr.ip}`,
  ];
}

// ifconfig: net-tools' old layout until Debiant 9, the new one after. Without -a only the interfaces that are up.
export function ifconfig(nics: Nic[], all: boolean, modern: boolean): string[] {
  const shown = nics.filter((n) => all || n.up);
  const blocks = shown.map((n) => {
    const a = n.addr, flags = [...(n.up ? ["UP"] : []), "BROADCAST", ...(n.up && n.carrier ? ["RUNNING"] : []), ...(n.master ? ["SLAVE"] : []), ...(n.name.startsWith("bond") ? ["MASTER"] : []), "MULTICAST"];
    if (modern) return [
      `${n.name}: flags=${n.up && n.carrier ? 4163 : n.up ? 4099 : 4098}<${flags.join(",")}>  mtu 1500`,
      ...(a ? [`        inet ${a.ip}  netmask ${maskOf(a.prefix)}  broadcast ${broadcastOf(a.ip, a.prefix)}`] : []),
      `        ether ${n.mac}  txqueuelen 1000  (Ethernet)`,
      "        RX packets 0  bytes 0 (0.0 B)",
      "        TX packets 0  bytes 0 (0.0 B)",
    ];
    return [
      `${n.name.padEnd(10)}Link encap:Ethernet  HWaddr ${n.mac}`,
      ...(a ? [`          inet addr:${a.ip}  Bcast:${broadcastOf(a.ip, a.prefix)}  Mask:${maskOf(a.prefix)}`] : []),
      `          ${flags.join(" ")}  MTU:1500  Metric:1`,
      "          RX packets:0 errors:0 dropped:0 overruns:0 frame:0",
      "          TX packets:0 errors:0 dropped:0 overruns:0 carrier:0",
      "          collisions:0 txqueuelen:1000",
      "          RX bytes:0 (0.0 B)  TX bytes:0 (0.0 B)",
    ];
  });
  const lo = modern
    ? ["lo: flags=73<UP,LOOPBACK,RUNNING>  mtu 65536", "        inet 127.0.0.1  netmask 255.0.0.0", "        loop  txqueuelen 1000  (Local Loopback)"]
    : ["lo        Link encap:Local Loopback", "          inet addr:127.0.0.1  Mask:255.0.0.0", "          UP LOOPBACK RUNNING  MTU:16436  Metric:1"];
  return [...blocks, lo].flatMap((b) => [...b, ""]).slice(0, -1);
}

// dhclient -v: the exchange with the router, or the retries that got no answer.
export function dhclient(dev: string, got: { ip: string; server: string; renewSec: number } | null): string[] {
  const discover = (n: number) => `DHCPDISCOVER on ${dev} to 255.255.255.255 port 67 interval ${n}`;
  if (!got) return [discover(3), discover(8), discover(15), discover(19), t("term.dhclient.none"), t("term.dhclient.sleep")];
  return [
    discover(3),
    `DHCPOFFER of ${got.ip} from ${got.server}`,
    `DHCPREQUEST for ${got.ip} on ${dev} to 255.255.255.255 port 67`,
    `DHCPACK of ${got.ip} from ${got.server}`,
    `bound to ${got.ip} -- renewal in ${got.renewSec} seconds.`,
  ];
}

// What the shell sees of a server's network: its ports, the interface that holds the address, and the running setting.
export interface NetView { nics: Nic[]; dev: string; addr: Addr | null; gw: string | null; up: boolean }
// A setting made by ip or ifdown, lost on the next boot; down is the primary interface switched off.
export type Runtime = IfaceConfig & { down?: true };
export interface IpResult { output: string[]; failed?: true; runtime?: Runtime }

const pick = (word: string | undefined, full: string) => !!word && full.startsWith(word);
const after = (args: string[], key: string) => { const i = args.indexOf(key); return i < 0 ? undefined : args[i + 1]; };
const without = (r: Runtime, ...keys: (keyof Runtime)[]): Runtime => Object.fromEntries(Object.entries(r).filter(([k]) => !keys.includes(k as keyof Runtime))) as Runtime;

// The ip command of iproute2 on the server's primary interface: addresses, the default route and the link state.
export function ipCommand(v: NetView, args: string[]): IpResult {
  const fail = (key: string, p: Record<string, string> = {}): IpResult => ({ output: t(key, p).split("\n"), failed: true });
  const now: Runtime = { mode: "static", ...(v.addr ? { ip: v.addr.ip, prefix: v.addr.prefix } : {}), ...(v.gw ? { gw: v.gw } : {}), ...(v.up ? {} : { down: true }) };
  const [obj, cmd, ...rest] = args;
  const known = (name: string | undefined) => (name ? v.nics.some((n) => n.name === name) : true);
  if (!obj) return fail("term.ip.usage");
  if (pick(obj, "address")) {
    const dev = after(rest, "dev");
    if (!cmd || pick(cmd, "show") || pick(cmd, "list")) {
      const name = dev ?? (rest[0] !== "dev" ? rest[0] : undefined);
      if (!known(name)) return fail("term.ip.device", { dev: name! });
      return { output: ipAddr(v.nics.filter((n) => !name || n.name === name)).slice(name ? 4 : 0) };
    }
    if (cmd === "add" || pick(cmd, "delete") || cmd === "flush") {
      if (!dev && cmd !== "flush") return fail("term.ip.devRequired");
      const name = dev ?? rest[0];
      if (!known(name)) return fail("term.ip.device", { dev: name });
      if (name !== v.dev) return fail("term.ip.unsupported");
      if (cmd === "flush") return { output: [], runtime: without(now, "ip", "prefix", "gw") };
      const [ip, slash] = (rest[0] ?? "").split("/"), prefix = slash === undefined ? 32 : Number(slash);
      if (!isIp(ip) || !Number.isInteger(prefix) || prefix < 0 || prefix > 32) return fail("term.ip.prefix", { arg: rest[0] ?? "" });
      if (cmd === "add") return v.addr?.ip === ip ? fail("term.ip.exists") : { output: [], runtime: { ...without(now, "gw"), ip, prefix } };
      return v.addr?.ip !== ip ? fail("term.ip.cannotAssign") : { output: [], runtime: without(now, "ip", "prefix", "gw") };
    }
    return fail("term.ip.command", { cmd, obj: "address" });
  }
  if (pick(obj, "route")) {
    if (!cmd || pick(cmd, "show") || pick(cmd, "list")) return { output: ipRoute(v.dev, v.addr, v.gw, v.up) };
    if (cmd === "add" || pick(cmd, "replace") || pick(cmd, "delete")) {
      if (rest[0] !== "default" && rest[0] !== "0.0.0.0/0") return fail("term.ip.unreachable");
      if (pick(cmd, "delete")) return v.gw ? { output: [], runtime: without(now, "gw") } : fail("term.ip.noProcess");
      const gw = after(rest, "via") ?? "";
      if (!isIp(gw)) return fail("term.ip.inet", { arg: gw });
      if (cmd === "add" && v.gw) return fail("term.ip.exists");
      if (!v.addr || !v.up || !sameNet(gw, v.addr.ip, v.addr.prefix)) return fail("term.ip.unreachable");
      return { output: [], runtime: { ...now, gw } };
    }
    return fail("term.ip.command", { cmd, obj: "route" });
  }
  if (pick(obj, "link")) {
    if (!cmd || pick(cmd, "show") || pick(cmd, "list")) return { output: ipAddr(v.nics).filter((l) => !/^\s+(inet|valid_lft)/.test(l)) };
    if (cmd === "set") {
      const name = rest[0] === "dev" ? rest[1] : rest[0], state = rest.find((w) => w === "up" || w === "down");
      if (!name || !known(name)) return fail("term.ip.device", { dev: name ?? "" });
      if (!state || name !== v.dev) return { output: [] };
      // Down takes the routes with it; up brings the address back but not the default route.
      return { output: [], runtime: state === "down" ? { ...without(now, "gw"), down: true } : without(now, "down") };
    }
    return fail("term.ip.command", { cmd, obj: "link" });
  }
  return fail("term.ip.object", { obj });
}
