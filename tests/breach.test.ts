import { describe, expect, it } from "vitest";
import { hashRng } from "../src/sim/00-core/rng";
import { hourOf, yearOf } from "../src/sim/00-core/time";
import { sizeSpec } from "../src/sim/10-catalog/products";
import { type GameState } from "../src/sim/50-state";
import { isAlert } from "../src/sim/alerts";
import { breachEligible, breachTick, BREACH_DAYS, decideBreach, drawFine, EXTORTION_HOURS, FINE, GDPR_AT, ransomFor, RANSOM, startBreach } from "../src/sim/60-infra/breach";
import { securityTick } from "../src/sim/60-infra/security";
import { openVulns, vulnsFor } from "../src/sim/60-infra/vulns";
import { tick, type SimEvent } from "../src/sim/88-tick/tick";
import { provisionService } from "../src/sim/90-actions/clusters";
import { addCustomer } from "../src/sim/90-actions/customers";
import { closeTicket, resolveTicket } from "../src/sim/90-actions/support";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { panelServer, withServer, newGame } from "./fixtures";

const year = (y: number) => hourOf(new Date(Date.UTC(y, 0, 1)));
const must = (r: { ok: boolean; error?: string }) => { if (!r.ok) throw new Error(r.error); };
const cluster = (s: GameState, id: string) => s.clusters.find((c) => c.id === id)!;
const patch = (s: GameState, id: string, fields: Partial<GameState["clusters"][number]>) => { s.clusters = s.clusters.map((c) => (c.id === id ? { ...c, ...fields } : c)); };

// A panel host with one web space.
function host(s: GameState) {
  const id = panelServer(s, "dev3"), cus = addCustomer(s, "Ada Lang", "hobbyDev");
  must(provisionService(s, cus, "webHosting", { label: "ada.de", spec: sizeSpec("webHosting", 0, yearOf(s.hour)), clusterId: id }));
  return id;
}
const start = () => ({ ...withServer(newGame(1)), cash: 1_000_000 });

// A mail host holds every live customer, so the sale effects can be counted on a large crowd.
function crowd(s: GameState, n: number): string {
  const base = s.customers[0] ?? (addCustomer(s, "Ada Lang", "hobbyDev"), s.customers[0]);
  s.customers = Array.from({ length: n }, (_, i) => ({ ...base, id: `cus-x${i}`, name: `Customer ${i}`, happiness: 80, churnedAt: null }));
  s.services = [];
  s.clusters = [...s.clusters, { ...s.clusters[0] ?? cluster(s, panelServer(s, "dev3")), id: "cl-mail", name: "mail1", kind: "mail" }];
  return "cl-mail";
}

const open = (s: GameState) => s.tickets.filter((t) => t.kind === "extortion");
const lastBreach = (s: GameState) => s.breaches[s.breaches.length - 1];

