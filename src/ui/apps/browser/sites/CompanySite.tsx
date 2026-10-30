import type { CSSProperties, ReactNode } from "react";
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
import { kbArticles, siteContent, sitePages, type SitePage } from "../../../../sim/80-business/website";
import { CompanyMark } from "../../company";
import { PRODUCT } from "../../support/labels";
import { BLURB, FEATURES, KB_STEPS, THREADS } from "./companyCopy";
import { AisleArt, DeskArt, RackArt } from "./SiteArt";
import "./site.css";

const ICON: Record<Product, LucideIcon> = {
  webHosting: Globe, vps: Server, gameServer: Gamepad2, dns: Network, vpn: Lock, storage: HardDrive, cloud: Cloud,
  dedicated: Cpu, colocation: Building2, gpu: Zap, ssl: ShieldCheck, domain: Globe,
};
const LABEL: Record<SitePage, string> = { home: "Home", products: "Products", kb: "Knowledge base", helpdesk: "Help desk", about: "About us", support: "Support" };

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
            {pages.filter((p) => p !== "home" && p !== "support").map((p) => <A key={p} to={`/${p}`} go={to} className={p === page ? "on" : undefined}>{LABEL[p]}</A>)}
            <A to="/support" go={to} className="site-button">Support</A>
          </nav>
        )}
      </header>
      {page === "home" && <Home game={game} go={to} />}
      {page === "products" && <Products game={game} />}
      {page === "kb" && <Kb game={game} topic={second} go={to} />}
      {page === "helpdesk" && <HelpDesk game={game} />}
      {page === "about" && <About game={game} />}
      {page === "support" && <Support game={game} pages={pages} go={to} />}
      <footer className="site-foot">
        {pages.length > 1 && <nav>{pages.map((p) => <A key={p} to={p === "home" ? "/" : `/${p}`} go={to}>{LABEL[p]}</A>)}</nav>}
        <span>Contact: <span className="site-link">{salesAddress(game)}</span></span>
        <span>&copy; {yearOf(game.hour)} {game.company.name}</span>
        {owns(game, "website") && game.marketing.designYear === 2005 && <span className="site-counter">{String(1000 + Math.floor(game.hour / 24) * 3).padStart(6, "0")}</span>}
      </footer>
      {owns(game, "website") && game.marketing.designYear >= 2025 && <span className="site-chat" aria-hidden><i /><i /><i /></span>}
    </div>
  );
}

