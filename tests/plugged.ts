import type { GameState } from "../src/sim/50-state";
import { mountDevice as mountOne, mountStack as mountMany } from "../src/sim/90-actions/hardware";

// Mounting leaves power supplies unplugged and takes hand work at a datacenter; suites that are not about power or racking mount
// through these, which have a technician rack the device at once and plug every supply in.
const plugAll = <T>(s: GameState, r: T): T => {
  for (const d of s.devices) {
    if (d.maintenance?.mount) d.maintenance = null;
    if (d.rackId) for (const c of d.components) if (c.kind === "psu") c.plugged = true;
  }
  return r;
};

type One = Parameters<typeof mountOne>;
type Many = Parameters<typeof mountMany>;
export const mountDevice = (s: One[0], id: One[1], rack: One[2], slot: One[3], how: One[4] = true) => plugAll(s, mountOne(s, id, rack, slot, how));
export const mountStack = (s: Many[0], model: Many[1], brand: Many[2], rack: Many[3], n: Many[4], from?: Many[5], how: Many[6] = true) =>
  plugAll(s, mountMany(s, model, brand, rack, n, from, how));
