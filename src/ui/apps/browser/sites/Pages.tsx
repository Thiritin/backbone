import { Play } from "lucide-react";
import { useState, type CSSProperties, type ReactNode } from "react";
import { t } from "../../../../i18n/en";
import { split, VIDEO_ARTIST, VIDEO_REAL, VIDEO_TITLE } from "../../../../sim/80-business/browser";
import { dateOf } from "../../../../sim/00-core/time";
import type { GameState } from "../../../../sim/50-state";
import { customerSite, siteHost } from "../../../../sim/80-business/website";
import { yearOf } from "../../../../sim/00-core/time";
import { CustomerBlock, type BlockCtx } from "./CustomerBlocks";
import { senderById } from "../../../../sim/40-support/notices";
import { CompanyMark } from "../../company";
import "./pages.css";
import "./customer.css";
import { LOCALE } from "../../../../i18n/lang";
import { noAutofill } from "../../../no-autofill";

// A web hosting customer's own page, laid out from the design its period and position pick.
export function CustomerSite({ game, serviceId }: { game: GameState; serviceId: string }) {
  const site = customerSite(game, serviceId);
  const [dark, setDark] = useState(false);
  const [cart, setCart] = useState(0);
  if (!site) return null;
  if (site.status === "defaced") {
    return (
      <div className="cs cs-defaced">
        <h1>{t("browser-sites-1.pg.hacked")}</h1>
        <p>{t("browser-sites-1.pg.greetings")}</p>
      </div>
    );
  }
  const { layout, scheme, blocks, period } = site.design;
  const v = game.services.find((x) => x.id === serviceId);
  const ctx: BlockCtx = {
    name: site.title, domain: v?.domain ?? siteHost(game, serviceId) ?? "", year: yearOf(game.hour), blurb: site.blurb,
    seed: [...site.title].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, period + 7), dark, setDark, cart, addToCart: () => setCart((n) => n + 1),
  };
  const variant = dark ? "dark" : scheme.variant;
  return (
    <div className={`csx cs-${layout} cs-scheme-${variant} cs-p${period}`} style={{ "--hue": scheme.hue } as CSSProperties}>
      <header className="csx-head"><h1>{site.title}</h1></header>
      <main className="cs-body">{blocks.map((b) => <CustomerBlock key={b} id={b} c={ctx} />)}</main>
      {site.sponsored && <footer className="cs-sponsor">{t("browser-sites-1.pg.sponsored")} <CompanyMark company={game.company} className="co-mark cs-sponsor-mark" />{game.company.name}</footer>}
    </div>
  );
}

const VIEWS = 1_402_118_730;

// The easter egg: a video site with a single video; Play opens the real one in a new tab.
export function VideoPage() {
  const [liked, setLiked] = useState(false);
  return (
    <div className="yt">
      <header className="yt-head">
        <span className="yt-logo"><i><Play aria-hidden /></i>YouTub</span>
      </header>
      <div className="yt-body">
        <button className="yt-player" aria-label={t("browser-sites-1.pg.play")} onClick={() => window.open(VIDEO_REAL, "_blank", "noopener,noreferrer")}>
          <span className="yt-play"><Play aria-hidden fill="currentColor" /></span>
        </button>
        <h1>{VIDEO_TITLE}</h1>
        <div className="yt-meta">
          <span className="yt-artist"><i>R</i>{VIDEO_ARTIST}</span>
          <span className="num">{t("browser-sites-1.pg.views", { n: VIEWS.toLocaleString(LOCALE) })}</span>
          <button className="yt-like" aria-pressed={liked} onClick={() => setLiked(!liked)}>{liked ? t("browser-sites-1.pg.liked") : t("browser-sites-1.pg.like")}</button>
        </div>
      </div>
    </div>
  );
}

// What a notice's address shows: its host, folder, file and a date to stamp it with.
function reported(game: GameState, ticketId: string) {
  const tk = game.tickets.find((x) => x.id === ticketId);
  if (!tk?.notice) return null;
  const { host, path } = split(tk.notice.url), cut = path.lastIndexOf("/");
  const date = dateOf(tk.createdAt).toLocaleString(LOCALE, { timeZone: "UTC", dateStyle: "medium", timeStyle: "short" });
  return { tk, host, dir: path.slice(0, cut) || "/", file: path.slice(cut + 1), date };
}

