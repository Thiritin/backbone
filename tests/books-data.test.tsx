// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useStore } from "../src/ui/store";
import { useAccounts, useLedger, useOpenItems, useReports, useVatReturns, accountsOf, CHART } from "../src/ui/apps/books/data";
import { newGame } from "./fixtures";

const seeded = () => {
  const s = newGame(7);
  s.cash = 1000;
  s.ledger = [
    { hour: s.hour, category: "rent", key: "ledger.rent", params: {}, amount: -300 },
    { hour: s.hour, category: "sales", key: "ledger.sale", params: {}, amount: 1500 },
  ];
  useStore.setState({ game: s });
  return s;
};
afterEach(() => useStore.setState({ game: newGame(7) }));

describe("books data hooks", () => {
  it("useAccounts numbers the fixed accounts and categories", () => {
    seeded();
    const { result } = renderHook(() => useAccounts());
    const ids = result.current.map((a) => a.id);
    expect(ids).toEqual(expect.arrayContaining(["bank", "receivables", "payables", "rent", "sales"]));
    expect(result.current.find((a) => a.id === "rent")!.no).toBe(CHART.rent[0]);
    expect(result.current.map((a) => a.no)).toEqual([...result.current.map((a) => a.no)].sort((a, b) => a - b));
    expect(result.current.find((a) => a.id === "bank")!.balance).toBe(1000);
  });

  it("accountsOf narrows to one year and carries the bank back", () => {
    const s = seeded();
    const y = new Date(Date.UTC(2005, 0, 1)).getUTCFullYear();
    expect(accountsOf(s, y + 10).find((a) => a.id === "bank")!.entries).toEqual([]);
  });

  it("useLedger lists years and the statement newest first with running balance", () => {
    seeded();
    const { result } = renderHook(() => useLedger());
    expect(result.current.years.length).toBeGreaterThan(0);
    expect(result.current.rows.map((r) => r.e.amount)).toEqual([1500, -300]);
    expect(result.current.rows.map((r) => r.balance)).toEqual([1000, -500]);
    expect(result.current.months).toHaveLength(1);
  });

  it("useOpenItems is empty without invoices or bills", () => {
    seeded();
    const { result } = renderHook(() => useOpenItems());
    expect(result.current).toMatchObject({ receivable: 0, payable: 0 });
  });

  it("useVatReturns reports the portal state", () => {
    seeded();
    const { result } = renderHook(() => useVatReturns());
    expect(result.current.certs).toEqual([]);
    expect(typeof result.current.linked).toBe("boolean");
  });

  it("useReports builds the year's profit and loss and the overview", () => {
    const s = seeded();
    const { result } = renderHook(() => useReports());
    const year = new Date(s.hour * 3600_000 + Date.UTC(2005, 0, 1)).getUTCFullYear();
    const pl = result.current.profitLoss(year);
    expect(pl.keys.length).toBeGreaterThan(0);
    expect(pl.revenue).toContain("sales");
    expect(pl.costs).toContain("rent");
    expect(pl.net.reduce((a, b) => a + b, 0)).toBeCloseTo(1200, 0);
    expect(result.current.overview().cash).toBe(1000);
  });
});
