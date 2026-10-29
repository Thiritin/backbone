// Hardware lifecycle (economy.md, Hardware lifecycle): list prices erode while a model is on sale, and a model past its end
// of support is slower and dearer to work on and fails more often.
import { yearOf } from "../00-core/time";
import { modelById, type DeviceModel } from "./hardware";

// List price factor per year on sale after the first, for models other than servers (a server's price follows its parts).
export const ERODE_PER_YEAR = 0.95;
// Past end of support: hands-on work takes this many times as long, spare parts cost this many times as much, and
// components fail this many times as often.
export const WORK_FACTOR = 2;
export const PARTS_FACTOR = 1.5;
export const FAILURE_FACTOR = 1.2;

// The year a model's support ends, null for a model that stays on sale.
export const supportEnd = (m: DeviceModel): number | null => (m.until === null ? null : m.until + m.supportYears);
export const outOfSupport = (m: DeviceModel, year: number): boolean => {
  const end = supportEnd(m);
  return end !== null && year > end;
};

// The list price after the erosion of the years since launch, which stops at the last year on sale.
export function erodedPrice(m: DeviceModel, price: number, year: number): number {
  if (m.server || m.until === null) return price;
  return price * ERODE_PER_YEAR ** Math.max(0, Math.min(year, m.until) - m.from);
}

// Whether a device of this model is out of support at this hour.
export const unsupported = (modelId: string, hour: number): boolean => outOfSupport(modelById(modelId), yearOf(hour));
// How many times as long hands-on work takes on a device of this model.
export const workFactor = (modelId: string, hour: number): number => (unsupported(modelId, hour) ? WORK_FACTOR : 1);
// What a spare part costs on top of its price when the device is out of support, in euro.
export const greySurcharge = (modelId: string, hour: number, partCost: number): number =>
  unsupported(modelId, hour) ? Math.round(partCost * (PARTS_FACTOR - 1) * 100) / 100 : 0;
