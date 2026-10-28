import { describe, expect, it } from "vitest";
import { t as tr } from "../src/i18n/en";
import { REPLY_KINDS } from "../src/i18n/replies";
import type { Profile } from "../src/sim/30-customers/customers";
import { ascii, CITY_TLD, companyDomain, domainFor } from "../src/sim/30-customers/domains";
import { orderLead } from "../src/sim/30-market/orders";
import { newLead } from "../src/sim/30-market/sales";
import { REPLY_VARIANTS } from "../src/sim/40-support/replies";
import { ACTIONS, createTicket, TEMPLATES, type Ticket, type TicketAction, type TicketKind } from "../src/sim/40-support/tickets";
import type { GameState } from "../src/sim/50-state";
import { tick } from "../src/sim/88-tick/tick";
import { addCustomer, addService } from "../src/sim/90-actions/customers";
import { decline } from "../src/sim/90-actions/sales";
import { closeTicket, replyTicket, resolveTicket } from "../src/sim/90-actions/support";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { readyGame } from "./fixtures";

const web = { product: "webHosting" as const, plan: "web-s", sla: "basic" as const };
const PROFILES: Profile[] = ["private", "gamer", "hobbyDev", "soleProp", "smallBiz", "agency", "office", "onlineShop", "enterprise"];
const CITIES = Object.keys(CITY_TLD);
const DOMAIN = /^[a-z0-9]+(-[a-z0-9]+)*\.(de|at|ch|co\.uk|fr|nl|it)$/;

function leads(seed: number) {
  const s = readyGame(seed);
  return Array.from({ length: 180 }, (_, i) => orderLead(s, PROFILES[i % PROFILES.length], CITIES[i % CITIES.length], [], web));
}

// Ticks until the queued work on a ticket has applied.
function settle(s: GameState, id: string): Ticket {
  for (let i = 0; i < 48 && s.tickets.find((x) => x.id === id)!.work; i++) tick(s);
  return s.tickets.find((x) => x.id === id)!;
}

// A sent email renders from en.ts with every placeholder filled.
const rendered = (key: string | undefined, params: Record<string, string | number> = {}) => {
  const text = tr(key!, params);
  expect(text).not.toBe(key);
  expect(text).not.toMatch(/undefined|NaN/);
  return text;
};

describe("domains", () => {
  it("are stable for a seed, unique, ASCII and on the city's country TLD", () => {
    const a = leads(4), b = leads(4);
    expect(a.map((r) => r.domain)).toEqual(b.map((r) => r.domain));
    expect(new Set(a.map((r) => r.domain)).size).toBe(a.length);
    for (const r of a) {
      expect(r.domain).toMatch(DOMAIN);
      expect(r.domain!.endsWith(`.${CITY_TLD[r.city].tld}`)).toBe(true);
    }
  });

  it("follow the customer's trade and language", () => {
    const s = readyGame(1);
    expect(domainFor(s, "Dental Practice Weber", "office", "Frankfurt", 1)).toMatch(/^(zahnarzt|praxis|zahnarztpraxis)-?weber\.de$/);
    expect(domainFor(s, "Bauer Bakery", "soleProp", "Vienna", 2)).toMatch(/^(baeckerei|backstube)-?bauer\.at$/);
    expect(domainFor(s, "Roth Logistics", "smallBiz", "London", 3)).toMatch(/^roth-?(logistics|freight)\.co\.uk$/);
    expect(domainFor(s, "Studio Kobalt", "agency", "Paris", 4)).toBe("studio-kobalt.fr");
    expect(ascii("Groß Müller Café")).toBe("gross-mueller-cafe");
    expect(companyDomain(s)).toBe("basement-hosting.de");
  });

  it("stay on the service once an order is accepted", () => {
    const s = readyGame(2);
    const r = orderLead(s, "office", "Frankfurt", [], web);
    resolveTicket(s, r.ticketId!, "accept");
    settle(s, r.ticketId!);
    const v = s.services.find((x) => x.id === s.sales.requests.find((x) => x.id === r.id)!.serviceId)!;
    expect(v).toMatchObject({ domain: r.domain, label: r.domain });
    expect(rendered(r.thread[0].key, r.thread[0].params)).toContain(r.domain);
  });

  it("are filled in for old saves on load", () => {
    const s = readyGame(5);
    const cus = addCustomer(s, "Veterinary Clinic Haas", "office");
    addService(s, cus, "webHosting", "Web S", 0.01, "hour", 0, "fra1");
    const old = JSON.parse(serialize(s));
    for (const v of old.services) delete v.domain;
    const back = deserialize(JSON.stringify(old));
    const webs = back.services.filter((v) => v.product === "webHosting");
    expect(webs.length).toBe(4);
    for (const v of webs) expect(v.domain).toMatch(/\.de$/), expect(v.label).toBe(v.domain);
    expect(webs.at(-1)!.domain).toMatch(/^(tierarzt|tierklinik)-?haas\.de$/);
    expect(new Set(webs.map((v) => v.domain)).size).toBe(4);
  });
});

