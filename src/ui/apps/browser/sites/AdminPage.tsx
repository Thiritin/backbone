import { useEffect, useState } from "react";
import { t } from "../../../../i18n/en";
import { yearOf } from "../../../../sim/00-core/time";
import { euro, euroCents } from "../../../../sim/00-core/money";
import { hasOrderForm, OWNED, owns, type OwnedChannel } from "../../../../sim/80-business/marketing";
import { setUpChannel } from "../../../../sim/90-actions/marketing";
import { generationOf, lineBlocker, listed, SITE_LINES, SITE_RENT, siteRoom, siteStatus, type SiteStatus } from "../../../../sim/80-business/website";
import { NAME_MAX, setCompany, TAGLINE_MAX } from "../../../../sim/90-actions/company";
import { redesign, setEmailOrders, setLine, setSiteHost } from "../../../../sim/90-actions/website";
import { useStore } from "../../../store";
import { PRODUCT } from "../../support/labels";

const STATUS: Record<SiteStatus, [string, string]> = { up: ["Up", "ok"], slow: ["Slow", "warn"], down: ["Down", "bad"] };

// A text setting that saves when it loses focus or Enter is pressed, and shows the stored value again when the save is refused.
function TextSetting({ label, value, max, save }: { label: string; value: string; max: number; save: (v: string) => boolean }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const commit = () => { if (draft.trim() !== value && !save(draft)) setDraft(value); };
  return (
    <label className="adm-field">
      <span className="co-label">{label}</span>
      <input className="field" maxLength={max} value={draft} spellCheck={false} onChange={(e) => setDraft(e.target.value)} onBlur={commit}
        onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()} />
    </label>
  );
}

// A channel not yet owned: setup and upkeep as values, and a button that stays off while the channel is out of reach.
function ChannelOffer({ id, label }: { id: OwnedChannel; label: string }) {
  const game = useStore((s) => s.game);
  const act = useStore((s) => s.act);
  const def = OWNED[id];
  const blocked = game.cash < def.setup || (def.needs !== null && !owns(game, def.needs)) || (id === "website" && !game.company.domain);
  return (
    <div className="web-line">
      <div className="web-line-row">
        <span>{label} <span className="num">{euro(def.setup)}</span> + <span className="num">{euro(def.upkeep)}</span> / month</span>
        <button className="btn primary" disabled={blocked} onClick={() => act((s) => setUpChannel(s, id))}>Set up</button>
      </div>
    </div>
  );
}

// The owner's page for the company site: no password, the player is the owner.
export function AdminPage({ onSite }: { onSite: () => void }) {
  const game = useStore((s) => s.game);
  const act = useStore((s) => s.act);
  const { siteHost, designYear } = game.marketing, status = siteStatus(game), [statusLabel, statusTone] = STATUS[status];
  const panels = game.clusters.filter((c) => c.kind === "panel" && c.panel);
  const hostName = siteHost.kind === "own" ? game.clusters.find((c) => c.id === siteHost.clusterId)?.name ?? "Missing host" : "Strateaux";
  const current = designYear >= generationOf(yearOf(game.hour));
  return (
    <div className="adm">
      <header className="adm-head">
        <h1>Admin</h1>
        <button className="btn" onClick={onSite}>View site</button>
      </header>
      <div className="adm-grid">
        <section className="adm-card">
          <h2>Company</h2>
          <TextSetting label="Name" value={game.company.name} max={NAME_MAX} save={(v) => act((s) => setCompany(s, { name: v })).ok} />
          <TextSetting label="Tagline" value={game.company.tagline} max={TAGLINE_MAX} save={(v) => act((s) => setCompany(s, { tagline: v })).ok} />
        </section>
        <section className="adm-card">
          <h2>Products</h2>
          {SITE_LINES.map((p) => {
            const on = listed(game, p), why = lineBlocker(game, p);
            return (
              <div key={p} className="web-line">
                <label className="web-line-row">
                  <span>{PRODUCT[p]}</span>
                  <input type="checkbox" role="switch" className="switch" aria-label={`List ${PRODUCT[p]}`} checked={on} disabled={!on && !!why}
                    onChange={(e) => act((s) => setLine(s, p, e.target.checked))} />
                </label>
                {why && <p className="web-why">{t(why)}</p>}
              </div>
            );
          })}
          {hasOrderForm(game) && (
            <div className="web-line">
              <label className="web-line-row">
                <span>Contact by email</span>
                <input type="checkbox" role="switch" className="switch" aria-label="Take orders by email" checked={game.marketing.emailOrders && game.company.mail.kind !== "none"}
                  onChange={(e) => act((s) => setEmailOrders(s, e.target.checked))} />
              </label>
            </div>
          )}
        </section>
        <section className="adm-card web-host">
          <h2>Site</h2>
          {owns(game, "website") && (
            <div className="web-line">
              <div className="web-line-row">
                <span>Design <span className="num">{designYear}</span></span>
                <button className="btn" disabled={current || game.cash < OWNED.website.setup} onClick={() => act((s) => redesign(s))}>
                  Redesign <span className="num">{euro(OWNED.website.setup)}</span>
                </button>
              </div>
            </div>
          )}
          {!owns(game, "website") && <ChannelOffer id="website" label="Web design" />}
          {owns(game, "website") && !owns(game, "orderForm") && <ChannelOffer id="orderForm" label="Order form" />}
          <div className="web-line">
            <div className="web-line-row"><span>{hostName}</span><span className={`pill ${statusTone}`}>{statusLabel}</span></div>
            {siteHost.kind === "rented" && <p className="web-why"><span className="num">{euroCents(SITE_RENT)}</span> a month</p>}
            <div className="seg wrap" role="group" aria-label="Host">
              <button aria-pressed={siteHost.kind === "rented"} onClick={() => act((s) => setSiteHost(s, { kind: "rented" }))}>Rented</button>
              {panels.map((c) => (
                <button key={c.id} aria-pressed={siteHost.kind === "own" && siteHost.clusterId === c.id}
                  disabled={!siteRoom(game, c).fits && !(siteHost.kind === "own" && siteHost.clusterId === c.id)}
                  onClick={() => act((s) => setSiteHost(s, { kind: "own", clusterId: c.id }))}>{c.name}</button>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
