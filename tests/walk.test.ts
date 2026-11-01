import { describe, expect, it } from "vitest";
import { hourOf } from "../src/sim/00-core/time";
import type { Ticket } from "../src/sim/40-support/tickets";
import { type GameState } from "../src/sim/50-state";
import { feed } from "../src/sim/80-business/news";
import { OFFERS, WALK, walkTick } from "../src/sim/80-business/walk";
import { guideSteps } from "../src/sim/checklist";
import { browseStore } from "../src/sim/90-actions/store";
import { closeTicket } from "../src/sim/90-actions/support";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { registered, newGame } from "./fixtures";

const NINE = 9;
// A company registered this morning, at the hour the daily check runs.
const fresh = (): GameState => {
  const s = registered(newGame(1));
  s.hour = NINE;
  s.registration!.hour = 0;
  return s;
};
const mails = (s: GameState) => s.tickets.filter((t) => t.kind === "pear");
const nextDay = (s: GameState) => { s.hour += 24; return walkTick(s); };

const TRIGGERS: Record<(typeof WALK)[number], (s: GameState) => void> = {
  Finance: (s) => { s.registration!.hour = hourOf(new Date(Date.UTC(2005, 0, 28, NINE))); s.hour = hourOf(new Date(Date.UTC(2005, 1, 1, NINE))); },
  Customers: (s) => { s.customers = Array.from({ length: 5 }, () => ({}) as GameState["customers"][number]); },
  Marketing: (s) => { s.clusters = [{ panel: "freepanel" } as GameState["clusters"][number]]; },
  Security: (s) => { s.tickets = [{ kind: "abuse", status: "open", customerId: "c1" } as Ticket]; },
  Staff: (s) => { s.tickets = Array.from({ length: 11 }, () => ({ kind: "howTo", status: "open", customerId: "c1" }) as Ticket); },
  Market: (s) => { s.sales = { ...s.sales, lost: [{} as GameState["sales"]["lost"][number]] }; },
  Research: (s) => { s.hour = 7 * 24 + NINE; },
};

describe("apps arrive when their problem does", () => {
  it("sends nothing on the first days of a new company", () => {
    const s = fresh();
    for (let d = 0; d < 6; d++) expect(nextDay(s)).toEqual([]);
    expect(mails(s)).toEqual([]);
    expect(s.arrived).toEqual([]);
  });

  it("waits for the trade office registration", () => {
    const s = newGame(1);
    s.hour = NINE;
    TRIGGERS.Customers(s);
    expect(walkTick(s)).toEqual([]);
    expect(s.installed).not.toContain("Customers");
  });

  for (const app of WALK) {
    it(`brings ${app} once with one email and one News line`, () => {
      const s = fresh();
      TRIGGERS[app](s);
      if (app !== "Finance" && app !== "Research") s.hour += 24;
      const events = walkTick(s);
      expect(events).toEqual([{ app: "News", key: "event.news.app", params: { app } }]);
      expect(s.arrived).toEqual([app]);
      expect(s.installed.includes(app)).toBe(!OFFERS.includes(app));
      expect(mails(s).map((t) => [t.topic, t.status, t.unread])).toEqual([[app, "open", true]]);
      expect(feed(s).filter((n) => n.key === "event.news.app")).toHaveLength(1);
      for (let d = 0; d < 3; d++) nextDay(s);
      expect(s.arrived.filter((x) => x === app)).toHaveLength(1);
      expect(mails(s).filter((t) => t.topic === app)).toHaveLength(1);
    });
  }

  it("brings Finance early when cash falls below two months of running costs", () => {
    const s = fresh();
    s.cash = 150;
    s.ledger = [...s.ledger, { hour: 2, category: "rent", key: "ledger.homeLine", params: {}, amount: -80 }];
    nextDay(s);
    expect(s.installed).toContain("Finance");
  });

  it("brings Research when the Pear Store is opened, and after an offer that needs it", () => {
    const s = fresh();
    expect(browseStore(s)).toEqual({ ok: true });
    expect(s.installed).toContain("Research");
    expect(mails(s).map((t) => t.topic)).toEqual(["Research"]);
    browseStore(s);
    expect(mails(s)).toHaveLength(1);

    const o = fresh();
    TRIGGERS.Market(o);
    nextDay(o);
    nextDay(o);
    expect(o.arrived).toEqual(["Market", "Research"]);
  });

  it("changes nothing in a save that already has every app", () => {
    const s = fresh();
    s.installed = [...s.installed, ...WALK];
    for (const app of WALK) TRIGGERS[app](s);
    s.hour = hourOf(new Date(Date.UTC(2005, 1, 1, NINE)));
    const before = serialize(s);
    expect(walkTick(s)).toEqual([]);
    expect(browseStore(s)).toEqual({ ok: true });
    expect(serialize(s)).toBe(before);
  });

  it("counts the apps of an old save as arrived, so they send no email", () => {
    const raw = JSON.parse(serialize(fresh()));
    delete raw.arrived;
    raw.installed = [...raw.installed, "Finance", "Customers"];
    const s = deserialize(JSON.stringify(raw));
    expect(s.arrived).toEqual(["Finance", "Customers", "Marketing", "Security"]);
    const kept = deserialize(serialize(fresh()));
    expect(kept.arrived).toEqual([]);
    expect(kept.installed).not.toContain("Marketing");
  });

  it("closes a Pear email", () => {
    const s = fresh();
    TRIGGERS.Customers(s);
    nextDay(s);
    expect(closeTicket(s, mails(s)[0].id).ok).toBe(true);
    expect(mails(s)[0].status).toBe("closed");
  });

  it("shows the Getting started step of an app once it is installed", () => {
    const s = fresh();
    expect(guideSteps(s)).not.toContain("website");
    expect(guideSteps(s)).not.toContain("loan");
    TRIGGERS.Marketing(s);
    TRIGGERS.Finance(s);
    walkTick(s);
    expect(guideSteps(s)).toEqual(expect.arrayContaining(["website", "launch", "loan"]));
    expect(guideSteps(s)).not.toContain("hire");
  });
});
