// Hardware labels shared by the Locations and Shop apps.
import { dateOf } from "../../sim/00-core/time";
import { COMPONENTS, jacksOf, type ComponentKind, type DeviceModel, type PortSpec } from "../../sim/10-catalog/hardware";
import type { Component, Device, End, GameState } from "../../sim/50-state";
import { deviceHealth, HOURS_PER_YEAR, linkStatus, portPeers, type LinkStatus } from "../../sim/60-infra/status";
import type { Lamp, PartLamp, Parts, PortLamp } from "../art/fronts";

export const speed = (g: number) => (g >= 1 ? `${g}G` : `${g * 1000}M`);
export const ram = (gb: number) => (gb >= 1024 ? `${+(gb / 1024).toFixed(1)} TB` : `${gb} GB`);
export const disk = (gb: number) => (gb >= 1000 ? `${+(gb / 1000).toFixed(1)} TB` : `${gb} GB`);
export const cores = (n: number) => `${n} ${n === 1 ? "core" : "cores"}`;
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
  if (m.kind === "patch") return i < jacksOf(m) ? `Front ${i + 1}` : `Back ${i - jacksOf(m) + 1}`;
  return `${m.ports[i].media === "sfp" && m.ports.some((p) => p.media === "rj45") ? "SFP" : "Port"} ${i + 1}`;
}

export const portLamps = (m: DeviceModel, peers: (End | null)[]): PortLamp[] => peers.map((p, i) => (p ? (m.ports[i].media === "sfp" ? "fiber" : "ok") : "off"));

export const devName = (d: Device) => d.label ?? d.name;
export const PART_NAME: Record<ComponentKind, string> = { hdd: "HDD", ssd: "SSD", nvme: "NVMe", psu: "Power supply", fan: "Fan", ram: "RAM stick", board: "Mainboard", cpu: "CPU", nic: "Network card" };
export const ageYears = (g: GameState, c: Component) => (g.hour - c.installedAt) / HOURS_PER_YEAR;
export const isWorn = (g: GameState, c: Component) => ageYears(g, c) >= COMPONENTS[c.kind].life;

const DRIVE: ReadonlySet<ComponentKind> = new Set(["hdd", "ssd", "nvme"]);
const WORSE: Lamp[] = ["ok", "warn", "bad"];
const HEALTH_LAMP = { ok: "ok", degraded: "warn", hot: "warn", rebuilding: "warn", maintenance: "warn", down: "bad", off: "off" } as const;

// Per-component lights: failed red, past its life amber, the drive being rebuilt blinking amber; all dark while the device is off.
function partLamps(g: GameState, d: Device): Parts {
  const lamp = (c: Component): PartLamp => (!d.on ? "off" : c.failedAt !== null ? "bad" : d.rebuild?.componentId === c.id ? "rebuild" : isWorn(g, c) ? "warn" : "ok");
  const of = (pick: (k: ComponentKind) => boolean) => d.components.filter((c) => pick(c.kind)).map(lamp);
  return { drives: of((k) => DRIVE.has(k)), psus: of((k) => k === "psu"), fans: of((k) => k === "fan") };
}

// The status light is the worse of link and health; a rebuild blinks it.
export function deviceLamps(g: GameState, id: string, m: DeviceModel) {
  const d = g.devices.find((x) => x.id === id)!, h = deviceHealth(g, id).state, link = lampOf(linkStatus(g, id));
  const state: Lamp = h === "off" ? "off" : WORSE[Math.max(WORSE.indexOf(HEALTH_LAMP[h]), WORSE.indexOf(link))];
  return { state, blink: h === "rebuilding", ports: d.on ? portLamps(m, portPeers(g, id)) : portLamps(m, []), parts: partLamps(g, d) };
}
