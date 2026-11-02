import { describe, expect, it } from "vitest";
import { sizeSpec } from "../src/sim/10-catalog/products";
import { zoneOf } from "../src/sim/60-infra/netsvc-dns";
import { sslTick } from "../src/sim/60-infra/webpanel";
import { webspaceOf } from "../src/sim/60-infra/webspace";
import { cronLoad, domainCert, parseSchedule, scheduleHours, scheduleOf, webZone } from "../src/sim/60-infra/webzone";
import { provisionService } from "../src/sim/90-actions/clusters";
import { addCustomer } from "../src/sim/90-actions/customers";
import { setAutoSsl } from "../src/sim/90-actions/webpanel";
import * as dom from "../src/sim/90-actions/webdomains";
import * as web from "../src/sim/90-actions/webspace";
import { BASEMENT_SERVER, newGame, panelServer, skipTo, withServer } from "./fixtures";

const ok = (r: { ok: boolean; id?: string; error?: string }) => {
  expect(r.error).toBeUndefined();
  return r.id!;
};
const err = (r: { ok: boolean; error?: string }) => (r.ok ? undefined : r.error);

function account(year = 2010) {
  const s = withServer(newGame(1));
  skipTo(s, year);
  const host = panelServer(s, BASEMENT_SERVER, "cpanic");
  const cus = addCustomer(s, "Socken Shop", "onlineShop");
  const svc = ok(provisionService(s, cus, "webHosting", { label: "sockenshop.de", spec: { ...sizeSpec("webHosting", 0, year), mailboxes: 1, app: "static" }, clusterId: host }));
  s.hour += 60 * 24;
  return { s, host, id: s.workloads.find((x) => x.serviceId === svc)!.id };
}
const ws = (s: ReturnType<typeof account>["s"], id: string) => webspaceOf(s, id)!;

describe("parked domains", () => {
  it("serve the main folder and can be removed", () => {
    const { s, id } = account();
    ok(web.createParkedDomain(s, id, "sockenshop.com"));
    expect(ws(s, id).domains["sockenshop.com"]).toMatchObject({ kind: "parked", folder: "public_html" });
    expect(ws(s, id).usage.parked).toBe(1);
    expect(err(web.createParkedDomain(s, id, "sockenshop.com"))).toBe("webspace.error.domainTaken");
    expect(err(web.createParkedDomain(s, id, "nodots"))).toBe("webspace.error.domainName");
    ok(web.deleteDomain(s, id, "sockenshop.com"));
    expect(ws(s, id).domains["sockenshop.com"]).toBeUndefined();
  });
});

describe("zone editor", () => {
  it("adds the subdomain's record and drops it with the subdomain", () => {
    const { s, id } = account();
    ok(web.createSubdomain(s, id, "portal", "sockenshop.de"));
    const a = () => webZone(s, ws(s, id), "sockenshop.de").records.filter((r) => r.name === "portal");
    expect(a()).toEqual([expect.objectContaining({ type: "A" })]);
    expect(a()[0].data).toBe(webZone(s, ws(s, id), "sockenshop.de").records.find((r) => r.name === "@" && r.type === "A")!.data);
    ok(web.deleteDomain(s, id, "portal.sockenshop.de"));
    expect(a()).toEqual([]);
  });

  it("saves and deletes records in the zone the DNS model holds", () => {
    const { s, id } = account();
    const rid = ok(dom.saveWebRecord(s, id, "sockenshop.de", { type: "A", name: "shop", ttl: 3600, data: "203.0.113.9" }));
    expect(zoneOf(s, "sockenshop.de").records).toContainEqual({ id: rid, type: "A", name: "shop", ttl: 3600, data: "203.0.113.9" });
    ok(dom.saveWebRecord(s, id, "sockenshop.de", { id: rid, type: "A", name: "shop", ttl: 300, data: "203.0.113.10" }));
    expect(zoneOf(s, "sockenshop.de").records.find((r) => r.id === rid)!.data).toBe("203.0.113.10");
    ok(dom.deleteWebRecord(s, id, "sockenshop.de", rid));
    expect(zoneOf(s, "sockenshop.de").records.some((r) => r.id === rid)).toBe(false);
    expect(err(dom.saveWebRecord(s, id, "sockenshop.de", { type: "A", name: "x", ttl: 3600, data: "nope" }))).toBe("error.badRecord");
    expect(err(dom.saveWebRecord(s, id, "other.de", { type: "A", name: "x", ttl: 3600, data: "1.2.3.4" }))).toBe("error.unknownZone");
  });

  it("gives an addon domain a zone of its own and keeps a subdomain in its parent's", () => {
    const { s, id } = account();
    ok(web.createAddonDomain(s, id, "wollladen.de"));
    ok(web.createSubdomain(s, id, "blog", "wollladen.de"));
    expect(webZone(s, ws(s, id), "wollladen.de").records.some((r) => r.name === "blog")).toBe(true);
    expect(webZone(s, ws(s, id), "sockenshop.de").records.some((r) => r.name === "blog")).toBe(false);
  });
});

