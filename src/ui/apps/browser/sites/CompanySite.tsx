import { useState, type CSSProperties, type ReactNode } from "react";
import { BookOpen, Building2, Check, CircleCheck, Cloud, Cpu, Gamepad2, Globe, HardDrive, LifeBuoy, Lock, Mail, MessagesSquare, Network, Server, ShieldCheck, Zap, type LucideIcon } from "lucide-react";
import { t } from "../../../../i18n/en";
import { START_YEAR, yearOf } from "../../../../sim/00-core/time";
import { euroCents } from "../../../../sim/00-core/money";
import { PRODUCTS } from "../../../../sim/10-catalog/products";
import type { Product } from "../../../../sim/30-customers/customers";
import { companyDomain } from "../../../../sim/30-customers/domains";
import type { GameState } from "../../../../sim/50-state";
import { salesAddress } from "../../../../sim/80-business/mail";
import { owns } from "../../../../sim/80-business/marketing";
import { packageSpec } from "../../../../sim/80-business/portal";
import { CYCLES, type Cycle } from "../../../../sim/10-catalog/cycles";
import { kbArticles, siteContent, sitePages, visibleProducts, orderLink, SITE_LINES, listed, type SitePage } from "../../../../sim/80-business/website";
import { CompanyMark } from "../../company";
import { PRODUCT } from "../../support/labels";
import { BLURB, FEATURES, KB_STEPS, THREADS } from "./companyCopy";
import { Contact, Legal, Network as NetworkPage, Status } from "./SitePages";
import { AisleArt, DeskArt, RackArt } from "./SiteArt";
import "./site.css";

const ICON: Record<Product, LucideIcon> = {
  webHosting: Globe, vps: Server, gameServer: Gamepad2, dns: Network, vpn: Lock, storage: HardDrive, cloud: Cloud,
  dedicated: Cpu, colocation: Building2, gpu: Zap, ssl: ShieldCheck, domain: Globe, reseller: Globe,
};
const CYCLE_LABEL: Record<Cycle, string> = {
  monthly: t("shop-admin.cycleMonthly"), quarterly: t("shop-admin.cycleQuarterly"), annual: t("shop-admin.cycleAnnual"), biennial: t("shop-admin.cycleBiennial"),
};
const LABEL: Record<SitePage, string> = {
  home: t("browser-sites-1.co.nav.home"), products: t("browser-sites-1.co.nav.products"), pricing: t("browser-sites-1.co.nav.pricing"), network: t("browser-sites-1.co.nav.network"), status: t("browser-sites-1.co.nav.status"), legal: t("browser-sites-1.co.nav.legal"), contact: t("browser-sites-1.co.nav.contact"), kb: t("browser-sites-1.co.nav.kb"), helpdesk: t("browser-sites-1.co.nav.helpdesk"), about: t("browser-sites-1.co.nav.about"), support: t("browser-sites-1.co.nav.support"),
};

type Go = (path: string) => void;
const A = ({ to, go, className, children }: { to: string; go: Go; className?: string; children: ReactNode }) => (
  <a href={`#${to}`} className={className} onClick={(e) => { e.preventDefault(); go(to); }}>{children}</a>
);

