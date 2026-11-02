import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { inbox, postDay } from "../src/sim/40-support/letters";
import { newGame, type GameState } from "../src/sim/50-state";
import { ASK_DAYS, ERFASSUNG_URL, NUMBER_DAYS, smallLimit, taxNumber, taxNumberOf } from "../src/sim/80-business/tax";
import { tick } from "../src/sim/88-tick/tick";
import { openBankAccount } from "../src/sim/90-actions/bank";
import { registerCompany } from "../src/sim/90-actions/company";
import { answerQuestionnaire } from "../src/sim/90-actions/tax";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { DohleSite } from "../src/ui/apps/browser/sites/dohle/DohleSite";
import { resolve } from "../src/sim/80-business/browser";

// Hour 56 is Monday 3 January 2005, 08:00.
const MONDAY_8 = 56;
const run = (s: GameState, hours: number) => { for (let i = 0; i < hours; i++) tick(s); };
const registered = (): GameState => {
  const s = newGame(7);
  s.hour = MONDAY_8;
  expect(openBankAccount(s, "sparklasse").ok).toBe(true);
  expect(registerCompany(s, "Basement Hosting", "Becker, Tin", "sole", { street: "Kellerweg 1", zip: "60311", city: "Frankfurt" }).ok).toBe(true);
  return s;
};
const letter = (s: GameState, topic: string) => inbox(s).find((l) => l.topic === topic);

describe("tax number", () => {
  it("starts empty in a new game", () => {
    const s = newGame(7);
    expect(s.tax.asked).toBeNull();
    expect(taxNumber(s)).toBeNull();
  });

  it("sends the questionnaire two working days after the trade office's letter, linking to DOHLE", () => {
    const s = registered();
    run(s, 1);
    const q = s.letters.find((l) => l.topic === "taxQuestionnaire")!;
    const office = s.letters.find((l) => l.topic === "officeRegistered")!;
    expect(q.at).toBe(postDay(MONDAY_8, ASK_DAYS));
    expect(q.at).toBe(postDay(office.at, 2));
    expect(q.link).toBe(ERFASSUNG_URL);
    expect(q.params.limit).toBe(smallLimit(2005));
    expect(s.tax.since).toBe(2005);
  });

  it("refuses an answer before the letter arrives and the small rule above the limit", () => {
    const s = registered();
    run(s, 1);
    expect(answerQuestionnaire(s, 10_000, false)).toEqual({ ok: false, error: "error.taxNoQuestionnaire" });
    run(s, 24 * 6);
    expect(letter(s, "taxQuestionnaire")).toBeTruthy();
    expect(answerQuestionnaire(s, smallLimit(2005) + 1, true)).toEqual({ ok: false, error: "error.taxSmallLimit" });
    expect(answerQuestionnaire(s, -5, false)).toEqual({ ok: false, error: "error.taxRevenue" });
  });

  it("assigns the tax number by letter five working days after the answer", () => {
    const s = registered();
    run(s, 24 * 7);
    expect(answerQuestionnaire(s, 12_000, true).ok).toBe(true);
    expect(answerQuestionnaire(s, 12_000, true)).toEqual({ ok: false, error: "error.taxAnswered" });
    expect(s.tax.small).toBe(true);
    expect(s.tax.expected).toBe(12_000);
    const due = postDay(s.hour, NUMBER_DAYS);
    expect(s.tax.numberAt).toBe(due);
    expect(taxNumber(s)).toBeNull();
    run(s, due - s.hour + 1);
    expect(taxNumber(s)).toBe(taxNumberOf(7));
    expect(taxNumberOf(7)).toMatch(/^045 \d{3} \d{5}$/);
    const l = letter(s, "taxNumber")!;
    expect(l.params.number).toBe(taxNumberOf(7));
    expect(l.params.period).toBe("none");
  });

  it("keeps its file through a save", () => {
    const s = registered();
    run(s, 24 * 7);
    answerQuestionnaire(s, 30_000, false);
    const back = deserialize(serialize(s));
    expect(back.tax).toEqual(s.tax);
  });

  it("gives saves registered before the tax office a number with the standard rule", () => {
    const s = registered();
    const data = JSON.parse(serialize(s));
    delete data.tax;
    const back = deserialize(JSON.stringify(data));
    expect(taxNumber(back)).toBe(taxNumberOf(7));
    expect(back.tax.small).toBe(false);
    expect(back.tax.asked).not.toBeNull();
    run(back, 1);
    expect(back.letters.some((l) => l.topic === "taxQuestionnaire")).toBe(false);
  });

  it("leaves unregistered old saves to the questionnaire", () => {
    const data = JSON.parse(serialize(newGame(7)));
    delete data.tax;
    expect(deserialize(JSON.stringify(data)).tax.asked).toBeNull();
  });

  it("shows the questionnaire on dohle.de and the tax number once it has arrived", () => {
    const s = registered();
    expect(resolve(s, ERFASSUNG_URL).page).toEqual({ kind: "dohle" });
    const page = () => renderToString(createElement(DohleSite, { game: s, path: "/erfassung/", go: () => {} }));
    expect(page()).toContain("Small business limit 2005");
    run(s, 24 * 7);
    answerQuestionnaire(s, 9_000, false);
    expect(page()).toContain("Pending");
    run(s, 24 * 8);
    expect(page()).toContain(taxNumberOf(7));
  });
});
