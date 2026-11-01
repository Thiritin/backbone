import { describe, expect, it } from "vitest";
import { hourOf } from "../src/sim/00-core/time";
import { rivalTrust, TIERS } from "../src/sim/10-catalog/hosttoast";
import { newGame, type GameState } from "../src/sim/50-state";
import { rivalValue } from "../src/sim/30-market/market";
import { bestTier, rollRivals, withBadges, yearAwards, type Rival } from "../src/sim/30-market/rivals";
import { hosttoastList, hosttoastTick, uptime90 } from "../src/sim/80-business/hosttoast";
import { trustBonus } from "../src/sim/80-business/marketing";
import { feed } from "../src/sim/80-business/news";
import { addCustomer } from "../src/sim/90-actions/customers";
import { registerHostToast, setHostToastTier } from "../src/sim/90-actions/marketing";
import { deserialize, serialize } from "../src/sim/91-save/save";

const month = (y: number, m: number) => hourOf(new Date(Date.UTC(y, m, 1)));
const byId = (s: GameState, id: string): Rival => s.competitors.find((r) => r.id === id)!;
const listed = (s: GameState, tier: keyof typeof TIERS, uptime = [1, 1, 1]) => { s.hosttoast = { ...s.hosttoast, tier, uptime }; };

describe("HOSTtoast", () => {
  it("seeds the majors on Premium, Rackspice on Diamond and small rivals as Registered, and fills old saves", () => {
    const s = newGame(5);
    expect(s.competitors.slice(0, 6).map((r) => [r.id, r.tier, r.badges])).toEqual([
      ["ionose", "premium", 1], ["ovheat", "premium", 1], ["hetzna", "premium", 1], ["rackspice", "diamond", 1], ["nitradoh", "premium", 1], ["wp-engyne", "premium", 1],
    ]);
    expect(s.competitors.slice(6).every((r) => r.tier === "registered" && r.badges === 0)).toBe(true);
    // Their 2005 listing is what their scores were set with.
    expect(s.competitors.slice(0, 6).map(rivalTrust)).toEqual([0, 0, 0, 0, 0, 0]);
    expect(s.hosttoast).toEqual({ tier: null, uptime: [], audit: null, awards: [] });
    const old = JSON.parse(serialize(s));
    delete old.hosttoast;
    for (const r of old.competitors) { delete r.tier; delete r.badges; delete r.down; }
    const back = deserialize(JSON.stringify(old));
    expect(back.hosttoast).toEqual(s.hosttoast);
    expect(back.competitors.map((r) => [r.tier, r.badges, r.down])).toEqual(s.competitors.map((r) => [r.tier, r.badges, []]));
  });

  it("replaces the free listing's trust and caps it with a paid review platform at 10", () => {
    const s = newGame(5);
    s.marketing.platform = "free";
    expect(trustBonus(s)).toBe(0);
    expect(registerHostToast(s)).toEqual({ ok: true });
    expect(trustBonus(s)).toBe(2);
    expect(registerHostToast(s)).toEqual({ ok: false, error: "error.hosttoast.registered" });
    s.marketing.platform = "trustPylon";
    expect(trustBonus(s)).toBe(8);
    listed(s, "diamond");
    expect(trustBonus(s)).toBe(10);
    // Last year's badges add one each.
    s.marketing.platform = null;
    s.hosttoast.awards = [{ year: 2004, kind: "uptime", product: null, id: "you" }, { year: 2003, kind: "uptime", product: null, id: "you" }];
    expect(trustBonus(s)).toBe(8);
  });

  it("refuses a tier the company is too young for or misses the uptime of, and grants a lower one", () => {
    const s = newGame(5);
    expect(setHostToastTier(s, "verified")).toEqual({ ok: false, error: "error.hosttoast.notRegistered" });
    registerHostToast(s);
    expect(setHostToastTier(s, "verified")).toEqual({ ok: false, error: "error.hosttoast.tooYoung" });
    s.hour = month(2007, 2);
    s.hosttoast.uptime = [1, 0.97, 0.99];
    expect(setHostToastTier(s, "verified")).toEqual({ ok: false, error: "error.hosttoast.uptime99" });
    s.hosttoast.uptime = [1, 0.995, 0.994];
    expect(uptime90(s)).toBeCloseTo(0.9963, 4);
    expect(setHostToastTier(s, "diamond")).toEqual({ ok: true });
    s.hosttoast.uptime = [0.99, 0.99, 0.99];
    expect(setHostToastTier(s, "premium")).toEqual({ ok: true });
    expect(setHostToastTier(s, "diamond")).toEqual({ ok: false, error: "error.hosttoast.uptime995" });
  });

  it("bills the fee as its own ledger line, opens a test ticket and drops a tier for a late answer", () => {
    const s = newGame(5);
    addCustomer(s, "Jonas Weber", "private");
    listed(s, "premium");
    s.hour = month(2006, 3);
    const cash = s.cash;
    hosttoastTick(s);
    expect(s.cash).toBe(cash - 99);
    expect(s.ledger.at(-1)).toMatchObject({ category: "marketing", key: "ledger.hosttoast", amount: -99 });
    const audit = s.tickets.find((x) => x.id === s.hosttoast.audit)!;
    expect(audit).toMatchObject({ kind: "howTo", customerId: s.customers[0].id, status: "open" });
    // Answered after three days: one tier down at the next month, with an email from HOSTtoast.
    audit.replies = [{ hour: audit.createdAt + 72, template: "tpl.howTo", right: true } as (typeof audit.replies)[number]];
    s.hour = month(2006, 4);
    const events = hosttoastTick(s);
    expect(s.hosttoast.tier).toBe("verified");
    expect(s.hosttoast.audit).toBeNull();
    expect(s.tickets.at(-1)).toMatchObject({ kind: "mail", topic: "hosttoastLate", mail: { from: "HOSTtoast" } });
    expect(events.some((e) => e.key === "event.ticket")).toBe(true);
    expect(s.ledger.at(-1)).toMatchObject({ key: "ledger.hosttoast", amount: -29 });
  });

  it("drops a tier when the 90-day uptime falls under its minimum", () => {
    const s = newGame(5);
    listed(s, "diamond", [1, 1]);
    s.hour = month(2008, 5);
    hosttoastTick(s);
    expect(s.hosttoast.tier).toBe("diamond");
    s.hosttoast.uptime = [0.99, 0.99];
    hosttoastTick(s);
    expect(s.hosttoast.uptime.at(-1)).toBe(1);
    expect(s.hosttoast.tier).toBe("premium");
    expect(s.tickets.at(-1)).toMatchObject({ topic: "hosttoastUptime" });
  });

  it("drops a rival on an outage that breaks its minimum and lets each January set the best tier it qualifies for", () => {
    const s = newGame(5), rack = byId(s, "rackspice");
    const list = [{ ...rack, down: [{ month: 3, hours: 12 }] }];
    const mar = rollRivals(list, s.seed, month(2005, 4), () => 0);
    expect(mar.list[0].tier).toBe("premium");
    expect(mar.events).toContainEqual({ kind: "tier", id: "rackspice", params: [2] });
    // Three months later the outage has left the 90 days, and January buys Diamond again.
    expect(bestTier(list[0], 13)).toBe("diamond");
    const small = { ...s.competitors[6], founded: 0, R: 70, customers: { Frankfurt: 1000 } };
    expect(bestTier(small, 5)).toBe("registered");
    expect(bestTier(small, 6)).toBe("verified");
    expect(bestTier({ ...small, customers: { Frankfurt: 1 } }, 30)).toBe("registered");
  });

  it("names a host of the year per product, seals clean years and counts badges as trust", () => {
    const s = newGame(5);
    const reviews = (stars: number) => Array.from({ length: 10 }, () => ({ stars: stars * 4, count: 4 }));
    const list = s.competitors.slice(0, 6).map((r) => ({ ...r, reviews: reviews(r.id === "hetzna" ? 4.5 : 3) }));
    list[0] = { ...list[0], down: [{ month: 20, hours: 3 }] };
    const won = yearAwards(list, 2006, null);
    expect(won.filter((a) => a.kind === "host").map((a) => [a.product, a.id])).toEqual([["webHosting", "ionose"], ["vps", "hetzna"], ["gameServer", "ovheat"]]);
    expect(won.filter((a) => a.kind === "uptime").map((a) => a.id)).toEqual(["ovheat", "hetzna", "rackspice", "nitradoh", "wp-engyne"]);
    const you = yearAwards(list, 2006, { score: 4.8, count: 30, sells: ["vps"], clean: true });
    expect(you.find((a) => a.product === "vps")?.id).toBe("you");
    expect(you.some((a) => a.kind === "uptime" && a.id === "you")).toBe(true);
    const badged = withBadges(list, won);
    expect(badged.map((r) => r.badges)).toEqual([1, 2, 2, 1, 1, 1]);
    expect(rivalTrust(badged[2])).toBe(1);
    expect(rivalValue("hobbyDev", badged[2]) - rivalValue("hobbyDev", list[2])).toBeCloseTo(1, 6);
  });

  it("runs the January awards in the game with news for each host of the year", () => {
    const s = newGame(5);
    s.competitors = s.competitors.map((r) => ({ ...r, reviews: Array.from({ length: 10 }, () => ({ stars: 16, count: 4 })) }));
    s.hour = month(2006, 0);
    const events = hosttoastTick(s);
    expect(s.hosttoast.awards.filter((a) => a.kind === "host")).toHaveLength(3);
    expect(events.filter((e) => e.key === "event.news.toastAward")).toHaveLength(3);
    expect(feed(s).some((n) => n.key === "event.news.toastAward")).toBe(true);
  });

  it("lists rivals and you by tier, then review score", () => {
    const s = newGame(5);
    const rows = hosttoastList(s, "webHosting", null);
    expect(rows[0].id).toBe("rackspice");
    expect(rows.every((r, i) => i === 0 || TIERS[rows[i - 1].tier].fee >= TIERS[r.tier].fee)).toBe(true);
    expect(rows.some((r) => r.id === "you")).toBe(false);
  });
});
