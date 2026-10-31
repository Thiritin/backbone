import { describe, expect, it } from "vitest";
import { hourOf, isMonthStart, yearOf } from "../src/sim/00-core/time";
import { sizeSpec } from "../src/sim/10-catalog/products";
import { leadFlows } from "../src/sim/30-market/market";
import { run as runBalance, STEADY } from "../src/sim/balance/model";
import type { GameState } from "../src/sim/50-state";
import { leadsThisMonth, OWNED } from "../src/sim/80-business/marketing";
import { agePenalty, customerSite, generationOf, siteFactor, siteStatus } from "../src/sim/80-business/website";
import { tick } from "../src/sim/88-tick/tick";
import { provisionService } from "../src/sim/90-actions/clusters";
import { addCustomer } from "../src/sim/90-actions/customers";
import { setPower } from "../src/sim/90-actions/hardware";
import { setUpChannel } from "../src/sim/90-actions/marketing";
import { startGame } from "../src/sim/90-actions/start";
import { redesign, setSiteHost } from "../src/sim/90-actions/website";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { en } from "../src/i18n/en";
import { automate, panelServer, readyGame, withCompany, withServer } from "./fixtures";

const inYear = (s: GameState, y: number) => { s.hour = hourOf(new Date(Date.UTC(y, 5, 15))); };
const hostOf = (s: GameState) => s.clusters.find((c) => c.kind === "panel")!.id;
// A company with the web design and an own panel VM as the site host.
const withSite = (seed = 1): GameState => {
  const s = readyGame(seed);
  s.cash = 100000;
  expect(setUpChannel(s, "website").ok).toBe(true);
  expect(setSiteHost(s, { kind: "own", clusterId: hostOf(s) }).ok).toBe(true);
  return s;
};
const website = (s: GameState) => leadsThisMonth(s).filter((b) => b.source === "website").reduce((n, b) => n + b.count, 0);
const run = (s: GameState, hours: number) => Array.from({ length: hours }).flatMap(() => tick(s));

