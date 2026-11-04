import { REGIONS } from "../../sim/20-world/datacenters";
import { regionBox, type Box, type Detail } from "./detail";
import { CITIES } from "./world-data";

// One lazily loaded patch per European datacenter city, plus the national layer.
export const PATCHES = CITIES.filter((c) => REGIONS.some((r) => !r.us && r.city === c.name)).map((c) => ({ code: c.code, box: regionBox(c.lat, c.lon) }));
const files = import.meta.glob<{ REGION: Detail }>("./region/*.ts");
const loaded = new Map<string, Promise<Detail | null>>();
export const loadRegion = (code: string): Promise<Detail | null> => {
  const load = files[`./region/${code}.ts`];
  if (!load) return Promise.resolve(null);
  if (!loaded.has(code)) loaded.set(code, load().then((m) => m.REGION, () => null));
  return loaded.get(code)!;
};
export const inBox = (b: Box, w: Box) => b.w < w.e && b.e > w.w && b.s < w.n && b.n > w.s;
