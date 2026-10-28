import type { GameState } from "../src/sim/50-state";
import { mountDevice as mountOne, mountStack as mountMany } from "../src/sim/90-actions/hardware";

// Mounting leaves power supplies unplugged; suites that are not about power mount through these, which plug every supply in.
const plugAll = <T>(s: GameState, r: T): T => {
  for (const d of s.devices) if (d.rackId) for (const c of d.components) if (c.kind === "psu") c.plugged = true;
  return r;
};

export const mountDevice = (...a: Parameters<typeof mountOne>) => plugAll(a[0], mountOne(...a));
export const mountStack = (...a: Parameters<typeof mountMany>) => plugAll(a[0], mountMany(...a));
