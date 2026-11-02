import { describe, expect, it } from "vitest";
import { dateOf } from "../src/sim/00-core/time";
import { inbox, post, postDay, POST_HOUR } from "../src/sim/40-support/letters";
import { newGame, type GameState } from "../src/sim/50-state";
import { chamberFee, FEES, NOTARY_MAIL, NOTARY_NAME, OFFICE_MAIL, REGISTER_NAME, SHARE_CAPITAL } from "../src/sim/80-business/paperwork";
import { tick } from "../src/sim/88-tick/tick";
import { COMPANY_LAW_SKILL } from "../src/sim/10-catalog/research";
import { registerCompany } from "../src/sim/90-actions/company";
import { openBankAccount } from "../src/sim/90-actions/bank";
import { downloadForm, signForm } from "../src/sim/90-actions/docs";
import { sendMail } from "../src/sim/90-actions/paperwork";
import { research } from "../src/sim/90-actions/store";
import { deserialize, serialize } from "../src/sim/91-save/save";

// Hour 56 is Monday 3 January 2005, 08:00.
const MONDAY_8 = 56;
const run = (s: GameState, hours: number) => { for (let i = 0; i < hours; i++) tick(s); };
// A company registers as a sole trader; a later form and Company law are set directly.
const registered = (form = "sole", bank = "sparklasse", law = true): GameState => {
  const s = newGame(7);
  s.hour = MONDAY_8;
  expect(openBankAccount(s, bank as never).ok).toBe(true);
  expect(registerCompany(s, "Basement Hosting", "Becker, Tin", "sole", { street: "Kellerweg 1", zip: "60311", city: "Frankfurt" }).ok).toBe(true);
  s.registration!.form = form;
  s.bank!.plan = "business";
  if (law) s.unlocks = [...s.unlocks, COMPANY_LAW_SKILL];
  return s;
};
const signed = (s: GameState, form: string): string => {
  const r = downloadForm(s, form);
  if (!r.ok) throw new Error(r.error);
  expect(signForm(s, r.id!)).toEqual({ ok: true });
  return r.id!;
};
const lastMail = (s: GameState) => s.tickets.filter((t) => t.kind === "mail").at(-1)!;

describe("letters", () => {
  it("land with the morning post after working days, skipping the weekend", () => {
    const friday = MONDAY_8 + 4 * 24 + 6;
    const at = postDay(friday, 1);
    expect(dateOf(at).getUTCDay()).toBe(1);
    expect(at % 24).toBe(POST_HOUR);
  });

  it("file a carried bill with the payables on arrival and put Post on the dock", () => {
    const s = registered();
    s.letters = [];
    post(s, REGISTER_NAME, "registerInvoice", { name: "X" }, 1, { bill: { supplier: "register", lines: [{ hour: s.hour, category: "fees", key: "ledger.registerEntry", params: {}, amount: -150 }], days: 14 } });
    const before = s.tickets.length;
    run(s, 30);
    const l = inbox(s).find((x) => x.topic === "registerInvoice")!;
    expect(s.payables.find((p) => p.id === l.payable)).toMatchObject({ supplier: "register", amount: 150, paidAt: null });
    expect(l.params.number).toBeTruthy();
    expect(s.tickets.slice(before).some((t) => t.topic === "invoice")).toBe(false);
    expect(s.installed).toContain("Post");
  });

  it("survive a save round trip, and an old save without them loads", () => {
    const s = registered();
    run(s, 2);
    expect(deserialize(serialize(s)).letters).toEqual(s.letters);
    const raw = JSON.parse(serialize(s));
    delete raw.letters;
    delete raw.chamberYear;
    expect(deserialize(JSON.stringify(raw)).letters).toEqual([]);
  });
});