describe("breach eligibility", () => {
  it("needs a critical vulnerability open more than 30 days", () => {
    const s = start(), id = host(s);
    const v = Array.from({ length: 40 }, (_, i) => vulnsFor("freepanel", 2008 + i, s.seed)).flat().find((x) => x.severity === "critical")!;
    patch(s, id, { version: v.year, updatedAt: v.patchedAt - 1 });
    const at = (days: number) => v.patchedAt + days * 24;
    expect(openVulns(s, id, at(30)).find((x) => x.id === v.id)?.days).toBe(BREACH_DAYS);
    expect(breachEligible(s, id, openVulns(s, id, at(30)))).toBe(false);
    expect(breachEligible(s, id, openVulns(s, id, at(31)))).toBe(true);
    expect(breachEligible(s, id, openVulns(s, id, at(31)).map((x) => ({ ...x, severity: "high" as const })))).toBe(false);
    expect(breachEligible(s, id, [])).toBe(false);
  });

  it("waits for an undecided ransom on the same host", () => {
    const s = start(), id = host(s);
    const v = { ...vulnsFor("freepanel", 2008, 1)[0] ?? { id: "x", family: "freepanel", year: 2008, disclosedAt: 0, patchedAt: 0 }, severity: "critical" as const, days: 60 };
    expect(breachEligible(s, id, [v])).toBe(true);
    startBreach(s, cluster(s, id), []);
    expect(breachEligible(s, id, [v])).toBe(false);
  });

  it("turns some exploitation rolls on an old panel host into breaches with the ticket and alert", () => {
    const s = start(), id = host(s), events: SimEvent[] = [];
    s.hour = year(2030);
    patch(s, id, { version: 2005, updatedAt: 0 });
    // A compromised host leaves the rolls, so each day starts with it cleaned up.
    for (let d = 0; d < 3000 && !s.breaches.length; d++) { s.hour += 24; s.security = { ...s.security, hacked: [] }; events.push(...securityTick(s)); }
    expect(s.breaches).toHaveLength(1);
    const b = s.breaches[0], t = open(s)[0];
    expect(b).toMatchObject({ hostId: id, decision: null, sold: false, fine: null, ticketId: t.id });
    expect(t).toMatchObject({ kind: "extortion", status: "open", dueAt: b.hour + EXTORTION_HOURS, customerId: "" });
    expect(events.filter((e) => e.key === "event.breach")).toHaveLength(1);
    expect(isAlert("event.breach")).toBe(true);
    expect(events.find((e) => e.key === "event.breach")?.params).toMatchObject({ host: cluster(s, id).name, ransom: b.ransom, hours: 72 });
  });
});

describe("ransom", () => {
  it("is two months of the host customers' revenue between 500 and 50,000, times 3 from 2013 and 5 from 2020", () => {
    const s = start();
    host(s);
    const c = s.customers.slice(0, 1), tiny = ransomFor(s, c);
    s.hour = year(2012);
    expect(ransomFor(s, c)).toBe(RANSOM.min);
    s.hour = year(2013);
    expect(ransomFor(s, c)).toBe(RANSOM.min * 3);
    s.hour = year(2020);
    expect(ransomFor(s, c)).toBe(RANSOM.min * 5);
    expect(tiny).toBeGreaterThanOrEqual(RANSOM.min);
    s.services = s.services.map((v) => ({ ...v, period: "year" as const, price: 12 * 10_000 }));
    s.hour = year(2012);
    expect(ransomFor(s, c)).toBe(20_000);
    s.services = s.services.map((v) => ({ ...v, price: 12 * 100_000 }));
    expect(ransomFor(s, c)).toBe(RANSOM.max);
    s.hour = year(2021);
    expect(ransomFor(s, c)).toBe(RANSOM.max * 5);
  });
});

