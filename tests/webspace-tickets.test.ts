import { afterEach, describe, expect, it } from "vitest";
import { sizeSpec } from "../src/sim/10-catalog/products";
import { createTicket } from "../src/sim/40-support/tickets";
import { supportTick } from "../src/sim/40-support/tick";
import { webspaceTickets, WISH_RATES } from "../src/sim/40-support/webspace-tickets";
import type { GameState } from "../src/sim/50-state";
import { webspaceOf } from "../src/sim/60-infra/webspace";
import { provisionService } from "../src/sim/90-actions/clusters";
import { addCustomer } from "../src/sim/90-actions/customers";
import * as web from "../src/sim/90-actions/webspace";
import { createOwnWebspace } from "../src/sim/90-actions/webspace";
import { BASEMENT_SERVER, newGame, panelServer, skipTo, withServer } from "./fixtures";

const ok = (r: { ok: boolean; id?: string; error?: string }) => {
  expect(r.error).toBeUndefined();
  return r.id!;
};

// A WordPass account on a cPanic server with three mailboxes, two months after it was sold in 2010.
function account(seed = 1) {
  const s = withServer(newGame(seed));
  skipTo(s, 2010);
  const host = panelServer(s, BASEMENT_SERVER, "cpanic");
  const cus = addCustomer(s, "Socken Shop", "onlineShop");
  const svc = ok(provisionService(s, cus, "webHosting", { label: "sockenshop.de", spec: { ...sizeSpec("webHosting", 0, 2010), mailboxes: 3, app: "wordpass" }, clusterId: host }));
  s.hour += 60 * 24;
  s.hour -= s.hour % 24;
  const w = s.workloads.find((x) => x.serviceId === svc)!;
  return { s, svc, id: w.id };
}
const ticketOn = (s: GameState, svc: string) => s.tickets.find((t) => t.serviceId === svc && t.customerId)!;
// Runs the support tick hour by hour.
const hours = (s: GameState, n: number) => {
  for (let i = 0; i < n; i++) { s.hour++; supportTick(s); }
};
// Every daily roll becomes a wish of this kind.
const only = (kind: keyof typeof WISH_RATES) => Object.assign(WISH_RATES, { database: 0, mailbox: 0, ftp: 0, [kind]: 30 });
const saved = { ...WISH_RATES };
afterEach(() => { Object.assign(WISH_RATES, saved); });

describe("panel task tickets", () => {
  it("asks for a database and closes once it exists with a user granted on it", () => {
    const { s, svc, id } = account();
    only("database");
    webspaceTickets(s);
    const t = ticketOn(s, svc), prefix = webspaceOf(s, id)!.prefix;
    expect(t).toMatchObject({ kind: "howTo", topic: "dbCreate", status: "open", task: { workloadId: id, part: "databases" } });
    const name = t.task!.key.slice(prefix.length);
    ok(web.createDatabase(s, id, name));
    hours(s, 1);
    expect(ticketOn(s, svc).status).toBe("open");
    ok(web.createDbUser(s, id, name, "s3cret!"));
    ok(web.grantDb(s, id, t.task!.key, t.task!.key));
    hours(s, 1);
    expect(ticketOn(s, svc).status).toBe("resolved");
  });

  it("asks for an FTP login and closes once the account exists", () => {
    const { s, svc, id } = account(2);
    only("ftp");
    webspaceTickets(s);
    const t = ticketOn(s, svc);
    expect(t).toMatchObject({ topic: "ftpLogin", task: { part: "ftp" } });
    const [login, domain] = t.task!.key.split("@");
    ok(web.createFtpAccount(s, id, login, domain, "s3cret!", "public_html", 0));
    hours(s, 1);
    expect(ticketOn(s, svc).status).toBe("resolved");
  });

  it("asks for an upgrade when the package has no mailbox or database left", () => {
    const a = account(3);
    only("mailbox");
    webspaceTickets(a.s);
    expect(ticketOn(a.s, a.svc)).toMatchObject({ kind: "upgrade", topic: "mailLimit" });
    expect(ticketOn(a.s, a.svc).task).toBeUndefined();

    const b = account(4);
    for (const n of ["a", "b", "c", "d"]) ok(web.createDatabase(b.s, b.id, n));
    only("database");
    webspaceTickets(b.s);
    expect(ticketOn(b.s, b.svc)).toMatchObject({ kind: "upgrade", topic: "dbLimit" });
  });

  it("opens no second ticket while one is open", () => {
    const { s, svc } = account(5);
    only("ftp");
    webspaceTickets(s);
    s.hour += 24;
    webspaceTickets(s);
    expect(s.tickets.filter((t) => t.serviceId === svc)).toHaveLength(1);
  });
});

describe("broken sites and overlays", () => {
  it("has a visitor report a missing database and closes once it is back", () => {
    const { s, svc, id } = account(6);
    ok(web.deleteDatabase(s, id, webspaceOf(s, id)!.app!.db));
    hours(s, 48);
    const t = ticketOn(s, svc);
    expect(t).toMatchObject({ kind: "howTo", topic: "dbError", task: { part: "app", key: "wordpass" } });
    ok(web.createDatabase(s, id, "wp"));
    hours(s, 1);
    expect(ticketOn(s, svc).status).toBe("resolved");
  });

  it("reports a missing config file as the installation page", () => {
    const { s, svc, id } = account(7);
    ok(web.deleteFile(s, id, "public_html/wp-config.php"));
    hours(s, 48);
    expect(ticketOn(s, svc).topic).toBe("appSetup");
  });

  it("drops the overlay once the service ends", () => {
    const { s, svc, id } = account(8);
    ok(web.createFolder(s, id, "public_html", "old"));
    expect(s.webspaces[id]).toBeDefined();
    s.services = s.services.map((v) => (v.id === svc ? { ...v, endedAt: s.hour } : v));
    webspaceTickets(s);
    expect(s.webspaces[id]).toBeUndefined();
  });

  it("keeps the overlay of the company's own web space and deletes its files without a service", () => {
    const { s } = account(11);
    const own = ok(createOwnWebspace(s, s.clusters.find((c) => c.kind === "panel")!.id));
    ok(web.createFolder(s, own, "public_html", "portal"));
    webspaceTickets(s);
    expect(s.webspaces[own]).toBeDefined();
    ok(web.deleteFile(s, own, "public_html/portal"));
  });
});

describe("compromised sites", () => {
  it("leaves a shell in the uploads folder and deleting it cleans the site", () => {
    const { s, svc, id } = account(9);
    s.sites = { ...s.sites, defaced: [svc], hacks: { [svc]: [s.hour] } };
    createTicket(s, s.customers[0], "howTo", svc, "hacked");
    const ws = webspaceOf(s, id)!;
    expect(ws.shells).toHaveLength(1);
    expect(ws.shells[0]).toMatch(/^public_html\/wp-content\/uploads\/[a-z0-9]{8}\.php$/);
    ok(web.deleteFile(s, id, ws.shells[0]));
    expect(s.sites.defaced).toEqual([]);
    expect(ticketOn(s, svc)).toMatchObject({ status: "resolved", outcome: "cleaned" });
    expect(s.webspaces[id]).toBeUndefined();
  });

  it("names the shell after the hack, so the next one is not hidden", () => {
    const { s, svc, id } = account(10);
    s.sites = { ...s.sites, defaced: [svc], hacks: { [svc]: [s.hour] } };
    const first = webspaceOf(s, id)!.shells[0];
    s.sites = { ...s.sites, hacks: { [svc]: [s.hour, s.hour + 24] } };
    expect(webspaceOf(s, id)!.shells[0]).not.toBe(first);
  });
});
