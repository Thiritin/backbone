import { Play } from "lucide-react";
import { useState, type CSSProperties, type ReactNode } from "react";
import { t } from "../../../../i18n/en";
import { VIDEO_ARTIST, VIDEO_REAL, VIDEO_TITLE } from "../../../../sim/80-business/browser";
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

// The bank login a phishing notice reports; the form goes nowhere.
export function PhishingPage({ sender }: { sender: string }) {
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
