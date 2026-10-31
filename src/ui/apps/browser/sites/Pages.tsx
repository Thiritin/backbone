import { Play } from "lucide-react";
import { useState, type CSSProperties, type ReactNode } from "react";
import { t } from "../../../../i18n/en";
import { VIDEO_ARTIST, VIDEO_REAL, VIDEO_TITLE } from "../../../../sim/80-business/browser";
import type { GameState } from "../../../../sim/50-state";
import { customerSite } from "../../../../sim/80-business/website";
import { senderById } from "../../../../sim/40-support/notices";
import { CompanyMark } from "../../company";
import "./pages.css";
import { LOCALE } from "../../../../i18n/lang";

const hueOf = (name: string): number => [...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);

// A web hosting customer's own page, in the colour its name picks.
export function CustomerSite({ game, serviceId }: { game: GameState; serviceId: string }) {
  const site = customerSite(game, serviceId);
  if (!site) return null;
  const hue = hueOf(site.title);
  if (site.status === "defaced") {
    return (
      <div className="cs cs-defaced">
        <h1>{t("browser-sites-1.pg.hacked")}</h1>
        <p>{t("browser-sites-1.pg.greetings")}</p>
      </div>
    );
  }
  return (
    <div className="cs" style={{ "--hue": hue } as CSSProperties}>
      <header className="cs-head"><h1>{site.title}</h1></header>
      <p className="cs-blurb">{t(site.blurb)}</p>
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
        <label>{t("browser-sites-1.pg.pin")}<input type="password" /></label>
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
