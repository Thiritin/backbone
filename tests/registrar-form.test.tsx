import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { t } from "../src/i18n/en";
import { domainOf } from "../src/sim/30-customers/registry";
import { stepsDone } from "../src/sim/30-market/manual";
import { orderLead } from "../src/sim/30-market/orders";
import type { GameState } from "../src/sim/50-state";
import { registrarFormUrl, resolve } from "../src/sim/80-business/browser";
import { tick } from "../src/sim/88-tick/tick";
import { confirmOrder, createAccount, quoteOrder, registerOrderDomain } from "../src/sim/90-actions/orders";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { RegistrarSite } from "../src/ui/apps/browser/sites/registrars";
import { mailed, owner, readyGame } from "./fixtures";

const web = { product: "webHosting" as const, size: 0, sla: "basic" as const };
const req = (s: GameState, id: string) => s.sales.requests.find((x) => x.ticketId === id)!;
const must = (res: { ok: boolean; error?: string }) => { if (!res.ok) throw new Error(res.error); };
const hour = (s: GameState) => tick(s);

// An email order past its confirmation, so the domain is the next step; owned picks a domain the customer brings.
function atDomain(s: GameState, owned: boolean): string {
  for (let i = 0; i < 40; i++) {
    const r = orderLead(s, "private", "Frankfurt", [], web, true);
    if (!!r.owned !== owned || !r.ticketId) continue;
    s.sales.requests = s.sales.requests.map((x) => (x.id === r.id ? { ...x, budget: 100 } : x));
    must(quoteOrder(s, r.ticketId, 10));
    for (let h = 0; h < 60 && !stepsDone(s, req(s, r.ticketId)).quote; h++) hour(s);
    must(createAccount(s, r.ticketId, mailed(s, r.ticketId)));
    hour(s);
    must(confirmOrder(s, r.ticketId));
    hour(s);
    return r.ticketId;
  }
  throw new Error("no order");
}

describe("registrar form", () => {
  it("registers a new domain with the owner from the customer record", () => {
    const s = readyGame(3);
    const id = atDomain(s, false), [address] = owner(s, id);
    expect(resolve(s, registrarFormUrl(s, id, false)).page.kind).toBe("registrar");
    must(registerOrderDomain(s, id, address));
    hour(s);
    expect(stepsDone(s, req(s, id)).domain).toBe(true);
    expect(domainOf(s, req(s, id).domain!)).toMatchObject({ customerId: req(s, id).customerId, transfer: false });
  });

  it("transfers an owned domain with the auth code from the order email", () => {
    const s = readyGame(4);
    const id = atDomain(s, true), r = req(s, id), [address, code] = owner(s, id);
    expect(t(r.thread[0].key, r.thread[0].params)).toContain(code!);
    expect(registerOrderDomain(s, id, address, "WRONG123")).toEqual({ ok: false, error: "error.authCode" });
    expect(registerOrderDomain(s, id, address)).toEqual({ ok: false, error: "error.authCode" });
    must(registerOrderDomain(s, id, address, ` ${code!.toLowerCase()} `));
    hour(s);
    expect(domainOf(s, r.domain!)).toMatchObject({ customerId: r.customerId, transfer: true });
  });

  it("refuses a missing or wrong owner field with one message", () => {
    const s = readyGame(5);
    const id = atDomain(s, false), [address] = owner(s, id);
    expect(registerOrderDomain(s, id)).toEqual({ ok: false, error: "error.ownerMismatch" });
    expect(registerOrderDomain(s, id, { ...address!, street: "" })).toEqual({ ok: false, error: "error.ownerMismatch" });
    expect(registerOrderDomain(s, id, { ...address!, city: "Elsewhere" })).toEqual({ ok: false, error: "error.ownerMismatch" });
    expect(registerOrderDomain(s, id, { ...address!, company: "Someone GmbH" })).toEqual({ ok: false, error: "error.ownerMismatch" });
    expect(domainOf(s, req(s, id).domain!)).toBeUndefined();
  });

  it("lets a shop with the registrar module register its own orders without the form", () => {
    const s = readyGame(6);
    s.shop = { ...s.shop, variant: "whmCache", since: 0, readyAt: 0 };
    const r = orderLead(s, "private", "Frankfurt", [], web, false);
    const id = r.ticketId!;
    expect(req(s, id).shop).toBe(true);
    must(createAccount(s, id, mailed(s, id)));
    hour(s);
    must(confirmOrder(s, id));
    hour(s);
    must(registerOrderDomain(s, id));
    hour(s);
    expect(stepsDone(s, req(s, id)).domain).toBe(true);
  });

  it("draws the form with the domain, the customer record, both nameservers and the auth code field", () => {
    const s = readyGame(4);
    const id = atDomain(s, true), r = req(s, id), c = s.customers.find((x) => x.id === r.customerId)!;
    const p = resolve(s, registrarFormUrl(s, id, true));
    if (p.page.kind !== "registrar") throw new Error(p.page.kind);
    const html = renderToString(<RegistrarSite game={s} id={p.page.id} path={p.path} />);
    for (const text of [r.domain!, c.address.street, t("registrarForm.authCode"), t("support.transferDomain"), "ns1.", "ns2."]) expect(html).toContain(text);
  });

  it("completes a ticket waiting on the domain in an old save through the form", () => {
    const s = readyGame(4);
    const id = atDomain(s, true), r = req(s, id);
    const old = JSON.parse(serialize(s));
    for (const x of old.sales.requests) for (const m of x.thread) delete m.params.auth;
    const back = deserialize(JSON.stringify(old)), [address, code] = owner(back, id);
    expect(t(req(back, id).thread[0].key, req(back, id).thread[0].params)).toContain(code!);
    must(registerOrderDomain(back, id, address, code));
    hour(back);
    expect(domainOf(back, r.domain!)).toMatchObject({ customerId: r.customerId, transfer: true });
  });
});
