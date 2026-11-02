import { describe, expect, it } from "vitest";
import { yearOf } from "../src/sim/00-core/time";
import { cleanHours, cleanMarket } from "../src/sim/10-catalog/apps";
import { marketRates, sizeSpec } from "../src/sim/10-catalog/products";
import type { Profile } from "../src/sim/30-customers/customers";
import { createTicket } from "../src/sim/40-support/tickets";
import type { GameState } from "../src/sim/50-state";
import { appsTick, cleanSite, cleanupPrice, offerCleanup, remindCustomer } from "../src/sim/60-infra/apps";
import { tick } from "../src/sim/88-tick/tick";
import { addCustomer, addService } from "../src/sim/90-actions/customers";
import { suspendService } from "../src/sim/90-actions/holds";
import { setRate } from "../src/sim/90-actions/rates";
import { resolveTicket } from "../src/sim/90-actions/support";
import { t } from "../src/i18n/en";
import { newGame } from "./fixtures";

const ok = (r: { ok: boolean; id?: string; error?: string }) => {
  if (!r.ok) throw new Error(r.error);
  return r.id!;
};

// A defaced WordPass site of a new customer, as the daily roll leaves it.
function defaced(s: GameState, profile: Profile = "private", i = s.nextId): string {
  const cus = addCustomer(s, `Customer ${i}`, profile);
  const id = addService(s, cus, "webHosting", `site${i}.de`, 0.02, "hour", 0, null, { ...sizeSpec("webHosting", 0, 2005), app: "wordpass", appVersion: 2005, appUpdatedAt: 0 });
  s.sites = { ...s.sites, defaced: [...s.sites.defaced, id], hacks: { ...s.sites.hacks, [id]: [s.hour] } };
  return id;
}
const customerOf = (s: GameState, id: string) => s.customers.find((c) => c.id === s.services.find((v) => v.id === id)!.customerId)!;
const backed = (s: GameState, id: string) => {
  s.workloads.push({ id: `wb${id}`, serviceId: id, clusterId: null, deviceId: null, rackId: null, slot: 0, units: 0, watts: 0, placedAt: 0, vcpu: 1, ramGb: 1, diskGb: 1, stopped: false, busyUntil: 0, backupAt: s.hour });
};
const settle = (s: GameState) => { for (let h = 0; h < 300 && s.tickets.some((x) => x.work); h++) tick(s); };

