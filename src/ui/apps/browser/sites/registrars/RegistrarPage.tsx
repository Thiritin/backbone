import { useState, type ReactNode } from "react";
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
export function DomainSearch({ game, r, title, button = "Search" }: { game: GameState; r: Registrar; title?: ReactNode; button?: string }) {
  const act = useStore((s) => s.act);
  const [query, setQuery] = useState(() => derivedDomain(game));
  const [shown, setShown] = useState(query);
  const names = spinNames(shown).filter((n) => companyDomainError(game, n) !== "error.domainInvalid");
  const tier = tierOf(game, r), cur = game.registrar;
  return (
    <div className="rg-find">
      <Head title={title} />
      <form className="rg-search" onSubmit={(e) => { e.preventDefault(); setShown(query); }}>
        <input aria-label="Domain name" spellCheck={false} autoCapitalize="off" value={query} onChange={(e) => setQuery(e.target.value)} />
        <button type="submit">{button}</button>
      </form>
      {names.length > 0 && (
        <table className="rg-table">
          <thead><tr><th>Domain</th><th className="r">Per year</th><th /></tr></thead>
          <tbody>
            {names.map((n) => {
              const free = !companyDomainError(game, n);
              return (
                <tr key={n}>
                  <td>{n}</td>
                  <td className="r num">{free ? euroCents(yearlyAt(game, r, tier, n)) : ""}</td>
                  <td className="r">{!free ? <span className="rg-taken">{n === game.company.domain ? "Yours" : "Taken"}</span>
                    : !game.company.domain && <button className="rg-btn" onClick={() => act(orderCompanyDomain, r.id, n)}>Buy</button>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      {names.length > 0 && !cur && r.signup > 0 && !game.company.domain && <p className="rg-note">Buying a domain here signs the reseller contract for a {euro(r.signup)} signup fee.</p>}
    </div>
  );
}

// What a year of each TLD costs at this registrar, split into columns.
export function TldPrices({ game, r, title, columns = 1, grid }: { game: GameState; r: Registrar; title?: ReactNode; columns?: number; grid?: boolean }) {
  const tier = tierOf(game, r), tlds = Object.keys(REGISTRIES), per = Math.ceil(tlds.length / columns);
  const price = (t: string) => euroCents(yearlyAt(game, r, tier, `x.${t}`));
  if (grid) return (
    <div className="rg-tlds">
      <Head title={title} />
      <ul className="rg-tld-grid">{tlds.map((t) => <li key={t}><b>.{t}</b><span className="num">{price(t)}</span></li>)}</ul>
    </div>
  );
  return (
    <div className="rg-tlds">
      <Head title={title} />
      <div className="rg-tld-cols">
        {Array.from({ length: columns }, (_, c) => (
          <table key={c} className="rg-table">
            <thead><tr><th>TLD</th><th className="r">Per year</th></tr></thead>
            <tbody>{tlds.slice(c * per, (c + 1) * per).map((t) => <tr key={t}><td>.{t}</td><td className="r num">{price(t)}</td></tr>)}</tbody>
          </table>
        ))}
      </div>
    </div>
  );
}

// The reseller contract: its terms and the button that signs it or switches to it.
export function Program({ game, r, title = "Reseller program", sign = "Sign" }: { game: GameState; r: Registrar; title?: ReactNode; sign?: string }) {
  const act = useStore((s) => s.act);
  const cur = game.registrar, mine = own(game, r), tier = tierOf(game, r);
  return (
    <div className="rg-program">
      <Head title={title} />
      <dl className="rg-specs">
        <div><dt>Signup</dt><dd className="num">{r.signup ? euro(r.signup) : "None"}</dd></div>
        <div><dt>Per month</dt><dd className="num">{r.minimum ? `${euro(r.minimum)} minimum` : r.fee ? euro(r.fee) : "None"}</dd></div>
        {r.factors.map((f, i) => (
          <div key={i}><dt>{i === 0 ? "Any size" : `${TIERS[i].toLocaleString("en")}+ domains`}</dt><dd className="num">{mine && tier === i ? <strong>{factor(f)}</strong> : factor(f)}</dd></div>
        ))}
        {r.tlds && Object.entries(r.tlds).map(([tld, f]) => <div key={tld}><dt>.{tld}</dt><dd className="num">{factor(f)}</dd></div>)}
        <div><dt>SSL certificate</dt><dd className="num">{euro(r.ssl)} a year</dd></div>
      </dl>
      {mine ? <span className="rg-pill">Under contract</span>
        : <button className="rg-btn" disabled={!!cur?.transfer} onClick={() => act(signRegistrar, r.id)}>{cur ? "Switch to this partner" : sign}</button>}
    </div>
  );
}

// The account under contract: tier, monthly bill, a pending transfer and every domain with its renewal date.
export function Account({ game, r, title = "Your account" }: { game: GameState; r: Registrar; title?: ReactNode }) {
  const act = useStore((s) => s.act);
  if (!own(game, r)) return null;
  const tier = game.registrar!.tier, count = game.domains.length, next = TIERS.find((at) => at > count);
  const t = game.registrar!.transfer, hands = techsAt(game, game.locations[0].id, OP_TASK.domains).length > 0;
  return (
    <div className="rg-account">
      <Head title={title} />
      <dl className="rg-specs">
        <div><dt>Tier</dt><dd className="num">{tier + 1} of {TIERS.length}</dd></div>
        <div><dt>Domains</dt><dd className="num">{count}</dd></div>
        <div><dt>SSL certificates</dt><dd className="num">{certificateCount(game)}</dd></div>
        <div><dt>Next tier</dt><dd className="num">{next ? `At ${next.toLocaleString("en")} domains` : "None"}</dd></div>
        <div><dt>Per month</dt><dd className="num">{euroCents(Math.max(r.minimum, monthlyDomains(game) + r.fee) + (certificateCount(game) * r.ssl) / 12)}</dd></div>
      </dl>
      {t && (
        <div className="rg-transfer">
          <span>{t.doneAt === null ? `${t.domains} domains to move from ${registrarById(t.from)!.name}` : `Moving ${t.domains} domains until ${formatDay(t.doneAt)}`}</span>
          {t.doneAt === null && (
            <>
              <span className="num">{t.domains * TRANSFER_MINUTES} min</span>
              <button className="rg-btn ghost" disabled={!hands} onClick={() => act(queueTransfer)}>Hand to technician</button>
              <button className="rg-btn" onClick={() => act(transferDomains)}>Move domains</button>
            </>
          )}
        </div>
      )}
      {count > 0 && (
        <table className="rg-table">
          <thead><tr><th>Domain</th><th>Customer</th><th className="r">Per year</th><th>Expires</th></tr></thead>
          <tbody>
            {[...game.domains].sort((a, b) => a.name.localeCompare(b.name)).map((d) => (
              <tr key={d.name}>
                <td>{d.name}</td>
                <td>{d.customerId ? game.customers.find((c) => c.id === d.customerId)?.name ?? "" : game.company.name}</td>
                <td className="r num">{euroCents(wholesale(game, d.name))}</td>
                <td className="num">{registering(game, d) ? "Registering" : formatDay(d.expiresAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