describe("the decision", () => {
  it("sells the data on a refusal and about one time in ten after paying", () => {
    const s = start(), id = host(s), sink: SimEvent[] = [];
    const draws = 3000;
    let paidSold = 0;
    for (let i = 0; i < draws; i++) {
      s.hour = 100 + i;
      startBreach(s, cluster(s, id), sink);
      const t = open(s).at(-1)!;
      decideBreach(s, t, "pay", sink);
      if (lastBreach(s).sold) paidSold++;
      expect(lastBreach(s).decision).toBe("pay");
    }
    expect(Math.abs(paidSold / draws - 0.1)).toBeLessThan(0.05);
    for (let i = 0; i < 40; i++) {
      s.hour = 5000 + i;
      startBreach(s, cluster(s, id), sink);
      decideBreach(s, open(s).at(-1)!, "refuse", sink);
      expect(lastBreach(s)).toMatchObject({ decision: "refuse", sold: true });
    }
  });

  it("books the ransom on paying and nothing more when the data is kept", () => {
    const s = start(), id = host(s), sink: SimEvent[] = [];
    let seen = 0;
    for (let i = 0; i < 60 && !seen; i++) {
      s.hour = 200 + i;
      const cash = s.cash;
      startBreach(s, cluster(s, id), sink);
      const t = open(s).at(-1)!, b = lastBreach(s), before = sink.length;
      decideBreach(s, t, "pay", sink);
      if (lastBreach(s).sold) continue;
      seen++;
      expect(s.cash).toBe(cash - b.ransom);
      expect(s.ledger.at(-1)).toMatchObject({ category: "fees", key: "ledger.ransom", amount: -b.ransom });
      expect(sink.length).toBe(before);
      expect(t).toMatchObject({ status: "resolved", outcome: "ransomPaid" });
      expect(lastBreach(s)).toMatchObject({ fine: 0, fineAt: null });
    }
    expect(seen).toBe(1);
  });

  it("applies the sale to every customer on the host", () => {
    const s = start(), sink: SimEvent[] = [];
    const mail = crowd(s, 600);
    s.hour = year(2015);
    s.marketing = { ...s.marketing, awareness: { ...s.marketing.awareness, private: 0.5, agency: 0.1 } };
    startBreach(s, cluster(s, mail), sink);
    decideBreach(s, open(s)[0], "refuse", sink);
    const gone = s.customers.filter((c) => c.churnedAt !== null), reviews = s.marketing.reviews.filter((r) => r.reason === "dataLoss");
    expect(s.customers.every((c) => c.happiness === 40)).toBe(true);
    expect(Math.abs(gone.length / 600 - 0.3)).toBeLessThan(0.06);
    expect(Math.abs(reviews.length / 600 - 0.2)).toBeLessThan(0.05);
    expect(reviews.every((r) => r.stars === 1)).toBe(true);
    expect(s.marketing.awareness.private).toBeCloseTo(0.4, 10);
    expect(s.marketing.awareness.agency).toBeCloseTo(0.08, 10);
    expect(sink.find((e) => e.key === "event.breachPress")?.params).toMatchObject({ customers: 600 });
    expect(lastBreach(s)).toMatchObject({ sold: true, fine: null, fineAt: s.hour + 720 });
  });
});

describe("the fine", () => {
  const draws = (s: GameState, soldAt: number, n = 2000) => Array.from({ length: n }, (_, i) => drawFine(s, soldAt, soldAt + 720, hashRng(7, i)));

  it("before 25 May 2018 is 2,000 to 25,000 log-uniform one time in five", () => {
    const s = start(), got = draws(s, GDPR_AT - 24), fines = got.filter((x) => x > 0).sort((a, b) => a - b);
    expect(Math.abs(fines.length / got.length - FINE.old.chance)).toBeLessThan(0.05);
    expect(fines[0]).toBeGreaterThanOrEqual(2000);
    expect(fines.at(-1)).toBeLessThanOrEqual(25_000);
    const median = fines[Math.floor(fines.length / 2)];
    expect(median).toBeGreaterThan(Math.sqrt(2000 * 25_000) * 0.8);
    expect(median).toBeLessThan(Math.sqrt(2000 * 25_000) * 1.25);
  });

  it("from 25 May 2018 is 2% of twelve months of revenue, between 2,000 and 200,000, half of the time", () => {
    const s = start(), at = GDPR_AT + 24 * 400, pay = (amount: number) => { s.ledger = [{ hour: at + 5, category: "payments", key: "ledger.payment", params: {}, amount }]; };
    pay(500_000);
    const got = draws(s, at), fines = got.filter((x) => x > 0);
    expect(Math.abs(fines.length / got.length - FINE.gdpr.chance)).toBeLessThan(0.05);
    expect(new Set(fines)).toEqual(new Set([10_000]));
    pay(20_000);
    expect(Math.max(...draws(s, at))).toBe(2000);
    pay(50_000_000);
    expect(Math.max(...draws(s, at))).toBe(200_000);
    s.ledger = [{ hour: at - 9000, category: "payments", key: "ledger.payment", params: {}, amount: 500_000 }];
    expect(Math.max(...draws(s, at))).toBe(2000);
  });

  it("arrives a month after the sale as a ledger line and a banner", () => {
    const s = start(), id = host(s), sink: SimEvent[] = [];
    s.hour = GDPR_AT + 24 * 400;
    s.ledger = [{ hour: s.hour - 100, category: "payments", key: "ledger.payment", params: {}, amount: 400_000 }];
    let found: ReturnType<typeof lastBreach> | undefined;
    for (let i = 0; i < 40 && !found?.fine; i++) {
      s.hour = GDPR_AT + 24 * 400 + i * 2000;
      s.ledger = [{ hour: s.hour - 100, category: "payments", key: "ledger.payment", params: {}, amount: 400_000 }];
      startBreach(s, cluster(s, id), sink);
      decideBreach(s, open(s).at(-1)!, "refuse", sink);
      const b = lastBreach(s), cash = s.cash;
      s.hour = b.fineAt! - 1;
      expect(breachTick(s)).toEqual([]);
      expect(lastBreach(s).fine).toBeNull();
      s.hour = b.fineAt!;
      const events = breachTick(s);
      found = lastBreach(s);
      if (found.fine) {
        expect(found.fine).toBe(8000);
        expect(s.cash).toBe(cash - 8000);
        expect(s.ledger.at(-1)).toMatchObject({ category: "fees", key: "ledger.fine", amount: -8000 });
        expect(events[0]).toMatchObject({ key: "event.breachFine", params: { amount: 8000 } });
      } else expect(events).toEqual([]);
    }
    expect(found?.fine).toBe(8000);
  });
});

