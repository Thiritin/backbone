import { describe, expect, it } from "vitest";
import { t } from "../src/i18n/en";
import { PRODUCTS } from "../src/sim/10-catalog/products";
import { planName } from "../src/sim/30-market/market";
import type { GameState } from "../src/sim/50-state";
import { hasPackages, siteContent } from "../src/sim/80-business/website";
import { tick, type SimEvent } from "../src/sim/88-tick/tick";
import { setUpChannel } from "../src/sim/90-actions/marketing";
import { setEmailOrders, setPackages } from "../src/sim/90-actions/website";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { readyGame } from "./fixtures";

const PLAN_NAMES = Object.values(PRODUCTS).flatMap((p) => p.plans.map((x) => x.name));
const run = (s: GameState, days: number) => {
  const events: SimEvent[] = [];
  for (let i = 0; i < days * 24; i++) events.push(...tick(s));
  return events;
};
const withForm = (seed: number) => {
  const s = readyGame(seed);
  s.cash = 1e6;
  setUpChannel(s, "website");
  setUpChannel(s, "orderForm");
  return s;
};
const orders = (s: GameState, from: number) => s.sales.requests.filter((r) => r.kind === "order" && r.createdAt >= from);
// Every text the game produced about requests: their threads, their names and the events.
const texts = (s: GameState, events: SimEvent[]) => [
  ...s.sales.requests.flatMap((r) => [planName(r), ...r.thread.map((m) => t(m.key, m.params))]),
  ...events.flatMap((e) => [t(`${e.key}.title`, e.params), t(`${e.key}.text`, e.params)]),
];

describe("packages on the website", () => {
  it("shows the lines and a contact address until a line sells packages", () => {
    const s = readyGame(1);
    const early = siteContent(s);
    expect(early.lines.length).toBeGreaterThan(0);
    expect(early.lines.every((l) => l.plans.length === 0)).toBe(true);
    expect(early.email).toMatch(/^sales@/);
    expect(setPackages(s, "webHosting", true)).toEqual({ ok: false, error: "error.needsOrderForm" });
    expect(setEmailOrders(s, false)).toEqual({ ok: false, error: "error.needsOrderForm" });

    const form = withForm(1);
    expect(siteContent(form).lines.every((l) => l.plans.length === 0)).toBe(true);
    expect(setPackages(form, "webHosting", true).ok).toBe(true);
    const web = siteContent(form).lines.find((l) => l.product === "webHosting")!;
    expect(web.plans).toEqual(PRODUCTS.webHosting.plans.map((x) => x.name));
    expect(siteContent(form).lines.filter((l) => l.product !== "webHosting").every((l) => l.plans.length === 0)).toBe(true);
    expect(setEmailOrders(form, false).ok).toBe(true);
    expect(siteContent(form).email).toBeNull();
  });

  it("keeps email orders on in a new game and through a save", () => {
    const s = withForm(2);
    expect(s.marketing.emailOrders).toBe(true);
    setPackages(s, "vps", true);
    setEmailOrders(s, false);
    const back = deserialize(serialize(s));
    expect(back.marketing.emailOrders).toBe(false);
    expect(hasPackages(back, "vps")).toBe(true);
    // A save from before packages that owns the order form sells packages on its listed lines.
    const old = JSON.parse(serialize(withForm(2)));
    delete old.marketing.packages;
    delete old.marketing.emailOrders;
    const loaded = deserialize(JSON.stringify(old));
    expect(loaded.marketing.emailOrders).toBe(true);
    expect(loaded.marketing.packages).toEqual(loaded.marketing.lines);
  });

  it("routes order leads by the email switch", () => {
    const on = withForm(3), off = withForm(3);
    for (const s of [on, off]) setPackages(s, "webHosting", true);
    setEmailOrders(off, false);
    const from = on.hour;
    run(on, 120);
    run(off, 120);
    const mailed = orders(on, from), formed = orders(off, from);
    // With email on, lines without packages and a quarter of the rest still ask for their own resources.
    expect(mailed.some((r) => r.spec)).toBe(true);
    expect(mailed.some((r) => r.product === "webHosting" && !r.spec)).toBe(true);
    // With email off, only package orders for lines with packages arrive, and none becomes an email.
    expect(formed.length).toBeGreaterThan(0);
    expect(formed.length).toBeLessThan(mailed.length);
    expect(formed.every((r) => r.product === "webHosting" && !r.spec && r.ticketId === null)).toBe(true);
    expect(formed.every((r) => r.status === "won" || r.status === "lost")).toBe(true);
  });

  it("names no plan before a line sells packages", () => {
    for (const seed of [1, 2, 3]) {
      const s = readyGame(seed);
      const said = texts(s, run(s, 90));
      expect(s.sales.requests.length).toBeGreaterThan(0);
      expect(said.filter((x) => PLAN_NAMES.some((n) => x.includes(n)))).toEqual([]);
    }
    const s = withForm(1);
    setPackages(s, "webHosting", true);
    const said = texts(s, run(s, 90));
    expect(said.some((x) => PRODUCTS.webHosting.plans.some((p) => x.includes(p.name)))).toBe(true);
  });
});
