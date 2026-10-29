import { useState } from "react";
import { euro, euroCents } from "../../../sim/00-core/money";
import { REGISTRARS, TIERS, registrarById, type Registrar } from "../../../sim/10-catalog/registrars";
import { derivedDomain } from "../../../sim/30-customers/domains";
import { monthlyDomains, TRANSFER_MINUTES, wholesale } from "../../../sim/30-customers/registrar";
import { registryOf } from "../../../sim/30-customers/registry";
import type { GameState } from "../../../sim/50-state";
import { queueTransfer, registerCompanyDomain, signRegistrar, transferDomains } from "../../../sim/90-actions/registrar";
import { techsAt, OP_TASK } from "../../../sim/47-staff/technicians";
import { useStore } from "../../store";
import { formatDay } from "../billing/BillingApp";

const factor = (x: number) => `${x.toFixed(2)}×`;
const monthly = (r: Registrar) => (r.minimum ? `${euro(r.minimum)} minimum` : r.fee ? euro(r.fee) : "None");

// The registrar partners as cards, the company domain and the domains under management.
export function Domains({ game }: { game: GameState }) {
  const act = useStore((s) => s.act);
  const cur = game.registrar, def = cur && registrarById(cur.id), count = game.domains.length;
  const next = def ? TIERS.find((at) => at > count) : undefined;
  const [name, setName] = useState("");
  const suggestion = derivedDomain(game), t = cur?.transfer;
  const hands = techsAt(game, game.locations[0].id, OP_TASK.domains).length > 0;
  return (
    <div className="net-addrs">
      {cur && def && (
        <dl className="fin-facts net-contract">
          <div><dt>Partner</dt><dd>{def.name}</dd></div>
          <div><dt>Tier</dt><dd className="num">{cur.tier + 1} of {TIERS.length}</dd></div>
          <div><dt>Domains</dt><dd className="num">{count}</dd></div>
          <div><dt>Next tier</dt><dd className="num">{next ? `At ${next.toLocaleString("en")} domains` : "None"}</dd></div>
          <div><dt>Per month</dt><dd className="num">{euroCents(Math.max(def.minimum, monthlyDomains(game) + def.fee))}</dd></div>
        </dl>
      )}
      {t && (
        <div className="net-buy">
          <span>{t.doneAt === null ? `${t.domains} domains to move from ${registrarById(t.from)!.name}` : `Moving ${t.domains} domains until ${formatDay(t.doneAt)}`}</span>
          <span className="grow" />
          {t.doneAt === null && (
            <>
              <span className="num">{t.domains * TRANSFER_MINUTES} min</span>
              <button className="btn" disabled={!hands} onClick={() => act(queueTransfer)}>Hand to technician</button>
              <button className="btn primary" onClick={() => act(transferDomains)}>Move domains</button>
            </>
          )}
        </div>
      )}
      <div className="shop-grid net-partners">
        {REGISTRARS.map((r) => {
          const own = cur?.id === r.id;
          return (
            <div key={r.id} className="shop-card">
              <div className="shop-name"><strong>{r.name}</strong></div>
              <dl className="shop-specs">
                <div><dt>Signup</dt><dd className="num">{r.signup ? euro(r.signup) : "None"}</dd></div>
                <div><dt>Per month</dt><dd className="num">{monthly(r)}</dd></div>
                {r.factors.map((f, i) => (
                  <div key={i}><dt>{i === 0 ? "Any size" : `${TIERS[i].toLocaleString("en")}+ domains`}</dt><dd className="num">{own && cur.tier === i ? <strong>{factor(f)}</strong> : factor(f)}</dd></div>
                ))}
                {r.tlds && Object.entries(r.tlds).map(([tld, f]) => <div key={tld}><dt>.{tld}</dt><dd className="num">{factor(f)}</dd></div>)}
              </dl>
              <div className="shop-buy">
                <span className="grow" />
                {own ? <span className="pill ok">Under contract</span>
                  : <button className="btn primary" disabled={!!t} onClick={() => act(signRegistrar, r.id)}>{cur ? "Switch" : "Sign"}</button>}
              </div>
            </div>
          );
        })}
      </div>
      <div className="shop-card net-company">
        <div className="shop-name"><strong>Company domain</strong></div>
        {game.company.domain ? (
          <dl className="shop-specs">
            <div><dt>Domain</dt><dd className="num">{game.company.domain}</dd></div>
            <div><dt>Registry</dt><dd>{registryOf(game.company.domain).name}</dd></div>
            <div><dt>Per year</dt><dd className="num">{euroCents(wholesale(game, game.company.domain))}</dd></div>
          </dl>
        ) : (
          <div className="shop-buy">
            <input className="field grow" aria-label="Domain name" placeholder={suggestion} spellCheck={false} value={name} onChange={(e) => setName(e.target.value)} />
            <button className="btn primary" disabled={!cur} onClick={() => act(registerCompanyDomain, name || suggestion)}>Register</button>
          </div>
        )}
      </div>
      {game.domains.length > 0 && (
        <table className="table fin-table">
          <thead><tr><th>Domain</th><th>Customer</th><th className="r">Per year</th><th>Expires</th></tr></thead>
          <tbody>
            {[...game.domains].sort((a, b) => a.name.localeCompare(b.name)).map((d) => (
              <tr key={d.name}>
                <td>{d.name}</td>
                <td>{d.customerId ? game.customers.find((c) => c.id === d.customerId)?.name ?? "" : game.company.name}</td>
                <td className="r num">{euroCents(wholesale(game, d.name))}</td>
                <td className="num">{formatDay(d.expiresAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
