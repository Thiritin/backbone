// docs/design/software.md, 8.6: what each hardware manufacturer has released, for its site and the News app. Pure.
import { brandFrom, brandsOf, jacksOf, MANUFACTURERS, MODELS, modelName, type DeviceModel, type Manufacturer } from "../10-catalog/hardware";

// The brands with a site of their own: every manufacturer that sells machines or network gear.
export const VENDORS = MANUFACTURERS.filter((m) => m.id !== "generic");
// A brand's site exists from the month its first model is released.
export const vendorLive = (maker: Manufacturer, month: number): boolean => vendorReleases(maker, month).length > 0;
// docs/design/software.md, 8.3: each brand under its pun, .de where the pun is German.
const VENDOR_TLD: Record<string, string> = { avn: "de", junipurr: "net" };
export const vendorHost = (id: string): string => `${id}.${VENDOR_TLD[id] ?? "com"}`;

type Params = Record<string, string | number>;
// month is year * 12 + month, January 0. key and params make the one-line release sentence.
export interface Release { month: number; model: DeviceModel; key: string; params: Params }

// The headline spec of a model by class.
function spec(m: DeviceModel): Params {
  if (m.server) return { height: m.height, cores: m.server.cores, ram: m.server.ramGb };
  if (m.nodes) return { height: m.height, nodes: m.nodes.count };
  if (m.kind === "switch") return { ports: m.ports.length, gbit: Math.max(...m.ports.map((p) => p.gbit)) };
  if (m.kind === "firewall" || m.kind === "gateway") return { gbit: m.throughputGbit ?? 0 };
  if (m.kind === "patch") return { jacks: jacksOf(m) };
  if (m.kind === "ups") return { wh: m.batteryWh ?? 0 };
  return { outlets: m.outlets ?? 0 };
}

// Every model the brand sells, newest first, up to and including this month. Twin nodes come with their chassis.
export function vendorReleases(maker: Manufacturer, month = Infinity): Release[] {
  return MODELS.filter((m) => m.price > 0 && !m.chassis && m.kind !== "part" && brandsOf(m).includes(maker.name))
    .map((m) => ({ month: brandFrom(m, maker.name), model: m, key: `vendor.release.${m.server ? "server" : m.kind}`, params: { brand: maker.name, model: modelName(m, maker.name), ...spec(m) } }))
    .filter((r) => r.month <= month)
    .sort((a, b) => b.month - a.month || a.model.name.localeCompare(b.model.name));
}
