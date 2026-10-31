import { useState, type ReactNode } from "react";
import { t } from "../../../../../i18n/en";
import { euro, euroCents } from "../../../../../sim/00-core/money";
import { registrarById, TIERS, type Registrar, type RegistrarId } from "../../../../../sim/10-catalog/registrars";
import type { Look } from "../../../../../sim/10-catalog/sites";
import { derivedDomain } from "../../../../../sim/30-customers/domains";
import { certificateCount, monthlyDomains, spinNames, TRANSFER_MINUTES, wholesale, yearlyAt } from "../../../../../sim/30-customers/registrar";
import { registering, REGISTRIES } from "../../../../../sim/30-customers/registry";
import type { GameState } from "../../../../../sim/50-state";
import { techsAt, OP_TASK } from "../../../../../sim/47-staff/technicians";
import { companyDomainError, orderCompanyDomain, queueTransfer, signRegistrar, transferDomains } from "../../../../../sim/90-actions/registrar";
import { useStore } from "../../../../store";
import { formatDay } from "../../../billing/BillingApp";
import "./registrars.css";
import { LOCALE } from "../../../../../i18n/lang";

export const REGISTRAR_HUE: Record<RegistrarId, number> = { nameCheep: 45, goDuddy: 150, interNetY: 250, openSrsly: 300 };

export const REGISTRAR_ERAS: Record<RegistrarId, { from: number; look: Look }[]> = {
  nameCheep: [{ from: 2005, look: "early" }, { from: 2015, look: "late" }],
  goDuddy: [{ from: 2005, look: "early" }, { from: 2016, look: "late" }],
  interNetY: [{ from: 2005, look: "early" }, { from: 2014, look: "late" }],
  openSrsly: [{ from: 2005, look: "early" }, { from: 2016, look: "late" }],
};

export interface RegistrarProps { game: GameState; r: Registrar; look: Look; year: number }

const factor = (x: number) => `${x.toFixed(2)}×`;
export const own = (game: GameState, r: Registrar): boolean => game.registrar?.id === r.id;
const tierOf = (game: GameState, r: Registrar) => (own(game, r) ? game.registrar!.tier : 0);

const Head = ({ title }: { title?: ReactNode }) => (title ? <h2>{title}</h2> : null);

