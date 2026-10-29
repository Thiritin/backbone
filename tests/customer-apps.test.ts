import { describe, expect, it } from "vitest";
import { hourOf, yearOf } from "../src/sim/00-core/time";
import { REP, SPAM } from "../src/sim/10-catalog/addresses";
import { appShares, AUTO_UPDATE, CMS, drawApp, SELF_UPDATE, type App } from "../src/sim/10-catalog/apps";
import { marketRates, sizeSpec, specPrice } from "../src/sim/10-catalog/products";
import type { Profile } from "../src/sim/30-customers/customers";
import { offerPrice } from "../src/sim/30-market/spec";
import { newGame, type GameState } from "../src/sim/50-state";
import { mailAddress } from "../src/sim/60-infra/addresses";
import {
  appMonitoring, appsTick, appVulns, asksForHelp, cleanSite, notifyCustomers, selfUpdateAt, wishOf,
} from "../src/sim/60-infra/apps";
import { vulnsFor, type Severity, type Vulnerability } from "../src/sim/60-infra/vulns";
import { tick, type SimEvent } from "../src/sim/88-tick/tick";
import { provisionService } from "../src/sim/90-actions/clusters";
import { addCustomer, addService } from "../src/sim/90-actions/customers";
import { setRate } from "../src/sim/90-actions/rates";
import { resolveTicket } from "../src/sim/90-actions/support";
import { customerSite } from "../src/sim/80-business/website";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { panelServer, withServer } from "./fixtures";

const ok = (r: { ok: boolean; id?: string; error?: string }) => {
  if (!r.ok) throw new Error(r.error);
  return r.id!;
};
const year = (y: number) => hourOf(new Date(Date.UTC(y, 0, 1)));

// The first vulnerability of the family and severity in the seed's releases from 2006.
function find(seed: number, family: App, severity?: Severity, from = 2006): Vulnerability {
  for (let y = from; y < 2060; y++) {
    const v = vulnsFor(family, y, seed).find((x) => !severity || x.severity === severity);
    if (v) return v;
  }
  throw new Error("none");
}

// A web hosting service of a new customer, running the app at a release from an hour on.
function site(s: GameState, profile: Profile, app: App, version: number, updatedAt: number, i = s.nextId): string {
  const cus = addCustomer(s, `Customer ${i}`, profile);
  return addService(s, cus, "webHosting", `site${i}.de`, 0.02, "hour", 0, null, { ...sizeSpec("webHosting", 0, 2005), app, appVersion: version, appUpdatedAt: updatedAt });
}
const service = (s: GameState, id: string) => s.services.find((v) => v.id === id)!;
const customerOf = (s: GameState, id: string) => s.customers.find((c) => c.id === service(s, id).customerId)!;
const share = (n: number, of: number) => n / of;

// Sites open to a vulnerability on the day after its patch.
function open(s: GameState, vuln: Vulnerability, profile: Profile, n: number, app: App = vuln.family as App): string[] {
  s.hour = vuln.patchedAt + 24;
  return Array.from({ length: n }, (_, i) => site(s, profile, app, vuln.year, vuln.disclosedAt - 24 * 60, i));
}

describe("customer apps", () => {
  it("follow the shares by year with linear steps between the keyframes", () => {
    expect(appShares(2005)).toMatchObject({ static: 0.6, wordpass: 0.2 });
    expect(appShares(2005).joomlah).toBeCloseTo(0.15);
    expect(appShares(2005).drupel).toBeCloseTo(0.05);
    expect(appShares(2010)).toMatchObject({ static: 0.35, wordpass: 0.4 });
    expect(appShares(2015)).toMatchObject({ static: 0.2, wordpass: 0.6 });
    expect(appShares(2020)).toMatchObject({ static: 0.15, wordpass: 0.7 });
    expect(appShares(2035)).toEqual(appShares(2020));
    expect(appShares(2012).wordpass).toBeCloseTo(0.48);
    for (const y of [2005, 2008, 2013, 2019, 2026]) {
      const a = appShares(y);
      expect(a.static + a.wordpass + a.joomlah + a.drupel).toBeCloseTo(1);
      expect(a.joomlah / a.drupel).toBeCloseTo(3);
    }
    const count = (y: number) => {
      const n: Record<string, number> = {};
      for (let k = 0; k < 4000; k++) n[drawApp(7, k, y)] = (n[drawApp(7, k, y)] ?? 0) + 1;
      return n;
    };
    expect(share(count(2005).static, 4000)).toBeGreaterThan(0.56);
    expect(share(count(2005).static, 4000)).toBeLessThan(0.64);
    expect(share(count(2026).wordpass, 4000)).toBeGreaterThan(0.66);
    expect(share(count(2026).wordpass, 4000)).toBeLessThan(0.74);
    expect(drawApp(7, 3, 2010)).toBe(drawApp(7, 3, 2010));
  });

  it("are drawn for every new web hosting service and recorded with their release", () => {
    const s = withServer(newGame(1));
    const id = addService(s, addCustomer(s, "Ada Lang", "hobbyDev"), "webHosting", "ada.de", 0.02, "hour");
    const { spec } = service(s, id);
    expect(spec.app).toBe(drawApp(1, Number(id.slice(3)), 2005));
    expect(spec).toMatchObject({ appVersion: 2005, appUpdatedAt: 0 });
    const vps = addService(s, addCustomer(s, "Bo", "gamer"), "vps", "box", 0.02, "hour");
    expect(service(s, vps).spec.app).toBeUndefined();
  });
});

