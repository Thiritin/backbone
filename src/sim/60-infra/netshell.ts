// docs/design/lan.md, Shell: ip, ifconfig, dhclient, ifup, ifdown and the networking restart on a Lunix server, read from
// lan.ts and written through the setIface and setRuntimeIface actions.
import { t } from "../../i18n/en";
import { modelById } from "../10-catalog/hardware";
import type { Device, GameState, IfaceConfig } from "../50-state";
import { setIface, setRuntimeIface } from "../90-actions/lan";
import { machineAddress } from "./addresses";
import { primaryOf, releaseOf, treeOf } from "./fs";
import { dhclient, IFACES, ifconfig, ipCommand, parseInterfaces, type Addr, type NetView, type Nic } from "./ifaces";
import { addressOf, gatewayOf, ifaceOf, lanOf, macOf } from "./lan";
import { peerOf } from "./status";
import type { CommandResult } from "./terminal";

const lines = (key: string, p: Record<string, string | number> = {}) => t(key, p).split("\n");
const prefixOf = (cidr: string) => Number(cidr.split("/")[1]);
// A dual-port card numbers its ports consecutively.
const nextMac = (mac: string) => mac.replace(/.$/, (x) => ((parseInt(x, 16) + 1) % 16).toString(16));

// The router that gave the server its lease, the lease's remaining seconds and the network's prefix.
function leaseOf(s: GameState, d: Device): { router: Device; addr: Addr; gw: string } | null {
  const ip = addressOf(s, d.id), router = s.devices.find((x) => x.id === gatewayOf(s, d.id)), lan = router && lanOf(s, router);
  if (!ip || !lan) return null;
  const until = lan.leases.find((l) => l.mac === macOf(s, d.id))?.until ?? s.hour + lan.leaseHours;
  return { router: router!, addr: { ip, prefix: prefixOf(lan.cidr), dynamic: Math.max(0, Math.round((until - s.hour) * 3600)) }, gw: lan.gateway };
}

function viewOf(s: GameState, d: Device): NetView {
  const { dev, ports, bonded } = primaryOf(s, d), c = ifaceOf(d), up = !c.down;
  const lease = c.mode === "dhcp" ? leaseOf(s, d) : null;
  const addr: Addr | null = c.mode === "static" ? (c.ip ? { ip: c.ip, prefix: c.prefix ?? 24 } : null) : lease?.addr ?? null;
  const gw = !up ? null : c.mode === "static" ? c.gw ?? null : lease?.gw ?? null;
  const carrier = (port: number) => !!peerOf(s, { device: d.id, port });
  const slave = (name: string, port: number): Nic => ({ name, mac: macOf(s, d.id), up: true, carrier: carrier(port), master: "bond0" });
  const nics: Nic[] = bonded
    ? [slave(ports[0], 0), slave(ports[1], 1), { name: "bond0", mac: macOf(s, d.id), up, carrier: carrier(0) || carrier(1), addr }]
    : [{ name: ports[0], mac: macOf(s, d.id), up, carrier: carrier(0), addr }, { name: ports[1], mac: nextMac(macOf(s, d.id)), up: false, carrier: carrier(1) }];
  return { nics, dev, addr, gw, up };
}

// What a networking restart or ifup reads: the file's setting for the primary interface, or the lines ifup prints.
function fromFile(s: GameState, d: Device): { ok: true; iface: IfaceConfig } | { ok: false; error: string[] } {
  const text = treeOf(s, d.id)[IFACES];
  if (typeof text !== "string") return { ok: false, error: lines("term.ifup.read", { file: IFACES }) };
  return parseInterfaces(text, primaryOf(s, d).dev);
}

// The networking restart, in the words of the release: init script output before Debiant 8, systemctl's after.
function restart(s: GameState, d: Device, via: "init" | "systemctl"): CommandResult {
  const r = fromFile(s, d), modern = Number(releaseOf(s, d.id).version) >= 8;
  if (!r.ok) return { output: [...r.error, ...lines(via === "systemctl" ? "term.net.job" : modern ? "term.net.failedSystemd" : "term.net.failed")], failed: true };
  return { output: via === "systemctl" ? [] : lines(modern ? "term.net.restartSystemd" : "term.net.restart"), action: [setIface, d.id, r.iface] };
}