export function CompanySite({ game, path, go }: { game: GameState; path: string; go: (url: string) => void }) {
  const domain = companyDomain(game), pages = sitePages(game);
  const [first, second] = path.split(/[?#]/)[0].split("/").filter(Boolean);
  const page = pages.find((p) => p === first) ?? "home";
  const to: Go = (p) => go(`www.${domain}${p}`);
  const look = owns(game, "website") ? ` designed g${Math.min(2025, game.marketing.designYear)}${game.marketing.designYear >= 2021 ? " pro" : ""}` : "";
  return (
    <div className={`site${look}`} style={{ "--brand": game.company.color } as CSSProperties}>
      <header className="site-head">
        <CompanyMark company={game.company} className="co-mark site-logo" />
        <div className="site-name">
          <h1>{game.company.name}</h1>
          {game.company.tagline && <p className="site-tagline">{game.company.tagline}</p>}
        </div>
        {pages.length > 1 && (
          <nav className="site-nav">
            {pages.filter((p) => p !== "home" && p !== "support" && p !== "legal" && p !== "contact").map((p) => <A key={p} to={`/${p}`} go={to} className={p === page ? "on" : undefined}>{LABEL[p]}</A>)}
            <A to="/support" go={to} className="site-button">{LABEL.support}</A>
          </nav>
        )}
      </header>
      {page === "home" && <Home game={game} go={to} open={go} />}
      {page === "products" && <Products game={game} go={go} />}
      {page === "pricing" && <Pricing game={game} go={go} />}
      {page === "kb" && <Kb game={game} topic={second} go={to} />}
      {page === "helpdesk" && <HelpDesk game={game} />}
      {page === "network" && <NetworkPage game={game} title={LABEL.network} />}
      {page === "status" && <Status game={game} title={LABEL.status} />}
      {page === "contact" && <Contact game={game} title={LABEL.contact} />}
      {page === "legal" && <Legal game={game} title={LABEL.legal} />}
      {page === "about" && <About game={game} />}
      {page === "support" && <Support game={game} pages={pages} go={to} />}
      <footer className="site-foot">
        {pages.length > 1 && <nav>{pages.map((p) => <A key={p} to={p === "home" ? "/" : `/${p}`} go={to}>{LABEL[p]}</A>)}</nav>}
        <span>{t("browser-sites-1.co.contact")} <span className="site-link">{salesAddress(game)}</span></span>
        <span>&copy; {yearOf(game.hour)} {game.company.name}</span>
        {owns(game, "website") && game.marketing.designYear === 2005 && <span className="site-counter">{String(1000 + Math.floor(game.hour / 24) * 3).padStart(6, "0")}</span>}
      </footer>
      {owns(game, "website") && game.marketing.designYear >= 2025 && <span className="site-chat" aria-hidden><i /><i /><i /></span>}
    </div>
  );
}

function ProductCards({ game, full, go }: { game: GameState; full?: boolean; go?: (url: string) => void }) {
  const { lines } = siteContent(game);
  if (!lines.length) return <p className="site-empty">{t("browser-sites-1.co.underConstruction")}</p>;
  const designed = owns(game, "website");
  return (
    <div className={`site-products${full ? " full" : ""}`}>
      {lines.map(({ product: p, from, link }) => {
        const Icon = ICON[p];
        return (
          <section key={p} className="site-product">
            {designed && <span className="site-icon"><Icon size={20} /></span>}
            <h3>{PRODUCT[p]}</h3>
            <p>{BLURB[p]}</p>
            {full && <ul className="site-checks">{FEATURES[p].map((f) => <li key={f}><Check size={14} />{f}</li>)}</ul>}
            {from !== null && (
              <div className="site-order">
                <span>{t(PRODUCTS[p].period === "year" ? "browser-sites-1.co.fromYear" : "browser-sites-1.co.fromMonth", { price: euroCents(from) })}</span>
                {link && go ? <a href={`#${link}`} className="site-button" onClick={(e) => { e.preventDefault(); go(link); }}>{t("browser-sites-1.co.order")}</a> : null}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

function Home({ game, go, open }: { game: GameState; go: Go; open: (url: string) => void }) {
  const { lines, email } = siteContent(game), city = game.locations[0]?.city ?? "Frankfurt";
  const designed = owns(game, "website");
  const pitch = t("browser-sites-1.co.pitch", { city }), sub = t("browser-sites-1.co.sub");
  return (
    <>
      {designed ? (
        <section className="site-hero">
          <div>
            <p className="site-pitch">{pitch}</p>
            <p className="site-sub">{sub}</p>
            <div className="site-ctas">
              <A to="/products" go={go} className="site-button">{t("browser-sites-1.co.seeProducts")}</A>
              <A to="/support" go={go} className="site-button ghost">{t("browser-sites-1.co.getSupport")}</A>
            </div>
          </div>
          <RackArt />
        </section>
      ) : <p className="site-pitch">{pitch} {sub}</p>}
      <h2>{LABEL.products}</h2>
      <ProductCards game={game} go={open} />
      {designed && (
        <section className="site-band">
          <AisleArt />
          <div>
            <h2>{t("browser-sites-1.co.ownRacks", { city })}</h2>
            <p>{t("browser-sites-1.co.ownRacksText")}</p>
            <ul className="site-checks">
              <li><Check size={14} />{t("browser-sites-1.co.check1")}</li>
              <li><Check size={14} />{t("browser-sites-1.co.check2")}</li>
              <li><Check size={14} />{t("browser-sites-1.co.check3")}</li>
            </ul>
          </div>
        </section>
      )}
      {email && lines.length > 0 && (
        <>
          <h2>{t("browser-sites-1.co.contactUs")}</h2>
          <p className="site-contact">{t("browser-sites-1.co.offer")} <span className="site-link">{email}</span></p>
        </>
      )}
    </>
  );
}

function Products({ game, go }: { game: GameState; go: (url: string) => void }) {
  return (
    <>
      <PageHead title={LABEL.products} lead={t("browser-sites-1.co.productsLead")} />
      <ProductCards game={game} full go={go} />
    </>
  );
}

function Pricing({ game, go }: { game: GameState; go: (url: string) => void }) {
  const [cycle, setCycle] = useState<Cycle>("monthly");
  const open = (link: string) => (e: { preventDefault: () => void }) => { e.preventDefault(); go(link); };
  const lines = SITE_LINES.filter((p) => listed(game, p));
  return (
    <>
      <PageHead title={LABEL.pricing} lead={t("browser-sites-1.co.pricingLead")} />
      <nav className="site-cycles">
        {CYCLES.map((c) => <button key={c} className={c === cycle ? "on" : undefined} onClick={() => setCycle(c)}>{CYCLE_LABEL[c]}</button>)}
      </nav>
      {lines.map((p) => {
        const items = visibleProducts(game, p).filter((x) => x.prices[cycle] !== undefined);
        if (!items.length) return null;
        return (
          <section key={p} className="site-pricing">
            <h3>{PRODUCT[p]}</h3>
            <table>
              <thead><tr><th>{t("browser-sites-1.co.plan")}</th><th>{t("browser-sites-1.co.specs")}</th><th>{CYCLE_LABEL[cycle]}</th><th>{t("shop-admin.setupFee")}</th><th /></tr></thead>
              <tbody>
                {items.map((x) => {
                  const sp = packageSpec(game, x), link = orderLink(game, x)!;
                  return (
                    <tr key={x.id}>
                      <td>{x.name}</td>
                      <td>{t("browser-sites-1.co.spec", { cpu: sp.vcpu, ram: sp.ramGb, disk: sp.diskGb })}</td>
                      <td>{euroCents(x.prices[cycle]!)}</td>
                      <td>{x.setup ? euroCents(x.setup) : ""}</td>
                      <td><a href={`#${link}`} className="site-button" onClick={open(link)}>{t("browser-sites-1.co.order")}</a></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        );
      })}
    </>
  );
}

const PageHead = ({ title, lead }: { title: string; lead: string }) => (
  <div className="site-pagehead"><h2>{title}</h2><p>{lead}</p></div>
);

function Kb({ game, topic, go }: { game: GameState; topic?: string; go: Go }) {
  const articles = kbArticles(game), article = articles.find((a) => a.topic === topic);
  if (article) {
    return (
      <article className="site-article">
        <A to="/kb" go={go} className="site-link">{LABEL.kb}</A>
        <h2>{t(`ticket.howTo.${article.topic}.subject`, {})}</h2>
        <ol>{KB_STEPS[article.topic]?.(companyDomain(game)).map((s) => <li key={s}>{s}</li>)}</ol>
        <p className="site-muted">{t("browser-sites-1.co.readTimes", { n: article.reads })}</p>
      </article>
    );
  }
  return (
    <>
      <PageHead title={LABEL.kb} lead={t("browser-sites-1.co.kbLead")} />
      <div className="site-list">
        {articles.map((a) => (
          <A key={a.topic} to={`/kb/${a.topic}`} go={go} className="site-row">
            <BookOpen size={18} /><span>{t(`ticket.howTo.${a.topic}.subject`, {})}</span><small className="num">{t("browser-sites-1.co.reads", { n: a.reads })}</small>
          </A>
        ))}
      </div>
    </>
  );
}

function HelpDesk({ game }: { game: GameState }) {
  const threads = THREADS.filter((x) => game.marketing.lines.includes(x.product));
  return (
    <>
      <PageHead title={LABEL.helpdesk} lead={t("browser-sites-1.co.helpLead")} />
      <div className="site-list">
        {threads.map((x) => (
          <details key={x.title} className="site-thread">
            <summary>
              <MessagesSquare size={18} />
              <span><b>{x.title}</b><small>{PRODUCT[x.product]} &middot; {x.author} &middot; {t("browser-sites-1.co.replies", { n: x.replies })}</small></span>
              {x.solved && <span className="site-tag"><CircleCheck size={12} />{t("browser-sites-1.co.solved")}</span>}
            </summary>
            <p>{x.question}</p>
            <p className="site-answer"><b>{t("browser-sites-1.co.supportSays", { name: game.company.name })}</b> {x.answer}</p>
          </details>
        ))}
      </div>
    </>
  );
}

function About({ game }: { game: GameState }) {
  const city = game.locations[0]?.city ?? "Frankfurt";
  const stats: [string, number][] = [
    [t("browser-sites-1.co.statCustomers"), game.customers.filter((c) => c.churnedAt === null).length],
    [t("browser-sites-1.co.statMachines"), game.devices.length],
    [t("browser-sites-1.co.statLocations"), game.locations.length],
    [t("browser-sites-1.co.statTeam"), 1 + game.staff.length],
  ];
  return (
    <>
      <PageHead title={LABEL.about} lead={t("browser-sites-1.co.aboutLead", { year: START_YEAR, city })} />
      <section className="site-band">
        <DeskArt />
        <div>
          <p>{t("browser-sites-1.co.aboutText", { name: game.company.name })}</p>
          <dl className="site-stats">{stats.map(([k, v]) => <div key={k}><dt>{k}</dt><dd className="num">{v}</dd></div>)}</dl>
        </div>
      </section>
    </>
  );
}

function Support({ game, pages, go }: { game: GameState; pages: SitePage[]; go: Go }) {
  const address = game.company.mail.kind === "free" ? salesAddress(game) : `support@${companyDomain(game)}`;
  return (
    <>
      <PageHead title={LABEL.support} lead={t("browser-sites-1.co.supportLead")} />
      <div className="site-products">
        <section className="site-product"><span className="site-icon"><Mail size={20} /></span><h3>{t("browser-sites-1.co.writeToUs")}</h3><p>{t("browser-sites-1.co.writeText")} <span className="site-link">{address}</span></p></section>
        {pages.includes("kb") && <A to="/kb" go={go} className="site-product"><span className="site-icon"><BookOpen size={20} /></span><h3>{LABEL.kb}</h3><p>{t("browser-sites-1.co.kbCard")}</p></A>}
        {pages.includes("helpdesk") && <A to="/helpdesk" go={go} className="site-product"><span className="site-icon"><LifeBuoy size={20} /></span><h3>{LABEL.helpdesk}</h3><p>{t("browser-sites-1.co.helpCard")}</p></A>}
      </div>
    </>
  );
}
