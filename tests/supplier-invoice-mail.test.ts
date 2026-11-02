import { describe, expect, it } from "vitest";
import { billSuppliers, UTILITY } from "../src/sim/46-finance/payables";
import { newGame, type LedgerEntry } from "../src/sim/50-state";
import { deserialize, serialize } from "../src/sim/91-save/save";

const line = (key: string, category: string, amount: number): LedgerEntry => ({ hour: 0, category, key, params: {}, amount });

describe("supplier invoice mail", () => {
  it("attaches the invoice with every line it bills", () => {
    const s = newGame(7);
    const bills = [line("ledger.power", "power", -40), line("ledger.space", "rent", -300), line("ledger.feed", "power", -25.5)];
    billSuppliers(s, bills, { datacenter: "Hetzler" });
    expect(s.payables.map((p) => [p.name, p.amount])).toEqual([[UTILITY, 40], ["Hetzler", 325.5]]);
    for (const p of s.payables) {
      const mail = Object.values(s.mail.msgs).flat().find((m) => m.p?.payable === p.id)!;
      expect(mail).toMatchObject({ from: `n:${p.name}`, p: { number: p.number, amount: p.amount }, att: [{ k: "invoice", id: p.id }] });
    }
    const dc = deserialize(serialize(s)).payables.find((p) => p.name === "Hetzler")!;
    expect(dc.lines.map((l) => [l.key, l.amount])).toEqual([["ledger.space", -300], ["ledger.feed", -25.5]]);
  });
});