// The network commands of a session on a server or one of the player's VMs; null for any other word. A VM's network is its
// host's bridge, so it shows its address and changes nothing.
export function netCommand(s: GameState, machineId: string, cmd: string, args: string[]): CommandResult | null {
  const d = s.devices.find((x) => x.id === machineId);
  if (!d || modelById(d.model).kind !== "server") {
    if (cmd !== "ip" && cmd !== "ifconfig") return null;
    const ip = machineAddress(s, machineId), addr = ip ? { ip, prefix: 24 } : null;
    const view: NetView = { nics: [{ name: "eth0", mac: macOf(s, machineId), up: true, carrier: true, addr }], dev: "eth0", addr, gw: null, up: true };
    if (cmd === "ifconfig") return { output: ifconfig(view.nics, args.includes("-a"), Number(releaseOf(s, machineId).version) >= 9) };
    const r = ipCommand(view, args);
    return r.runtime ? { output: lines("term.ip.notPermitted"), failed: true } : r;
  }
  const v = viewOf(s, d), { dev } = primaryOf(s, d), version = Number(releaseOf(s, d.id).version);
  const devArg = args.filter((a) => !a.startsWith("-")).at(-1);
  switch (cmd) {
    case "ip": {
      const r = ipCommand(v, args);
      return { output: r.output, failed: r.failed, action: r.runtime ? [setRuntimeIface, d.id, r.runtime] : undefined };
    }
    case "ifconfig": return { output: ifconfig(v.nics, args.includes("-a"), version >= 9) };
    case "dhclient": {
      // The offer this server would get as a DHCP client, read from a copy of the state where it is one.
      const as = { ...s, devices: s.devices.map((x) => (x.id === d.id ? { ...x, runtime: { mode: "dhcp" as const, boot: x.bootUntil ?? null } } : x)) };
      const lease = leaseOf(as, as.devices.find((x) => x.id === d.id)!);
      const got = lease && { ip: lease.addr.ip, server: lease.gw, renewSec: Math.round((lanOf(as, lease.router)!.leaseHours * 3600) / 2) };
      return { output: dhclient(devArg ?? dev, got), failed: got ? undefined : true, action: [setRuntimeIface, d.id, d.iface?.mode === "static" ? { mode: "dhcp" } : null] };
    }
    case "ifup": case "ifdown": {
      if (!devArg && !args.includes("-a")) return { output: lines("term.ifup.usage", { cmd }), failed: true };
      if (devArg && devArg !== dev && devArg !== "lo") return { output: lines("term.ifup.unknown", { dev: devArg }), failed: true };
      if (devArg === "lo") return { output: [] };
      if (cmd === "ifdown") return { output: [], action: [setRuntimeIface, d.id, { mode: "static", down: true }] };
      const r = fromFile(s, d);
      return r.ok ? { output: [], action: [setIface, d.id, r.iface] } : { output: r.error, failed: true };
    }
    case "/etc/init.d/networking": case "service": {
      const op = cmd === "service" ? (args[0] === "networking" ? args[1] : undefined) : args[0];
      if (cmd === "service" && args[0] !== "networking") return { output: lines("term.service.unknown", { name: args[0] ?? "" }), failed: true };
      if (!op || !["start", "restart", "reload", "force-reload", "stop"].includes(op)) return { output: lines("term.net.usage"), failed: true };
      if (op === "stop") return { output: [], action: [setRuntimeIface, d.id, { mode: "static", down: true }] };
      return restart(s, d, "init");
    }
    case "systemctl": {
      if (version < 8) return null;
      const [op, unit] = args;
      if (op !== "restart" && op !== "start" && op !== "reload") return { output: lines("term.systemctl.unknown", { op: op ?? "" }), failed: true };
      if (unit?.replace(/\.service$/, "") !== "networking") return { output: lines("term.systemctl.unit", { op, unit: unit ?? "" }), failed: true };
      return restart(s, d, "systemctl");
    }
  }
  return null;
}
