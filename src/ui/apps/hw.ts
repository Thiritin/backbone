// Hardware labels shared by the Locations and Shop apps.
import { dateOf } from "../../sim/00-core/time";
import { cardOf } from "../../sim/10-catalog/gpu";
import { COMPONENTS, isOobPort, jacksOf, OOB_PORT, oobPorts, type ComponentKind, type DeviceModel, type PortSpec } from "../../sim/10-catalog/hardware";
import { cpuModel, skuOf, socketOf, VENDOR_NAME } from "../../sim/10-catalog/cpus";
import { familyById, familyName } from "../../sim/10-catalog/families";
import type { Component, Device, End, GameState } from "../../sim/50-state";
import { deviceHealth, HOURS_PER_YEAR, isPlugged, linkStatus, portPeers, type LinkStatus } from "../../sim/60-infra/status";
import { isMgmtDevice, oobUp } from "../../sim/60-infra/oob";
import { portLinks, type PortLink } from "../../sim/60-infra/usage";
import type { Lamp, PartLamp, Parts, PortLamp, PortLight } from "../art/fronts";
import { oobLabel } from "../art/mgmt";
import { LOCALE } from "../../i18n/lang";
import { t } from "../../i18n/en";

export const speed = (g: number) => (g >= 1000 ? `${+(g / 1000).toFixed(1)}T` : g >= 1 ? `${g}G` : `${g * 1000}M`);
export const ram = (gb: number) => (gb >= 1024 ? `${+(gb / 1024).toFixed(1)} TB` : `${gb} GB`);
export const disk = (gb: number) => (gb >= 1000 ? `${+(gb / 1000).toFixed(1)} TB` : `${gb} GB`);
export const cores = (n: number) => t("apps.hw.cores", { n });
const FF_LABEL = { "3.5": '3.5"', "2.5": '2.5"', nvme: "NVMe" } as const;
// Size of a sized part ("16 GB", "4 TB, 3.5\"", "32 cores"), or a dash for parts without one.
export const partSize = (c: Pick<Component, "kind" | "size" | "ff" | "sku">): string =>
  c.size === undefined ? "-" : c.kind === "board" ? t("apps.hw.cpusUpTo", { cores: cores(c.size) }) : c.kind === "ram" ? ram(c.size) : c.kind === "cpu" ? cores(c.size) : c.kind === "gpu" ? cardOf(c.size, c.sku).name : `${disk(c.size)}${c.ff ? `, ${FF_LABEL[c.ff]}` : ""}`;
