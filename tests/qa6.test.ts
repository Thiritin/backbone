import { describe, expect, it } from "vitest";
import { nowMinutes } from "../src/sim/00-core/time";
import { mxSetAt } from "../src/sim/10-catalog/mail-providers";
import { domainOf, shownStatus } from "../src/sim/30-customers/registry";
import { zoneRecords } from "../src/sim/60-infra/company-zone";
import { siteStatus } from "../src/sim/80-business/website";
import { setCompanyRecord } from "../src/sim/90-actions/domains";
import { checkIonoseDomain, setIonoseRecords } from "../src/sim/90-actions/mail-hosted";
import { readyGame } from "./fixtures";

describe("qa6 registrar and Ionose", () => {
  it("reports one registration state for the company domain", () => {
    const s = readyGame(61), d = domainOf(s, s.company.domain!)!;
    d.readyAt = nowMinutes(s) + 2;
    expect(shownStatus(s, d)).toBe("registering");
    d.readyAt = nowMinutes(s);
    expect(shownStatus(s, d)).toBe("active");
  });

  it("names the field a DNS record is missing", () => {
    const s = readyGame(62), err = (r: Parameters<typeof setCompanyRecord>[1]) => { const x = setCompanyRecord(s, r); return x.ok ? "" : x.error; };
    expect(err({ type: "TXT", name: "@", ttl: 3600, data: "" })).toBe("error.recordValue");
    expect(err({ type: "A", name: "@", ttl: 3600, data: "10.0.0" })).toBe("error.recordIp");
    expect(err({ type: "MX", name: "@", ttl: 3600, data: "mx.example.com" })).toBe("error.recordPriority");
    expect(err({ type: "MX", name: "@", ttl: 3600, data: "10" })).toBe("error.recordHost");
    expect(err({ type: "A", name: "bad name", ttl: 3600, data: "10.0.0.1" })).toBe("error.recordName");
  });

  it("keeps the site up whatever the apex A record says", () => {
    const s = readyGame(63);
    s.company = { ...s.company, zone: [{ id: "p1", type: "A", name: "@", ttl: 3600, data: "198.51.100.80" }] };
    const before = siteStatus(s);
    s.company = { ...s.company, zone: [] };
    expect(siteStatus(s)).toBe(before);
  });

  it("sets the three Ionose records at once and the check passes after propagation", () => {
    const s = readyGame(64);
    s.company = { ...s.company, zone: [] };
    s.registrar = { ...s.registrar!, id: "nameCheep" };
    const tenant = s.mail.tenants.find((t) => t.host === "ionose" && t.domain === s.company.domain);
    const id = tenant!.id;
    expect(setIonoseRecords(s, id).ok).toBe(true);
    const z = zoneRecords(s);
    expect(z.filter((r) => r.type === "MX").map((r) => r.data).sort()).toEqual(mxSetAt("ionose", s.company.domain!, s.hour).map(([p, h]) => `${p} ${h}`).sort());
    expect(z.filter((r) => r.type === "TXT")).toHaveLength(1);
    expect(checkIonoseDomain(s, id).ok).toBe(false);
    s.hour += 2;
    expect(checkIonoseDomain(s, id).ok).toBe(true);
    expect(setIonoseRecords(s, id).ok && zoneRecords(s)).toHaveLength(z.length);
  });
});
