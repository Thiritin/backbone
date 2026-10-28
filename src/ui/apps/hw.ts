// Hardware labels shared by the Locations and Shop apps.
import { dateOf } from "../../sim/00-core/time";
import { PATCH_JACKS, type DeviceModel, type PortSpec } from "../../sim/10-catalog/hardware";
import type { End, GameState } from "../../sim/50-state";
import { linkStatus, portPeers, type LinkStatus } from "../../sim/60-infra/status";
import type { Lamp, PortLamp } from "../art/fronts";

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
  if (m.kind === "patch") return `${PATCH_JACKS} jacks`;
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
  if (m.kind === "patch") return i < PATCH_JACKS ? `Front ${i + 1}` : `Back ${i - PATCH_JACKS + 1}`;
  return `${m.ports[i].media === "sfp" && m.ports.some((p) => p.media === "rj45") ? "SFP" : "Port"} ${i + 1}`;
}

export const portLamps = (m: DeviceModel, peers: (End | null)[]): PortLamp[] => peers.map((p, i) => (p ? (m.ports[i].media === "sfp" ? "fiber" : "ok") : "off"));

export function deviceLamps(g: GameState, id: string, m: DeviceModel) {
  return { state: lampOf(linkStatus(g, id)), ports: portLamps(m, portPeers(g, id)) };
}