function ProductCards({ game, full }: { game: GameState; full?: boolean }) {
  const { lines } = siteContent(game);
  if (!lines.length) return <p className="site-empty">This page is under construction.</p>;
  const designed = owns(game, "website");
  return (
    <div className={`site-products${full ? " full" : ""}`}>
      {lines.map(({ product: p, from }) => {
        const Icon = ICON[p];
        return (
          <section key={p} className="site-product">
            {designed && <span className="site-icon"><Icon size={20} /></span>}
            <h3>{PRODUCT[p]}</h3>
            <p>{BLURB[p]}</p>
            {full && <ul className="site-checks">{FEATURES[p].map((f) => <li key={f}><Check size={14} />{f}</li>)}</ul>}
            {from !== null && (
              <div className="site-order">
                <span>from <b className="num">{euroCents(from)}</b> {PRODUCTS[p].period === "year" ? "a year" : "a month"}</span>
                <span className="site-button">Order</span>
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

function Home({ game, go }: { game: GameState; go: Go }) {
  const { lines, email } = siteContent(game), city = game.locations[0]?.city ?? "Frankfurt";
  const designed = owns(game, "website");
  const pitch = `Web hosting and servers from ${city}.`, sub = "Our machines run day and night, and so do we.";
  return (
    <>
      {designed ? (
        <section className="site-hero">
          <div>
            <p className="site-pitch">{pitch}</p>
            <p className="site-sub">{sub}</p>
            <div className="site-ctas">
              <A to="/products" go={go} className="site-button">See products</A>
              <A to="/support" go={go} className="site-button ghost">Get support</A>
            </div>
          </div>
          <RackArt />
        </section>
      ) : <p className="site-pitch">{pitch} {sub}</p>}
      <h2>Products</h2>
      <ProductCards game={game} />
      {designed && (
        <section className="site-band">
          <AisleArt />
          <div>
            <h2>Our own racks in {city}</h2>
            <p>Every server runs on hardware we bought, built and look after ourselves. When something breaks, a person from our team is on the way.</p>
            <ul className="site-checks">
              <li><Check size={14} />Monitored around the clock</li>
              <li><Check size={14} />Backups on separate disks</li>
              <li><Check size={14} />Support from the people who run the machines</li>
            </ul>
          </div>
        </section>
      )}
      {email && lines.length > 0 && (
        <>
          <h2>Contact us</h2>
          <p className="site-contact">Tell us what you need and we will send you an offer: <span className="site-link">{email}</span></p>
        </>
      )}
    </>
  );
}

function Products({ game }: { game: GameState }) {
  return (
    <>
      <PageHead title="Products" lead="Choose the plan that fits your project. You can move to a larger one at any time." />
      <ProductCards game={game} full />
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
        <A to="/kb" go={go} className="site-link">Knowledge base</A>
        <h2>{t(`ticket.howTo.${article.topic}.subject`, {})}</h2>
        <ol>{KB_STEPS[article.topic]?.(companyDomain(game)).map((s) => <li key={s}>{s}</li>)}</ol>
        <p className="site-muted">Read {article.reads} times</p>
      </article>
    );
  }
  return (
    <>
      <PageHead title="Knowledge base" lead="Find answers to the questions our customers ask most." />
      <div className="site-list">
        {articles.map((a) => (
          <A key={a.topic} to={`/kb/${a.topic}`} go={go} className="site-row">
            <BookOpen size={18} /><span>{t(`ticket.howTo.${a.topic}.subject`, {})}</span><small className="num">{a.reads} reads</small>
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
      <PageHead title="Help desk" lead="Read what other customers asked and how our support team answered." />
      <div className="site-list">
        {threads.map((x) => (
          <details key={x.title} className="site-thread">
            <summary>
              <MessagesSquare size={18} />
              <span><b>{x.title}</b><small>{PRODUCT[x.product]} &middot; {x.author} &middot; {x.replies} replies</small></span>
              {x.solved && <span className="site-tag"><CircleCheck size={12} />Solved</span>}
            </summary>
            <p>{x.question}</p>
            <p className="site-answer"><b>{game.company.name} support:</b> {x.answer}</p>
          </details>
        ))}
      </div>
    </>
  );
}

function About({ game }: { game: GameState }) {
  const city = game.locations[0]?.city ?? "Frankfurt";
  const stats: [string, number][] = [
    ["Customers", game.customers.filter((c) => c.churnedAt === null).length],
    ["Machines", game.devices.length],
    ["Locations", game.locations.length],
    ["Team", 1 + game.staff.length],
  ];
  return (
    <>
      <PageHead title="About us" lead={`We started in ${START_YEAR} with one server in a basement in ${city}.`} />
      <section className="site-band">
        <DeskArt />
        <div>
          <p>Today {game.company.name} runs web hosting and servers for customers from small clubs to growing companies. We still build every machine ourselves and answer every ticket from our own office.</p>
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
      <PageHead title="Support" lead="Our team answers every request, usually on the same day." />
      <div className="site-products">
        <section className="site-product"><span className="site-icon"><Mail size={20} /></span><h3>Write to us</h3><p>Send your question with your customer number to <span className="site-link">{address}</span>.</p></section>
        {pages.includes("kb") && <A to="/kb" go={go} className="site-product"><span className="site-icon"><BookOpen size={20} /></span><h3>Knowledge base</h3><p>Follow our step-by-step guides for the most common tasks.</p></A>}
        {pages.includes("helpdesk") && <A to="/helpdesk" go={go} className="site-product"><span className="site-icon"><LifeBuoy size={20} /></span><h3>Help desk</h3><p>Browse questions from other customers and our answers.</p></A>}
      </div>
    </>
  );
}