describe("company site hosting", () => {
  it("is rented by default, always up and billed at the month start under its own ledger key", () => {
    const s = readyGame(1);
    s.cash = 100000;
    expect(s.marketing.siteHost).toEqual({ kind: "rented" });
    ok(setUpChannel(s, "website"));
    expect(setPower(s, "dev3", false).ok).toBe(true);
    expect(siteStatus(s)).toBe("up");
    const from = s.ledger.length;
    run(s, 24 * 62);
    const bills = s.ledger.slice(from).filter((e) => e.key === "ledger.siteHosting");
    expect(bills.length).toBeGreaterThanOrEqual(2);
    expect(bills.every((e) => e.amount === -9.9 && e.category === "marketing")).toBe(true);
    expect(en["ledger.siteHosting"]({})).toBe("Website hosting: Strateaux");
  });

  it("bills no rent while the site runs on an own host", () => {
    const s = withSite();
    const from = s.ledger.length;
    run(s, 24 * 35);
    expect(s.ledger.slice(from).some((e) => e.key === "ledger.siteHosting")).toBe(false);
  });

  it("moves to an own panel host only when it has the disk, and back for free", () => {
    const s = readyGame(1);
    const cash = s.cash;
    expect(setSiteHost(s, { kind: "own", clusterId: "nope" })).toEqual({ ok: false, error: "error.unknownCluster" });
    const hyper = s.clusters.find((c) => c.kind !== "panel")!;
    expect(setSiteHost(s, { kind: "own", clusterId: hyper.id })).toEqual({ ok: false, error: "error.siteHostPanel" });
    expect(setSiteHost(s, { kind: "own", clusterId: hostOf(s) }).ok).toBe(true);
    expect(s.marketing.siteHost).toEqual({ kind: "own", clusterId: hostOf(s) });
    expect(setSiteHost(s, { kind: "rented" }).ok).toBe(true);
    expect(s.marketing.siteHost).toEqual({ kind: "rented" });
    expect(s.cash).toBe(cash);

    const full = readyGame(1);
    const vm = full.workloads.find((w) => !w.serviceId)!;
    full.workloads = full.workloads.map((w) => (w.id === vm.id ? { ...w, diskGb: 0.1 } : w));
    expect(setSiteHost(full, { kind: "own", clusterId: hostOf(full) })).toEqual({ ok: false, error: "error.siteHostNoRoom" });
  });

  it("goes down with an own host that is powered off, tells the player once per outage and recovers", () => {
    const s = withSite();
    expect(siteStatus(s)).toBe("up");
    ok(setPower(s, "dev3", false));
    const events = run(s, 6).filter((e) => e.key === "event.siteDown");
    expect(siteStatus(s)).toBe("down");
    expect(events).toHaveLength(1);
    expect(en["event.siteDown.title"]({})).toBeTruthy();
    expect(en["event.siteDown.text"](events[0].params)).toContain(s.clusters.find((c) => c.id === hostOf(s))!.name);
    ok(setPower(s, "dev3", true));
    run(s, 1);
    ok(setPower(s, "dev3", false));
    expect(run(s, 3).filter((e) => e.key === "event.siteDown")).toHaveLength(1);
    expect(s.marketing.siteOutage).toBe(true);
  });

  it("goes down on a bare-metal panel host that is taken offline", () => {
    const s = withCompany(withServer(startGame(1)));
    s.cash = 100000;
    const host = panelServer(s, "dev3");
    ok(setUpChannel(s, "website"));
    ok(setSiteHost(s, { kind: "own", clusterId: host }));
    expect(siteStatus(s)).toBe("up");
    s.security = { ...s.security, offline: [host] };
    expect(siteStatus(s)).toBe("down");
  });

  it("is slow while the host performs below 1 and takes half the website leads", () => {
    const s = withSite();
    const up = website(s);
    expect(up).toBeGreaterThan(0);
    const host = s.clusters.find((c) => c.id === hostOf(s))!;
    s.clusters = s.clusters.map((c) => (c.id === host.id ? { ...c, phpUntil: s.hour + 100 } : c));
    expect(siteStatus(s)).toBe("slow");
    expect(siteFactor(s)).toBe(0.5);
    expect(website(s)).toBeCloseTo(up * 0.5, 9);
  });

  it("is slow while the host has over 90% of its RAM booked", () => {
    const s = withSite();
    const vm = s.workloads.find((w) => !w.serviceId)!;
    s.workloads = s.workloads.map((w) => (w.id === vm.id ? { ...w, ramGb: 1.2 } : w));
    expect(siteStatus(s)).toBe("slow");
  });

  it("loses all website leads and awareness while down", () => {
    const s = withSite();
    const up = website(s);
    ok(setPower(s, "dev3", false));
    expect(siteStatus(s)).toBe("down");
    expect(website(s)).toBe(0);
    expect(up).toBeGreaterThan(0);
    expect(leadFlows(s).length).toBeGreaterThan(0);

    const a = withSite(), b = withSite();
    ok(setPower(b, "dev3", false));
    const monthStart = (x: GameState) => { do tick(x); while (!isMonthStart(x.hour)); };
    monthStart(a); monthStart(b);
    expect(a.marketing.awareness.private).toBeGreaterThan(b.marketing.awareness.private);
  });

  it("loses the orders of the order form while the site is down", () => {
    const orders = (down: boolean) => {
      const s = automate(withSite(7));
      ok(setUpChannel(s, "orderForm"));
      if (down) ok(setPower(s, "dev3", false));
      else ok(setSiteHost(s, { kind: "rented" }));
      return run(s, 24 * 30).filter((e) => e.key === "event.orderPlaced").length;
    };
    expect(orders(false)).toBeGreaterThan(0);
    expect(orders(true)).toBe(0);
  });
});

describe("design ages", () => {
  it("has no penalty one generation behind, then 20% per generation down to 40%", () => {
    const s = withSite();
    expect(s.marketing.designYear).toBe(2005);
    const factors = [2005, 2008, 2012, 2013, 2016, 2017, 2020, 2021, 2025, 2030].map((y) => { inYear(s, y); return agePenalty(s); });
    expect(factors.map((f) => Math.round(f * 100) / 100)).toEqual([1, 1, 1, 0.8, 0.8, 0.6, 0.6, 0.4, 0.4, 0.4]);
    inYear(s, 2012);
    const fresh = website(s);
    inYear(s, 2013);
    expect(website(s) / fresh).toBeCloseTo(0.8, 9);
  });

  it("scales website leads by the age penalty", () => {
    const s = withSite();
    inYear(s, 2012);
    const base = website(s);
    s.marketing = { ...s.marketing, designYear: 2005 };
    inYear(s, 2021);
    const old = website(s);
    s.marketing = { ...s.marketing, designYear: 2021 };
    expect(old / website(s)).toBeCloseTo(0.4, 9);
    expect(base).toBeGreaterThan(0);
  });

  it("sets the generation of the year when the web design is bought", () => {
    const s = readyGame(1);
    s.cash = 100000;
    inYear(s, 2013);
    ok(setUpChannel(s, "website"));
    expect(s.marketing.designYear).toBe(2013);
    expect(generationOf(2012)).toBe(2009);
    expect(generationOf(yearOf(s.hour))).toBe(2013);
  });

  it("redesigns for the web design price, resets the penalty and refuses a current design", () => {
    const s = readyGame(1);
    s.cash = 100000;
    expect(redesign(s)).toEqual({ ok: false, error: "error.needsWebsite" });
    ok(setUpChannel(s, "website"));
    expect(redesign(s)).toEqual({ ok: false, error: "error.designCurrent" });
    inYear(s, 2017);
    expect(agePenalty(s)).toBe(0.6);
    const cash = s.cash;
    ok(redesign(s));
    expect(s.cash).toBe(cash - OWNED.website.setup);
    expect(s.cash).toBe(cash - 400);
    expect(s.marketing.designYear).toBe(2017);
    expect(agePenalty(s)).toBe(1);
    expect(s.ledger.at(-1)).toMatchObject({ key: "ledger.redesign", category: "marketing", amount: -400 });
    expect(en["ledger.redesign"]({})).toBe("Website redesign");
    expect(redesign(s)).toEqual({ ok: false, error: "error.designCurrent" });
    inYear(s, 2021);
    s.cash = 100;
    expect(redesign(s)).toEqual({ ok: false, error: "error.noCash" });
  });
});

