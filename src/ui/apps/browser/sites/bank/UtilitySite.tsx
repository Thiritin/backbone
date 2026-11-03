import { t } from "../../../../../i18n/en";
import { LOCALE } from "../../../../../i18n/lang";
import { euroCents } from "../../../../../sim/00-core/money";
import { yearOf } from "../../../../../sim/00-core/time";
import { businessPowerPrice } from "../../../../../sim/10-catalog/economy";
import { HOUSEHOLD_FACTOR } from "../../../../../sim/20-world/datacenters";
import { ownAddress } from "../../../../../sim/30-customers/addresses";
import { supplierHost, UTILITY } from "../../../../../sim/46-finance/payables";
import type { GameState, LedgerEntry } from "../../../../../sim/50-state";
import { displayHost } from "../../../../../sim/80-business/browser";
import { monthYear } from "../../../support/labels";
import { InvoiceTable, PayMethodPanel } from "../shared/SupplierAccount";
import "./utility-site.css";

const kwh = (n: number) => `${Math.round(n).toLocaleString(LOCALE)} kWh`;
const ct = (n: number) => `${n.toLocaleString(LOCALE, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ct/kWh`;
// The household price the basement and office pay, in ct/kWh.
const tariff = (game: GameState) => businessPowerPrice(yearOf(game.hour)) * HOUSEHOLD_FACTOR * 100;

// Billed months: power lines of the utility's invoices, and those booked straight to the ledger before the first invoice.
// A paid invoice's lines are booked again on payment, so the ledger only counts up to then.
function billedUsage(game: GameState): LedgerEntry[] {
  const bills = game.payables.filter((p) => p.name === UTILITY), first = bills[0]?.issuedAt ?? Infinity;
  return [...game.ledger.filter((e) => e.key === "ledger.powerUse" && e.hour < first), ...bills.flatMap((p) => p.lines.filter((e) => e.key === "ledger.powerUse"))]
    .sort((a, b) => b.hour - a.hour);
}

function Account({ game }: { game: GameState }) {
  const own = ownAddress(game), homes = game.locations.filter((l) => !l.dc);
  const running = homes.flatMap((l) => (game.powerUse[l.id] ? [{ l, u: game.powerUse[l.id] }] : []));
  const billed = billedUsage(game);
  return (
    <main className="eo-main">
      <h1>{t("accounts.portal")}</h1>
      <p className="eo-who"><strong>{game.company.name}</strong> · {t("accounts.customerNo")} {customerNo(game)}</p>
      <section className="eo-card">
        <h2>{t("accounts.contract")}</h2>
        <dl className="eo-kv">
          <div><dt>{t("accounts.customerNo")}</dt><dd className="num">{customerNo(game)}</dd></div>
          <div><dt>{t("accounts.customer")}</dt><dd>{game.company.name}</dd></div>
          <div><dt>{t("accounts.address")}</dt><dd>{own.street}, {own.zip} {own.city}</dd></div>
          <div><dt>{t("accounts.points")}</dt><dd>{homes.map((l) => l.name).join(", ")}</dd></div>
          <div><dt>{t("accounts.tariff")}</dt><dd>{t("accounts.eoff.tariff")}</dd></div>
          <div><dt>{t("accounts.price")}</dt><dd className="num">{ct(tariff(game))}</dd></div>
        </dl>
      </section>
      <section className="eo-card">
        <h2>{t("accounts.usage")}</h2>
        {running.length + billed.length ? (
          <table className="eo-table">
            <thead><tr><th>{t("accounts.period")}</th><th>{t("accounts.point")}</th><th className="r">{t("accounts.usage")}</th><th className="r">{t("bank.site.amount")}</th></tr></thead>
            <tbody>
              {running.map(({ l, u }) => <tr key={l.id} className="eo-now"><td>{t("accounts.thisMonth")}</td><td>{l.name}</td><td className="r num">{kwh(u.kwh)}</td><td className="r num">{euroCents(u.eur)}</td></tr>)}
              {billed.map((e, i) => <tr key={i}><td>{monthYear(e.hour - 1)}</td><td>{String(e.params.location)}</td><td className="r num">{kwh(Number(e.params.kwh))}</td><td className="r num">{euroCents(-e.amount)}</td></tr>)}
            </tbody>
          </table>
        ) : <p>{t("accounts.noUsage")}</p>}
      </section>
      {game.bank && <section className="eo-card"><h2>{t("accounts.payMethod")}</h2><PayMethodPanel game={game} name={UTILITY} title={game.company.name} /></section>}
      <section className="eo-card">
        <h2>{t("accounts.invoices")}</h2>
        <InvoiceTable game={game} name={UTILITY} className="eo-table" />
      </section>
    </main>
  );
}

const customerNo = (game: GameState) => String(400_000_000 + ((game.seed * 7919) % 99_999_999));

// The utility's site: its business tariff on the front page and the customer account under /account.
export function UtilitySite({ game, path, go }: { game: GameState; path: string; go: (url: string) => void }) {
  const account = path.startsWith("/account"), host = displayHost(supplierHost(UTILITY));
  const link = (to: string, label: string, on: boolean) => <a href={`#${to}`} aria-current={on ? "page" : undefined} onClick={(e) => { e.preventDefault(); go(`${host}${to}`); }}>{label}</a>;
  return (
    <div className="eo">
      <header className="eo-head">
        <span className="eo-logo" aria-hidden>e</span><span className="eo-name">E.OFF</span>
        <nav>{link("/", t("accounts.eoff.power"), !account)}{link("/account", t("accounts.myAccount"), account)}</nav>
      </header>
      {account ? <Account game={game} /> : (
        <main className="eo-main">
          <section className="eo-hero">
            <h1>{t("accounts.eoff.hero")}</h1>
            <dl className="eo-kv">
              <div><dt>{t("accounts.tariff")}</dt><dd>{t("accounts.eoff.tariff")}</dd></div>
              <div><dt>{t("accounts.price")}</dt><dd className="num">{ct(tariff(game))}</dd></div>
            </dl>
            <button className="eo-btn" onClick={() => go(`${host}/account`)}>{t("accounts.myAccount")}</button>
          </section>
        </main>
      )}
      <footer className="eo-foot">© {yearOf(game.hour)} E.OFF</footer>
    </div>
  );
}
