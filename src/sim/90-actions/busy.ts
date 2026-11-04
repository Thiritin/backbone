// Conflicts between hand work orders. An order claims the units it changes and the rack slots it occupies or frees; a new order that
// shares a claim with any open order (of any worker) is refused as busy. Every order is validated against the committed state, not the
// state after the open orders, so a mount behind a pending unmount of the same slot is busy too. Cabling and power toggles claim nothing.
import type { GameState } from "../50-state";
import { heightIn } from "../60-infra/status";

export interface Claim { deviceId?: string; rackId?: string; slot?: number; height?: number }

// A stack claims its whole rack: where it lands is only settled when the work is done.
const keysOf = (c: Claim): string[] => [
  ...(c.deviceId ? [`d:${c.deviceId}`] : []),
  ...(c.rackId ? (c.slot === undefined ? [`r:${c.rackId}:*`] : Array.from({ length: c.height ?? 1 }, (_, i) => `r:${c.rackId}:${c.slot! + i}`)) : []),
];

const clash = (a: string, b: string): boolean => a === b || (a.endsWith(":*") && b.startsWith(a.slice(0, -1))) || (b.endsWith(":*") && a.startsWith(b.slice(0, -1)));

// What a hands-on action claims.
function claimsOf(s: GameState, name: string, args: unknown[]): Claim[] {
  const id = args[0] as string, d = s.devices.find((x) => x.id === id);
  const here = (): Claim[] => (d?.rackId ? [{ rackId: d.rackId, slot: d.slot, height: heightIn(s, d.rackId, d.model) }] : []);
  switch (name) {
    case "mountDevice": return [{ deviceId: id }, ...(d ? [{ rackId: args[1] as string, slot: args[2] as number, height: heightIn(s, args[1] as string, d.model) }] : [])];
    case "moveInRack": return [{ deviceId: id }, ...here(), ...(d?.rackId ? [{ rackId: d.rackId, slot: args[1] as number, height: heightIn(s, d.rackId, d.model) }] : [])];
    case "unmountDevice": return [{ deviceId: id }, ...here()];
    case "mountStack": return [{ rackId: args[2] as string }];
    case "installPart": case "removePart": case "replaceComponent": return [{ deviceId: id }];
    default: return [];
  }
}

const openKeys = (s: GameState): string[] =>
  s.orders.filter((o) => !o.applied && o.action).flatMap((o) => claimsOf(s, o.action!.name, o.action!.args).flatMap(keysOf));

const taken = (s: GameState, claims: Claim[]): boolean => {
  const open = openKeys(s);
  return claims.flatMap(keysOf).some((k) => open.some((o) => clash(k, o)));
};

// The refusal for a hands-on action that clashes with an open order.
export const busyAction = (s: GameState, name: string, args: unknown[]): "error.busy" | null => (taken(s, claimsOf(s, name, args)) ? "error.busy" : null);

// The refusal for any change to a unit or slot an open order claims; the UI disables the key with it.
export const busyReason = (s: GameState, target: Claim): "error.busy" | null => (taken(s, [target]) ? "error.busy" : null);