describe("old saves", () => {
  it("load with a rented host and the design year of the game year when the web design is owned", () => {
    const s = readyGame(2);
    s.cash = 100000;
    ok(setUpChannel(s, "website"));
    inYear(s, 2013);
    const old = JSON.parse(serialize(s));
    delete old.marketing.siteHost; delete old.marketing.designYear; delete old.marketing.siteOutage;
    const loaded = deserialize(JSON.stringify(old));
    expect(loaded.marketing).toMatchObject({ siteHost: { kind: "rented" }, designYear: 2013, siteOutage: false });

    const none = readyGame(2);
    inYear(none, 2013);
    const noneOld = JSON.parse(serialize(none));
    delete noneOld.marketing.designYear;
    expect(deserialize(JSON.stringify(noneOld)).marketing.designYear).toBe(2005);

    ok(setSiteHost(s, { kind: "own", clusterId: hostOf(s) }));
    s.marketing = { ...s.marketing, designYear: 2009 };
    expect(deserialize(serialize(s)).marketing).toMatchObject({ siteHost: { kind: "own", clusterId: hostOf(s) }, designYear: 2009 });
  });
});

describe("customer sites", () => {
  const setup = () => {
    const s = readyGame(3);
    const cus = addCustomer(s, "Ada Lang", "agency");
    const r = provisionService(s, cus, "webHosting", { label: "ada.de", spec: sizeSpec("webHosting", 0, yearOf(s.hour)), clusterId: hostOf(s) });
    if (!r.ok) throw new Error(r.error);
    return { s, id: r.id! };
  };

  it("shows a name, a blurb key for the profile and the status up, slow, defaced or down", () => {
    const { s, id } = setup();
    const site = customerSite(s, id)!;
    expect(site).toMatchObject({ title: "Ada Lang", blurb: "site.blurb.agency", status: "up" });
    expect(en[site.blurb]({})).toBeTruthy();

    const host = hostOf(s);
    s.clusters = s.clusters.map((c) => (c.id === host ? { ...c, phpUntil: s.hour + 100 } : c));
    expect(customerSite(s, id)!.status).toBe("slow");
    s.clusters = s.clusters.map((c) => (c.id === host ? { ...c, phpUntil: -1 } : c));

    s.security = { ...s.security, hacked: [host] };
    expect(customerSite(s, id)!.status).toBe("defaced");
    s.security = { ...s.security, hacked: [] };

    ok(setPower(s, "dev3", false));
    expect(customerSite(s, id)!.status).toBe("down");
  });

  it("belongs to web hosting services only", () => {
    const { s } = setup();
    expect(customerSite(s, "nope")).toBeNull();
  });

  it("has a blurb for every profile", () => {
    for (const p of ["private", "gamer", "hobbyDev", "soleProp", "smallBiz", "agency", "office", "onlineShop", "enterprise"]) expect(en[`site.blurb.${p}`]({})).toMatch(/\S/);
  });
});

describe("balance", () => {
  it("keeps the steady bot within half a year of the levels before site hosting and redesigns", () => {
    const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
    const runs = Array.from({ length: 20 }, (_, i) => runBalance(STEADY, i + 1));
    expect(runs.filter((r) => r.bankrupt)).toHaveLength(0);
    const before: Record<number, number> = { 2: 2006.2, 3: 2006.9, 4: 2008.7, 5: 2011.9 };
    for (const level of [2, 3, 4, 5]) expect(Math.abs(median(runs.map((r) => r.levelYear[level] ?? Infinity)) - before[level])).toBeLessThanOrEqual(0.5);
  }, 60000);
});

function ok(r: { ok: boolean; error?: string }) {
  if (!r.ok) throw new Error(r.error);
}
