import { useEffect, useState } from "react";
import { t } from "../../../i18n/en";
import { euro, euroCents } from "../../../sim/00-core/money";
import { yearOf } from "../../../sim/00-core/time";
import { registrarById, REGISTRARS } from "../../../sim/10-catalog/registrars";
import { shopById } from "../../../sim/10-catalog/shops";
import type { Product } from "../../../sim/30-customers/customers";
import { OWNED, owns, type SiteHost } from "../../../sim/80-business/marketing";
import { shopActive } from "../../../sim/80-business/shop";
import { generationOf, lineBlocker, listed, SITE_LINES, SITE_RENT, siteBuilt, siteRoom, siteStatus, type SiteStatus } from "../../../sim/80-business/website";
import { setCompany, TAGLINE_MAX } from "../../../sim/90-actions/company";
import { setUpChannel } from "../../../sim/90-actions/marketing";
import { buildSite, launchSite, redesign, setEmailOrders, setLine, setSiteHost } from "../../../sim/90-actions/website";
import { useStore } from "../../store";
import { formatDay } from "../billing/format";
import { PRODUCT } from "../support/labels";

const STATUS: Record<SiteStatus, [string, string]> = { up: [t("marketing.statusUp"), "ok"], slow: [t("marketing.statusSlow"), "warn"], down: [t("marketing.statusDown"), "bad"] };
const sameHost = (a: SiteHost | null, b: SiteHost) => a?.kind === b.kind && (a.kind === "rented" || a.clusterId === (b as { clusterId: string }).clusterId);

// Rented web space at Strateaux or one of the company's own web panel hosts with room for the site.
function HostPicker({ value, pick }: { value: SiteHost | null; pick: (h: SiteHost) => void }) {
  const game = useStore((s) => s.game);
  const panels = game.clusters.filter((c) => c.kind === "panel" && c.panel);
  return (
    <div className="seg wrap" role="group" aria-label={t("marketing.hosting")}>
      <button aria-pressed={value?.kind === "rented"} onClick={() => pick({ kind: "rented" })}>{t("marketing.rentAtStrateaux")}</button>
      {panels.map((c) => {
        const h: SiteHost = { kind: "own", clusterId: c.id }, on = sameHost(value, h);
        return <button key={c.id} aria-pressed={on} disabled={!on && !siteRoom(game, c).fits} onClick={() => pick(h)}>{c.name}</button>;
      })}
      {!panels.length && <button disabled>{t("marketing.ownWebPanel")}</button>}
    </div>
  );
}

// Saves when it loses focus or Enter is pressed, and shows the stored value again when the save is refused.
function Tagline() {
  const game = useStore((s) => s.game);
  const act = useStore((s) => s.act);
  const value = game.company.tagline;
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const commit = () => { if (draft.trim() !== value && !act(setCompany, { tagline: draft }).ok) setDraft(value); };
  return (
    <input className="field mkt-grow" aria-label={t("marketing.tagline")} maxLength={TAGLINE_MAX} value={draft} spellCheck={false} onChange={(e) => setDraft(e.target.value)} onBlur={commit}
      onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()} />
  );
}

