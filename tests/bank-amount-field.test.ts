import { describe, expect, it } from "vitest";
import { amountField } from "../src/ui/apps/browser/sites/bank/BankSite";
import { LOCALE } from "../src/i18n/lang";

describe("prefilled transfer amount", () => {
  it("uses the language's decimal mark and still parses back", () => {
    const sep = (1.5).toLocaleString(LOCALE).includes(",") ? "," : ".";
    expect(amountField("26.00")).toBe(`26${sep}00`);
    expect(Number(amountField("1234.5").replace(",", "."))).toBe(1234.5);
    expect(amountField(null)).toBe("");
  });
});