describe("cron schedules", () => {
  it("runs at most hourly in effect", () => {
    const hours = (x: string) => scheduleHours(parseSchedule(x)!);
    expect(hours("* * * * *")).toBe(1);
    expect(hours("*/5 * * * *")).toBe(1);
    expect(hours("0 * * * *")).toBe(1);
    expect(hours("0 */6 * * *")).toBe(6);
    expect(hours("0 0,12 * * *")).toBe(12);
    expect(hours("0 0 * * *")).toBe(24);
    expect(hours("0 0 * * 0")).toBe(168);
    expect(hours("0 0 1 * *")).toBe(720);
    expect(hours("0 0 1 1 *")).toBe(8760);
    expect(parseSchedule("61 * * * *")).toBeNull();
    expect(parseSchedule("* * * *")).toBeNull();
    expect(parseSchedule("a * * * *")).toBeNull();
  });

  it("stores the job and counts its load", () => {
    const { s, id } = account();
    const a = ok(dom.createCronJob(s, id, "*/5 * * * *", "php -q /home/x/cron.php"));
    const b = ok(dom.createCronJob(s, id, "0 0 * * *", "/usr/bin/backup"));
    const jobs = ws(s, id).cron;
    expect(jobs[a]).toMatchObject({ everyHours: 1, schedule: "*/5 * * * *" });
    expect(scheduleOf(jobs[b])).toBe("0 0 * * *");
    expect(cronLoad(jobs[a])).toBeCloseTo(24 * cronLoad(jobs[b]));
    expect(err(dom.createCronJob(s, id, "nonsense", "x"))).toBe("webspace.error.cronSchedule");
    expect(err(dom.createCronJob(s, id, "0 * * * *", " "))).toBe("webspace.error.cronCommand");
    ok(web.deleteCron(s, id, a));
    expect(ws(s, id).cron[a]).toBeUndefined();
  });
});

describe("certificates per domain", () => {
  it("has none before the free year, then AutoSSL covers the account's domains", () => {
    const old = account(2010);
    expect(domainCert(old.s, ws(old.s, old.id), "sockenshop.de").kind).toBe("none");
    const { s, host, id } = account(2017);
    ok(web.createAddonDomain(s, id, "wollladen.de"));
    sslTick(s);
    expect(domainCert(s, ws(s, id), "sockenshop.de")).toMatchObject({ kind: "manual", status: "valid" });
    expect(domainCert(s, ws(s, id), "wollladen.de").kind).toBe("none");
    ok(setAutoSsl(s, host, true));
    expect(domainCert(s, ws(s, id), "sockenshop.de").kind).toBe("autossl");
    expect(domainCert(s, ws(s, id), "wollladen.de")).toMatchObject({ kind: "autossl", status: "valid", expires: null });
    expect(domainCert(s, ws(s, id), "sockenshop.de").expires).toBeGreaterThan(s.hour);
  });
});
