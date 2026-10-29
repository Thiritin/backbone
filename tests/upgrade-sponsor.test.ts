import { describe, expect, it } from "vitest";
import { expandable, templatesOf } from "../src/sim/40-support/tickets";
import { newGame } from "../src/sim/50-state";
import { eventById } from "../src/sim/80-business/community";
import { tick } from "../src/sim/88-tick/tick";
import { addCustomer, addService } from "../src/sim/90-actions/customers";
import { readyGame } from "./fixtures";

describe("upgrade requests", () => {
  it("come only for services that can grow, each with a quote request and no shortcut reply", () => {
    const s = newGame(5);
    const domains = Array.from({ length: 100 }, (_, i) => { const id = addCustomer(s, `Domain ${i}`, "smallBiz"); addService(s, id, "domain", `d${i}.de`, 10, "year"); return id; });
    for (let i = 0; i < 100; i++) addService(s, addCustomer(s, `Server ${i}`, "smallBiz"), "vps", "VPS 512", 0.01, "hour");
    expect(expandable(s.services.find((v) => v.product === "domain")!)).toBe(false);
    expect(expandable(s.services.find((v) => v.product === "vps")!)).toBe(true);
    while (s.hour < 6 * 730) tick(s);
    const upgrades = s.tickets.filter((t) => t.kind === "upgrade");
    expect(upgrades.length).toBeGreaterThan(0);
    expect(upgrades.some((t) => domains.includes(t.customerId))).toBe(false);
    for (const t of upgrades) expect(templatesOf(t)).toEqual([]);
    // Every upgrade email turned into a quote request; ended requests are pruned, open ones are still there.
    expect(upgrades.every((t) => t.topic === "more")).toBe(true);
    for (const t of upgrades.filter((x) => x.status === "open")) expect(s.sales.requests.find((r) => r.ticketId === t.id)?.kind).toBe("expansion");
  }, 60_000);
});

describe("sponsoring requests", () => {
  it("ask only for lines the company sells on its website", () => {
    const s = readyGame(9);
    s.marketing = { ...s.marketing, lines: ["webHosting"] };
    while (s.hour < 365 * 24) tick(s);
    expect(s.sponsorships.length).toBeGreaterThan(2);
    expect(s.sponsorships.every((sp) => eventById(sp.event)!.product === "webHosting")).toBe(true);
  }, 60_000);

  it("stay away while no line is on the website", () => {
    const s = readyGame(9);
    s.marketing = { ...s.marketing, lines: [] };
    while (s.hour < 120 * 24) tick(s);
    expect(s.sponsorships).toEqual([]);
  }, 60_000);
});
