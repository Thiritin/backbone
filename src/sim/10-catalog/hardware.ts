// Contract for milestone 2; values come from docs/design/economy.md (Server models, Routers).
export type DeviceKind = "server" | "switch" | "gateway" | "patch";
export interface PortSpec { media: "rj45" | "sfp"; gbit: number }
export interface ServerSpec {
  arch: "x86" | "arm";
  sockets: number;
  cores: number;
  ramGb: number;
  maxRamGb: number;
  bays: number;
  diskGb: number;
  disk: "HDD" | "SSD" | "NVMe";
}
export interface DeviceModel {
  id: string;
  name: string;
  kind: DeviceKind;
  // Rack units; shelf devices use one shelf slot and can't go in a rack.
  height: number;
  shelf: boolean;
  ports: PortSpec[];
  watts: number;
  idleWatts: number;
  psus: 1 | 2;
  price: number;
  from: number;
  until: number | null;
  server?: ServerSpec;
}

export const SERVER_BRANDS = ["Dwell", "Hewlett-Packet", "SuperMacro"] as const;
export const SWITCH_BRAND = "Sysko";

export const MODELS: DeviceModel[] = [];
export const modelById = (id: string): DeviceModel => {
  const m = MODELS.find((x) => x.id === id);
  if (!m) throw new Error(`unknown model ${id}`);
  return m;
};
export const shopModels = (year: number): DeviceModel[] => MODELS.filter((m) => m.from <= year && (m.until === null || year <= m.until) && m.price > 0);