const humanize = (slug: string) => slug.charAt(0).toUpperCase() + slug.slice(1).replace(/-/g, " ");

export function noticeTitle(game: GameState, ticketId: string): string {
  const r = reported(game, ticketId);
  if (!r) return "";
  switch (r.tk.topic) {
    case "phishing": return t("misc1.browser.onlineBanking", { name: senderById(r.tk.notice!.sender).name });
    case "youtuber": return humanize(r.file);
    case "spam": return r.file;
    default: return t("browser-sites-1.pg.indexOf", { dir: r.dir });
  }
}

// The page a notice reports, as it stands until the player takes it down.
export function NoticePage({ game, ticketId }: { game: GameState; ticketId: string }) {
  const r = reported(game, ticketId);
  if (!r) return null;
  const { tk, host, dir, file, date } = r;
  if (tk.topic === "phishing") return <PhishingPage sender={tk.notice!.sender} />;
  if (tk.topic === "spam") return (
    <div className="ap">
      <h1>{file}</h1>
      <form className="ap-mailer" onSubmit={(e) => e.preventDefault()}>
        <label>{t("browser-sites-1.pg.recipients")}<textarea rows={6} {...noAutofill} /></label>
        <label>{t("browser-sites-1.pg.subject")}<input {...noAutofill} /></label>
        <label>{t("browser-sites-1.pg.message")}<textarea rows={8} {...noAutofill} /></label>
        <button>{t("browser-sites-1.pg.send")}</button>
      </form>
    </div>
  );
  if (tk.topic === "youtuber") return (
    <article className="ap-post">
      <h1>{humanize(file)}</h1>
      <p className="ap-date">{t("browser-sites-1.pg.posted", { date })}</p>
      <p>{t("browser-sites-1.pg.criticism")}</p>
    </article>
  );
  return (
    <div className="ap">
      <h1>{t("browser-sites-1.pg.indexOf", { dir })}</h1>
      <table className="ap-index">
        <thead><tr><th>{t("browser-sites-1.pg.colName")}</th><th>{t("browser-sites-1.pg.colModified")}</th><th>{t("browser-sites-1.pg.colSize")}</th></tr></thead>
        <tbody>
          <tr><td><a href="#" onClick={(e) => e.preventDefault()}>{t("browser-sites-1.pg.parentDir")}</a></td><td /><td /></tr>
          <tr><td><a href="#" onClick={(e) => e.preventDefault()}>{file}</a></td><td>{date}</td><td>{tk.topic === "movie" ? "412M" : "68M"}</td></tr>
        </tbody>
      </table>
      <address>{t("browser-sites-1.pg.apache", { host })}</address>
    </div>
  );
}

// The bank login a phishing notice reports; the form goes nowhere.
function PhishingPage({ sender }: { sender: string }) {
  const bank = senderById(sender);
  return (
    <div className="bk">
      <header className="bk-head"><i>/</i>{bank.name}</header>
      <form className="bk-form" onSubmit={(e) => e.preventDefault()}>
        <h1>{t("browser-sites-1.pg.banking")}</h1>
        <label>{t("browser-sites-1.pg.branch")}<input inputMode="numeric" /></label>
        <label>{t("browser-sites-1.pg.account")}<input inputMode="numeric" /></label>
        <label>{t("browser-sites-1.pg.pin")}<input type="password" {...noAutofill} /></label>
        <button>{t("browser-sites-1.pg.login")}</button>
      </form>
    </div>
  );
}

export function NotFound({ host }: { host: string }) {
  return (
    <div className="br-error">
      <h1>{t("browser-sites-1.pg.notFound")}</h1>
      <p>{t("browser-sites-1.pg.notFoundText", { host })}</p>
    </div>
  );
}

export function CannotReach({ host }: { host: string }) {
  return (
    <div className="br-error">
      <h1>{t("browser-sites-1.pg.cannotReach")}</h1>
      <p>{t("browser-sites-1.pg.timeout", { host })}</p>
    </div>
  );
}

export function HostPage({ host, children }: { host: string; children?: ReactNode }) {
  return (
    <div className="br-error">
      <h1>{t("browser-sites-1.pg.noPage")}</h1>
      <p>{host}</p>
      {children}
    </div>
  );
}
