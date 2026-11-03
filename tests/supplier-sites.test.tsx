import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { t } from "../src/i18n/en";
import { registrarHost, REGISTRARS } from "../src/sim/10-catalog/registrars";
import { openAccount } from "../src/sim/46-finance/bank";
import { invoice, UTILITY } from "../src/sim/46-finance/payables";
import { resolve } from "../src/sim/80-business/browser";
import { UtilitySite } from "../src/ui/apps/browser/sites/bank/UtilitySite";
import { RegistrarSite } from "../src/ui/apps/browser/sites/registrars";
import { newGame, readyGame } from "./fixtures";

describe("supplier sites", () => {
  it("shows the utility's account with billed and running kWh and the payment method", () => {
    const s = newGame(7), home = s.locations.find((l) => !l.dc)!;
    expect(resolve(s, "www.e-off.de").page).toEqual({ kind: "utility" });
    expect(resolve(s, "www.e-off.de/account").page).toEqual({ kind: "utility" });
    s.bank = openAccount(s, "sparklasse");
    invoice(s, "power", UTILITY, [{ hour: s.hour, category: "power", key: "ledger.powerUse", params: { location: home.name, kwh: 123, ct: 40.5 }, amount: -49.82 }]);
    s.powerUse = { [home.id]: { kwh: 456.4, eur: 18.4 } };
    const html = renderToString(<UtilitySite game={s} path="/account" go={() => {}} />);
    expect(html).toContain("123 kWh");
    expect(html).toContain("456 kWh");
    expect(html).toContain(t("accounts.thisMonth"));
    expect(html).toContain(t("accounts.payMethod"));
    expect(html).toContain(t("accounts.pay.debit"));
    expect(renderToString(<UtilitySite game={s} path="/" go={() => {}} />)).toContain(t("accounts.myAccount"));
  });

  it("links a registrar's customers to their account, a former partner to its invoices only", () => {
    const s = readyGame(3), id = s.registrar!.id;
    const [former, stranger] = REGISTRARS.filter((r) => r.id !== id);
    expect(renderToString(<RegistrarSite game={s} id={id} path="/" />)).toContain(t("accounts.myAccount"));
    expect(renderToString(<RegistrarSite game={s} id={stranger.id} path="/" />)).not.toContain(t("accounts.myAccount"));
    const mine = renderToString(<RegistrarSite game={s} id={id} path="/account" />);
    expect(mine).toContain(t("accounts.contract"));
    expect(mine).toContain(t("registrarPanel.domains"));
    invoice(s, "registrar", former.name, [{ hour: s.hour, category: "domains", key: "ledger.power", params: {}, amount: -12 }]);
    const old = renderToString(<RegistrarSite game={s} id={former.id} path="/account" />);
    expect(old).toContain(t("accounts.invoices"));
    expect(old).not.toContain(t("registrarPanel.domains"));
    expect(resolve(s, `www.${registrarHost(former)}/account`).page).toEqual({ kind: "registrar", id: former.id });
  });
});
