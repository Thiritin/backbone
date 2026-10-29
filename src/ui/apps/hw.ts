// Hardware labels shared by the Locations and Shop apps.
import { dateOf } from "../../sim/00-core/time";
import { COMPONENTS, jacksOf, type ComponentKind, type DeviceModel, type PortSpec } from "../../sim/10-catalog/hardware";
import type { Component, Device, End, GameState } from "../../sim/50-state";
import { deviceHealth, HOURS_PER_YEAR, isPlugged, linkStatus, portPeers, type LinkStatus } from "../../sim/60-infra/status";
import { portLinks, type PortLink } from "../../sim/60-infra/usage";
import type { Lamp, PartLamp, Parts, PortLamp, PortLight } from "../art/fronts";

export const speed = (g: number) => (g >= 1 ? `${g}G` : `${g * 1000}M`);
export const ram = (gb: number) => (gb >= 1024 ? `${+(gb / 1024).toFixed(1)} TB` : `${gb} GB`);
export const disk = (gb: number) => (gb >= 1000 ? `${+(gb / 1000).toFixed(1)} TB` : `${gb} GB`);
export const cores = (n: number) => `${n} ${n === 1 ? "core" : "cores"}`;
const FF_LABEL = { "3.5": '3.5"', "2.5": '2.5"', nvme: "NVMe" } as const;
// Size of a sized part ("16 GB", "4 TB, 3.5\"", "32 cores"), or a dash for parts without one.
export const partSize = (c: Pick<Component, "kind" | "size" | "ff">): string =>
  c.size === undefined ? "-" : c.kind === "ram" ? ram(c.size) : c.kind === "cpu" ? cores(c.size) : `${disk(c.size)}${c.ff ? `, ${FF_LABEL[c.ff]}` : ""}`;
const SLOT_NAME: Partial<Record<ComponentKind, string>> = { hdd: "Bay", ssd: "Bay", nvme: "Bay", ram: "DIMM", cpu: "Socket", psu: "PSU bay", fan: "Fan" };
// Slot a part sits in: the nth of its kind, or its fixed place on the board.
export const partSlot = (kind: ComponentKind, nth: number): string => (SLOT_NAME[kind] ? `${SLOT_NAME[kind]} ${nth}` : "Onboard");
export const height = (m: DeviceModel) => `${m.height}U`;
export const watts = (w: number) => `${Math.round(w).toLocaleString("en-GB")} W`;
export const day = (hour: number) => dateOf(hour).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
export const lampOf = (st: LinkStatus): Lamp => (!st.online ? "bad" : st.warning ? "warn" : "ok");
export const CABLE_NAME = { copper: "copper", dac: "DAC", fiber: "fiber" };

export function portsText(m: DeviceModel): string {
  if (m.kind === "patch") return `${jacksOf(m)} jacks`;
  const runs: { p: PortSpec; n: number }[] = [];
  for (const p of m.ports) {
    const last = runs.at(-1);
    if (last && last.p.media === p.media && last.p.gbit === p.gbit) last.n++;
    else runs.push({ p, n: 1 });
  }
  return runs.map(({ p, n }) => `${n} × ${p.media === "sfp" ? "SFP " : ""}${speed(p.gbit)}`).join(", ");
}

export function portName(m: DeviceModel, i: number): string {
  if (m.kind === "server") return `eth${i}`;
  if (m.kind === "patch") return i < jacksOf(m) ? `Top ${i + 1}` : `Bottom ${i - jacksOf(m) + 1}`;
  return `${m.ports[i].media === "sfp" && m.ports.some((p) => p.media === "rj45") ? "SFP" : "Port"} ${i + 1}`;
}

export const portLamps = (m: DeviceModel, peers: (End | null)[]): PortLamp[] => peers.map((p, i) => (p ? (m.ports[i].media === "sfp" ? "fiber" : "ok") : "off"));

export const devName = (d: Device) => d.label ?? d.name;
export const PART_NAME: Record<ComponentKind, string> = { hdd: "HDD", ssd: "SSD", nvme: "NVMe", psu: "Power supply", fan: "Fan", ram: "RAM stick", board: "Mainboard", cpu: "CPU", nic: "Network card" };
// A sized part by name: "RAM stick 16 GB", "HDD 4 TB, 3.5\"".
export const partLabel = (p: Pick<Component, "kind" | "size" | "ff">): string => `${PART_NAME[p.kind]}${p.size === undefined ? "" : ` ${partSize(p)}`}`;
export const ageYears = (g: GameState, c: Component) => (g.hour - c.installedAt) / HOURS_PER_YEAR;
export const isWorn = (g: GameState, c: Component) => ageYears(g, c) >= COMPONENTS[c.kind].life;

const DRIVE: ReadonlySet<ComponentKind> = new Set(["hdd", "ssd", "nvme"]);
const WORSE: Lamp[] = ["ok", "warn", "bad"];
const HEALTH_LAMP = { ok: "ok", degraded: "warn", hot: "warn", rebuilding: "warn", booting: "warn", maintenance: "warn", down: "bad", hung: "bad", nopower: "off", off: "off" } as const;

// Per-component lights: failed red, past its life amber, the drive being rebuilt blinking amber; all dark while the device is off.
function partLamps(g: GameState, d: Device): Parts {
  const lamp = (c: Component): PartLamp => (!d.on || !isPlugged(c) ? "off" : c.failedAt !== null ? "bad" : d.rebuild?.componentId === c.id ? "rebuild" : isWorn(g, c) ? "warn" : "ok");
  const of = (pick: (k: ComponentKind) => boolean) => d.components.filter((c) => pick(c.kind)).map(lamp);
  return { drives: of((k) => DRIVE.has(k)), psus: of((k) => k === "psu"), fans: of((k) => k === "fan") };
}

// The status light is the worse of link and health; a rebuild blinks it.
export function deviceLamps(g: GameState, id: string, m: DeviceModel) {
  const d = g.devices.find((x) => x.id === id)!, h = deviceHealth(g, id).state, link = lampOf(linkStatus(g, id));
  const state: Lamp = h === "off" || h === "nopower" ? "off" : WORSE[Math.max(WORSE.indexOf(HEALTH_LAMP[h]), WORSE.indexOf(link))];
  const frozen = g.frozen.includes(id);
  return { state: frozen ? "bad" as Lamp : state, blink: frozen || h === "rebuilding" || h === "booting", ports: d.on && h !== "nopower" ? portLamps(m, portPeers(g, id)) : portLamps(m, []), lights: portLights(g, id, m), parts: partLamps(g, d) };
}

// Every change to the game replaces the state object, so the links are worked out once per state for all devices.
const LINKS = new WeakMap<GameState, Map<string, (PortLink | null)[]>>();
export function portLights(g: GameState, id: string, m: DeviceModel): PortLight[] {
  let links = LINKS.get(g);
  if (!links) LINKS.set(g, (links = portLinks(g)));
  return (links.get(id) ?? []).map((l, i) => l && { lamp: l.gbit < m.ports[i].gbit ? "warn" : "ok", load: l.load });
}
