import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { openAccount } from "../src/sim/46-finance/bank";
import { visibleCandidates } from "../src/sim/47-staff/staff";
import type { GameState } from "../src/sim/50-state";
import { buyCircuit } from "../src/sim/90-actions/hardware";
import { buyStudy } from "../src/sim/90-actions/market";
import { planTraining } from "../src/sim/90-actions/staff";
import { PROFILE_IDS } from "../src/sim/80-business/marketing";
import { hire, newGame } from "./fixtures";

type R = { ok: boolean; id?: string; error?: string };
const ok = (r: R) => { if (!r.ok) throw new Error(r.error); return r.id!; };
const bank = (s: GameState) => { s.bank = { ...openAccount(s, "sparklasse"), welcomed: true }; return s; };
const last = (s: GameState) => s.payables.at(-1)!;

describe("vendor spend leaves a document", () => {
  it("books a market study as a services receipt, then as an open invoice after a bank", () => {
    const s = newGame(11);
    s.cash = 1e5;
    ok(buyStudy(s, PROFILE_IDS[0]));
    expect(last(s)).toMatchObject({ supplier: "services", method: "cash", doc: "receipt" });
    const b = bank(newGame(11));
    b.cash = 1;
    ok(buyStudy(b, PROFILE_IDS[0]));
    expect(last(b)).toMatchObject({ method: "transfer", doc: "invoice", paidAt: null });
    expect(b.cash).toBe(1);
  });

  it("refuses cash that is not there before a bank", () => {
    const s = newGame(11);
    s.cash = 1;
    expect(buyStudy(s, PROFILE_IDS[0])).toMatchObject({ ok: false, error: "error.noCash" });
  });

  it("trains an employee on a bank account without cash on hand", () => {
    const s = bank(newGame(6));
    s.cash = 2000;
    const c = visibleCandidates(s).find((x) => x.role === "support")!;
    ok(hire(s, c.id));
    s.cash = 0;
    ok(planTraining(s, s.staff[0].id, ["howTo"]));
    expect(last(s)).toMatchObject({ supplier: "services", method: "transfer", doc: "invoice", paidAt: null });
  });

  it("books a circuit as a hardware shop document", () => {
    const s = newGame(12);
    s.cash = 1e5;
    ok(buyCircuit(s, s.locations[0].id));
    expect(last(s)).toMatchObject({ supplier: "hardware" });
  });
});

// Every direct write to cash is listed with its count. A new vendor purchase goes through bill, placeOrder or spend instead.
const DIRECT: Record<string, number> = {
  "40-support/notices.ts": 1, "40-support/terms.ts": 1, "40-support/tickets.ts": 1,
  "45-billing/billing.ts": 1, "45-billing/fraud.ts": 3, "45-billing/payments.ts": 2,
  "46-finance/bank.ts": 4, "46-finance/payables.ts": 1,
  "47-staff/oncall.ts": 1, "47-staff/staff.ts": 1,
  "60-infra/apps.ts": 2, "60-infra/breach.ts": 2, "60-infra/handwork.ts": 1,
  "80-business/shoplink.ts": 1, "80-business/tax.ts": 1, "80-business/used.ts": 1,
  "90-actions/bank.ts": 1, "90-actions/billing.ts": 2, "90-actions/dev.ts": 1, "90-actions/games.ts": 1,
  "90-actions/hall.ts": 3, "90-actions/hardware.ts": 1, "90-actions/staff.ts": 1, "90-actions/work-orders.ts": 1,
  "91-save/save.ts": 1,
};

describe("direct cash writes", () => {
  it("stay in the listed files", async () => {
    const { globSync } = await import("node:fs");
    const found: Record<string, number> = {};
    for (const f of globSync("src/sim/**/*.ts")) {
      const n = (readFileSync(f, "utf8").match(/\bs\.cash\s*(=(?!=)|[-+]=)/g) ?? []).length;
      if (n) found[f.replace("src/sim/", "")] = n;
    }
    expect(found).toEqual(DIRECT);
  });
});
