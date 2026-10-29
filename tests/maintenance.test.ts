import { describe, expect, it } from "vitest";
import { dateOf, hourOf, yearOf } from "../src/sim/00-core/time";
import { sizeSpec } from "../src/sim/10-catalog/products";
import type { Profile } from "../src/sim/30-customers/customers";
import { newGame, type GameState } from "../src/sim/50-state";
import { startOf } from "../src/sim/60-infra/maintenance";
import { tick } from "../src/sim/88-tick/tick";
import { provisionService } from "../src/sim/90-actions/clusters";
import { addCustomer } from "../src/sim/90-actions/customers";
import { setPower } from "../src/sim/90-actions/hardware";
import { cancelMaintenance, moveMaintenance, planMaintenance } from "../src/sim/90-actions/maintenance";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { basement, BASEMENT_SERVER, withServer } from "./fixtures";

const ok = (r: { ok: boolean; id?: string; error?: string }) => { expect(r.error).toBeUndefined(); return r.id!; };
// 2005-01-07 is a Friday.
const at = (day: number, hour: number) => hourOf(new Date(Date.UTC(2005, 0, day, hour)));
const TUE = 11;

// A basement server with one VPS per profile; the clock stands at hour `now`.
function world(profiles: Profile[], now: number) {
  const s = withServer(newGame(1));
  s.cash = 100_000;
  basement(s);
  s.hour = now;
  const ids = profiles.map((p, i) => {
    const cus = addCustomer(s, `Ada Lang ${i}`, p);
    ok(provisionService(s, cus, "vps", { label: `vm${i}`, spec: sizeSpec("vps", 0, yearOf(s.hour)) }));
    return cus;
  });
  const who = (id: string) => s.customers.find((c) => c.id === id)!;
  return { s, ids, who };
}
const target = { kind: "device", id: BASEMENT_SERVER } as const;
const run = (s: GameState, hours: number) => { for (let i = 0; i < hours; i++) tick(s); };
const runTo = (s: GameState, hour: number) => { while (s.hour < hour) tick(s); };
const outages = (s: GameState, cus: string) => s.tickets.filter((t) => t.customerId === cus && t.kind === "outage");
const down = (s: GameState) => Object.values(s.downHours).reduce((n, h) => n + h, 0);

// Plans a window at Tuesday 10:00 announced `ahead` hours before it, pulls the plug when it opens and runs `hours` of it.
function outageIn(planned: boolean, ahead: number, hours = 4, length = 4) {
  const from = at(TUE, 10), w = world(["smallBiz"], from - ahead);
  if (planned) ok(planMaintenance(w.s, target, from, length));
  runTo(w.s, from - 1);
  const start = w.who(w.ids[0]).happiness;
  setPower(w.s, BASEMENT_SERVER, false);
  run(w.s, hours + 1);
  return { ...w, from, start, lost: start - w.who(w.ids[0]).happiness };
}

describe("planned maintenance", () => {
  it("writes no tickets, costs no happiness and earns no SLA credit inside an announced window", () => {
    const control = outageIn(false, 30);
    expect(control.lost).toBeGreaterThan(0);
    expect(down(control.s)).toBeGreaterThan(0);
    const w = outageIn(true, 30, 3);
    expect(w.s.maintenance).toHaveLength(1);
    expect(w.lost).toBe(0);
    expect(outages(w.s, w.ids[0])).toHaveLength(0);
    expect(down(w.s)).toBe(0);
  });

  it("counts work past the window as a normal outage from the window's end", () => {
    const w = outageIn(true, 30, 3);
    expect(w.lost).toBe(0);
    run(w.s, 6);
    expect(w.s.maintenance).toHaveLength(0);
    expect(w.start - w.who(w.ids[0]).happiness).toBeGreaterThan(0);
    expect(down(w.s)).toBeGreaterThan(0);
  });

  it("halves the penalties of a window announced under a day ahead", () => {
    const full = outageIn(false, 30, 3), late = outageIn(true, 10, 3);
    expect(late.lost).toBeGreaterThan(0);
    expect(late.lost).toBeCloseTo(full.lost / 2);
    expect(down(late.s)).toBeCloseTo(down(full.s) / 2);
  });

  it("sends each customer a notice and lists them as covered", () => {
    const w = world(["smallBiz", "hobbyDev"], at(TUE, 8));
    ok(planMaintenance(w.s, target, at(TUE + 1, 1), 4));
    const notices = w.s.tickets.filter((t) => t.kind === "maintenance" && t.topic === "notice");
    expect(notices.map((t) => t.customerId).sort()).toEqual([...w.ids].sort());
    expect([...w.s.maintenance[0].customerIds].sort()).toEqual([...w.ids].sort());
  });

  it("lets an online shop ask to move a weekday daytime window and moving is free", () => {
    const w = world(["onlineShop"], at(TUE, 8));
    const id = ok(planMaintenance(w.s, target, at(TUE + 1, 9), 4));
    const ask = w.s.tickets.find((t) => t.topic === "move")!;
    expect(ask.status).toBe("open");
    expect(w.s.maintenance[0].customerIds).toEqual([]);
    const cash = w.s.cash;
    ok(moveMaintenance(w.s, id, at(TUE + 1, 23)));
    expect(w.s.cash).toBe(cash);
    expect(w.s.tickets.find((t) => t.id === ask.id)!.status).toBe("resolved");
    expect(w.s.maintenance[0].customerIds).toEqual(w.ids);
    expect(w.s.maintenance[0].notifiedAt).toBe(w.s.hour);
  });

  it("makes a gamer decline a Friday night window and accept a Thursday night one", () => {
    const w = world(["gamer"], at(TUE, 8));
    ok(planMaintenance(w.s, target, at(TUE + 4, 1), 4));
    expect(w.s.tickets.find((t) => t.topic === "declined")!.outcome).toBe("declined");
    expect(w.s.maintenance[0].customerIds).toEqual([]);
    ok(planMaintenance(w.s, target, at(TUE + 3, 1), 4));
    expect(w.s.maintenance[1].customerIds).toEqual(w.ids);
  });

  it("offers tonight, tomorrow night and the weekend night at 01:00", () => {
    const now = at(TUE, 14);
    expect([startOf("tonight", now), startOf("tomorrow", now)]).toEqual([at(TUE + 1, 1), at(TUE + 2, 1)]);
    expect(dateOf(startOf("weekend", now)).getUTCDay()).toBe(6);
    expect(startOf("tonight", at(TUE, 0))).toBe(at(TUE, 1));
  });

  it("cancels a window and rejects a start in the past", () => {
    const w = world(["smallBiz"], at(TUE, 8));
    expect(planMaintenance(w.s, target, w.s.hour, 4).ok).toBe(false);
    const id = ok(planMaintenance(w.s, target, at(TUE + 1, 1), 4));
    ok(cancelMaintenance(w.s, id));
    expect(w.s.maintenance).toEqual([]);
  });

  it("loads saves from before maintenance windows", () => {
    const raw = JSON.parse(serialize(newGame(1)));
    delete raw.maintenance;
    expect(deserialize(JSON.stringify(raw)).maintenance).toEqual([]);
  });
});
