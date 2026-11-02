import { describe, expect, it } from "vitest";
import { expandable, templatesOf } from "../src/sim/40-support/tickets";
import { eventById } from "../src/sim/80-business/community";
import { tick } from "../src/sim/88-tick/tick";
import { communityTick } from "../src/sim/80-business/sponsoring";
import { addCustomer, addService } from "../src/sim/90-actions/customers";
import { readyGame, newGame } from "./fixtures";
import { FEB_1 } from "./support.helpers";

describe("upgrade requests", () => {
  it("come only for services that can grow, each with a quote request and no shortcut reply", () => {
    const s = newGame(5);
    // Upgrades roll at month starts, so start just before February.
    s.hour = FEB_1 - 1;
    const domains = Array.from({ length: 100 }, (_, i) => { const id = addCustomer(s, `Domain ${i}`, "smallBiz"); addService(s, id, "domain", `d${i}.de`, 10, "year"); return id; });
    for (let i = 0; i < 100; i++) addService(s, addCustomer(s, `Server ${i}`, "smallBiz"), "vps", "VPS 512", 0.01, "hour");
    expect(expandable(s.services.find((v) => v.product === "domain")!)).toBe(false);
    expect(expandable(s.services.find((v) => v.product === "vps")!)).toBe(true);
    while (s.hour <= FEB_1 + 1) tick(s);
    const upgrades = s.tickets.filter((t) => t.kind === "upgrade");
    expect(upgrades.length).toBeGreaterThan(0);
    expect(upgrades.some((t) => domains.includes(t.customerId))).toBe(false);
    for (const t of upgrades) expect(templatesOf(t)).toEqual([]);
    // Every upgrade email turned into a quote request; ended requests are pruned, open ones are still there.
    expect(upgrades.every((t) => t.topic === "more")).toBe(true);
    for (const t of upgrades.filter((x) => x.status === "open")) expect(s.sales.requests.find((r) => r.ticketId === t.id)?.kind).toBe("expansion");
  });
});

describe("sponsoring requests", () => {
  it("ask only for lines the company sells on its website", () => {
    const s = readyGame(9);
    s.unlocks = [...s.unlocks, "marketingBasics"];
    s.marketing = { ...s.marketing, lines: ["webHosting"] };
    // Requests are the community's own hourly step; the rest of the tick plays no part.
    for (; s.hour < 365 * 24; s.hour++) communityTick(s);
    expect(s.sponsorships.length).toBeGreaterThan(2);
    expect(s.sponsorships.every((sp) => eventById(sp.event)!.product === "webHosting")).toBe(true);
  });

  it("stay away while no line is on the website", () => {
    const s = readyGame(9);
    s.unlocks = [...s.unlocks, "marketingBasics"];
    s.marketing = { ...s.marketing, lines: [] };
    // A request would land on the day it falls due, so daily steps are enough.
    for (; s.hour < 120 * 24; s.hour += 24) communityTick(s);
    expect(s.sponsorships).toEqual([]);
  });
});
