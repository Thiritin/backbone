import { describe, expect, it } from "vitest";
import { orderLead } from "../src/sim/30-market/orders";
import { hostFor, invoiceOf, stepsDone } from "../src/sim/30-market/manual";
import { CHECKS } from "../src/sim/checklist";
import { loseRequest } from "../src/sim/30-market/sales";
import type { GameState } from "../src/sim/50-state";
import { tick } from "../src/sim/88-tick/tick";
import { confirmOrder, createAccount, provisionOrder, registerOrderDomain, sendOrderAccess } from "../src/sim/90-actions/orders";
import { mailed, owner, quoteOrder, readyGame } from "./fixtures";
import { prefill } from "../src/ui/apps/books/NewCustomer";

const run = (s: GameState, hours: number) => { for (let i = 0; i < hours; i++) tick(s); };
const done = (s: GameState, res: { ok: boolean; error?: string }) => { if (!res.ok) throw new Error(res.error); run(s, 1); };
const fresh = () => {
  const s = readyGame(2);
  s.invoices = [];
  const r = orderLead(s, "private", "Frankfurt", [], { product: "webHosting", size: 0, sla: "basic" }, true);
  const id = r.ticketId!;
  s.sales.requests = s.sales.requests.map((x) => (x.id === r.id ? { ...x, budget: 100 } : x));
  done(s, quoteOrder(s, id, 12));
  for (let i = 0; i < 60 && !stepsDone(s, s.sales.requests.find((x) => x.id === r.id)!).quote; i++) tick(s);
  return { s, id, rid: r.id, req: () => s.sales.requests.find((x) => x.id === r.id)! };
};
const ticks = (s: GameState) => ["orderAccount", "orderDomain", "orderProvision", "orderAccess", "sendInvoice"].map((k) => CHECKS[k](s));

describe("order guide cards", () => {
  it("tick one by one as the order moves", () => {
    const { s, id, req } = fresh();
    expect(ticks(s)).toEqual([false, false, false, false, false]);
    done(s, createAccount(s, id, mailed(s, id)));
    expect(ticks(s)).toEqual([true, false, false, false, false]);
    done(s, confirmOrder(s, id));
    expect(CHECKS.sendInvoice(s)).toBe(false);
    done(s, registerOrderDomain(s, id, ...owner(s, id)));
    expect(ticks(s)).toEqual([true, true, false, false, false]);
    done(s, provisionOrder(s, id, hostFor(s, req())!));
    expect(ticks(s)).toEqual([true, true, true, false, true]);
    done(s, sendOrderAccess(s, id));
    expect(ticks(s)).toEqual([true, true, true, true, true]);
  });

  it("do not tick from a lost order", () => {
    const { s, id, req } = fresh();
    done(s, createAccount(s, id, mailed(s, id)));
    loseRequest(s, req(), "lost", "lost.expired");
    expect(ticks(s).slice(0, 4)).toEqual([false, false, false, false]);
  });

  it("stay ticked once the order is won", () => {
    const { s, id, req } = fresh();
    done(s, createAccount(s, id, mailed(s, id)));
    s.sales.requests = s.sales.requests.map((x) => (x.id === req().id ? { ...x, status: "won" } : x));
    expect(CHECKS.orderAccount(s)).toBe(true);
    expect(invoiceOf(s, req())).toBeUndefined();
  });

  it("fills New customer from the order email", () => {
    const { s, id } = fresh();
    expect(prefill(s, id)).toMatchObject(mailed(s, id)!);
    expect(prefill(s, "nope").contact).toBe("");
  });
});