describe("site clean-up", () => {
  it("prices an hour at the market's rate, drifting over the years and set in Pricing", () => {
    expect(marketRates("webHosting", 2026).cleanHour).toBe(85);
    expect(marketRates("webHosting", 2005).cleanHour).toBe(51);
    const s = newGame(1), id = defaced(s, "office");
    expect(cleanupPrice(s, customerOf(s, id))).toBe(cleanMarket(yearOf(s.hour)) * cleanHours("high"));
    ok(setRate(s, "webHosting", "cleanHour", 100));
    expect(cleanupPrice(s, customerOf(s, id))).toBe(400);
  });

  it("restores a site with a backup from the customer's ticket", () => {
    const s = newGame(2), id = defaced(s);
    const tk = createTicket(s, customerOf(s, id), "howTo", id, "hacked");
    backed(s, id);
    ok(resolveTicket(s, tk.id, "clean"));
    settle(s);
    expect(s.tickets.find((x) => x.id === tk.id)).toMatchObject({ status: "resolved", outcome: "cleaned" });
    expect(s.sites.defaced).toEqual([]);
  });

  it("sells paid clean-up without a backup at the hourly rate; others decline or cancel", () => {
    const s = newGame(3), ids = Array.from({ length: 20 }, () => defaced(s, "soleProp"));
    const tickets = ids.map((id) => createTicket(s, customerOf(s, id), "howTo", id, "hacked"));
    const price = cleanMarket(yearOf(s.hour)) * cleanHours("medium");
    for (const tk of tickets) ok(resolveTicket(s, tk.id, "cleanPaid"));
    settle(s);
    const by = (o: string) => tickets.map((tk) => s.tickets.find((x) => x.id === tk.id)!).filter((x) => x.outcome === o);
    const sold = by("cleanSold"), left = by("cancelled"), open = tickets.filter((tk) => s.tickets.find((x) => x.id === tk.id)!.status === "open");
    expect(sold.length).toBeGreaterThan(0);
    expect(left.length).toBeGreaterThan(0);
    expect(open.length).toBeGreaterThan(0);
    expect(sold.length + left.length + open.length).toBe(20);
    const lines = s.ledger.filter((l) => l.key === "ledger.siteCleanup");
    expect(lines.length).toBe(sold.length);
    expect(lines.every((l) => l.amount === price && l.category === "sales")).toBe(true);
    for (const x of sold) expect(s.sites.defaced).not.toContain(x.serviceId);
    for (const x of left) expect(customerOf(s, x.serviceId!).churnedAt).not.toBeNull();
    for (const x of open) expect(s.sites.defaced).toContain(x.serviceId);
  });

  it("loses more customers to a proactive offer the dearer the player is", () => {
    const run = (rate: number | null) => {
      const s = newGame(4);
      if (rate !== null) ok(setRate(s, "webHosting", "cleanHour", rate));
      const out = Array.from({ length: 60 }, () => {
        const id = defaced(s);
        createTicket(s, customerOf(s, id), "howTo", id, "hacked");
        return ok(offerCleanup(s, id));
      });
      return { s, count: (o: string) => out.filter((x) => x === o).length };
    };
    const market = run(null), dear = run(3 * cleanMarket(2005) + 100);
    expect(market.count("cleanSold")).toBeGreaterThan(dear.count("cleanSold"));
    expect(dear.count("cancelled")).toBeGreaterThan(market.count("cancelled"));
    // A sold clean-up answers the customer's open ticket about the hack.
    const s = market.s, sold = s.services.filter((v) => !s.sites.defaced.includes(v.id) && v.endedAt === null && v.product === "webHosting");
    expect(sold.length).toBe(market.count("cleanSold"));
    for (const v of sold) expect(s.tickets.find((x) => x.serviceId === v.id)).toMatchObject({ status: "resolved", outcome: "cleaned" });
    const declined = market.s.sites.defaced.find((id) => market.s.sites.notified.includes(`${id}|offer`))!;
    expect(offerCleanup(market.s, declined)).toEqual({ ok: false, error: "error.alreadyOffered" });
  });

  it("explains an abuse suspension with the hack and lifts it once the site is clean", () => {
    const s = newGame(5), id = defaced(s), c = customerOf(s, id);
    ok(suspendService(s, id, "abuse"));
    const mine = s.tickets.filter((x) => x.customerId === c.id);
    expect(mine).toHaveLength(1);
    expect(mine[0]).toMatchObject({ kind: "howTo", topic: "abuseHold", serviceId: id });
    expect(t("ticket.howTo.abuseHold.text", { domain: "x.de" })).toMatch(/hacked/);
    expect(t("ticket.howTo.abuseHold.text", { domain: "x.de" })).not.toMatch(/invoice/);
    backed(s, id);
    ok(cleanSite(s, id));
    expect(s.heldServices[id]).toBeUndefined();
    expect(s.tickets.find((x) => x.id === mine[0].id)).toMatchObject({ status: "resolved", outcome: "cleaned" });
    // A hold on a clean site still brings the billing question.
    const other = defaced(s);
    s.sites = { ...s.sites, defaced: s.sites.defaced.filter((x) => x !== other) };
    ok(suspendService(s, other, "abuse"));
    expect(s.tickets.at(-1)).toMatchObject({ kind: "billing", topic: "suspended" });
  });

  it("gets some reminded customers to clean their site, never the ones not reminded", () => {
    const s = newGame(6), ids = Array.from({ length: 40 }, () => defaced(s));
    const reminded = ids.slice(0, 20);
    for (const id of reminded) ok(remindCustomer(s, id));
    expect(remindCustomer(s, reminded[0])).toEqual({ ok: false, error: "error.alreadyReminded" });
    ok(suspendService(s, reminded[0], "abuse"));
    s.hour -= s.hour % 24;
    for (let d = 0; d < 5; d++) { s.hour += 24; appsTick(s); }
    const cleaned = reminded.filter((id) => !s.sites.defaced.includes(id));
    expect(cleaned.length).toBeGreaterThan(0);
    expect(cleaned.length).toBeLessThan(20);
    expect(ids.slice(20).every((id) => s.sites.defaced.includes(id))).toBe(true);
    for (const id of cleaned) expect(s.sites.notified).not.toContain(`${id}|remind`);
    if (cleaned.includes(reminded[0])) expect(s.heldServices[reminded[0]]).toBeUndefined();
  });
});
