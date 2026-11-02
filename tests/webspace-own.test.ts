import { describe, expect, it } from "vitest";
import { companyDomain } from "../src/sim/30-customers/domains";
import { dropCluster } from "../src/sim/60-infra/cluster";
import { accountsOn, assignKey, issueKey, panelMachine } from "../src/sim/60-infra/licence";
import { companyWebspace, ownWebspacesOn, webspaceOf } from "../src/sim/60-infra/webspace";
import { provisionService } from "../src/sim/90-actions/clusters";
import { addCustomer } from "../src/sim/90-actions/customers";
import * as web from "../src/sim/90-actions/webspace";
import { createOwnWebspace, removeOwnWebspace } from "../src/sim/90-actions/webspace";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { BASEMENT_SERVER, newGame, openShop, panelServer, panelVm, readyGame, skipTo, withServer } from "./fixtures";

const ok = (r: { ok: boolean; id?: string; error?: string }) => {
  expect(r.error).toBeUndefined();
  return r.id!;
};
const err = (r: { ok: boolean; error?: string }) => (r.ok ? undefined : r.error);

function host(seed = 1) {
  const s = withServer(newGame(seed));
  skipTo(s, 2010);
  return { s, host: panelServer(s, BASEMENT_SERVER, "cpanic") };
}

describe("own web spaces", () => {
  it("creates the company domain's account holding only the panel skeleton", () => {
    const { s, host: c } = host();
    const id = ok(createOwnWebspace(s, c));
    const ws = companyWebspace(s)!;
    expect(ws.workloadId).toBe(id);
    expect(ws.domain).toBe(companyDomain(s));
    expect(Object.keys(ws.files).sort()).toEqual(["logs", "mail", "public_html", "public_html/index.html", "tmp"]);
    expect([ws.app, ws.databases, ws.mailboxes, ws.cron]).toEqual([null, {}, {}, {}]);
    expect(s.webspaces).toEqual({});
    expect(ownWebspacesOn(s, c).map((x) => x.id)).toEqual([id]);
  });

  it("takes the player's changes like any web space", () => {
    const { s, host: c } = host();
    const id = ok(createOwnWebspace(s, c));
    ok(web.createDatabase(s, id, "shop"));
    ok(web.createSubdomain(s, id, "portal", companyDomain(s)));
    const ws = webspaceOf(s, id)!;
    expect(ws.databases[`${ws.prefix}shop`]).toBeDefined();
    expect(ws.domains[`portal.${companyDomain(s)}`]?.folder).toBe("public_html/portal");
    const back = deserialize(serialize(s));
    expect(webspaceOf(back, id)).toEqual(ws);
    ok(removeOwnWebspace(s, id));
    expect([s.ownWebspaces, s.webspaces, companyWebspace(s)]).toEqual([[], {}, null]);
  });

  it("refuses a taken domain or username and a bad name", () => {
    const { s, host: c } = host();
    ok(createOwnWebspace(s, c));
    expect(err(createOwnWebspace(s, c))).toBe("webspace.error.domainTaken");
    const cus = addCustomer(s, "Socken Shop", "onlineShop");
    ok(provisionService(s, cus, "webHosting", { label: "sockenshop.de", clusterId: c }));
    const taken = webspaceOf(s, s.workloads.find((w) => w.clusterId === c)!.id)!.account;
    expect(err(createOwnWebspace(s, c, "other.de", taken))).toBe("webspace.error.accountTaken");
    expect(err(createOwnWebspace(s, c, "other.de", "9lives"))).toBe("webspace.error.account");
    expect(err(createOwnWebspace(s, c, "not a domain"))).toBe("webspace.error.domainName");
    ok(createOwnWebspace(s, c, "other.de", "other"));
  });

  it("counts against the panel licence", () => {
    const s = readyGame(1);
    const id = panelVm(s, s.clusters.find((c) => c.kind === "cloud")!.id, "cpanic", { vcpu: 2, ramGb: 4, diskGb: 50 });
    const c = () => s.clusters.find((x) => x.id === id)!, vm = panelMachine(c())!;
    s.licenses = s.licenses.filter((k) => k.machineId !== vm);
    assignKey(s, issueKey(s, "cpanic", "solo").id, vm);
    ok(createOwnWebspace(s, id));
    expect(accountsOn(s, c())).toBe(1);
    expect(err(provisionService(s, addCustomer(s, "Ada Lang", "hobbyDev"), "webHosting", { label: "a.com", clusterId: id }))).toBe("error.licenceCap");
  });

  it("refuses work while its host is offline and goes when the host goes", () => {
    const { s, host: c } = host();
    const id = ok(createOwnWebspace(s, c));
    ok(web.createDatabase(s, id, "shop"));
    s.security.offline = [c];
    expect(err(web.createDatabase(s, id, "y"))).toBe("webspace.error.offline");
    expect(err(createOwnWebspace(s, c, "other.de", "other"))).toBe("webspace.error.offline");
    s.security.offline = [];
    dropCluster(s, c);
    expect([s.ownWebspaces, s.webspaces]).toEqual([[], {}]);
  });

  it("gives an old save's installed shop the company web space on its host", () => {
    const s = openShop(readyGame(1));
    const at = s.shop.install!.clusterId, before = accountsOn(s, s.clusters.find((x) => x.id === at)!);
    const raw = JSON.parse(serialize(s));
    delete raw.ownWebspaces;
    const back = deserialize(JSON.stringify(raw));
    const ws = companyWebspace(back)!;
    expect(back.ownWebspaces).toEqual([expect.objectContaining({ clusterId: at, domain: companyDomain(back) })]);
    // The skeleton, plus the shop's files under the portal subdomain (shop-install.test.ts).
    expect(ws.files["public_html/index.html"]).toBeDefined();
    expect(ws.files["public_html/portal/index.php"]?.from).toBe(`clientexit_${s.shop.install!.version}.zip`);
    expect(accountsOn(back, back.clusters.find((x) => x.id === at)!)).toBe(before);
    // A save that has the field keeps what the player left.
    back.ownWebspaces = [];
    expect(deserialize(serialize(back)).ownWebspaces).toEqual([]);
  });
});