describe("self-updating customers", () => {
  // The share of (site, vulnerability) pairs the customers of a profile would update by themselves.
  function updating(profile: Profile, app: App, years: number[]) {
    const s = newGame(5), vulns = years.flatMap((y) => vulnsFor(app, y, 5));
    const ids = Array.from({ length: 30 }, (_, i) => site(s, profile, app, 2005, 0, i));
    const pairs = ids.flatMap((id) => vulns.map((v) => selfUpdateAt(s, service(s, id), v)));
    return { share: pairs.filter((x) => x !== null).length / pairs.length, pairs, vulns };
  }

  it("update by skill within seven days of the patch", () => {
    const byYears = [2006, 2007, 2008, 2009, 2010, 2011, 2012];
    for (const [profile, want] of [["hobbyDev", SELF_UPDATE.high], ["smallBiz", SELF_UPDATE.medium], ["private", SELF_UPDATE.low]] as const) {
      const r = updating(profile, "joomlah", byYears);
      expect(Math.abs(r.share - want)).toBeLessThan(0.08);
    }
    const s = newGame(5), v = find(5, "joomlah"), ids = Array.from({ length: 40 }, (_, i) => site(s, "hobbyDev", "joomlah", 2005, 0, i));
    for (const id of ids) {
      const at = selfUpdateAt(s, service(s, id), v);
      if (at !== null) {
        expect(at).toBeGreaterThanOrEqual(v.patchedAt);
        expect(at).toBeLessThan(v.patchedAt + 7 * 24);
      }
    }
  });

  it("step up for WordPass from 2013 and not for the other apps", () => {
    const before = [2008, 2009, 2010, 2011, 2012], after = [2014, 2016, 2018, 2020, 2022];
    for (const [profile, plain, auto] of [["hobbyDev", SELF_UPDATE.high, AUTO_UPDATE.high], ["smallBiz", SELF_UPDATE.medium, AUTO_UPDATE.medium], ["private", SELF_UPDATE.low, AUTO_UPDATE.low]] as const) {
      expect(Math.abs(updating(profile, "wordpass", before).share - plain)).toBeLessThan(0.08);
      expect(Math.abs(updating(profile, "wordpass", after).share - auto)).toBeLessThan(0.08);
      expect(Math.abs(updating(profile, "drupel", after).share - plain)).toBeLessThan(0.08);
    }
  });

  it("close the vulnerability on the day they update", () => {
    const s = newGame(5), v = find(5, "joomlah"), ids = open(s, v, "hobbyDev", 40);
    s.hour = v.patchedAt;
    expect(ids.every((id) => appVulns(s, service(s, id)).length > 0)).toBe(true);
    let updated = 0;
    for (let d = 0; d < 8; d++) {
      appsTick(s);
      s.hour += 24;
    }
    for (const id of ids) {
      const left = appVulns(s, service(s, id)).some((x) => x.id === v.id);
      const at = selfUpdateAt(s, service(s, id), v);
      if (at !== null) { updated++; expect(left).toBe(false); }
    }
    expect(updated).toBeGreaterThan(20);
  });
});

