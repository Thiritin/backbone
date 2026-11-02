import { describe, expect, it } from "vitest";
import { nowHours } from "../src/sim/00-core/time";
import { mxHostsAt, PARKING, recordAt, zoneRecords } from "../src/sim/60-infra/company-zone";
import { newGame } from "../src/sim/50-state";
import { removeCompanyRecord, setCompanyRecord } from "../src/sim/90-actions/domains";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { readyGame } from "./fixtures";

// readyGame books Hosted Exchange, which points the MX record at Ionose; these cases start from the registrar's parking zone.
const parked = (s: ReturnType<typeof readyGame>) => { s.company = { ...s.company, zone: PARKING }; return s; };
const data = (s: ReturnType<typeof readyGame>, type: "MX" | "TXT", name: string, hour: number) => recordAt(s, type, name, hour).map((r) => r.data);

describe("company zone", () => {
  it("shows a new record after the default TTL and an edit after the TTL it replaces", () => {
    const s = parked(readyGame(5)), h = nowHours(s);
    const r = setCompanyRecord(s, { type: "MX", name: "@", ttl: 86400, data: "10 mx1.gmix.net" });
    expect(r.ok).toBe(true);
    expect(data(s, "MX", "@", h + 0.9)).toEqual([]);
    expect(data(s, "MX", "@", h + 1)).toEqual(["10 mx1.gmix.net"]);
    s.hour += 2;
    const e = nowHours(s);
    setCompanyRecord(s, { id: r.ok ? r.id : "", type: "MX", name: `${s.company.domain}.`, ttl: 300, data: "1 smtp.goggle.com" });
    expect(data(s, "MX", "@", e + 23.9)).toEqual(["10 mx1.gmix.net"]);
    expect(data(s, "MX", "@", e + 24)).toEqual(["1 smtp.goggle.com"]);
    expect(zoneRecords(s).find((x) => x.type === "MX")?.data).toBe("1 smtp.goggle.com");
  });

  it("keeps resolving a deleted record for its TTL", () => {
    const s = readyGame(6);
    const r = setCompanyRecord(s, { type: "TXT", name: "@", ttl: 300, data: "goggle-site-verification=abc" });
    s.hour += 2;
    removeCompanyRecord(s, (r.ok && r.id) || "");
    const e = nowHours(s);
    expect(zoneRecords(s).some((x) => x.type === "TXT")).toBe(false);
    expect(data(s, "TXT", "@", e)).toEqual(["goggle-site-verification=abc"]);
    expect(data(s, "TXT", "@", e + 1 / 12)).toEqual([]);
  });

  it("names the mail exchanger before and after an MX change", () => {
    const s = parked(readyGame(7)), h = nowHours(s);
    setCompanyRecord(s, { type: "MX", name: "@", ttl: 3600, data: "20 alt1.aspmx.l.goggle.com" });
    const r = setCompanyRecord(s, { type: "MX", name: "@", ttl: 3600, data: "10 aspmx.l.goggle.com." });
    expect(mxHostsAt(s, h + 1)).toEqual(["aspmx.l.goggle.com", "alt1.aspmx.l.goggle.com"]);
    s.hour += 5;
    setCompanyRecord(s, { id: r.ok ? r.id : "", type: "MX", name: "@", ttl: 3600, data: "5 mail.gmix.net" });
    expect(mxHostsAt(s, nowHours(s))[0]).toBe("aspmx.l.goggle.com");
    expect(mxHostsAt(s, nowHours(s) + 1)[0]).toBe("mail.gmix.net");
  });

  it("refuses bad records and a zone without a domain", () => {
    const s = readyGame(8);
    expect(setCompanyRecord(s, { type: "MX", name: "@", ttl: 3600, data: "mail.gmix.net" })).toEqual({ ok: false, error: "error.badRecord" });
    expect(setCompanyRecord(s, { type: "A", name: "www.other.org.", ttl: 3600, data: "1.2.3.4" })).toEqual({ ok: false, error: "error.badRecord" });
    expect(setCompanyRecord(s, { type: "A", name: "@", ttl: 120, data: "1.2.3.4" })).toEqual({ ok: false, error: "error.badRecord" });
    const fresh = newGame(8);
    expect(setCompanyRecord(fresh, { type: "A", name: "@", ttl: 3600, data: "1.2.3.4" })).toEqual({ ok: false, error: "error.needsDomain" });
  });

  it("loads an old save with the parking records and keeps edits across a save", () => {
    const s = readyGame(9), raw = JSON.parse(serialize(s));
    delete raw.company.zone;
    const zone = deserialize(JSON.stringify(raw)).company.zone;
    expect(zone.slice(0, PARKING.length)).toEqual(PARKING);
    expect(zone.slice(PARKING.length).map((r) => r.data)).toEqual(["10 mx00.ionose.de", "20 mx01.ionose.de"]);
    setCompanyRecord(s, { type: "TXT", name: "@", ttl: 3600, data: "v=spf1 include:_spf.goggle.com ~all" });
    expect(deserialize(serialize(s)).company.zone).toEqual(s.company.zone);
  });
});
