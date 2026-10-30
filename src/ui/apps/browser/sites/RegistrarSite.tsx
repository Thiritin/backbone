import { useState, type CSSProperties } from "react";
import { euro, euroCents } from "../../../../sim/00-core/money";
import { registrarById, TIERS, type RegistrarId } from "../../../../sim/10-catalog/registrars";
import { derivedDomain } from "../../../../sim/30-customers/domains";
import { certificateCount, monthlyDomains, spinNames, TRANSFER_MINUTES, wholesale, yearlyAt } from "../../../../sim/30-customers/registrar";
import { registering } from "../../../../sim/30-customers/registry";
import type { GameState } from "../../../../sim/50-state";
import { techsAt, OP_TASK } from "../../../../sim/47-staff/technicians";
import { companyDomainError, orderCompanyDomain, queueTransfer, signRegistrar, transferDomains } from "../../../../sim/90-actions/registrar";
import { useStore } from "../../../store";
import { formatDay } from "../../billing/BillingApp";

export const REGISTRAR_HUE: Record<RegistrarId, number> = { nameCheep: 45, goDuddy: 150, interNetY: 250, openSrsly: 300 };

const factor = (x: number) => `${x.toFixed(2)}×`;

// A registrar's site: the domain search with its name spinner, the reseller program, and the account once under contract.
export function RegistrarSite({ game, id }: { game: GameState; id: RegistrarId }) {
  const act = useStore((s) => s.act);
  const r = registrarById(id)!, cur = game.registrar, own = cur?.id === id;
  const [query, setQuery] = useState(() => derivedDomain(game));
  const [shown, setShown] = useState(query);
  const names = spinNames(shown).filter((n) => companyDomainError(game, n) !== "error.domainInvalid");
  const tier = own ? cur.tier : 0, count = game.domains.length, next = TIERS.find((at) => at > count);
  const t = own ? cur.transfer : null, hands = techsAt(game, game.locations[0].id, OP_TASK.domains).length > 0;
  return (
    <div className="rg" style={{ "--hue": REGISTRAR_HUE[id] } as CSSProperties}>
      <header className="rg-head"><strong>{r.name}</strong></header>
      <section className="rg-hero">
        <h1>Find your domain</h1>
        <form className="rg-search" onSubmit={(e) => { e.preventDefault(); setShown(query); }}>
          <input aria-label="Domain name" spellCheck={false} autoCapitalize="off" value={query} onChange={(e) => setQuery(e.target.value)} />
          <button type="submit">Search</button>
        </form>
      </section>
      {names.length > 0 && (
        <section className="rg-sec">
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
                      : !game.company.domain && <button className="rg-btn" onClick={() => act(orderCompanyDomain, id, n)}>Buy</button>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!cur && r.signup > 0 && !game.company.domain && <p className="rg-note">Buying a domain here signs the reseller contract for a {euro(r.signup)} signup fee.</p>}
        </section>
      )}
      <section className="rg-sec">
        <h2>Reseller program</h2>
        <dl className="rg-specs">
          <div><dt>Signup</dt><dd className="num">{r.signup ? euro(r.signup) : "None"}</dd></div>
          <div><dt>Per month</dt><dd className="num">{r.minimum ? `${euro(r.minimum)} minimum` : r.fee ? euro(r.fee) : "None"}</dd></div>
          {r.factors.map((f, i) => (
            <div key={i}><dt>{i === 0 ? "Any size" : `${TIERS[i].toLocaleString("en")}+ domains`}</dt><dd className="num">{own && tier === i ? <strong>{factor(f)}</strong> : factor(f)}</dd></div>
          ))}
          {r.tlds && Object.entries(r.tlds).map(([tld, f]) => <div key={tld}><dt>.{tld}</dt><dd className="num">{factor(f)}</dd></div>)}
          <div><dt>SSL certificate</dt><dd className="num">{euro(r.ssl)} a year</dd></div>
        </dl>
        {own ? <span className="rg-pill">Under contract</span>
          : <button className="rg-btn" disabled={!!cur?.transfer} onClick={() => act(signRegistrar, id)}>{cur ? "Switch to this partner" : "Sign"}</button>}
      </section>
      {own && (
        <section className="rg-sec">
          <h2>Your account</h2>
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
        </section>
      )}
    </div>
  );
}
