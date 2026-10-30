import { expect } from "vitest";
import { isMonthStart } from "../src/sim/00-core/time";
import { type GameState } from "../src/sim/50-state";
import { tick } from "../src/sim/88-tick/tick";
import { createVm } from "../src/sim/90-actions/clusters";
import { installSoftware } from "../src/sim/90-actions/software";
import type { ActionResult } from "../src/sim/90-actions/hardware";
import { bootedMachine } from "./fixtures";

export const err = (r: { ok: boolean; error?: string }) => (r.ok ? "ok" : r.error);
export const idOf = (r: ActionResult) => (r.ok ? r.id! : "");
export const run = (s: GameState, hours: number) => { for (let h = 0; h < hours; h++) tick(s); };
export const toMonthStart = (s: GameState) => { do tick(s); while (!isMonthStart(s.hour)); };
export const mailLedger = (s: GameState) => s.ledger.filter((e) => e.hour === s.hour && e.key === "ledger.companyMail");

// A mail server in a VM on the basement hypervisor, installed and running.
export function selfHosted(s: GameState, software = "postfixit"): string {
  s.company = { ...s.company, mail: { kind: "free" } };
  const vm = createVm(s, s.clusters.find((c) => c.kind === "cloud")!.id, { vcpu: 2, ramGb: 4, diskGb: 40 });
  expect(vm.ok).toBe(true);
  const r = installSoftware(s, bootedMachine(s, idOf(vm)), software);
  expect(err(r)).toBe("ok");
  run(s, 6);
  return idOf(r);
}
