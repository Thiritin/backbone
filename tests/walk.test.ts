import { describe, expect, it } from "vitest";
import type { GameState } from "../src/sim/50-state";
import { OVERDRAFT, walkTick } from "../src/sim/80-business/walk";
import { guideSteps } from "../src/sim/checklist";
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
const lowCash = (s: GameState) => {
  s.cash = 150;
  s.ledger = [...s.ledger, { hour: 2, category: "rent", key: "ledger.homeLine", params: {}, amount: -80 }];
};

describe("apps of a new company", () => {
  it("are all there at registration, with no Pear email or news line about them", () => {
    const s = fresh();
    expect(s.installed).toEqual(expect.arrayContaining(["Marketing", "Security", "Research"]));
    expect(s.installed).not.toContain("Customers");
    for (let d = 0; d < 10; d++) expect(nextDay(s)).toEqual([]);
    expect(mails(s)).toEqual([]);
    expect(s.news.filter((n) => n.startsWith("app."))).toEqual([]);
  });

  it("show their Getting started steps from the start", () => {
    expect(guideSteps(fresh())).toEqual(expect.arrayContaining(["website", "launch", "tenCustomers", "research", "patch"]));
  });

  it("reach an old save that still waited for them, and the Customers app leaves its dock", () => {
    const s = fresh();
    s.installed = s.installed.filter((id) => id !== "Research" && id !== "Security").concat("Customers");
    s.news = [...s.news, `app.Customers@${s.hour}`];
    const back = deserialize(serialize(s));
    expect(back.installed).toEqual(expect.arrayContaining(["Marketing", "Security", "Research"]));
    expect(back.installed).not.toContain("Customers");
  });
});

describe("the overdraft email", () => {
  it("is sent once when cash falls below two months of running costs", () => {
    const s = fresh();
    s.cash = 170;
    s.ledger = [...s.ledger, { hour: 2, category: "rent", key: "ledger.homeLine", params: {}, amount: -80 }];
    nextDay(s);
    expect(mails(s)).toEqual([]);
    lowCash(s);
    nextDay(s);
    nextDay(s);
    expect(mails(s).map((t) => t.topic)).toEqual([OVERDRAFT]);
  });

  it("can be closed", () => {
    const s = fresh();
    lowCash(s);
    nextDay(s);
    expect(closeTicket(s, mails(s)[0].id).ok).toBe(true);
    expect(mails(s)[0].status).toBe("closed");
  });
});
