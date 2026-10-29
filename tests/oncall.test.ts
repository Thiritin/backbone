import { describe, expect, it } from "vitest";
import { hourOf } from "../src/sim/00-core/time";
import { createTicket } from "../src/sim/40-support/tickets";
import { cents } from "../src/sim/45-billing/billing";
import { callOut, callOutRate, onCallAt, respond } from "../src/sim/47-staff/oncall";
import { visibleCandidates, type Task } from "../src/sim/47-staff/staff";
import { nextSlot } from "../src/sim/47-staff/technicians";
import { newGame, type GameState } from "../src/sim/50-state";
import { failComponents, tick, type SimEvent } from "../src/sim/88-tick/tick";
import { addCustomer } from "../src/sim/90-actions/customers";
import { buyDevice, setPower } from "../src/sim/90-actions/hardware";
import { hire, queueOperation, setOnCall, setTechRules } from "../src/sim/90-actions/staff";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { withServer } from "./fixtures";

type R = ReturnType<typeof setPower>;
const ok = (r: R) => {
  if (!r.ok) throw new Error(r.error);
  return r.id!;
};
// 2005-01-03 is a Monday.
const MONDAY_9 = 48 + 9;
const TUESDAY_2 = 3 * 24 + 2;
const SATURDAY_2 = 7 * 24 + 2;
const SUNDAY_2 = 8 * 24 + 2;
const run = (s: GameState, hours: number) => {
  const events: SimEvent[] = [];
  for (let h = 0; h < hours; h++) events.push(...tick(s));
  return events;
};
const dev = (s: GameState, id: string) => s.devices.find((d) => d.id === id)!;
const staffer = (s: GameState, id: string) => s.staff.find((e) => e.id === id)!;

function technician(s: GameState, trained: Task[] = ["hardware"]): string {
  const c = visibleCandidates(s).filter((x) => x.role === "technician" && !s.staff.some((e) => e.name === x.name))[0];
  const id = ok(hire(s, c.id));
  s.staff = s.staff.map((e) => (e.id === id ? { ...e, trained: [...trained] } : e));
  return id;
}

// A failed fan in the basement server with a spare in storage, the tick before the given hour.
function failedFan(s: GameState, hour: number) {
  s.hour = hour - 1;
  const fan = dev(s, "dev3").components.find((c) => c.kind === "fan")!;
  s.devices = s.devices.map((d) => (d.id === "dev3" ? failComponents(s, d, [fan.id]) : d));
  ok(buyDevice(s, "part-fan", "Generic", 1, "loc1"));
  return fan.id;
}
const fanFailed = (s: GameState, id: string) => dev(s, "dev3").components.find((c) => c.id === id)?.failedAt != null;

