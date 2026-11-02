import { describe, expect, it } from "vitest";
import { nowHours } from "../src/sim/00-core/time";
import { addressesAt, recordAt, zoneRecords } from "../src/sim/60-infra/company-zone";
import { mailAddress } from "../src/sim/60-infra/addresses";
import { recordChoices } from "../src/sim/60-infra/zone-choices";
import { setCompanyRecord, removeCompanyRecord } from "../src/sim/90-actions/domains";
import { saveRecord } from "../src/sim/90-actions/netsvc-dns";
import { uninstallSoftware } from "../src/sim/90-actions/software";
import { selectMailServer } from "../src/sim/90-actions/mail";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { err, selfHosted } from "./company-mail.helpers";
import { readyGame } from "./fixtures";

const mailCluster = (s: ReturnType<typeof readyGame>) => s.clusters.find((c) => c.kind === "mail")!;

describe("managed zone records", () => {
  it("add the own mail server and the machines with public addresses, and drop them with the host", () => {
    const s = readyGame(3);
    selfHosted(s);
    selectMailServer(s);
    const ip = mailAddress(s, mailCluster(s).id)!.ip, d = s.company.domain;
    const mail = zoneRecords(s).find((r) => r.name === "mail" && r.type === "A")!;
    expect(mail).toMatchObject({ data: ip, managed: true });
    expect(addressesAt(s, `mail.${d}`, nowHours(s))).toEqual([ip]);
    const vm = mailCluster(s).vm!, host = s.workloads.find((w) => w.id === vm)!.hostname!;
    expect(recordAt(s, "A", host, nowHours(s)).map((r) => r.data)).toEqual([ip]);
    expect(uninstallSoftware(s, vm).ok).toBe(true);
    expect(zoneRecords(s).some((r) => r.name === "mail")).toBe(false);
  });

  it("follow a changed address", () => {
    const s = readyGame(3);
    selfHosted(s);
    selectMailServer(s);
    const a = s.ips.addresses.find((x) => x.ip === mailAddress(s, mailCluster(s).id)!.ip)!;
    s.ips = { ...s.ips, addresses: s.ips.addresses.map((x) => (x === a ? { ...x, ip: "203.0.113.9" } : x)) };
    expect(recordAt(s, "A", "mail", nowHours(s)).map((r) => r.data)).toEqual(["203.0.113.9"]);
  });

  it("cannot be overwritten or deleted by the player", () => {
    const s = readyGame(3);
    selfHosted(s);
    selectMailServer(s);
    expect(err(setCompanyRecord(s, { type: "A", name: "mail", ttl: 3600, data: "198.51.100.7" }))).toBe("error.managedRecord");
    expect(err(removeCompanyRecord(s, "m:A:mail"))).toBe("error.badRecord");
  });

  it("are there in an old save without being stored", () => {
    const s = readyGame(3);
    selfHosted(s);
    selectMailServer(s);
    const g = deserialize(serialize(s));
    expect(g.company.zone.some((r) => r.managed)).toBe(false);
    expect(zoneRecords(g).some((r) => r.name === "mail" && r.managed)).toBe(true);
  });
});

describe("record values", () => {
  it("refuse an address as MX target in every zone", () => {
    const s = readyGame(3);
    expect(err(setCompanyRecord(s, { type: "MX", name: "@", ttl: 3600, data: "10 212.1.87.145" }))).toBe("error.badRecord");
    const zone = s.domains[0]?.name;
    if (zone) expect(saveRecord(s, zone, { type: "MX", name: "@", ttl: 3600, data: "10 212.1.87.145" }).ok).toBe(false);
  });

  it("offer the own mail server and its machine as MX and the own addresses as A", () => {
    const s = readyGame(3);
    selfHosted(s);
    selectMailServer(s);
    const d = s.company.domain, ip = mailAddress(s, mailCluster(s).id)!.ip;
    const mx = recordChoices(s, "MX").map((c) => c.value);
    expect(mx[0]).toBe(`mail.${d}`);
    expect(mx.every((h) => h.endsWith(`.${d}`) || !/^\d/.test(h))).toBe(true);
    expect(recordChoices(s, "A").map((c) => c.value)).toContain(ip);
    expect(recordChoices(s, "CNAME").map((c) => c.value)).toContain(`mail.${d}`);
  });
});