// The domain search with its name spinner; Buy orders the company domain.
export function DomainSearch({ game, r, title, button = t("browser-sites-1.rg.search") }: { game: GameState; r: Registrar; title?: ReactNode; button?: string }) {
  const act = useStore((s) => s.act);
  const [query, setQuery] = useState(() => derivedDomain(game));
  const [shown, setShown] = useState(query);
  const names = spinNames(shown).filter((n) => companyDomainError(game, n) !== "error.domainInvalid");
  const tier = tierOf(game, r), cur = game.registrar;
  return (
    <div className="rg-find">
      <Head title={title} />
      <form className="rg-search" onSubmit={(e) => { e.preventDefault(); setShown(query); }}>
        <input aria-label={t("browser-sites-1.rg.domainName")} spellCheck={false} autoCapitalize="off" value={query} onChange={(e) => setQuery(e.target.value)} />
        <button type="submit">{button}</button>
      </form>
      {names.length > 0 && (
        <table className="rg-table">
          <thead><tr><th>{t("browser-sites-1.rg.domain")}</th><th className="r">{t("browser-sites-1.rg.perYear")}</th><th /></tr></thead>
          <tbody>
            {names.map((n) => {
              const free = !companyDomainError(game, n);
              return (
                <tr key={n}>
                  <td>{n}</td>
                  <td className="r num">{free ? euroCents(yearlyAt(game, r, tier, n)) : ""}</td>
                  <td className="r">{!free ? <span className="rg-taken">{n === game.company.domain ? t("browser-sites-1.rg.yours") : t("browser-sites-1.rg.taken")}</span>
                    : !game.company.domain && <button className="rg-btn" onClick={() => act(orderCompanyDomain, r.id, n)}>{t("browser-sites-1.rg.buy")}</button>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      {names.length > 0 && !cur && r.signup > 0 && !game.company.domain && <p className="rg-note">{t("browser-sites-1.rg.signupNote", { fee: euro(r.signup) })}</p>}
    </div>
  );
}

// What a year of each TLD costs at this registrar, split into columns.
export function TldPrices({ game, r, title, columns = 1, grid }: { game: GameState; r: Registrar; title?: ReactNode; columns?: number; grid?: boolean }) {
  const tier = tierOf(game, r), tlds = Object.keys(REGISTRIES), per = Math.ceil(tlds.length / columns);
  const price = (tld: string) => euroCents(yearlyAt(game, r, tier, `x.${tld}`));
  if (grid) return (
    <div className="rg-tlds">
      <Head title={title} />
      <ul className="rg-tld-grid">{tlds.map((tld) => <li key={tld}><b>.{tld}</b><span className="num">{price(tld)}</span></li>)}</ul>
    </div>
  );
  return (
    <div className="rg-tlds">
      <Head title={title} />
      <div className="rg-tld-cols">
        {Array.from({ length: columns }, (_, c) => (
          <table key={c} className="rg-table">
            <thead><tr><th>{t("browser-sites-1.rg.tld")}</th><th className="r">{t("browser-sites-1.rg.perYear")}</th></tr></thead>
            <tbody>{tlds.slice(c * per, (c + 1) * per).map((tld) => <tr key={tld}><td>.{tld}</td><td className="r num">{price(tld)}</td></tr>)}</tbody>
          </table>
        ))}
      </div>
    </div>
  );
}

// The reseller contract: its terms and the button that signs it or switches to it.
export function Program({ game, r, title = t("browser-sites-1.rg.program"), sign = t("browser-sites-1.rg.sign") }: { game: GameState; r: Registrar; title?: ReactNode; sign?: string }) {
  const act = useStore((s) => s.act);
  const cur = game.registrar, mine = own(game, r), tier = tierOf(game, r);
  return (
    <div className="rg-program">
      <Head title={title} />
      <dl className="rg-specs">
        <div><dt>{t("browser-sites-1.rg.signup")}</dt><dd className="num">{r.signup ? euro(r.signup) : t("browser-sites-1.rg.none")}</dd></div>
        <div><dt>{t("browser-sites-1.rg.perMonth")}</dt><dd className="num">{r.minimum ? t("browser-sites-1.rg.minimum", { amount: euro(r.minimum) }) : r.fee ? euro(r.fee) : t("browser-sites-1.rg.none")}</dd></div>
        {r.factors.map((f, i) => (
          <div key={i}><dt>{i === 0 ? t("browser-sites-1.rg.anySize") : t("browser-sites-1.rg.nDomainsPlus", { n: TIERS[i].toLocaleString(LOCALE) })}</dt><dd className="num">{mine && tier === i ? <strong>{factor(f)}</strong> : factor(f)}</dd></div>
        ))}
        {r.tlds && Object.entries(r.tlds).map(([tld, f]) => <div key={tld}><dt>.{tld}</dt><dd className="num">{factor(f)}</dd></div>)}
        <div><dt>{t("browser-sites-1.rg.ssl")}</dt><dd className="num">{t("browser-sites-1.rg.aYear", { price: euro(r.ssl) })}</dd></div>
      </dl>
      {mine ? <span className="rg-pill">{t("browser-sites-1.rg.underContract")}</span>
        : <button className="rg-btn" disabled={!!cur?.transfer} onClick={() => act(signRegistrar, r.id)}>{cur ? t("browser-sites-1.rg.switch") : sign}</button>}
    </div>
  );
}

// The account under contract: tier, monthly bill, a pending transfer and every domain with its renewal date.
export function Account({ game, r, title = t("browser-sites-1.rg.account") }: { game: GameState; r: Registrar; title?: ReactNode }) {
  const act = useStore((s) => s.act);
  if (!own(game, r)) return null;
  const tier = game.registrar!.tier, count = game.domains.length, next = TIERS.find((at) => at > count);
  const tr = game.registrar!.transfer, hands = techsAt(game, game.locations[0].id, OP_TASK.domains).length > 0;
  return (
    <div className="rg-account">
      <Head title={title} />
      <dl className="rg-specs">
        <div><dt>{t("browser-sites-1.rg.tier")}</dt><dd className="num">{t("browser-sites-1.rg.tierOf", { n: tier + 1, total: TIERS.length })}</dd></div>
        <div><dt>{t("browser-sites-1.rg.domains")}</dt><dd className="num">{count}</dd></div>
        <div><dt>{t("browser-sites-1.rg.sslCerts")}</dt><dd className="num">{certificateCount(game)}</dd></div>
        <div><dt>{t("browser-sites-1.rg.nextTier")}</dt><dd className="num">{next ? t("browser-sites-1.rg.atDomains", { n: next.toLocaleString(LOCALE) }) : t("browser-sites-1.rg.none")}</dd></div>
        <div><dt>{t("browser-sites-1.rg.perMonth")}</dt><dd className="num">{euroCents(Math.max(r.minimum, monthlyDomains(game) + r.fee) + (certificateCount(game) * r.ssl) / 12)}</dd></div>
      </dl>
      {tr && (
        <div className="rg-transfer">
          <span>{tr.doneAt === null ? t("browser-sites-1.rg.toMove", { n: tr.domains, from: registrarById(tr.from)!.name }) : t("browser-sites-1.rg.moving", { n: tr.domains, date: formatDay(tr.doneAt) })}</span>
          {tr.doneAt === null && (
            <>
              <span className="num">{t("browser-sites-1.rg.minutes", { n: tr.domains * TRANSFER_MINUTES })}</span>
              <button className="rg-btn ghost" disabled={!hands} onClick={() => act(queueTransfer)}>{t("browser-sites-1.rg.handOff")}</button>
              <button className="rg-btn" onClick={() => act(transferDomains)}>{t("browser-sites-1.rg.moveDomains")}</button>
            </>
          )}
        </div>
      )}
      {count > 0 && (
        <table className="rg-table">
          <thead><tr><th>{t("browser-sites-1.rg.domain")}</th><th>{t("browser-sites-1.rg.customer")}</th><th className="r">{t("browser-sites-1.rg.perYear")}</th><th>{t("browser-sites-1.rg.expires")}</th></tr></thead>
          <tbody>
            {[...game.domains].sort((a, b) => a.name.localeCompare(b.name)).map((d) => (
              <tr key={d.name}>
                <td>{d.name}</td>
                <td>{d.customerId ? game.customers.find((c) => c.id === d.customerId)?.name ?? "" : game.company.name}</td>
                <td className="r num">{euroCents(wholesale(game, d.name))}</td>
                <td className="num">{registering(game, d) ? t("browser-sites-1.rg.registering") : formatDay(d.expiresAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
