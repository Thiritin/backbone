import { expect } from "vitest";
import { newGame, type GameState } from "../src/sim/50-state";
import { connect } from "../src/sim/90-actions/hardware";
import { buyDevice, hypervisor, join, skipTo, withServer } from "./fixtures";
import { mountDevice } from "./plugged";

export const ok = (r: { ok: boolean; id?: string; error?: string }) => { expect(r.error).toBeUndefined(); return r.id!; };
export const err = (r: { ok: boolean; error?: string }) => r.error;
export const SMALL = { vcpu: 1, ramGb: 1, diskGb: 20 };

// A Proxmocks cluster of dev3 and nodes - 1 more servers in 2009; spare is one more free server.
export function pmx(nodes = 3): { s: GameState; c: string; ids: string[]; spare: string } {
  const s = { ...withServer(newGame(1)), cash: 500_000 };
  s.unlocks = [...s.unlocks, "virtualization"];
  skipTo(s, 2009);
  const buy = (slot: number, port: number) => {
    const id = ok(buyDevice(s, "g1-compute", "Dwell", 1, "loc1"));
    ok(mountDevice(s, id, "rack2", slot));
    ok(connect(s, { device: id, port: 0 }, { device: "dev4", port }));
    return id;
  };
  const ids = ["dev3"];
  for (let i = 1; i < nodes; i++) ids.push(buy(2 * i, i));
  const spare = buy(2 * nodes, nodes);
  const c = hypervisor(s, ["dev3"], "PVE", "proxmocks");
  for (const id of ids.slice(1)) join(s, c, id);
  return { s, c, ids, spare };
}
