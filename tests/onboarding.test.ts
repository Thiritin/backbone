import { describe, expect, it } from "vitest";
import { startGame, OPEN_HOUR } from "../src/sim/90-actions/start";
import { cardBoard, CHAPTER1, checkDone, TUTORIAL, waiting } from "../src/sim/checklist";
import { newGame } from "./fixtures";
import { cardOf } from "../src/ui/apps/guide";
import { appByName } from "../src/ui/apps/registry";
import { tick } from "../src/sim/88-tick/tick";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { FIRST_ORDER_DAYS } from "../src/sim/30-market/orders";
import { dateOf } from "../src/sim/00-core/time";

describe("onboarding cards", () => {
  it("starts on Monday 3 January 2005 at 08:00 while newGame stays at hour 0", () => {
    const s = startGame(1);
    expect(s.hour).toBe(OPEN_HOUR);
    const d = dateOf(s.hour);
    expect([d.getUTCDay(), d.getUTCDate(), d.getUTCHours()]).toEqual([1, 3, 8]);
    expect(newGame(1).hour).toBe(0);
  });

  it("has ten cards whose goals make up the tutorial", () => {
    const b = cardBoard(startGame(1));
    expect(b.cards).toHaveLength(10);
    expect(b.cards.flatMap((c) => c.goals)).toEqual([...TUTORIAL]);
    expect(b.current?.id).toBe("bank");
    expect(TUTORIAL).not.toContain("internet");
    expect(TUTORIAL).not.toContain("findAddress");
  });

  it("resolves every current card to a registered app with a focus where one is defined", () => {
    const s = startGame(1);
    for (const card of CHAPTER1) {
      const { step, title, text } = cardOf(s, { ...card, chapter: 1 });
      expect(appByName(step.app)).toBeDefined();
      expect(title).not.toMatch(/^guide\.card/);
      expect(text).toMatch(/\.$/);
    }
  });

  it("moves the current card on as goals are ticked and waits on the clock", () => {
    const s = startGame(1);
    s.checklist = ["bank"];
    expect(cardBoard(s).current?.id).toBe("register");
    s.registration = { number: "1" } as unknown as typeof s.registration;
    expect(waiting(s, "payBill")).toBe(true);
    s.marketing = { ...s.marketing, siteReady: s.hour + 72 };
    expect(waiting(s, "website")).toBe(true);
    s.checklist = ["bank", "register", "domain"];
    const b = cardBoard(s);
    expect(b.wait[b.cards.findIndex((c) => c.id === "website")]).toBe(true);
    expect(b.current?.id).toBe("buyServer");
    s.checklist = [...s.checklist, "setup", "shareWeb"];
    expect(waiting(s, "hosting")).toBe(true);
    s.checklist = [...s.checklist, "buyServer", "mountServer", "mountRouter", "serverLinked", "downloadIso", "writeStick", "plugStick", "bootUsb", "installOs", "payBill"];
    expect(cardBoard(s).current).toBeUndefined();
    s.hour += 72;
    expect(waiting(s, "website")).toBe(false);
    expect(waiting(s, "hosting")).toBe(false);
  });

  it("brings the first order within three game days of web hosting going online", () => {
    expect(FIRST_ORDER_DAYS).toBe(3);
    const s = startGame(1);
    s.webOpenedAt = s.hour;
    s.marketing = { ...s.marketing, lines: ["webHosting"] };
    for (let h = 0; h < 24 * FIRST_ORDER_DAYS + 12 && !s.sales.requests.some((r) => r.kind === "order"); h++) tick(s);
    expect(s.sales.requests.some((r) => r.kind === "order")).toBe(true);
  });

  it("starts the three days when the product is listed, not when the panel host came online", () => {
    const s = startGame(1);
    s.webOpenedAt = s.hour;
    s.hour += 24 * 10;
    s.marketing = { ...s.marketing, lines: ["webHosting"] };
    for (let h = 0; h < 24 * FIRST_ORDER_DAYS + 12 && !s.sales.requests.some((r) => r.kind === "order"); h++) tick(s);
    expect(s.sales.requests.some((r) => r.kind === "order")).toBe(true);
  });

  it("sends the order the next morning when the window ran out while the mail was not routed", () => {
    const s = startGame(1);
    s.webOpenedAt = s.hour;
    s.firstOrderFrom = s.hour - 24 * 10;
    s.marketing = { ...s.marketing, lines: ["webHosting"] };
    for (let h = 0; h < 30 && !s.sales.requests.some((r) => r.kind === "order"); h++) tick(s);
    expect(s.sales.requests.some((r) => r.kind === "order")).toBe(true);
  });

  it("points the first-order card at the order's ticket and words the waiting states as statements", () => {
    const s = startGame(1);
    const card = { id: "firstOrder", goals: ["firstCustomer"], chapter: 1 } as const;
    expect(cardOf(s, card).step.focus).toBeUndefined();
    s.sales.requests = [{ kind: "order", ticketId: "tkt1", status: "open" } as never];
    expect(cardOf(s, card).step).toMatchObject({ app: "Support", focus: { kind: "ticket", id: "tkt1" } });
  });

  it("loads a save from the old step list without losing ticks", () => {
    const s = startGame(1);
    s.checklist = ["bank", "internet", "findAddress", "mail", "hosttoast"];
    const back = deserialize(serialize(s));
    expect(back.checklist).toEqual(s.checklist);
    expect(checkDone(back, "bank")).toBe(true);
    expect(checkDone(back, "hosttoast")).toBe(true);
    expect(cardBoard(back).done[0]).toBe(true);
    expect(cardBoard(back).current?.id).toBe("register");
  });
});
