// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { t } from "../src/i18n/en";
import { atDesk, inbox, post } from "../src/sim/40-support/letters";
import { openAccount } from "../src/sim/46-finance/bank";
import { bill } from "../src/sim/46-finance/payables";
import { OFFICE_NAME } from "../src/sim/80-business/paperwork";
import { tick } from "../src/sim/88-tick/tick";
import { checkDone } from "../src/sim/checklist";
import { PreviewApp } from "../src/ui/apps/PreviewApp";
import { SupplierInvoice } from "../src/ui/apps/preview/SupplierInvoice";
import { useStore } from "../src/ui/store";
import { listingById } from "../src/sim/20-world/properties";
import { freeSections, rentSection } from "../src/sim/90-actions/properties";
import { newGame } from "./fixtures";

afterEach(cleanup);
const fee = (s: ReturnType<typeof newGame>) => ({ hour: s.hour, category: "fees" as const, key: "ledger.tradeRegistration", params: {}, amount: -26 });

function withFee() {
  const s = newGame(11);
  s.letters = [];
  s.bank = { ...openAccount(s, "sparklasse"), welcomed: true };
  post(s, OFFICE_NAME, "officeRegistered", { name: "Kellerhost", reg: "4711" }, 1, { bill: { supplier: "office", lines: [fee(s)], days: 14 } });
  for (let i = 0; i < 4 * 24; i++) tick(s);
  return s;
}

describe("authority fee", () => {
  it("arrives as a letter only and keeps its payable", () => {
    const s = withFee();
    const l = inbox(s)[0], p = s.payables.find((x) => x.id === l.payable)!;
    expect(p.supplier).toBe("office");
    expect(Object.values(s.mail.msgs).flat().some((m) => m.p?.payable === p.id || m.att?.some((a) => "id" in a && a.id === p.id))).toBe(false);
    expect(atDesk(s).length + inbox(s).length).toBeGreaterThan(0);
    p.paidAt = s.hour; p.sent = p.amount;
    expect(checkDone(s, "payBill")).toBe(true);
  });

  it("previews as the letter with the shared logo, and the stamp once paid", () => {
    const s = withFee();
    const p = s.payables[0];
    useStore.setState({ game: s });
    useStore.getState().openApp("Preview", { kind: "payable", id: p.id });
    const { container } = render(<PreviewApp />);
    const letter = container.querySelector(".letter")!;
    expect(letter).toBeTruthy();
    expect(container.querySelector(".inv-dot, .inv")).toBeNull();
    expect(container.querySelector(".letter-paid")).toBeNull();
    const logo = letter.querySelector(".letter-logo")!.innerHTML;
    cleanup();
    p.paidAt = s.hour;
    useStore.setState({ game: { ...s } });
    const again = render(<PreviewApp />).container;
    expect(again.querySelector(".letter-paid")).toBeTruthy();
    expect(again.querySelector(".letter-logo")!.innerHTML).toBe(logo);
    // The fee document of the same issuer drawn as an invoice carries the letterhead mark too.
    cleanup();
    p.issuedAt = 7 * 365 * 24;
    const inv = render(<SupplierInvoice game={s} p={p} />).container;
    expect(inv.querySelector(".letter-logo")!.innerHTML).toBe(logo);
  });
});

describe("era", () => {
  const vendor = (year: number) => {
    const s = newGame(3);
    s.hour = (year - 2005) * 365 * 24;
    const p = bill(s, { supplier: "landlord", name: "Dwell Immobilien", lines: [fee(s)], method: "cash" });
    return render(<SupplierInvoice game={s} p={p} />).container;
  };
  it.each([2005, 2012])("omits the bank block on a cash receipt and shows a VAT line in %s", (year) => {
    const s = newGame(3);
    s.hour = (year - 2005) * 365 * 24;
    const p = bill(s, { supplier: "landlord", name: "Dwell Immobilien", lines: [fee(s)], method: "cash" });
    const c = render(<SupplierInvoice game={s} p={p} />).container;
    expect(c.textContent).not.toContain(t("paperwork.letter.bank"));
    expect(c.textContent).toContain(t("purchase.vatFree"));
  });
  it("prints 2005 in monospace on continuous forms and 2012 styled", () => {
    expect(vendor(2005).querySelector(".inv-dot .dot-strip")).toBeTruthy();
    cleanup();
    const c = vendor(2012);
    expect(c.querySelector(".inv-dot")).toBeNull();
    expect(c.querySelector(".inv")).toBeTruthy();
  });
});

describe("real purchase", () => {
  it("fills the rent invoice lines from the landlord flow", () => {
    const s = newGame(7);
    s.cash = 2_000_000;
    expect(rentSection(s, "gallushof", freeSections(s, listingById("gallushof")!)[0]).ok).toBe(true);
    const p = s.payables.find((x) => x.supplier === "landlord")!;
    const c = render(<SupplierInvoice game={s} p={p} />).container;
    expect(c.textContent).not.toContain("undefined");
  });
});
