import { describe, expect, it } from "vitest";
import { hourOf } from "../src/sim/00-core/time";
import type { DeskId } from "../src/sim/10-catalog/desks";
import { newDeskAi, openDesk } from "../src/sim/40-support/desk";
import { aiOffered, ANSWER_BOT_FEE, articleDeflects, billDeskAi, BOT_NAME } from "../src/sim/40-support/desk-ai";
import { importTicket } from "../src/sim/40-support/desk-work";
import { createTicket } from "../src/sim/40-support/tickets";
import { supportTick } from "../src/sim/40-support/tick";
import type { GameState } from "../src/sim/50-state";
import { addCustomer, addService } from "../src/sim/90-actions/customers";
import { setDeskAi } from "../src/sim/90-actions/desk";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { newGame, registered } from "./fixtures";

const at = (y: number) => hourOf(new Date(Date.UTC(y, 0, 3, 10)));
function hosted(id: DeskId, year: number, seed = 5): GameState {
  const s = registered({ ...newGame(seed), hour: at(year), cash: 1e6 });
  openDesk(s, id, { kind: "hosted" }, "pxl");
  return s;
}
// Basic how-to tickets on the desk's portal, one customer each.
function asks(s: GameState, n: number) {
  return Array.from({ length: n }, (_, i) => {
    const id = addCustomer(s, `C${i}`, "private"), c = s.customers.find((x) => x.id === id)!;
    const t = createTicket(s, c, "howTo", null, "upload");
    importTicket(s, t, true);
    return { t, c, due: t.dueAt, happy: c.happiness };
  });
}

describe("AI on the hosted desks", () => {
  it("starts each feature in the researched year", () => {
    expect(aiOffered(hosted("zendusk", 2012), "suggestedArticles")).toBe(false);
    expect(aiOffered(hosted("zendusk", 2013), "suggestedArticles")).toBe(true);
    expect(aiOffered(hosted("zendusk", 2016), "answerBot")).toBe(false);
    expect(aiOffered(hosted("zendusk", 2017), "answerBot")).toBe(true);
    expect(aiOffered(hosted("freshdusk", 2011), "suggestedArticles")).toBe(true);
    expect(aiOffered(hosted("freshdusk", 2017), "answerBot")).toBe(false);
    expect(aiOffered(hosted("freshdusk", 2018), "answerBot")).toBe(true);
    const s = hosted("zendusk", 2016);
    expect(setDeskAi(s, "answerBot", true)).toEqual({ ok: false, error: "error.deskFeature" });
  });

  it("gives self-hosted desks none", () => {
    for (const id of ["ostickit", "freescoot"] as const) {
      const s = registered({ ...newGame(5), hour: at(2024), cash: 1e6 });
      openDesk(s, id);
      for (const a of ["suggestedArticles", "answerBot", "autoAnswer", "drafting"] as const) expect(aiOffered(s, a)).toBe(false);
      expect(setDeskAi(s, "suggestedArticles", true).ok).toBe(false);
      expect(articleDeflects(s, "upload")).toBe(false);
    }
  });

  it("lets some portal customers read the suggested article instead of writing in", () => {
    const s = hosted("zendusk", 2015);
    const hits = Array.from({ length: 20000 }, () => articleDeflects(s, "upload")).filter(Boolean).length;
    expect(hits / 20000).toBeGreaterThan(0.05);
    expect(hits / 20000).toBeLessThan(0.07);
    expect(articleDeflects(s, "php")).toBe(false);
    expect(setDeskAi(s, "suggestedArticles", false).ok).toBe(true);
    expect(articleDeflects(s, "upload")).toBe(false);
    // Over two months of customers the switch adds reads.
    const reads = (on: boolean) => {
      const g = hosted("zendusk", 2015, 9);
      setDeskAi(g, "suggestedArticles", on);
      for (let i = 0; i < 150; i++) addService(g, addCustomer(g, `C${i}`, "private"), "webHosting", "site", 5, "year");
      for (let h = 0; h < 24 * 60; h++) { supportTick(g); g.hour++; }
      return Object.values(g.kbReads).reduce((a, b) => a + b, 0);
    };
    expect(reads(false)).toBe(0);
    expect(reads(true)).toBeGreaterThan(0);
  });

  it("solves some basic how-to tickets with the answer bot and bills only those", () => {
    const s = hosted("zendusk", 2018);
    expect(setDeskAi(s, "answerBot", true).ok).toBe(true);
    const all = asks(s, 60);
    supportTick(s);
    const bot = BOT_NAME.zendusk;
    const tickets = all.map((x) => ({ ...x, t: s.tickets.find((t) => t.id === x.t.id)!, c: s.customers.find((c) => c.id === x.c.id)! }));
    const solved = tickets.filter((x) => x.t.status === "resolved"), open = tickets.filter((x) => x.t.status !== "resolved");
    expect(solved.length).toBeGreaterThan(5);
    expect(open.length).toBeGreaterThan(30);
    for (const x of solved) expect(x.t.replies.map((r) => [r.by, r.right])).toEqual([[bot, true]]);
    for (const x of open) {
      expect(x.t.notes!.map((n) => [n.by, n.key])).toEqual([[bot, "desk.note.botTried"]]);
      expect([x.t.status, x.t.dueAt, x.t.replies.length, x.c.happiness]).toEqual(["open", x.due, 0, x.happy]);
    }
    expect(s.kbReads.upload).toBe(solved.length);
    expect(s.desk!.ai.solved).toBe(solved.length);
    // A second hour leaves the tickets it already tried to the agents.
    s.hour++;
    supportTick(s);
    expect(s.desk!.ai.solved + s.desk!.ai.tried).toBe(60);
    const cash = s.cash;
    billDeskAi(s);
    expect(s.ledger.at(-1)).toMatchObject({ key: "ledger.answerBot", params: { n: solved.length }, amount: -solved.length * ANSWER_BOT_FEE });
    expect(s.cash).toBeCloseTo(cash - solved.length * ANSWER_BOT_FEE);
    const lines = s.ledger.length;
    billDeskAi(s);
    expect(s.ledger.length).toBe(lines);
  });

  it("leaves the answer bot off until switched on", () => {
    const s = hosted("freshdusk", 2019);
    const all = asks(s, 10);
    supportTick(s);
    expect(all.every((x) => s.tickets.find((t) => t.id === x.t.id)!.status === "open")).toBe(true);
    expect(s.desk!.ai).toMatchObject({ solved: 0, tried: 0 });
  });

  it("loads a save from before the AI switches", () => {
    const s = hosted("zendusk", 2018);
    const data = JSON.parse(serialize(s));
    delete data.desk.ai;
    const back = deserialize(JSON.stringify(data));
    expect(back.desk!.ai).toEqual(newDeskAi());
  });
});
