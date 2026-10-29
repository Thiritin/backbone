import type { DeviceModel } from "../../../sim/10-catalog/hardware";

export interface Filter { form: string | null; cores: number; ram: number; disk: string | null }
export const NO_FILTER: Filter = { form: null, cores: 0, ram: 0, disk: null };
export const FORMS = ["1U", "2U", "4U"];
export const DISKS = ["HDD", "SSD", "NVMe"];
export const CORES = [0, 4, 8, 16, 32, 64];
export const RAMS = [0, 16, 64, 256, 1024];

export const formOf = (m: DeviceModel) => `${m.height}U`;
export const isSet = (f: Filter) => f.form !== null || f.cores > 0 || f.ram > 0 || f.disk !== null;

// Form factor applies to every device; cores, RAM and disk drop anything that is not a server.
export const matchesFilter = (m: DeviceModel, f: Filter): boolean => {
  const s = m.server;
  if (f.form && formOf(m) !== f.form) return false;
  if (!s) return !f.cores && !f.ram && !f.disk;
  return s.cores >= f.cores && s.ramGb >= f.ram && (!f.disk || s.disk === f.disk);
};
