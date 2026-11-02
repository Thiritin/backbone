import type { ReactNode } from "react";
import { t } from "../../../../../i18n/en";
import { LOCALE } from "../../../../../i18n/lang";
import { dateOf, yearOf } from "../../../../../sim/00-core/time";
import type { GameState } from "../../../../../sim/50-state";
import type { ListEntry, SiteBody } from "../../../../../sim/80-business/webspace-sites";
import { CustomerSite } from "../Pages";
import "./webspace.css";

type Body<K extends SiteBody["kind"]> = Extract<SiteBody, { kind: K }>;
const hashOf = (text: string): number => [...text].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7) >>> 0;
const day = (hour: number) => dateOf(hour).toLocaleDateString(LOCALE, { timeZone: "UTC", dateStyle: "long" });
const stamp = (hour: number) => dateOf(hour).toLocaleString(LOCALE, { timeZone: "UTC", dateStyle: "short", timeStyle: "short" });
const apache = (year: number) => (year < 2008 ? "2.0.59" : year < 2017 ? "2.2.22" : "2.4.25");

// The page title the Browser shows for a site.
export function siteTitle(body: SiteBody): string {
  switch (body.kind) {
    case "app": return body.app === "wordpass" ? `${body.title} | ${t("ws.wp.tagline")}` : body.title;
    case "error":
      if (body.error === "db") return body.app === "wordpass" ? t("ws.err.wp.title") : body.app === "drupel" ? t("ws.err.dr.old.title") : t("ws.err.jo");
      return body.error === "suspended" ? t("ws.err.susp.title") : body.error === "http500" ? t("ws.err.500.title") : body.domain;
    case "index": return body.listing ? t("ws.idx.title") : t(`ws.ph.${body.panel}.title`);
    default: return body.kind === "static" ? body.domain : "";
  }
}

export function WebspaceSite({ game, body }: { game: GameState; body: SiteBody }) {
  const year = yearOf(game.hour);
  switch (body.kind) {
    case "customer": return <CustomerSite game={game} serviceId={body.serviceId} />;
    case "static": return <div className="wsx wsx-plain"><h1>{body.domain}</h1></div>;
    case "app": return body.app === "wordpass" ? <WordPrass game={game} body={body} year={year} /> : body.app === "joomlah" ? <Joomlah body={body} year={year} /> : <Drupel body={body} year={year} />;
    case "error": return <ErrorPage body={body} year={year} />;
    case "index": return body.listing ? <Listing body={body} listing={body.listing} year={year} /> : <Placeholder body={body} />;
  }
}