describe("notifying customers", () => {
  const critical = (seed: number) => find(seed, "joomlah", "high");

  it("takes 30 minutes per 10 customers and writes to each only once", () => {
    const s = newGame(3), v = critical(3);
    open(s, v, "private", 25);
    s.playerBusyUntil = 0;
    ok(notifyCustomers(s, "joomlah", v.id));
    expect(s.playerBusyUntil).toBe(s.hour * 60 + 90);
    expect(notifyCustomers(s, "joomlah", v.id)).toEqual({ ok: false, error: "error.nobodyToNotify" });
    expect(notifyCustomers(s, "drupel", v.id).ok).toBe(false);
    expect(appMonitoring(s).find((r) => r.vuln?.id === v.id)).toMatchObject({ sites: 25, unnotified: 0 });
  });

  it("makes half of those who would not update themselves ask for help, and offers split 70, 20 and 10 by budget", () => {
    const s = newGame(3), v = critical(3), ids = open(s, v, "smallBiz", 1000);
    ok(notifyCustomers(s, "joomlah", v.id));
    const stay = ids.filter((id) => selfUpdateAt(s, service(s, id), v) === null);
    const asking = s.tickets.filter((t) => t.kind === "howTo" && t.topic === "update");
    expect(asking.every((t) => stay.includes(t.serviceId!))).toBe(true);
    expect(Math.abs(share(asking.length, stay.length) - 0.5)).toBeLessThan(0.05);
    expect(stay.filter((id) => asksForHelp(service(s, id), v)).length).toBe(asking.length);
    const wishes = asking.map((t) => wishOf(s, customerOf(s, t.serviceId!), t));
    const of = (w: string) => share(wishes.filter((x) => x === w).length, wishes.length);
    expect(Math.abs(of("once") - 0.7)).toBeLessThan(0.06);
    expect(Math.abs(of("managed") - 0.2)).toBeLessThan(0.06);
    expect(Math.abs(of("refuse") - 0.1)).toBeLessThan(0.05);
  });

  it("never sells managed updates to a basic budget", () => {
    const s = newGame(3), v = critical(3), ids = open(s, v, "private", 600);
    ok(notifyCustomers(s, "joomlah", v.id));
    const wishes = s.tickets.filter((t) => t.topic === "update").map((t) => wishOf(s, customerOf(s, t.serviceId!), t));
    expect(wishes.length).toBeGreaterThan(100);
    expect(wishes).not.toContain("managed");
    expect(ids.length).toBe(600);
  });

  // A game with a ticket from a customer whose wish is the given one.
  function asked(wish: "once" | "managed" | "refuse") {
    const s = newGame(3), v = critical(3);
    open(s, v, "smallBiz", 400);
    ok(notifyCustomers(s, "joomlah", v.id));
    const t = s.tickets.find((x) => x.topic === "update" && wishOf(s, customerOf(s, x.serviceId!), x) === wish)!;
    s.playerBusyUntil = 0;
    return { s, t, v, svc: t.serviceId! };
  }
  const settle = (s: GameState, id: string) => {
    for (let h = 0; h < 3 && s.tickets.find((x) => x.id === id)!.work; h++) tick(s);
    return s.tickets.find((x) => x.id === id)!;
  };

  it("sells the one-off update for a sales ledger line and closes the vulnerability", () => {
    const { s, t, v, svc } = asked("once");
    ok(resolveTicket(s, t.id, "offerOnce"));
    const done = settle(s, t.id);
    expect(done).toMatchObject({ status: "resolved", outcome: "updateSold" });
    expect(s.ledger.find((l) => l.key === "ledger.appUpdate")).toMatchObject({ category: "sales", amount: 49 });
    expect(appVulns(s, service(s, svc)).some((x) => x.id === v.id)).toBe(false);
    expect(service(s, svc).spec.managedUpdates).toBeUndefined();
  });

  it("books the one-off at the player's own rate", () => {
    const { s, t } = asked("once");
    ok(setRate(s, "webHosting", "updateOnce", 80));
    ok(resolveTicket(s, t.id, "offerOnce"));
    settle(s, t.id);
    expect(s.ledger.find((l) => l.key === "ledger.appUpdate")?.amount).toBe(80);
  });

  it("sells managed updates and raises the price by the monthly rate without a complaint", () => {
    const { s, t, svc } = asked("managed");
    const monthly = service(s, svc).price * 730, happy = customerOf(s, svc).happiness, priced = () => s.tickets.some((x) => x.customerId === service(s, svc).customerId && x.topic === "price");
    ok(resolveTicket(s, t.id, "offerManaged"));
    expect(settle(s, t.id)).toMatchObject({ outcome: "managedSold" });
    expect(service(s, svc).spec.managedUpdates).toBe(true);
    expect(service(s, svc).price * 730).toBeCloseTo(monthly + 5, 5);
    expect(customerOf(s, svc).happiness).toBeGreaterThanOrEqual(happy);
    expect(priced()).toBe(false);
  });

  it("is declined when the customer wants something else, and leaves the thread open for another offer", () => {
    const { s, t, svc } = asked("managed");
    ok(resolveTicket(s, t.id, "offerOnce"));
    const events: SimEvent[] = [];
    for (let h = 0; h < 3; h++) events.push(...tick(s));
    expect(s.tickets.find((x) => x.id === t.id)).toMatchObject({ status: "open", outcome: null, work: null });
    expect(events.some((e) => e.key === "event.offerDeclined")).toBe(true);
    expect(appVulns(s, service(s, svc)).length).toBeGreaterThan(0);
    ok(resolveTicket(s, t.id, "offerManaged"));
    expect(settle(s, t.id).outcome).toBe("managedSold");
  });

  it("updates for free in 20 minutes for +5 happiness", () => {
    const { s, t, v, svc } = asked("refuse");
    const happy = customerOf(s, svc).happiness;
    ok(resolveTicket(s, t.id, "free"));
    expect(s.playerBusyUntil).toBe(s.hour * 60 + 20);
    expect(settle(s, t.id)).toMatchObject({ status: "resolved", outcome: "updated" });
    expect(customerOf(s, svc).happiness).toBeGreaterThan(happy + 4);
    expect(s.ledger.some((l) => l.key === "ledger.appUpdate")).toBe(false);
    expect(appVulns(s, service(s, svc)).some((x) => x.id === v.id)).toBe(false);
  });

  it("offers only the update actions on an update ticket", () => {
    const { s, t } = asked("once");
    expect(resolveTicket(s, t.id, "clean")).toEqual({ ok: false, error: "error.unknownTicketAction" });
    expect(resolveTicket(s, t.id, "credit")).toEqual({ ok: false, error: "error.unknownTicketAction" });
  });
});