describe("the ticket", () => {
  const ticketGame = () => {
    const s = start(), id = host(s);
    startBreach(s, cluster(s, id), []);
    return { s, t: open(s)[0] };
  };

  it("counts as a refusal after 72 hours", () => {
    const { s, t } = ticketGame(), due = t.dueAt;
    for (let h = 0; h < EXTORTION_HOURS - 1; h++) tick(s);
    expect(s.hour).toBeLessThan(due);
    expect(s.tickets.find((x) => x.id === t.id)!.status).toBe("open");
    while (s.hour <= due) tick(s);
    expect(s.tickets.find((x) => x.id === t.id)).toMatchObject({ status: "resolved", outcome: "ransomRefused" });
    expect(s.breaches[0]).toMatchObject({ decision: "refuse", sold: true });
  });

  it("is paid through the Pay action once the work is done", () => {
    const { s, t } = ticketGame(), cash = s.cash, ransom = s.breaches[0].ransom;
    must(resolveTicket(s, t.id, "pay"));
    expect(s.cash).toBe(cash);
    for (let h = 0; h < 3; h++) tick(s);
    expect(s.breaches[0].decision).toBe("pay");
    expect(s.tickets.find((x) => x.id === t.id)!.outcome).toBe("ransomPaid");
    expect(s.ledger.some((l) => l.key === "ledger.ransom" && l.amount === -ransom)).toBe(true);
  });

  it("is refused through Refuse and Ignore, and cannot be paid without cash", () => {
    const a = ticketGame();
    must(resolveTicket(a.s, a.t.id, "refuse"));
    for (let h = 0; h < 3; h++) tick(a.s);
    expect(a.s.breaches[0]).toMatchObject({ decision: "refuse", sold: true });
    const b = ticketGame();
    must(closeTicket(b.s, b.t.id));
    for (let h = 0; h < 3; h++) tick(b.s);
    expect(b.s.breaches[0]).toMatchObject({ decision: "refuse", sold: true });
    const c = ticketGame();
    c.s.cash = 0;
    expect(resolveTicket(c.s, c.t.id, "pay")).toEqual({ ok: false, error: "error.noCash" });
  });
});

describe("saves", () => {
  it("fill breaches for a save without them and keep the ones it has", () => {
    const s = start(), id = host(s);
    const old = JSON.parse(serialize(s));
    delete old.breaches;
    expect(deserialize(JSON.stringify(old)).breaches).toEqual([]);
    startBreach(s, cluster(s, id), []);
    expect(deserialize(serialize(s)).breaches).toEqual(s.breaches);
  });
});