// The company website as a sales channel: built by hand, launched under the company domain, then upgraded.
export function SiteCard() {
  const game = useStore((s) => s.game);
  const act = useStore((s) => s.act);
  const [host, setHost] = useState<SiteHost | null>(null);
  const m = game.marketing, domain = game.company.domain, built = siteBuilt(game);
  const registrar = (game.registrar && registrarById(game.registrar.id)?.name) ?? REGISTRARS[0].name;
  const [statusLabel, statusTone] = STATUS[siteStatus(game)];
  const rent = <span className="mkt-sub">{t("marketing.priceMonth", { price: euroCents(SITE_RENT) })}</span>;

  let pill;
  if (m.launched) pill = <span className={`pill ${statusTone}`}>{statusLabel}</span>;
  else if (built) pill = <span className="pill accent">{t("marketing.ready")}</span>;
  else if (m.siteReady !== null) pill = <span className="pill">{t("marketing.building")}</span>;
  else pill = <span className="pill">{t("marketing.none")}</span>;

  return (
    <div className="shop-card mkt-campaign">
      <div className="mkt-head"><strong>{t("marketing.website")}</strong>{pill}</div>
      {m.siteReady === null && (
        <div className="mkt-row">
          <span className="mkt-grow">{t("marketing.siteIntro")}</span>
          <button className="btn primary" onClick={() => act(buildSite)}>{t("marketing.build")}</button>
        </div>
      )}
      {m.siteReady !== null && !built && (
        <div className="mkt-row"><span className="mkt-label">{t("marketing.readyOn")}</span><span className="mkt-value">{formatDay(m.siteReady)}</span></div>
      )}
      {built && !m.launched && <>
        <div className="mkt-row">
          <span className="mkt-label">{t("marketing.domain")}</span>
          <span className="mkt-value">{domain ? <span className="num">{domain}</span> : t("marketing.buyDomain", { registrar })}</span>
        </div>
        <div className="mkt-row">
          <span className="mkt-label">{t("marketing.hosting")}</span>
          <div className="mkt-grow"><HostPicker value={host} pick={setHost} />{host?.kind === "rented" && rent}</div>
        </div>
        <div className="mkt-row mkt-end">
          <button className="btn primary" disabled={!domain || !host} onClick={() => host && act(launchSite, host)}>{t("marketing.launch")}</button>
        </div>
      </>}
      {m.launched && <>
        <div className="mkt-row"><span className="mkt-label">{t("marketing.domain")}</span><span className="mkt-value num">{domain}</span></div>
        <div className="mkt-row">
          <span className="mkt-label">{t("marketing.hosting")}</span>
          <div className="mkt-grow"><HostPicker value={m.siteHost} pick={(h) => act(setSiteHost, h)} />{m.siteHost.kind === "rented" && rent}</div>
        </div>
        <div className="mkt-row"><span className="mkt-label">{t("marketing.tagline")}</span><Tagline /></div>
        <Upgrades />
      </>}
    </div>
  );
}

// Web design, its redesigns, the shop and email orders, once the site is online.
function Upgrades() {
  const game = useStore((s) => s.game);
  const act = useStore((s) => s.act);
  const current = game.marketing.designYear >= generationOf(yearOf(game.hour));
  const offer = (id: "website") => (
    <button className="btn" disabled={game.cash < OWNED[id].setup} onClick={() => act(setUpChannel, id)}>{t("marketing.setUp")} <span className="num">{euro(OWNED[id].setup)}</span></button>
  );
  const upkeep = (id: "website") => <span className="mkt-sub">{t("marketing.priceMonth", { price: euro(OWNED[id].upkeep) })}</span>;
  return <>
    <div className="mkt-row">
      <span className="mkt-label">{t("marketing.design")}</span>
      {owns(game, "website") ? <>
        <span className="mkt-grow num">{game.marketing.designYear}</span>
        <button className="btn" disabled={current || game.cash < OWNED.website.setup} onClick={() => act(redesign)}>{t("marketing.redesign")} <span className="num">{euro(OWNED.website.setup)}</span></button>
      </> : <><span className="mkt-grow">{t("marketing.webDesign")}{upkeep("website")}</span>{offer("website")}</>}
    </div>
    {owns(game, "website") && game.shop.variant && (
      <div className="mkt-row">
        <span className="mkt-label">{t("marketing.orders")}</span>
        <span className="mkt-grow">{shopById(game.shop.variant).name}</span>
      </div>
    )}
    {shopActive(game) && (
      <label className="mkt-row">
        <span className="mkt-label">{t("marketing.email")}</span>
        <span className="mkt-grow">{t("marketing.emailOrders")}</span>
        <input type="checkbox" role="switch" className="switch" aria-label={t("marketing.emailOrders")} checked={game.marketing.emailOrders}
          onChange={(e) => act(setEmailOrders, e.target.checked)} />
      </label>
    )}
  </>;
}

function LineRow({ p, addon = false }: { p: Product; addon?: boolean }) {
  const game = useStore((s) => s.game);
  const act = useStore((s) => s.act);
  const on = listed(game, p), why = lineBlocker(game, p);
  return (
    <div className={`mkt-line${addon ? " mkt-addon" : ""}`}>
      <label className="mkt-line-row">
        <span>{PRODUCT[p]}</span>
        <input type="checkbox" role="switch" className="switch" aria-label={t("marketing.listProduct", { product: PRODUCT[p] })} checked={on} disabled={!on && !!why}
          onChange={(e) => act(setLine, p, e.target.checked)} />
      </label>
      {!on && why && <p className="mkt-sub">{t(why)}</p>}
    </div>
  );
}

// The product lines listed on the website; SSL sits under web hosting as its add-on.
export function Products() {
  return (
    <div className="mkt-list">
      <div className="shop-card">
        {SITE_LINES.filter((p) => p !== "ssl").map((p) => (
          <div key={p}>
            <LineRow p={p} />
            {p === "webHosting" && <LineRow p="ssl" addon />}
          </div>
        ))}
      </div>
    </div>
  );
}