describe("managed updates", () => {
  it("update within a day of every patch and close the vulnerabilities", () => {
    const s = newGame(4), v = find(4, "joomlah"), [id] = open(s, v, "smallBiz", 1);
    s.services = s.services.map((x) => (x.id === id ? { ...x, spec: { ...x.spec, managedUpdates: true } } : x));
    s.hour = v.patchedAt;
    expect(appVulns(s, service(s, id)).map((x) => x.id)).toContain(v.id);
    appsTick(s);
    expect(appVulns(s, service(s, id))).toEqual([]);
    expect(service(s, id).spec.appUpdatedAt).toBe(v.patchedAt);
  });

  it("raise the price through the pricing units", () => {
    expect(marketRates("webHosting", 2026)).toMatchObject({ updates: 5, updateOnce: 49 });
    expect(marketRates("webHosting", 2005)).toMatchObject({ updates: 5, updateOnce: 49 });
    const spec = sizeSpec("webHosting", 1, 2026);
    expect(specPrice("webHosting", { ...spec, managedUpdates: true }, 2026)).toBeCloseTo(specPrice("webHosting", spec, 2026) + 5, 2);
    const s = newGame(1);
    ok(setRate(s, "webHosting", "updates", 8));
    expect(offerPrice(s, "webHosting", { ...spec, managedUpdates: true })).toBeCloseTo(offerPrice(s, "webHosting", spec) + 8, 2);
    expect(setRate(s, "vps", "updates", 1).ok).toBe(false);
  });
});