// WordPrass shows its Hello world post, and the older a site, the more posts its owner wrote.
function WordPrass({ game, body, year }: { game: GameState; body: Body<"app">; year: number }) {
  const seed = hashOf(body.domain), look = year < 2010 ? "k" : year < 2013 ? "t10" : year < 2019 ? "t14" : "t19";
  const extra = Math.min(4, seed % 5, Math.floor((game.hour - body.since) / (24 * 45)));
  const posts = [{ title: t("ws.wp.hello"), text: t("ws.wp.helloBody"), at: body.since, hello: true },
    ...Array.from({ length: extra }, (_, i) => ({ title: t(`ws.post.${(seed + i) % 4}.title`), text: t(`ws.post.${(seed + i) % 4}.body`), at: body.since + (i + 1) * 24 * 45, hello: false }))].reverse();
  return (
    <div className={`wsx wp wp-${look}`}>
      <header className="wp-head"><h1>{body.title}</h1><p>{t("ws.wp.tagline")}</p>
        <nav><a>{t("ws.home")}</a><a>{t("ws.wp.page")}</a></nav></header>
      <div className="wp-cols">
        <main>{posts.map((p) => (
          <article key={p.title}>
            <h2>{p.title}</h2>
            <small>{t("ws.wp.postedOn", { date: day(p.at) })}</small>
            <p>{p.text}</p>
            <footer>{t("ws.wp.uncategorized")}{p.hello ? ` | ${t("ws.wp.comment")}` : ""}</footer>
            {p.hello && year >= 2019 && <blockquote><b>{t("ws.wp.commentAuthor")}</b> {t("ws.wp.commentBody")}</blockquote>}
          </article>))}</main>
        <aside>
          <h3>{t("ws.search")}</h3><input aria-label={t("ws.search")} />
          <h3>{t("ws.wp.recentPosts")}</h3><ul>{posts.map((p) => <li key={p.title}><a>{p.title}</a></li>)}</ul>
          <h3>{t("ws.wp.recentComments")}</h3><ul><li>{t("ws.wp.commentAuthor")}</li></ul>
          <h3>{t("ws.wp.archives")}</h3><ul><li><a>{dateOf(body.since).toLocaleDateString(LOCALE, { timeZone: "UTC", month: "long", year: "numeric" })}</a></li></ul>
          <h3>{t("ws.wp.categories")}</h3><ul><li><a>{t("ws.wp.uncategorized")}</a></li></ul>
          <h3>{t("ws.wp.meta")}</h3><ul><li><a>{t("ws.login")}</a></li><li><a>{t("ws.rss.entries")}</a></li><li><a>{t("ws.rss.comments")}</a></li></ul>
        </aside>
      </div>
      <footer className="wp-foot">{look === "k" ? t("ws.wp.poweredBy", { name: body.title }) : t("ws.wp.powered")}</footer>
    </div>
  );
}

function Joomlah({ body, year }: { body: Body<"app">; year: number }) {
  const look = year < 2012 ? "m" : year < 2021 ? "p" : "c";
  return (
    <div className={`wsx jo jo-${look}`}>
      <header><h1>{body.title}</h1><nav><a>{t("ws.home")}</a>{look === "m" && <a>{t("ws.jo.overview")}</a>}</nav></header>
      <div className="jo-cols">
        <aside>
          {look === "m" && <><h3>{t("ws.jo.mainMenu")}</h3><ul><li><a>{t("ws.home")}</a></li><li><a>{t("ws.jo.overview")}</a></li></ul></>}
          <h3>{t("ws.jo.login")}</h3>
          <label>{t("ws.username")}<input /></label><label>{t("ws.password")}<input type="password" /></label>
          <label className="jo-rem"><input type="checkbox" />{t("ws.jo.remember")}</label><button>{t("ws.login")}</button>
          <a>{t("ws.jo.forgot")}</a>
        </aside>
        <main><h2>{look === "m" ? t("ws.jo.frontpage") : t("ws.jo.welcome")}</h2><p>{t("ws.jo.intro")}</p></main>
      </div>
      <footer>{look === "m" ? t("ws.jo.gpl") : <>{t("ws.backToTop")}<br />© {year} {body.title}</>}</footer>
    </div>
  );
}

function Drupel({ body, year }: { body: Body<"app">; year: number }) {
  const look = year < 2011 ? "g" : year < 2021 ? "b" : "o";
  return (
    <div className={`wsx dr dr-${look}`}>
      <header><h1>{body.title}</h1><nav><a>{t("ws.home")}</a></nav></header>
      <div className="dr-cols">
        <aside>
          <h3>{look === "o" ? t("ws.login") : t("ws.dr.userLogin")}</h3>
          <label>{t("ws.username")}<input /></label><label>{t("ws.password")}<input type="password" /></label>
          <button>{t("ws.login")}</button>
          {look !== "o" && <ul><li><a>{t("ws.dr.createAccount")}</a></li><li><a>{t("ws.dr.requestPw")}</a></li></ul>}
        </aside>
        {look === "g"
          ? <main><h2>{t("ws.dr.welcomeOld")}</h2><p>{t("ws.dr.follow")}</p><ol>{[1, 2, 3, 4].map((n) => <li key={n}>{t(`ws.dr.step${n}`)}</li>)}</ol></main>
          : <main><h2>{t("ws.dr.welcome", { name: body.title })}</h2><p>{t("ws.dr.empty")}</p><p><a>{t("ws.dr.add")}</a></p></main>}
      </div>
      <footer>{t("ws.dr.powered")}</footer>
    </div>
  );
}

