import { describe, expect, it } from "vitest";
import { t } from "../src/i18n/en";
import { yearOf } from "../src/sim/00-core/time";
import { marketRates, sizeSpec, specPrice } from "../src/sim/10-catalog/products";
import { orderLead } from "../src/sim/30-market/orders";
import { sizeOf, specText } from "../src/sim/30-market/spec";
import type { GameState } from "../src/sim/50-state";
import { siteContent } from "../src/sim/80-business/website";
import { tick, type SimEvent } from "../src/sim/88-tick/tick";
import { setUpChannel } from "../src/sim/90-actions/marketing";
import { setRate } from "../src/sim/90-actions/rates";
import { setEmailOrders } from "../src/sim/90-actions/website";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { readyGame } from "./fixtures";

const OLD_NAMES = ["Web S", "Web M", "Web L", "VPS S", "VPS M", "VPS L", "VPS XL", "Game S", "Game L", "Dedicated S", "Dedicated L", "package"];
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
const orders = (s: GameState, from = 0) => s.sales.requests.filter((r) => r.kind === "order" && r.createdAt >= from);
const web = { product: "webHosting" as const, size: 1, sla: "basic" as const };
const vps = { product: "vps" as const, size: 1, sla: "basic" as const };
// Places one order through the form and returns the request and its service.
const formOrder = (s: GameState, need: typeof web | typeof vps = web) => {
  const r = orderLead(s, "private", "Frankfurt", [], need, false);
  const won = s.sales.requests.find((x) => x.id === r.id)!;
  expect(won.status).toBe("won");
  return { r: won, v: s.services.find((x) => x.id === won.serviceId)! };
};
// Every text the game produced about requests: their threads, specs, lost sales and the events.
const texts = (s: GameState, events: SimEvent[]) => [
  ...s.sales.requests.flatMap((r) => [specText(r.product, r.spec), ...r.thread.map((m) => t(m.key, m.params))]),
  ...s.sales.lost.flatMap((l) => [specText(l.product, l.spec), t(l.reason, l.params)]),
  ...events.flatMap((e) => [t(`${e.key}.title`, e.params), t(`${e.key}.text`, e.params)]),
];

describe("specs on requests and services", () => {
  it("vary between requests and stay on the request and the service", () => {
    const s = withForm(1);
    const placed = Array.from({ length: 4 }, () => formOrder(s));
    expect(new Set(placed.map(({ r }) => JSON.stringify(r.spec))).size).toBeGreaterThan(2);
    for (const { r, v } of placed) expect(v.spec).toMatchObject(r.spec);
    const back = deserialize(serialize(s));
    expect(back.services.find((v) => v.id === placed[0].v.id)!.spec).toMatchObject(placed[0].r.spec);
  });

  it("are priced at the order form by the line's rates less the discount", () => {
    const s = withForm(2);
    expect(setRate(s, "webHosting", "diskGb", 4).ok).toBe(true);
    expect(setRate(s, "webHosting", "base", 1).ok).toBe(true);
    const { r, v } = formOrder(s);
    const list = specPrice("webHosting", r.spec, yearOf(s.hour), "basic", s.rates.webHosting);
    const m = marketRates("webHosting", yearOf(s.hour));
    expect(list).toBeCloseTo(1 + 4 * r.spec.diskGb + m.mailbox! * r.spec.mailboxes + (m.traffic! * r.spec.trafficGb) / 100, 2);
    expect(v.price * 730).toBeCloseTo(Math.round(list * (1 - r.discount) * 100) / 100, 6);
    expect(siteContent(s).lines.find((l) => l.product === "webHosting")!.from).toBe(specPrice("webHosting", sizeSpec("webHosting", 0, yearOf(s.hour)), yearOf(s.hour), "basic", s.rates.webHosting));
  });

  it("leaves the prices of services already sold alone when a rate changes", () => {
    const s = withForm(3);
    const { v } = formOrder(s);
    const before = s.services.map((x) => [x.id, x.price]);
    expect(setRate(s, "webHosting", "diskGb", 9).ok).toBe(true);
    run(s, 2);
    expect(s.services.filter((x) => before.some(([id]) => id === x.id)).map((x) => [x.id, x.price])).toEqual(before);
    const next = formOrder(s);
    expect(next.v.price).toBeGreaterThan(v.price * (next.r.spec.diskGb / v.spec.diskGb));
  });

  it("are provisioned by the order form with their own resources", () => {
    const s = withForm(4);
    for (const need of [vps, web]) {
      const { r, v } = formOrder(s, need);
      const w = s.workloads.find((x) => x.serviceId === v.id)!;
      expect(sizeOf(w)).toEqual(sizeOf(r.spec));
    }
  });
});

describe("email orders", () => {
  it("route every order lead through the form when switched off", () => {
    const on = withForm(5), off = withForm(5);
    expect(setEmailOrders(off, false).ok).toBe(true);
    for (const s of [on, off]) for (let i = 0; i < 40; i++) orderLead(s, "private", "Frankfurt", []);
    expect(orders(on).some((r) => r.ticketId !== null)).toBe(true);
    expect(orders(off).every((r) => r.ticketId === null)).toBe(true);
    expect(off.tickets.some((x) => x.kind === "order")).toBe(false);
    // A lead the form cannot place goes elsewhere instead of writing an email.
    const away = orderLead(off, "private", "London", [], web);
    expect(off.sales.requests.find((x) => x.id === away.id)).toMatchObject({ status: "lost", ticketId: null });
  });
});

describe("sim text", () => {
  it("names no old package in events, request threads or lost sales", () => {
    for (const seed of [1, 2, 3]) {
      const s = withForm(seed);
      const said = texts(s, run(s, 90));
      expect(orders(s).length).toBeGreaterThan(0);
      expect(said.filter((x) => OLD_NAMES.some((n) => x.includes(n)))).toEqual([]);
    }
  }, 20000);
});

describe("saves from before specs", () => {
  it("fill specs from the old plan ids, drop the plans and the packages, and start with market rates", () => {
    const s = withForm(6);
    formOrder(s, vps);
    setEmailOrders(s, false);
    orderLead(s, "private", "London", [], web, false);
    const old = JSON.parse(serialize(s));
    const plans: Record<string, string> = { webHosting: "web-l", vps: "vps-m" };
    for (const x of [...old.services, ...old.sales.requests, ...old.sales.lost]) { delete x.spec; x.plan = plans[x.product] ?? null; x.packaged = true; }
    old.marketing.packages = ["webHosting"];
    delete old.rates;
    const back = deserialize(JSON.stringify(old));
    expect(back.rates).toEqual({});
    expect("packages" in back.marketing).toBe(false);
    const all = [...back.services, ...back.sales.requests, ...back.sales.lost];
    expect(back.sales.lost.length).toBeGreaterThan(0);
    expect(all.every((x) => !("plan" in x) && !("packaged" in x))).toBe(true);
    for (const v of back.services) expect(v.spec).toMatchObject(sizeSpec(v.product, v.product === "webHosting" ? 2 : v.product === "vps" ? 1 : 0, yearOf(v.startedAt)));
    for (const r of back.sales.requests) expect(r.spec).toEqual(sizeSpec(r.product, r.product === "webHosting" ? 2 : 1, yearOf(r.createdAt)));
    for (const l of back.sales.lost) expect(l.spec).toEqual(sizeSpec(l.product, l.product === "webHosting" ? 2 : 1, yearOf(l.hour)));
  });
});