describe("replies", () => {
  it("has every wording of every email", () => {
    const p = { name: "Anna", company: "Basement Hosting", host: "basement-hosting.de", service: "x.de", domain: "x.de", credit: 1, refund: 10, days: 7, hours: 48, url: "https://x.de/", sender: "S", plan: "Web S", city: "Paris", price: 5, hour: 100 };
    for (const k of REPLY_KINDS) for (let i = 0; i < REPLY_VARIANTS; i++) rendered(`reply.${k}.${i}`, p);
  });

  function ticket(seed: number, kind: TicketKind, topic: string) {
    const s = readyGame(seed);
    const cus = addCustomer(s, "Anna Bauer", "private");
    const svc = addService(s, cus, "webHosting", "Web S", 0.01, "hour", 0, "fra1");
    if (topic === "price") s.services = s.services.map((v) => (v.id === svc ? { ...v, before: 0.005 } : v));
    const t = createTicket(s, s.customers.find((c) => c.id === cus)!, kind, svc, topic);
    if (kind === "notice" || kind === "legal") t.notice = { sender: "warner", from: "legal@warnerbras.com", url: "https://x.de/", video: null, real: true, round: 1, followAt: null };
    return { s, t, domain: s.services.find((v) => v.id === svc)!.domain! };
  }

  it("sends an email in the thread for each ticket action", () => {
    const topic: Partial<Record<TicketKind, string>> = { billing: "price", refund: "outage", notice: "movie", legal: "data", appeal: "forgot" };
    for (const [kind, actions] of Object.entries(ACTIONS) as [TicketKind, TicketAction[]][]) {
      if (kind === "order") continue;
      for (const action of actions) {
        const { s, t } = ticket(7, kind, topic[kind] ?? "down");
        expect(resolveTicket(s, t.id, action)).toMatchObject({ ok: true });
        const mail = settle(s, t.id).replies.at(-1)!;
        const what = kind === "refund" && action === "reject" ? "refuse" : action;
        expect(mail.key).toMatch(new RegExp(`^reply\\.${what}\\.[0-2]$`));
        rendered(mail.key, mail.params);
      }
    }
  });

  it("sends each template in the company's words and confirms a closed cancellation", () => {
    for (const [kind, templates] of Object.entries(TEMPLATES) as [TicketKind, string[]][]) {
      for (const tpl of templates) {
        const { s, t, domain } = ticket(8, kind, kind === "howTo" ? "dns" : "x");
        replyTicket(s, t.id, tpl);
        const mail = settle(s, t.id).replies[0];
        expect(mail.key).toMatch(new RegExp(`^reply\\.tpl\\.${tpl}\\.[0-2]$`));
        const text = rendered(mail.key, mail.params);
        if (tpl === "dns") expect(text).toContain(domain), expect(text).toContain("ns1.basement-hosting.de");
      }
    }
    const { s, t } = ticket(9, "cancellation", "leave");
    closeTicket(s, t.id);
    expect(s.tickets.find((x) => x.id === t.id)!.replies.at(-1)!.key).toMatch(/^reply\.cancel\.[0-2]$/);
  });

  it("varies the wording with the seed", () => {
    const keys = new Set([1, 2, 3, 4, 5, 6, 7, 8].map((seed) => {
      const { s, t } = ticket(seed, "outage", "down");
      resolveTicket(s, t.id, "credit");
      return settle(s, t.id).replies[0].key;
    }));
    expect(keys.size).toBeGreaterThan(1);
  });

  it("answers orders and sales requests with an acceptance or a reasoned decline", () => {
    const s = readyGame(3);
    const ok = orderLead(s, "private", "Frankfurt", [], web), off = orderLead(s, "private", "Paris", [], web);
    resolveTicket(s, ok.ticketId!, "accept");
    resolveTicket(s, off.ticketId!, "reject");
    settle(s, ok.ticketId!), settle(s, off.ticketId!);
    const thread = (id: string) => s.sales.requests.find((x) => x.id === id)!.thread;
    const yes = thread(ok.id).at(-1)!, no = thread(off.id).at(-1)!;
    expect(yes).toMatchObject({ from: "you" });
    expect(yes.key).toMatch(/^reply\.accept\.[0-2]$/);
    expect(rendered(yes.key, yes.params)).toContain(ok.domain);
    expect(no.key).toMatch(/^reply\.decline\.notOffered\.[0-2]$/);
    expect(rendered(no.key, no.params)).toContain("Paris");
    const lead = newLead(s, "smallBiz", "Frankfurt", [], web);
    decline(s, lead.id);
    expect(thread(lead.id).at(-1)!.key).toMatch(/^reply\.decline\.busy\.[0-2]$/);
  });
});
