import { describe, expect, it } from "vitest";
import { sizeSpec } from "../src/sim/10-catalog/products";
import { serviceOnline } from "../src/sim/40-support/status";
import { quotaOf } from "../src/sim/60-infra/netsvc-quota";
import { netsvcTick } from "../src/sim/60-infra/netsvc";
import { putShares, sharesOf, type Share } from "../src/sim/60-infra/netsvc-storage";
import { setQuota } from "../src/sim/90-actions/netsvc-quota";
import { deleteShare, extendShare, setSharePolicy } from "../src/sim/90-actions/netsvc-storage";
import { isMonthStart } from "../src/sim/00-core/time";
import { storageGame } from "./storage-game";

void serviceOnline; void sizeSpec;

const share = (id: string, over: Partial<Share> = {}): Share => ({ id, name: id, createdAt: 0, expiresAt: null, password: false, ...over });
const nextMonth = (s: { hour: number }) => { s.hour += 24; while (!isMonthStart(s.hour)) s.hour += 24; };

describe("shared links", () => {
  it("hands out links each month, some with an expiry or a password", () => {
    const { s, v } = storageGame("ownclod");
    expect(sharesOf(s, v())).toEqual([]);
    for (let i = 0; i < 6; i++) { nextMonth(s); netsvcTick(s); }
    const list = sharesOf(s, v());
    expect(list.length).toBeGreaterThan(3);
    expect(list.some((x) => x.expiresAt !== null)).toBe(true);
  });

  it("lets only old unprotected links leak", () => {
    const { s, v, happy } = storageGame("ownclod");
    s.hour = 24 * 400;
    putShares(s, v(), [share("young", { createdAt: s.hour - 24 * 10 }), share("locked", { createdAt: 0, password: true }), share("timed", { createdAt: 0, expiresAt: s.hour + 24 * 400 })]);
    let leaks = 0;
    for (let m = 0; m < 2; m++) { nextMonth(s); leaks += netsvcTick(s).filter((e) => e.key === "event.linkLeaked" && e.params!.link === "young").length; }
    for (let m = 0; m < 200; m++) { nextMonth(s); leaks += netsvcTick(s).filter((e) => e.key === "event.linkLeaked" && e.params!.link === "timed").length; }
    expect(leaks).toBe(0);
    putShares(s, v(), [share("old", { createdAt: 0 })]);
    s.customers = s.customers.map((c) => ({ ...c, happiness: 90 }));
    const start = happy();
    let hit = 0;
    for (let m = 0; m < 400 && !hit; m++) { nextMonth(s); hit = netsvcTick(s).filter((e) => e.key === "event.linkLeaked" && e.params!.link === "old").length; }
    expect(hit).toBeGreaterThan(0);
    expect(happy()).toBeLessThan(start);
  });

  it("stamps the policy on links without an expiry and gives new ones the same", () => {
    const { s, v } = storageGame("ownclod");
    putShares(s, v(), [share("a"), share("b", { expiresAt: s.hour + 5 })]);
    expect(setSharePolicy(s, 30).ok).toBe(true);
    const list = sharesOf(s, v());
    expect(list[0].expiresAt).toBe(s.hour + 30 * 24);
    expect(list[1].expiresAt).toBe(s.hour + 5);
    expect(setSharePolicy(s, 12).ok).toBe(false);
    nextMonth(s);
    netsvcTick(s);
    expect(sharesOf(s, v()).filter((x) => x.id !== "a" && x.id !== "b").every((x) => x.expiresAt !== null)).toBe(true);
  });

  it("raises a ticket for some expired links, lets the player extend them and drops old ones", () => {
    const { s, v } = storageGame("ownclod");
    s.hour = 24 * 100;
    const links = Array.from({ length: 60 }, (_, i) => share(`x${i}`, { expiresAt: s.hour - 1 }));
    putShares(s, v(), links);
    netsvcTick(s);
    const ticket = s.tickets.find((t) => t.topic === "linkExpired");
    expect(ticket).toBeDefined();
    expect(extendShare(s, v().id, "x0").ok).toBe(true);
    expect(sharesOf(s, v()).find((x) => x.id === "x0")!.expiresAt).toBe(s.hour + 30 * 24);
    expect(s.tickets.find((t) => t.id === ticket!.id)!.status).toBe("resolved");
    expect(deleteShare(s, v().id, "x1").ok).toBe(true);
    s.hour += 24 * 31;
    netsvcTick(s);
    expect(sharesOf(s, v()).some((x) => x.id === "x2")).toBe(false);
  });

  it("sets the per-user quota of a storage service through the quota module", () => {
    const { s, v } = storageGame("ownclod");
    expect(quotaOf(s, v()).perUserMb).toBeGreaterThan(0);
    expect(setQuota(s, v().id, 2048).ok).toBe(true);
    expect(quotaOf(s, v()).perUserMb).toBe(2048);
  });
});
