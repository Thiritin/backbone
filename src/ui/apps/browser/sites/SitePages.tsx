import { t } from "../../../../i18n/en";
import type { Product } from "../../../../sim/30-customers/customers";
import { addressFor } from "../../../../sim/30-customers/addresses";
import { companyDomain } from "../../../../sim/30-customers/domains";
import { datacenterById } from "../../../../sim/20-world/datacenters";
import type { GameState } from "../../../../sim/50-state";
import { v6Offered } from "../../../../sim/60-infra/addresses";
import { capacityMbps } from "../../../../sim/60-infra/network";
import { salesAddress } from "../../../../sim/80-business/mail";
import { LEGAL_FORMS } from "../../../../sim/80-business/office";
import { statusBars, statusNow, type LineState } from "../../../../sim/80-business/status";
import { listed, SITE_LINES } from "../../../../sim/80-business/website";
import { PRODUCT } from "../../support/labels";

const Head = ({ title, lead }: { title: string; lead: string }) => <div className="site-pagehead"><h2>{title}</h2><p>{lead}</p></div>;

// Uplink capacity as a marketing figure: the largest of 1, 2, 5, 10, 20, 50, 100 ... Gbit/s that fits.
const marketingGbit = (mbps: number): number => {
  const gbit = mbps / 1000;
  let best = 1;
  for (let m = 1; m <= gbit; m *= 10) for (const k of [1, 2, 5]) if (m * k <= gbit) best = m * k;
  return best;
};

export function Network({ game, title }: { game: GameState; title: string }) {
  const rows = game.locations.filter((l) => l.dc);
  return (
    <>
      <Head title={title} lead={t("browser-sites-1.co.networkLead")} />
      <div className="site-products full">
        {rows.map((l) => {
          const dc = datacenterById(l.dc!), up = game.network.uplinks.filter((u) => u.locationId === l.id).reduce((n, u) => n + capacityMbps(u), 0);
          const tier = dc.certified ? 3 : dc.feeds === "ab" ? 2 : 1;
          return (
            <section key={l.id} className="site-product">
              <h3>{dc.city}</h3>
              <ul className="site-checks">
                <li>{t("browser-sites-1.co.tier", { n: tier })}</li>
                <li>{t(dc.feeds === "ab" ? "browser-sites-1.co.powerAb" : "browser-sites-1.co.powerSingle")}</li>
                <li>{t(`browser-sites-1.co.backup.${dc.backup}`)}</li>
                {up >= 1000 && <li>{t("browser-sites-1.co.uplink", { gbit: marketingGbit(up) })}</li>}
                <li>{t("browser-sites-1.co.carriers", { n: dc.carriers })}</li>
                {v6Offered(game, l) && <li>{t("browser-sites-1.co.ipv6")}</li>}
                {game.network.protection !== "none" && <li>{t("browser-sites-1.co.ddos")}</li>}
              </ul>
            </section>
          );
        })}
      </div>
    </>
  );
}

const STATE_LABEL: Record<LineState, string> = {
  ok: t("browser-sites-1.co.statusOk"), slow: t("browser-sites-1.co.statusSlow"), down: t("browser-sites-1.co.statusDown"), maint: t("browser-sites-1.co.statusMaint"),
};

export function Status({ game, title }: { game: GameState; title: string }) {
  const now = statusNow(game), lines = SITE_LINES.filter((p: Product) => listed(game, p));
  return (
    <>
      <Head title={title} lead={t("browser-sites-1.co.statusLead")} />
      <div className="site-list">
        {lines.map((p) => {
          const st = now.get(p) ?? "ok";
          return (
            <div key={p} className="site-status">
              <span className="site-status-head"><b>{PRODUCT[p]}</b><span className={`site-state ${st}`}>{STATE_LABEL[st]}</span></span>
              <span className="site-bars">{statusBars(game, p).map((b, i) => <i key={i} className={b} title={STATE_LABEL[b]} />)}</span>
            </div>
          );
        })}
      </div>
    </>
  );
}

export function Legal({ game, title }: { game: GameState; title: string }) {
  const r = game.registration, city = game.locations[0]?.city ?? "Frankfurt";
  const own = addressFor(game.seed, 0, r?.owner ?? game.company.name, game.company.name, city);
  return (
    <>
      <Head title={title} lead={t("browser-sites-1.co.legalLead")} />
      <section className="site-legal">
        <h3>{t("browser-sites-1.co.imprint")}</h3>
        <p>{game.company.name}{r && LEGAL_FORMS[r.form] ? ` (${LEGAL_FORMS[r.form]})` : ""}<br />{own.street}<br />{own.zip} {own.city}</p>
        {r && <p>{t("browser-sites-1.co.legalOwner", { owner: r.owner })}<br />{t("browser-sites-1.co.legalNumber", { number: r.number })}</p>}
        <h3>{t("browser-sites-1.co.terms")}</h3>
        <p>{t("browser-sites-1.co.termsText", { name: game.company.name })}</p>
        <h3>{t("browser-sites-1.co.privacy")}</h3>
        <p>{t("browser-sites-1.co.privacyText", { name: game.company.name })}</p>
      </section>
    </>
  );
}

export function Contact({ game, title }: { game: GameState; title: string }) {
  const support = game.company.mail.kind === "free" ? salesAddress(game) : `support@${companyDomain(game)}`;
  const own = addressFor(game.seed, 0, game.registration?.owner ?? game.company.name, game.company.name, game.locations[0]?.city ?? "Frankfurt");
  return (
    <>
      <Head title={title} lead={t("browser-sites-1.co.contactLead")} />
      <dl className="site-stats">
        <div><dt>{t("browser-sites-1.co.sales")}</dt><dd>{salesAddress(game)}</dd></div>
        <div><dt>{t("browser-sites-1.co.nav.support")}</dt><dd>{support}</dd></div>
        <div><dt>{t("browser-sites-1.co.address")}</dt><dd>{own.street}, {own.zip} {own.city}</dd></div>
      </dl>
    </>
  );
}
