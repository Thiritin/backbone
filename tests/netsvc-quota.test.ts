import { describe, expect, it } from "vitest";
import { sizeSpec } from "../src/sim/10-catalog/products";
import { BASEMENT_SERVER, panelServer, withServer } from "./fixtures";
import { newGame, type GameState } from "../src/sim/50-state";
import { defaultQuotaMb, quotaOf } from "../src/sim/60-infra/netsvc-quota";
import { netsvcTick } from "../src/sim/60-infra/netsvc";
import { provisionService } from "../src/sim/90-actions/clusters";
import { addCustomer } from "../src/sim/90-actions/customers";
import { setQuota } from "../src/sim/90-actions/netsvc-quota";
import { dateOf } from "../src/sim/00-core/time";

// Jumps to the first hour of the next month and runs the monthly pass.
const month = (s: GameState) => { do s.hour++; while (dateOf(s.hour).getUTCDate() !== 1 || dateOf(s.hour).getUTCHours() !== 0); netsvcTick(s); };

function host() {
  const s = withServer(newGame(1));
  const cluster = panelServer(s, BASEMENT_SERVER);
  const cust = addCustomer(s, "Anna Albers", "private");
  s.customers = s.customers.map((c) => ({ ...c, happiness: 80 }));
  provisionService(s, cust, "webHosting", { label: "a", spec: sizeSpec("webHosting", 0, 2005), clusterId: cluster });
  const v = () => s.services[0];
  return { s, v, q: () => quotaOf(s, v()), happy: () => s.customers.find((c) => c.id === cust)!.happiness };
}

describe("quotas", () => {
  it("follow the era defaults", () => {
    expect(defaultQuotaMb("mailbox", 2005)).toBe(50);
    expect(defaultQuotaMb("mailbox", 2012)).toBe(1000);
    expect(defaultQuotaMb("mailbox", 2030)).toBe(15000);
    expect(defaultQuotaMb("cloud", 2010)).toBe(1000);
    expect(defaultQuotaMb("cloud", 2016)).toBe(5000);
    expect(defaultQuotaMb("cloud", 2024)).toBe(20000);
    expect(defaultQuotaMb("mailbox", 2016)).toBe(3000);
  });

  it("grow every month and open one ticket when full", () => {
    const { s, v, q } = host();
    expect(q().perUserMb).toBe(50);
    month(s);
    expect(q().usedMb).toBeGreaterThan(0);
    for (let i = 0; i < 40; i++) month(s);
    const open = () => s.tickets.filter((t) => t.topic === "mailFull" && t.serviceId === v().id && t.status !== "resolved" && t.status !== "closed");
    expect(q().usedMb).toBeGreaterThanOrEqual(0.95 * q().perUserMb * v().spec.mailboxes);
    expect(open().length).toBe(1);
    month(s);
    expect(open().length).toBe(1);
  });

  it("refuses a raise the host disk cannot book and resolves the ticket on a fitting one", () => {
    const { s, v, q } = host();
    s.netsvc.quotas[v().id] = { perUserMb: 50, usedMb: 50 * v().spec.mailboxes };
    month(s);
    expect(s.tickets.some((t) => t.topic === "mailFull")).toBe(true);
    expect(setQuota(s, v().id, 1e9)).toEqual({ ok: false, error: "error.quotaNoDisk" });
    expect(setQuota(s, v().id, 200).ok).toBe(true);
    expect(q().perUserMb).toBe(200);
    expect(s.tickets.find((t) => t.topic === "mailFull")!.status).toBe("resolved");
  });

  it("costs 3 happiness when lowered below the stored data", () => {
    const { s, v, q, happy } = host();
    s.netsvc.quotas[v().id] = { perUserMb: 1000, usedMb: 1000 * v().spec.mailboxes * 0.9 };
    const before = happy();
    expect(setQuota(s, v().id, 100).ok).toBe(true);
    expect(q().usedMb).toBe(100 * v().spec.mailboxes);
    expect(happy()).toBe(before - 3);
    expect(setQuota(s, v().id, 0)).toEqual({ ok: false, error: "error.quotaInvalid" });
  });
});