describe("company paperwork", () => {
  it("bills the registration and the chamber's basic fee by letter", () => {
    const s = registered();
    run(s, 24 * 16);
    const topics = inbox(s).map((l) => l.topic);
    expect(topics).toEqual(expect.arrayContaining(["officeRegistered", "chamberFee"]));
    const confirm = inbox(s).find((l) => l.topic === "officeRegistered")!;
    expect(confirm.params.reg).toBe(s.registration!.number);
    expect(confirm.params.number).toMatch(/^OF-/);
    expect(s.payables.map((p) => p.amount)).toEqual(expect.arrayContaining([FEES.registration, 40]));
  });

  it("raises the chamber fee with the staff and for a registered company", () => {
    const s = registered();
    expect(chamberFee(s)).toBe(40);
    s.staff = Array.from({ length: 12 }, (_, i) => ({ ...s.staff[0], id: `e${i}` })) as GameState["staff"];
    expect(chamberFee(s)).toBe(250);
    s.registration!.form = "limited";
    expect(chamberFee(s)).toBe(700);
  });

  it("turns a sole trader into a partnership once the trade office confirms by letter", () => {
    const s = registered();
    const doc = signed(s, "partnership");
    expect(s.docs.find((d) => d.id === doc)!.form).toMatchObject({ form: "partnership", from: "sole" });
    expect(sendMail(s, OFFICE_MAIL, "Change", doc)).toEqual({ ok: true });
    expect(lastMail(s).topic).toBe("officeReceived");
    expect(s.registration!.form).toBe("sole");
    expect(downloadForm(s, "limited")).toEqual({ ok: false, error: "error.changePending" });
    run(s, 24 * 6);
    expect(s.registration!.form).toBe("partnership");
    expect(s.payables.some((p) => p.supplier === "office" && p.amount === FEES.change)).toBe(true);
  });

  it("goes limited through the notary and the register, never back down", () => {
    const s = registered("partnership");
    s.cash = SHARE_CAPITAL + 1000;
    const doc = signed(s, "limited");
    expect(sendMail(s, OFFICE_MAIL, "GmbH", doc)).toEqual({ ok: true });
    expect(lastMail(s).topic).toBe("wrongDesk");
    expect(sendMail(s, NOTARY_MAIL, "GmbH", doc)).toEqual({ ok: true });
    expect(lastMail(s)).toMatchObject({ topic: "notaryFiled", mail: { from: NOTARY_NAME } });
    run(s, 24 * 14);
    expect(s.registration!.form).toBe("partnership");
    run(s, 24 * 10);
    expect(s.registration!.form).toBe("limited");
    expect(inbox(s).map((l) => l.topic)).toEqual(expect.arrayContaining(["notaryInvoice", "registerEntry", "registerInvoice"]));
    expect(s.payables.filter((p) => p.supplier === "notary" || p.supplier === "register").map((p) => p.amount).sort()).toEqual([FEES.register, FEES.notary]);
    expect(downloadForm(s, "partnership")).toEqual({ ok: false, error: "error.legalFormDown" });
    expect(downloadForm(s, "sole")).toEqual({ ok: false, error: "error.legalFormDown" });
  });

  it("answers an unsigned form, a missing capital and a stranger's address without filing", () => {
    const s = registered();
    s.cash = 100;
    expect(downloadForm(s, "limited")).toEqual({ ok: false, error: "error.shareCapital" });
    s.cash = SHARE_CAPITAL;
    const r = downloadForm(s, "limited"), doc = r.ok ? r.id! : "";
    sendMail(s, NOTARY_MAIL, "GmbH", doc);
    expect(lastMail(s).topic).toBe("unsigned");
    signForm(s, doc);
    s.cash = 100;
    sendMail(s, NOTARY_MAIL, "GmbH", doc);
    expect(lastMail(s).topic).toBe("capital");
    sendMail(s, "someone@example.com", "Hi", null);
    expect(lastMail(s).topic).toBe("bounce");
    expect(sendMail(s, "not an address", "Hi", null)).toEqual({ ok: false, error: "error.mailAddress" });
    expect(s.letters.some((l) => l.form)).toBe(false);
  });

  it("offers a limited company only after Company law, while a partnership needs no training", () => {
    const s = registered("sole", "sparklasse", false);
    expect(downloadForm(s, "limited")).toEqual({ ok: false, error: "error.companyLaw" });
    expect(downloadForm(s, "partnership").ok).toBe(true);
    s.knowHow = 100;
    expect(research(s, COMPANY_LAW_SKILL)).toEqual({ ok: true });
    run(s, 24 * 11);
    expect(s.unlocks).toContain(COMPANY_LAW_SKILL);
    s.cash = SHARE_CAPITAL;
    expect(downloadForm(s, "limited").ok).toBe(true);
  });

  it("refuses a form the account plan is not made for, before the form is signed", () => {
    const s = registered("sole", "netbunk");
    s.cash = SHARE_CAPITAL;
    expect(downloadForm(s, "limited")).toEqual({ ok: false, error: "error.bankPlan" });
    const r = downloadForm(s, "partnership"), doc = r.ok ? r.id! : "";
    s.bank!.plan = "giro";
    expect(signForm(s, doc)).toEqual({ ok: false, error: "error.bankPlan" });
  });
});