describe("hacked customer sites", () => {
  // A site left open to a critical vulnerability for months, whose customer never updates for it. Sites that would are dropped.
  function stuck(s: GameState, profile: Profile = "private") {
    const v = find(s.seed, "joomlah", "critical");
    s.hour = v.patchedAt + 24 * 100;
    for (let i = 0; i < 200; i++) {
      const id = site(s, profile, "joomlah", v.year, v.disclosedAt - 24);
      if (appVulns(s, service(s, id)).every((x) => selfUpdateAt(s, service(s, id), x) === null)) return id;
      s.services = s.services.filter((x) => x.id !== id);
    }
    throw new Error("no stuck site");
  }
  const days = (s: GameState, n: number, until: () => boolean) => {
    const events: SimEvent[] = [];
    for (let d = 0; d < n && !until(); d++) {
      s.hour += 24;
      events.push(...appsTick(s));
    }
    return events;
  };

  it("get defaced by chance with a hacked ticket, only the one service", () => {
    const s = newGame(2), id = stuck(s), other = site(s, "private", "static", 2005, 0);
    const events = days(s, 600, () => s.sites.defaced.length > 0);
    expect(s.sites.defaced).toEqual([id]);
    expect(events.find((e) => e.key === "event.siteHacked")?.params).toMatchObject({ software: "Joomlah" });
    expect(s.tickets.find((t) => t.topic === "hacked")).toMatchObject({ kind: "howTo", serviceId: id, status: "open" });
    expect(customerSite(s, id)?.status).toBe("defaced");
    expect(customerSite(s, other)?.status).not.toBe("defaced");
    expect(s.sites.hacks[id]).toHaveLength(1);
  });

  it("never touch static sites", () => {
    const s = newGame(2);
    site(s, "private", "static", 2005, 0);
    s.hour = year(2030);
    days(s, 800, () => false);
    expect(s.sites.defaced).toEqual([]);
  });

  it("send spam from the host's address a day while defaced", () => {
    const base = () => {
      const s = withServer(newGame(1)), host = panelServer(s, "dev3"), cus = addCustomer(s, "Ada Lang", "hobbyDev");
      const id = ok(provisionService(s, cus, "webHosting", { label: "ada.de", spec: sizeSpec("webHosting", 0, 2005), clusterId: host }));
      return { s, host, id };
    };
    const day = (s: GameState) => { for (let h = 0; h < 24; h++) tick(s); };
    const { s, host, id } = base(), clean = base();
    tick(s); tick(clean.s);
    const start = mailAddress(s, host)!.rep;
    s.sites = { ...s.sites, defaced: [id] };
    day(s); day(clean.s);
    expect(start - mailAddress(s, host)!.rep).toBe(SPAM.shady * REP.perThousand);
    expect(mailAddress(clean.s, clean.host)!.rep).toBeGreaterThanOrEqual(start);
  });

  // Test sites run without a workload, so a backed-up one is added for the restore and dropped again to keep the site online.
  const backed = (s: GameState, id: string) => {
    s.workloads.push({ id: `wb${id}`, serviceId: id, clusterId: null, deviceId: null, rackId: null, slot: 0, units: 0, watts: 0, placedAt: 0, vcpu: 1, ramGb: 1, diskGb: 1, stopped: false, busyUntil: 0, backupAt: s.hour });
  };
  const unbacked = (s: GameState, id: string) => { s.workloads = s.workloads.filter((w) => w.id !== `wb${id}`); };

  it("are restored by the player from a backup in 30 minutes, which resolves the ticket", () => {
    const s = newGame(2), id = stuck(s);
    days(s, 600, () => s.sites.defaced.length > 0);
    s.playerBusyUntil = 0;
    expect(cleanSite(s, id)).toEqual({ ok: false, error: "error.noBackup" });
    backed(s, id);
    const happy = customerOf(s, id).happiness;
    ok(cleanSite(s, id));
    expect(s.playerBusyUntil).toBe(s.hour * 60 + 30);
    expect(s.sites.defaced).toEqual([]);
    expect(s.tickets.find((t) => t.topic === "hacked")).toMatchObject({ status: "resolved", outcome: "cleaned" });
    expect(customerOf(s, id).happiness).toBe(Math.min(100, happy + 5));
    expect(cleanSite(s, id)).toEqual({ ok: false, error: "error.notDefaced" });
  });

  it("are restored from the ticket in 30 minutes when a backup exists", () => {
    const s = newGame(2), id = stuck(s);
    days(s, 600, () => s.sites.defaced.length > 0);
    const t = s.tickets.find((x) => x.topic === "hacked")!;
    s.playerBusyUntil = 0;
    expect(resolveTicket(s, t.id, "clean")).toEqual({ ok: false, error: "error.noBackup" });
    backed(s, id);
    ok(resolveTicket(s, t.id, "clean"));
    expect(s.playerBusyUntil).toBe(s.hour * 60 + 30);
    for (let h = 0; h < 3 && s.tickets.find((x) => x.id === t.id)!.work; h++) tick(s);
    expect(s.tickets.find((x) => x.id === t.id)).toMatchObject({ status: "resolved", outcome: "cleaned" });
    expect(s.sites.defaced).toEqual([]);
    expect(id).toBeTruthy();
  });

  it("without a backup are left to the customer to rebuild, at a loss of happiness", () => {
    const s = newGame(2), id = stuck(s);
    days(s, 600, () => s.sites.defaced.length > 0);
    const t = s.tickets.find((x) => x.topic === "hacked")!, happy = customerOf(s, id).happiness;
    ok(resolveTicket(s, t.id, "noBackup"));
    for (let h = 0; h < 3 && s.tickets.find((x) => x.id === t.id)!.work; h++) tick(s);
    expect(s.tickets.find((x) => x.id === t.id)).toMatchObject({ status: "resolved", outcome: "noBackup" });
    expect(s.sites.defaced).toEqual([]);
    expect(customerOf(s, id).happiness).toBeLessThan(happy);
  });

  it("are cleaned up by customers of medium and high skill half the time within three days, never by low skill", () => {
    const s = newGame(2);
    const cleaned = (profile: Profile) => {
      const ids = Array.from({ length: 200 }, () => site(s, profile, "static", 2005, 0));
      s.sites = { ...s.sites, defaced: ids, hacks: Object.fromEntries(ids.map((id) => [id, [s.hour]])) };
      for (let d = 0; d < 4; d++) { s.hour += 24; appsTick(s); }
      return ids.filter((id) => !s.sites.defaced.includes(id)).length;
    };
    s.hour = year(2006);
    expect(cleaned("private")).toBe(0);
    const medium = cleaned("smallBiz"), high = cleaned("hobbyDev");
    expect(Math.abs(share(medium, 200) - 0.5)).toBeLessThan(0.1);
    expect(Math.abs(share(high, 200) - 0.5)).toBeLessThan(0.1);
  });

  it("make the customer leave at the third hack within a year", () => {
    const s = newGame(2), id = stuck(s), all: SimEvent[] = [];
    for (let n = 1; n <= 3; n++) {
      all.push(...days(s, 3000, () => s.sites.defaced.includes(id) || customerOf(s, id).churnedAt !== null));
      if (n < 3) {
        expect(s.sites.hacks[id]).toHaveLength(n);
        expect(customerOf(s, id).churnedAt).toBeNull();
        backed(s, id);
        ok(cleanSite(s, id));
        unbacked(s, id);
      }
    }
    expect(customerOf(s, id).churnedAt).not.toBeNull();
    expect(service(s, id).endedAt).not.toBeNull();
    expect(all.filter((e) => e.key === "event.siteHacked")).toHaveLength(2);
    expect(all.some((e) => e.key === "event.siteLeft")).toBe(true);
    expect(s.sites.defaced).toEqual([]);
  });

  it("do not count hacks older than a year", () => {
    const s = newGame(2), id = stuck(s);
    s.sites = { ...s.sites, hacks: { [id]: [s.hour - 24 * 400, s.hour - 24 * 380] } };
    days(s, 3000, () => s.sites.defaced.length > 0);
    expect(customerOf(s, id).churnedAt).toBeNull();
    expect(s.sites.hacks[id]).toHaveLength(1);
  });
});

