import { describe, expect, it } from "vitest";
import { nowHours } from "../src/sim/00-core/time";
import { addressesAt, recordAt, zoneRecords } from "../src/sim/60-infra/company-zone";
import { mailAddress } from "../src/sim/60-infra/addresses";
import { recordChoices } from "../src/sim/60-infra/zone-choices";
import { setCompanyRecord, removeCompanyRecord } from "../src/sim/90-actions/domains";
import { saveRecord } from "../src/sim/90-actions/netsvc-dns";
import { uninstallSoftware } from "../src/sim/90-actions/software";
import { bookMail, selectMailServer } from "../src/sim/90-actions/mail";
import { mxTarget } from "../src/sim/42-mail/caps";
import { roleAccount, serverStatus } from "../src/sim/42-mail/accounts";
import { mailShare, mailUnrouted } from "../src/sim/80-business/mail";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { err, selfHosted } from "./company-mail.helpers";
import { readyGame } from "./fixtures";
import { salesTick } from "../src/sim/30-market/sales";

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
    expect(err(setCompanyRecord(s, { type: "MX", name: "@", ttl: 3600, data: "10 212.1.87.145" }))).toBe("error.recordHost");
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

const mxIds = (s: ReturnType<typeof readyGame>) => s.company.zone.filter((r) => r.type === "MX" && !r.gone).map((r) => r.id);
const pointMx = (s: ReturnType<typeof readyGame>, data: string) => {
  for (const id of mxIds(s)) removeCompanyRecord(s, id);
  return setCompanyRecord(s, { type: "MX", name: "@", ttl: 300, data });
};
// Email orders arrive in the sales step alone.
const orders = (s: ReturnType<typeof readyGame>, hours: number) => {
  const before = s.sales.requests.filter((r) => r.kind === "order").length;
  for (let h = 0; h < hours; h++) { s.hour++; salesTick(s); }
  return s.sales.requests.filter((r) => r.kind === "order").length - before;
};

describe("mail routing through the zone", () => {
  it("delivers to the provider tenant the MX names", () => {
    const s = readyGame(4);
    expect(bookMail(s, "hostedExchange").ok).toBe(true);
    expect(mxTarget(s)?.host).toBe("ionose");
    expect(mailUnrouted(s)).toBe(false);
    expect(mailShare(s, "smallBiz")).toBe(1);
  });

  it("delivers to the own server through the automatic record of its host name", () => {
    const s = readyGame(3);
    selfHosted(s);
    selectMailServer(s);
    expect(mxTarget(s)?.host).toBe("self");
    expect(serverStatus(s, roleAccount(s, "sales")!.id, "imap")).toBe("ok");
    // The mail server's machine name resolves to the same address.
    const host = s.workloads.find((w) => w.id === mailCluster(s).vm)!.hostname!;
    expect(pointMx(s, `10 ${host}.${s.company.domain}`).ok).toBe(true);
    s.hour += 1;
    expect(mxTarget(s)?.host).toBe("self");
  });

  it("delivers nowhere on a missing or wrong MX and shows it", () => {
    const s = readyGame(3);
    selfHosted(s);
    selectMailServer(s);
    for (const id of mxIds(s)) removeCompanyRecord(s, id);
    s.hour += 2;
    expect(mxTarget(s)).toBe(null);
    expect(mailUnrouted(s)).toBe(true);
    expect(mailShare(s, "private")).toBe(0);
    expect(serverStatus(s, roleAccount(s, "sales")!.id, "imap")).toBe("unresolved");
    pointMx(s, "10 aspmx.l.goggle.com");
    s.hour += 2;
    expect(mailUnrouted(s)).toBe(true);
  });

  it("delivers nowhere on an address as MX from an old save", () => {
    const s = readyGame(3);
    selfHosted(s);
    selectMailServer(s);
    const ip = mailAddress(s, mailCluster(s).id)!.ip;
    s.company = { ...s.company, zone: s.company.zone.map((r) => (r.type === "MX" ? { ...r, data: `10 ${ip}` } : r)) };
    const g = deserialize(serialize(s));
    expect(mxTarget(g)).toBe(null);
    expect(mailUnrouted(g)).toBe(true);
  });

  it("brings customer email orders again once the MX is right", () => {
    const s = readyGame(3);
    selfHosted(s);
    selectMailServer(s);
    // Without the website shop every order comes by email.
    s.shop = { ...s.shop, variant: null };
    for (const id of mxIds(s)) removeCompanyRecord(s, id);
    s.hour += 2;
    expect(orders(s, 24 * 30)).toBe(0);
    expect(pointMx(s, `10 mail.${s.company.domain}`).ok).toBe(true);
    expect(orders(s, 24 * 30)).toBeGreaterThan(0);
  });
});
