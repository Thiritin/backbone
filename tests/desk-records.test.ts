import { describe, expect, it } from "vitest";
import { hourOf, nowHours } from "../src/sim/00-core/time";
import { openDesk } from "../src/sim/40-support/desk";
import { deskAddress, deskHostReachable, deskRecords, senderVerified } from "../src/sim/40-support/desk-records";
import type { GameState } from "../src/sim/50-state";
import { holderOf } from "../src/sim/60-infra/addresses";
import { panelMachine } from "../src/sim/60-infra/licence";
import { installDesk, subscribeDesk, verifyDesk } from "../src/sim/90-actions/desk-install";
import { setCompanyRecord } from "../src/sim/90-actions/domains";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { readyGame } from "./fixtures";

const game = (seed = 5): GameState => { const s = readyGame(seed); s.hour = hourOf(new Date(Date.UTC(2014, 0, 1))); s.cash = 1_000_000; return s; };
// The panel host's own public address, as a datacenter server holds it.
const panel = (s: GameState) => {
  const c = s.clusters.find((x) => x.kind === "panel")!;
  s.ips.addresses.push({ id: "ip-desk", ip: "203.0.113.10", v: 4, locationId: s.locations[0].id, holder: holderOf(s, panelMachine(c)!), source: "line", blockId: null, rep: 100, listed: false, spam: 0, delistAt: null });
  return c;
};
const rows = (s: GameState, hour?: number) => deskRecords(s, hour).map((r) => [r.type, r.name, r.data, r.ok]);
const add = (s: GameState, type: "A" | "CNAME" | "TXT", name: string, data: string) => expect(setCompanyRecord(s, { type, name, ttl: 3600, data }).ok).toBe(true);

describe("desk domain records", () => {
  it("lists the CNAME, SPF and DKIM records a hosted desk needs", () => {
    const s = game();
    subscribeDesk(s, "acme", "zendusk");
    expect(rows(s)).toEqual([
      ["CNAME", "support", "acme.zendusk.com", false],
      ["TXT", "@", "v=spf1 include:mail.zendusk.com ~all", false],
      ["CNAME", "zendusk1._domainkey", "zendusk1._domainkey.zendusk.com", false],
      ["CNAME", "zendusk2._domainkey", "zendusk2._domainkey.zendusk.com", false],
    ]);
    subscribeDesk(s, "acme", "freshdusk");
    expect(rows(s).map((r) => r[2])).toEqual(["acme.freshdusk.com", "v=spf1 include:email.freshdusk.com ~all", "fd1.dkim.freshdusk.com", "fd2.dkim.freshdusk.com"]);
  });

  it("lists the A record of a self-hosted desk at its panel host's address, and none for a desk without a site", () => {
    const s = game(), c = s.clusters.find((x) => x.kind === "panel")!;
    expect(installDesk(s, c.id, "ostickit").ok).toBe(true);
    expect(rows(s)).toEqual([["A", "support", "", false]]);
    panel(s);
    expect(rows(s)).toEqual([["A", "support", "203.0.113.10", false]]);
    openDesk(s, "zendusk");
    expect(deskRecords(s)).toEqual([]);
  });

  it("resolves support.<domain> once the record's TTL has passed, and the tenant address always", () => {
    const s = game(), domain = s.company.domain!;
    subscribeDesk(s, "acme", "zendusk");
    const h = nowHours(s);
    expect([deskHostReachable(s, `support.${domain}`), deskHostReachable(s, "acme.zendusk.com"), deskHostReachable(s, "other.zendusk.com")]).toEqual([false, true, false]);
    expect(deskAddress(s)).toBe("acme.zendusk.com");
    add(s, "CNAME", "support", "ACME.zendusk.com.");
    expect(deskHostReachable(s, `support.${domain}`, h + 0.9)).toBe(false);
    expect(deskHostReachable(s, `support.${domain}`, h + 1)).toBe(true);
    expect(deskAddress(s, h + 1)).toBe(`support.${domain}`);
  });

  it("sends as the company's domain once SPF and both DKIM records resolve", () => {
    const s = game();
    subscribeDesk(s, "acme", "zendusk");
    add(s, "TXT", "@", "v=spf1 include:_spf.gmix.net include:mail.zendusk.com ~all");
    add(s, "CNAME", "zendusk1._domainkey", "zendusk1._domainkey.zendusk.com");
    const h = nowHours(s) + 1;
    expect(senderVerified(s, h)).toBe(false);
    add(s, "CNAME", "zendusk2._domainkey", "zendusk2._domainkey.zendusk.com");
    expect(senderVerified(s, h)).toBe(true);
  });

  it("passes Verify only when every record resolves", () => {
    const s = game(), c = panel(s);
    expect(verifyDesk(s)).toEqual({ ok: false, error: "error.noDesk" });
    installDesk(s, c.id, "ostickit");
    expect(verifyDesk(s)).toEqual({ ok: false, error: "error.deskRecords" });
    add(s, "A", "support", deskRecords(s)[0].data);
    expect(verifyDesk(s)).toEqual({ ok: false, error: "error.deskRecords" });
    s.hour += 1;
    expect(verifyDesk(s)).toEqual({ ok: true });
  });

  it("loads a save from before the records with the desk unmapped", () => {
    const s = game();
    subscribeDesk(s, "acme", "zendusk");
    const back = deserialize(serialize(s));
    expect(deskAddress(back)).toBe("acme.zendusk.com");
    expect(deskRecords(back).every((r) => !r.ok)).toBe(true);
  });
});