const SLOT_NAME: Partial<Record<ComponentKind, string>> = { hdd: t("apps.hw.slot.bay"), ssd: t("apps.hw.slot.bay"), nvme: t("apps.hw.slot.bay"), ram: t("apps.hw.slot.dimm"), cpu: t("apps.hw.slot.socket"), psu: t("apps.hw.slot.psu"), fan: t("apps.hw.slot.fan"), gpu: t("apps.hw.slot.pcie") };
// Slot a part sits in: the nth of its kind, or its fixed place on the board.
export const partSlot = (kind: ComponentKind, nth: number): string => (SLOT_NAME[kind] ? t("apps.hw.slot", { kind: SLOT_NAME[kind]!, n: nth }) : t("apps.hw.onboard"));
export const height = (m: DeviceModel) => (m.kind === "gateway" && m.height === 0 ? t("apps.hw.panel") : `${m.height}U`);
export const watts = (w: number) => `${Math.round(w).toLocaleString(LOCALE)} W`;
export const day = (hour: number) => dateOf(hour).toLocaleDateString(LOCALE, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
// Counts down in days while a day or more is left, then in hours.
export const readyIn = (at: number, now: number) => {
  const left = Math.max(1, Math.ceil(at - now)), days = Math.floor(left / 24);
  return days ? t("apps.hw.days", { n: days }) : `${left} h`;
};
export const lampOf = (st: LinkStatus): Lamp => (!st.online ? "bad" : st.warning ? "warn" : "ok");
export const CABLE_NAME = { copper: t("apps.hw.cable.copper"), dac: "DAC", fiber: t("apps.hw.cable.fiber"), rollover: t("apps.hw.cable.rollover") };

export function portsText(m: DeviceModel): string {
  if (m.kind === "patch") return t("apps.hw.jacks", { n: jacksOf(m) });
  if (m.kind === "kvm" || m.kind === "console" || m.kind === "oob") {
    const n = (k: string) => oobPorts(m).filter((p) => p === k).length;
    return m.kind === "oob" ? `${n("net")} × 1G` : t(m.kind === "kvm" ? "apps.hw.portsKvm" : "apps.hw.portsSerial", { n: n(m.kind === "kvm" ? "kvm" : "serial") });
  }
  const runs: { p: PortSpec; n: number }[] = [];
  for (const p of m.ports) {
    const last = runs.at(-1);
    if (last && last.p.media === p.media && last.p.gbit === p.gbit) last.n++;
    else runs.push({ p, n: 1 });
  }
  return runs.map(({ p, n }) => `${n} × ${p.media === "sfp" ? "SFP " : p.media === "dsl" ? `${t("art.portDsl")} ` : ""}${speed(p.gbit)}`).join(", ");
}

export function portName(m: DeviceModel, i: number): string {
  if (isOobPort(i)) { const l = oobLabel(m, i); return /^\d+$/.test(l) ? t("apps.hw.oobPort", { kind: oobPorts(m)[i - OOB_PORT] === "kvm" ? t("apps.hw.kvm") : t("apps.hw.serial"), label: l }) : l; }
  if (m.kind === "server") return `eth${i}`;
  if (m.kind === "patch") return i < jacksOf(m) ? t("apps.hw.portTop", { n: i + 1 }) : t("apps.hw.portBottom", { n: i - jacksOf(m) + 1 });
  if (m.ports[i].media === "dsl") return t("art.portDsl");
  return t(m.ports[i].media === "sfp" && m.ports.some((p) => p.media === "rj45") ? "apps.hw.portSfp" : "apps.hw.port", { n: i + 1 });
}

export const portLamps = (m: DeviceModel, peers: (End | null)[]): PortLamp[] => peers.map((p, i) => (p ? (m.ports[i].media === "sfp" ? "fiber" : "ok") : "off"));

export const devName = (d: Device) => d.label ?? d.name;
export const PART_NAME: Record<ComponentKind, string> = { hdd: "HDD", ssd: "SSD", nvme: "NVMe", psu: t("apps.hw.part.psu"), fan: t("apps.hw.part.fan"), ram: t("apps.hw.part.ram"), board: t("apps.hw.part.board"), cpu: "CPU", nic: t("apps.hw.part.nic"), gpu: "GPU" };
// A CPU's clock, "2.0 GHz, 2.8 GHz boost"; empty for anything else or a CPU of unknown make.
export const clockLabel = (p: Pick<Component, "kind" | "vendor" | "gen" | "size" | "sku">): string => {
  if (p.kind !== "cpu") return "";
  const k = skuOf(p);
  if (k) return k.boost > k.ghz ? t("apps.hw.boost", { ghz: k.ghz, boost: k.boost }) : `${k.ghz} GHz`;
  const c = p.vendor && p.gen ? cpuModel(p.vendor, p.gen) : undefined;
  return c ? `${c.ghz} GHz` : "";
};
// Cores and threads of a CPU, "8c/16t".
export const threadsLabel = (p: Pick<Component, "kind" | "vendor" | "gen" | "size" | "sku">): string => {
  const k = p.kind === "cpu" ? skuOf(p) : undefined;
  return k ? `${k.cores}c/${k.threads}t` : "";
};
// A sized part by name: "RAM stick 16 GB", "HDD 4 TB, 3.5\"", "Indel Xenon E5-2650, 8c/16t, 2.0 GHz, 2.8 GHz boost", "AMB Mainboard".
export const partLabel = (p: Pick<Component, "kind" | "size" | "ff" | "vendor" | "gen" | "sku">): string => {
  if (p.kind === "board" && p.vendor && p.gen && p.size !== undefined) return t("apps.hw.mainboard", { name: `${VENDOR_NAME[p.vendor]} ${socketOf(p.vendor, p.gen)}-${p.size}` });
  const k = p.kind === "cpu" ? skuOf(p) : undefined;
  if (k) return `${VENDOR_NAME[k.vendor]} ${k.name}, ${threadsLabel(p)}, ${clockLabel(p)}`;
  // A stick or drive with a maker: "Sumsang DDR4-2933 RDIMM 32 GB", "Seagull Exos 4 TB, 3.5\"".
  const f = familyById(p.sku);
  if (f) return `${familyName(f)} ${partSize(p)}`;
  return `${p.vendor ? `${VENDOR_NAME[p.vendor]} ` : ""}${p.gen ? `G${p.gen} ` : ""}${PART_NAME[p.kind]}${p.size === undefined ? "" : ` ${partSize(p)}`}${clockLabel(p) ? `, ${clockLabel(p)}` : ""}`;
};
// The memory and drives of a server as spec rows: each family with its count and size, the sticks' type and speed, the drives' interface, speed and wear rating.
type Fitted = Pick<Component, "kind" | "size" | "ff" | "vendor" | "gen" | "sku">;
export function memoryDriveRows(parts: Fitted[]): [string, string][] {
  const group = (kinds: string[]) => {
    const found = parts.filter((p) => kinds.includes(p.kind));
    return found.length ? { n: found.length, p: found[0], f: familyById(found[0].sku) } : undefined;
  };
  const ramPart = group(["ram"]), drive = group(["hdd", "ssd", "nvme"]);
  const rows: [string, string][] = [];
  if (ramPart) {
    const f = ramPart.f;
    rows.push([t("apps.hw.memory"), `${ramPart.n} × ${partLabel(ramPart.p)}`]);
    if (f && f.kind === "ram") rows.push([t("apps.hw.memoryType"), `${f.ddr}-${f.mts} ${f.stick}`]);
  }
  if (drive) {
    const f = drive.f;
    rows.push([t("apps.hw.drives"), `${drive.n} × ${partLabel(drive.p)}`]);
    if (f && f.kind !== "ram") rows.push([t("apps.hw.driveInterface"), `${f.iface}${f.rpm ? `, ${f.rpm.toLocaleString(LOCALE)} rpm` : f.dwpd ? `, ${f.dwpd} DWPD` : ""}`], [t("apps.hw.driveSpeed"), `${f.mbps} MB/s, ${f.iops.toLocaleString(LOCALE)} IOPS`]);
  }
  return rows;
}
// A used part's age stays unknown (null) until a burn-in has looked at it.
export const ageYears = (g: GameState, c: Component): number | null => (c.wear ? null : (g.hour - c.installedAt) / HOURS_PER_YEAR);
export const isWorn = (g: GameState, c: Component) => { const a = ageYears(g, c); return a === null ? c.wear === "worn" : a >= COMPONENTS[c.kind].life; };

const DRIVE: ReadonlySet<ComponentKind> = new Set(["hdd", "ssd", "nvme"]);
const WORSE: Lamp[] = ["ok", "warn", "bad"];
const HEALTH_LAMP = { ok: "ok", degraded: "warn", hot: "warn", rebuilding: "warn", booting: "warn", halting: "warn", setup: "warn", maintenance: "warn", down: "bad", hung: "bad", stuck: "bad", locked: "bad", nopower: "off", off: "off" } as const;

// Per-component lights: failed red, past its life amber, the drive being rebuilt blinking amber; all dark while the device is off.
function partLamps(g: GameState, d: Device): Parts {
  const lamp = (c: Component): PartLamp => (!d.on || !isPlugged(c) ? "off" : c.failedAt !== null ? "bad" : d.rebuild?.componentId === c.id ? "rebuild" : isWorn(g, c) ? "warn" : "ok");
  const of = (pick: (k: ComponentKind) => boolean) => d.components.filter((c) => pick(c.kind)).map(lamp);
  return { drives: of((k) => DRIVE.has(k)), psus: of((k) => k === "psu"), fans: of((k) => k === "fan") };
}

// The status light is the worse of link and health; a rebuild blinks it.
export function deviceLamps(g: GameState, id: string, m: DeviceModel) {
  const d = g.devices.find((x) => x.id === id)!, h = deviceHealth(g, id).state;
  const link: Lamp = isMgmtDevice(d) ? (oobUp(g, id) ? "ok" : "bad") : lampOf(linkStatus(g, id));
  const state: Lamp = h === "off" || h === "nopower" ? "off" : WORSE[Math.max(WORSE.indexOf(HEALTH_LAMP[h]), WORSE.indexOf(link))];
  return { state, blink: h === "rebuilding" || h === "booting" || h === "halting", ports: d.on && h !== "nopower" ? portLamps(m, portPeers(g, id)) : portLamps(m, []), lights: portLights(g, id, m), parts: partLamps(g, d) };
}

// Every change to the game replaces the state object, so the links are worked out once per state for all devices.
const LINKS = new WeakMap<GameState, Map<string, (PortLink | null)[]>>();
export function portLights(g: GameState, id: string, m: DeviceModel): PortLight[] {
  let links = LINKS.get(g);
  if (!links) LINKS.set(g, (links = portLinks(g)));
  return (links.get(id) ?? []).map((l, i) => l && { lamp: l.gbit < m.ports[i].gbit ? "warn" : "ok", load: l.load });
}