// The line number of the include that fails, per app.
const LINE = { wordpass: 17, joomlah: 31, drupel: 19, static: 1 };

function ErrorPage({ body, year }: { body: Body<"error">; year: number }) {
  const { app, domain, home, detail } = body;
  if (body.error === "suspended") {
    return <div className="wsx wsx-susp"><h1>{t("ws.err.susp.title")}</h1><p>{t("ws.err.susp.body")}</p><p>{t("ws.err.susp.contact")}</p></div>;
  }
  if (body.error === "http500") {
    return (
      <div className="wsx wsx-apache"><h1>{t("ws.err.500.title")}</h1><p>{t("ws.err.500.body")}</p>
        <p>{t("ws.err.500.contact", { mail: `webmaster@${domain}` })}</p><p>{t("ws.err.500.more")}</p>
        <hr /><address>{t("ws.err.apache", { v: apache(year), host: domain })}</address></div>
    );
  }
  if (body.error === "fatal") {
    const script = `${home}/index.php`, line = LINE[app ?? "static"];
    return (
      <div className="wsx wsx-php">
        {year < 2021 && <p><b>{t("ws.err.php.warning")}</b>: {t("ws.err.php.stream", { file: detail, script, line })}</p>}
        <p><b>{t("ws.err.php.fatal")}</b>: {t(year < 2021 ? "ws.err.php.required" : "ws.err.php.required8", { file: detail, script, line })}</p>
      </div>
    );
  }
  if (app === "wordpass") {
    return (
      <div className="wsx wsx-wperr"><h1>{t("ws.err.wp.title")}</h1><p>{t("ws.err.wp.body", { file: "wp-config.php" })}</p>
        <ul><li>{t("ws.err.wp.q1")}</li><li>{t("ws.err.wp.q2")}</li><li>{t("ws.err.wp.q3")}</li></ul><p>{t("ws.err.wp.help")}</p></div>
    );
  }
  if (app === "drupel") {
    return year < 2011
      ? <div className="wsx wsx-drerr"><h2>{t("ws.err.dr.old.title")}</h2><p>{t("ws.err.dr.old.body")}</p></div>
      : <div className="wsx wsx-plain"><p>{t("ws.err.dr.pdo", { db: detail, script: `${home}/includes/lock.inc` })}</p></div>;
  }
  return <div className="wsx wsx-plain"><p>{t("ws.err.jo")}</p></div>;
}

const sizeOf = (e: ListEntry): string => (e.dir ? "-" : e.mb >= 1 ? `${e.mb.toFixed(1)}M` : `${Math.max(1, Math.round(e.mb * 1024))}K`);

function Listing({ body, listing, year }: { body: Body<"index">; listing: ListEntry[]; year: number }) {
  return (
    <div className="wsx wsx-apache">
      <h1>{t("ws.idx.title")}</h1>
      <table><thead><tr><th>{t("ws.idx.name")}</th><th>{t("ws.idx.modified")}</th><th>{t("ws.idx.size")}</th><th>{t("ws.idx.desc")}</th></tr></thead>
        <tbody>{listing.map((e) => <tr key={e.name}><td><a>{e.name}{e.dir ? "/" : ""}</a></td><td>{stamp(e.at)}</td><td>{sizeOf(e)}</td><td /></tr>)}</tbody></table>
      <hr /><address>{t("ws.err.apache", { v: apache(year), host: body.domain })}</address>
    </div>
  );
}

// Each panel's page for a folder nobody has filled yet.
function Placeholder({ body }: { body: Body<"index"> }): ReactNode {
  return <div className={`wsx wsx-ph wsx-ph-${body.panel}`}><h1>{t(`ws.ph.${body.panel}.title`)}</h1><p>{t(`ws.ph.${body.panel}.body`)}</p></div>;
}