describe("saves from before customer apps", () => {
  it("draw the app by the start year and run two releases behind the save", () => {
    const s = withServer(newGame(6));
    const early = addService(s, addCustomer(s, "Ada Lang", "hobbyDev"), "webHosting", "ada.de", 0.02, "hour");
    s.hour = year(2012);
    const late = addService(s, addCustomer(s, "Bo Lang", "hobbyDev"), "webHosting", "bo.de", 0.02, "hour");
    s.hour = year(2020) + 5;
    const data = JSON.parse(serialize(s));
    delete data.sites;
    for (const v of data.services) for (const k of ["app", "appVersion", "appUpdatedAt"]) delete v.spec[k];
    const back = deserialize(JSON.stringify(data));
    expect(back.sites).toEqual({ defaced: [], hacks: {}, notified: [] });
    const a = service(back, early).spec, b = service(back, late).spec;
    expect(a.app).toBe(drawApp(6, Number(early.slice(3)), 2005));
    expect(b.app).toBe(drawApp(6, Number(late.slice(3)), 2012));
    expect(CMS.includes(a.app!) || a.app === "static").toBe(true);
    expect(a.appVersion).toBe(2018);
    expect(b.appVersion).toBe(2018);
    expect(yearOf(a.appUpdatedAt!)).toBe(2018);
    expect(deserialize(serialize(back)).services.map((v) => v.spec)).toEqual(back.services.map((v) => v.spec));
  });
});
