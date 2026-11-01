import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { hourOf } from "../src/sim/00-core/time";
import { sizeSpec } from "../src/sim/10-catalog/products";
import { createTicket } from "../src/sim/40-support/tickets";
import { newGame } from "../src/sim/50-state";
import { hostMessages } from "../src/sim/60-infra/messages";
import { VULNS } from "../src/sim/60-infra/security";
import { provisionService } from "../src/sim/90-actions/clusters";
import { addCustomer } from "../src/sim/90-actions/customers";
import { Messages } from "../src/ui/apps/browser/consoles/directadmen/Messages";
import { panelServer, withServer } from "./fixtures";

const ok = (r: { ok: boolean; id?: string; error?: string }) => { if (!r.ok) throw new Error(r.error); return r.id!; };

function world() {
  const s = withServer(newGame(4));
  s.hour = hourOf(new Date(Date.UTC(2018, 0, 1)));
  const host = panelServer(s, "dev3", "directadmen");
  const mine = addCustomer(s, "Ada", "hobbyDev"), other = addCustomer(s, "Bob", "hobbyDev");
  const site = ok(provisionService(s, mine, "webHosting", { label: "ada.de", spec: sizeSpec("webHosting", 0, 2005), clusterId: host }));
  return { s, host, mine, other, site };
}

describe("DirectAdmin Message System", () => {
  it("lists tickets of customers on the host and not those of other hosts", () => {
    const { s, host, mine, other, site } = world();
    const a = createTicket(s, s.customers.find((c) => c.id === mine)!, "howTo", site, "updateBroke");
    createTicket(s, s.customers.find((c) => c.id === other)!, "howTo", null, "updateBroke");
    createTicket(s, s.customers.find((c) => c.id === mine)!, "billing", null);
    const list = hostMessages(s, host);
    expect(list.map((m) => m.ticket?.id)).toEqual([a.id]);
  });

  it("adds an expired certificate and a pending advisory as system messages", () => {
    const { s, host, site } = world();
    expect(hostMessages(s, host)).toEqual([]);
    s.webpanel.ssl.expired = [site];
    s.webpanel.ssl.expires = { [site]: s.hour - 5 };
    s.security = { ...s.security, vuln: VULNS[0].id, stage: 1 };
    s.clusters = s.clusters.map((c) => (c.id === host ? { ...c, php: VULNS[0].versions[0] } : c));
    const kinds = hostMessages(s, host).map((m) => m.kind).sort();
    expect(kinds).toEqual(["advisory", "certExpired"]);
    const c = s.clusters.find((x) => x.id === host)!;
    const html = renderToString(<Messages game={s} c={c} late />);
    expect(html).toContain("ada.de");
    expect(html).toContain("Security advisory");
  });

  it("derives the list from state on every read", () => {
    const { s, host, mine, site } = world();
    createTicket(s, s.customers.find((c) => c.id === mine)!, "outage", site);
    expect(hostMessages(s, host)).toHaveLength(1);
    s.services = s.services.map((v) => (v.id === site ? { ...v, endedAt: s.hour } : v));
    expect(hostMessages(s, host)).toHaveLength(0);
  });
});