describe("on-call duty", () => {
  it("replaces a failed part on Saturday night only with a roster", () => {
    const without = { ...withServer(newGame(1)), cash: 100_000 };
    technician(without);
    const lost = failedFan(without, SATURDAY_2);
    run(without, 4);
    expect(fanFailed(without, lost)).toBe(true);

    const s = { ...withServer(newGame(1)), cash: 100_000 };
    const id = technician(s);
    ok(setOnCall(s, id, true));
    const fan = failedFan(s, SATURDAY_2);
    const events = run(s, 4);
    expect(fanFailed(s, fan)).toBe(false);
    expect(dev(s, "dev3").components.filter((c) => c.kind === "fan").every((c) => c.failedAt === null)).toBe(true);
    expect(dev(s, "dev3").on).toBe(true);
    expect(events.some((e) => e.key === "event.techReplaced")).toBe(true);
    expect(s.onCall.month[id].callOuts).toBe(1);
    expect(s.onCall.month[id].hours).toBeGreaterThanOrEqual(1);
  });

  it("pays a week's allowance as 5 weekdays at 2 and 2 weekend days at 4 hourly wages", () => {
    const s = { ...withServer(newGame(1)), cash: 100_000 };
    const id = technician(s);
    ok(setOnCall(s, id, true));
    s.hour = MONDAY_9 - 1;
    run(s, 168);
    const p = s.onCall.month[id];
    expect(p.days).toBe(7);
    expect(p.allowance).toBeCloseTo((18 * staffer(s, id).salary) / 173, 1);
    // Month start pays it as its own payroll line and starts a new month.
    s.hour = hourOf(new Date(Date.UTC(2005, 1, 1))) - 1;
    const cash = s.cash;
    run(s, 1);
    expect(s.ledger.find((l) => l.key === "ledger.onCallAllowance")?.amount).toBe(-p.allowance);
    expect(s.cash).toBeLessThan(cash);
    expect(s.onCall.month).toEqual({});
  });

  it("pays a call-out as one hour of overtime with night and Sunday surcharges", () => {
    expect(callOutRate(TUESDAY_2)).toBeCloseTo(1.5);
    expect(callOutRate(SUNDAY_2)).toBeCloseTo(1.75);
    expect(callOutRate(SATURDAY_2 + 12)).toBeCloseTo(1.3);
    const s = { ...withServer(newGame(1)), cash: 100_000 };
    const id = technician(s), e = staffer(s, id);
    s.hour = TUESDAY_2;
    callOut(s, e);
    expect(s.onCall.month[id]).toMatchObject({ callOuts: 1, hours: 1, callPay: cents((e.salary / 173) * 1.5) });
    s.hour = SUNDAY_2;
    callOut(s, e);
    expect(s.onCall.month[id].callPay).toBe(cents(cents((e.salary / 173) * 1.5) + (e.salary / 173) * 1.75));
  });

  it("lets a technician rest 11 hours after a call-out before the next office hour", () => {
    const s = { ...withServer(newGame(1)), cash: 100_000 };
    const id = technician(s);
    ok(setOnCall(s, id, true));
    const fan = failedFan(s, TUESDAY_2);
    run(s, 5);
    expect(fanFailed(s, fan)).toBe(false);
    const last = s.onCall.lastCall[id];
    expect(last).toBeGreaterThanOrEqual(TUESDAY_2);
    // Without the call-out the shutdown would happen at 09:00; rest runs 11 hours past the last call-out hour.
    expect(nextSlot(s, "loc1", "hardware")).toEqual({ name: staffer(s, id).name, hour: last + 12 });
    ok(queueOperation(s, "off", "dev4"));
    run(s, last + 11 - s.hour);
    expect(dev(s, "dev4").on).toBe(true);
    run(s, 1);
    expect(dev(s, "dev4").on).toBe(false);
  });

  it("rotates weekly with the handover on Monday at 09:00 and shows the on-call slot", () => {
    const s = { ...withServer(newGame(1)), cash: 100_000 };
    const a = technician(s), b = technician(s);
    ok(setOnCall(s, a, true));
    ok(setOnCall(s, b, true));
    expect(onCallAt(s, "loc1", MONDAY_9 - 1)?.id).toBe(b);
    expect(onCallAt(s, "loc1", MONDAY_9)?.id).toBe(a);
    expect(onCallAt(s, "loc1", MONDAY_9 + 167)?.id).toBe(a);
    expect(onCallAt(s, "loc1", MONDAY_9 + 168)?.id).toBe(b);
    ok(setOnCall(s, a, false));
    expect(onCallAt(s, "loc1", MONDAY_9)?.id).toBe(b);
    s.hour = SATURDAY_2 - 1;
    expect(nextSlot(s, "loc1", "hardware", true)).toEqual({ name: staffer(s, b).name, hour: SATURDAY_2, onCall: true });
    expect(nextSlot(s, "loc1", "hardware")?.hour).toBe(MONDAY_9 + 168);
    s.staff = s.staff.map((e) => (e.id === a ? { ...e, trained: ["servers"] } : e));
    expect(setOnCall(s, a, true)).toEqual({ ok: false, error: "error.notOnCallTrained" });
  });

  it("blackholes a saturating attack by rule and answers abuse reports", () => {
    const s = { ...withServer(newGame(1)), cash: 100_000 };
    const id = technician(s), e = staffer(s, id);
    const attack = { id: "ddos1", serviceId: "v1", locationId: "loc1", mbps: 500, startedAt: SATURDAY_2, endsAt: SATURDAY_2 + 5, blackholed: false };
    s.hour = SATURDAY_2;
    s.network = { ...s.network, saturated: ["loc1"], attacks: [attack] };
    ok(setTechRules(s, { blackhole: false }));
    expect(respond(s, e, [])).toBe(false);
    ok(setTechRules(s, { blackhole: true }));
    const events: SimEvent[] = [];
    expect(respond(s, e, events)).toBe(true);
    expect(s.network.attacks[0].blackholed).toBe(true);
    expect(events[0].key).toBe("event.onCallBlackhole");

    const cid = addCustomer(s, "Spamco", "private");
    const c = s.customers.find((x) => x.id === cid)!;
    const t = createTicket(s, c, "abuse", null, "spam");
    expect(respond(s, e, [])).toBe(true);
    expect(s.tickets.find((x) => x.id === t.id)!.work).toMatchObject({ op: "reply", arg: "warn", by: e.name });
  });

  it("loads saves from before on-call duty", () => {
    const s = { ...withServer(newGame(1)), cash: 100_000 };
    technician(s);
    const data = JSON.parse(serialize(s));
    delete data.onCall;
    delete data.techRules.blackhole;
    const back = deserialize(JSON.stringify(data));
    expect(back.onCall).toEqual({ roster: [], lastCall: {}, month: {} });
    expect(back.techRules.blackhole).toBe(true);
    run(back, 24);
  });
});
