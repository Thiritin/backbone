import { describe, expect, it } from "vitest";
import { hourOf } from "../src/sim/00-core/time";
import { billingTick, owed } from "../src/sim/45-billing/billing";
import { staffTick } from "../src/sim/47-staff/staff";
import { newGame, type GameState } from "../src/sim/50-state";
import { tick } from "../src/sim/88-tick/tick";
import { sendInvoice } from "../src/sim/90-actions/billing";
import { addCustomer, addService } from "../src/sim/90-actions/customers";
import { hire } from "../src/sim/90-actions/staff";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { withServer } from "./fixtures";

const at = (y: number, m: number, d: number, h: number) => hourOf(new Date(Date.UTC(y, m - 1, d, h)));

// Three customers: A's invoice is a draft, B's exact payment waits in the bank, C's invoice is a week overdue.
function books(seed = 9) {
  const s = withServer(newGame(seed));
  const [a, b, c] = ["Müller Webdesign", "Krause IT", "Bauer Media"].map((name, i) => {
    const id = addCustomer(s, name, "agency", "prompt");
    addService(s, id, "domain", `d${i}.de`, 12, "year");
    return id;
  });
  tick(s);
  const inv = (customerId: string) => s.invoices.find((i) => i.customerId === customerId)!;
  sendInvoice(s, inv(b).id);
  sendInvoice(s, inv(c).id);
  Object.assign(inv(b), { payStep: 0, payAt: s.hour + 1 });
  Object.assign(inv(c), { payStep: 9, payAt: null, dueAt: s.hour - 8 * 24 });
  s.hour++;
  billingTick(s);
  Object.assign(s.transfers[0], { reference: "books.ref.invoice", params: { number: inv(b).number } });
  return { s, A: () => inv(a), B: () => inv(b), C: () => inv(c) };
}

describe("bookkeeper", () => {
  // A per-seat plan with no automation of its own, so the clerks do every chore.
  const clerk = (s: GameState, n = 1) => {
    s.books = { vendor: "sevdeck", installedAt: s.hour, edition: "rechnung", seats: n, download: null };
    for (let i = 0; i < n; i++) {
      const c = s.candidates.find((x) => x.role === "bookkeeper" && x.arriveAt <= s.hour)
        ?? { ...s.candidates[0], id: `cand${i}`, role: "bookkeeper" as const, arriveAt: 0, leaveAt: 1e9 };
      if (!s.candidates.includes(c)) s.candidates.push(c);
      const id = (hire(s, c.id) as { id: string }).id;
      Object.assign(s.staff.find((e) => e.id === id)!, { skill: 50, trained: ["reminder", "invoices", "transfers"] });
    }
  };

  it("clears drafts, transfers with odd amounts and reminders in a workday", () => {
    const { s, A, B, C } = books();
    s.billingRules.autoRemind = true;
    s.transfers[0].amount = owed(B()) - 0.01;
    clerk(s);
    s.hour = at(2005, 1, 3, 9);
    for (let h = 0; h < 8; h++) { staffTick(s); s.hour++; }
    expect(A().status).toBe("open");
    expect(B().status).toBe("paid");
    expect(C().reminders).toHaveLength(1);
    expect(s.activity.filter((x) => x.by === s.staff[0].name).map((x) => x.key)).toEqual(expect.arrayContaining(["activity.sendInvoice", "activity.matchTransfer", "activity.reminder"]));
  });

  it("sends twice the drafts an hour with a second hire", () => {
    const sent = (clerks: number) => {
      const s = withServer(newGame(9));
      for (let i = 0; i < 40; i++) addService(s, addCustomer(s, `Kunde ${i}`, "agency", "prompt"), "domain", `k${i}.de`, 12, "year");
      tick(s);
      clerk(s, clerks);
      s.hour = at(2005, 1, 3, 9);
      staffTick(s);
      return s.invoices.filter((i) => i.status === "open").length;
    };
    expect(sent(1)).toBeGreaterThan(0);
    expect(sent(2)).toBe(2 * sent(1));
  });
});

describe("saves", () => {
  it("from before modules load with none", () => {
    const s = withServer(newGame(9));
    const raw = JSON.parse(serialize(s));
    delete raw.modules;
    const loaded = deserialize(JSON.stringify(raw));
    expect(loaded.modules).toEqual([]);
    tick(loaded);
  });
});
