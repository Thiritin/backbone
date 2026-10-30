import { Play } from "lucide-react";
import { useState, type CSSProperties } from "react";
import { t } from "../../../../i18n/en";
import { VIDEO_ARTIST, VIDEO_REAL, VIDEO_TITLE } from "../../../../sim/80-business/browser";
import type { GameState } from "../../../../sim/50-state";
import { customerSite } from "../../../../sim/80-business/website";
import { senderById } from "../../../../sim/40-support/notices";
import { CompanyMark } from "../../company";
import "./pages.css";

const hueOf = (name: string): number => [...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);

// A web hosting customer's own page, in the colour its name picks.
export function CustomerSite({ game, serviceId }: { game: GameState; serviceId: string }) {
  const site = customerSite(game, serviceId);
  if (!site) return null;
  const hue = hueOf(site.title);
  if (site.status === "defaced") {
    return (
      <div className="cs cs-defaced">
        <h1>Hacked by xX_Pwn3r_Xx</h1>
        <p>Greetings to everyone with a weak password.</p>
      </div>
    );
  }
  return (
    <div className="cs" style={{ "--hue": hue } as CSSProperties}>
      <header className="cs-head"><h1>{site.title}</h1></header>
      <p className="cs-blurb">{t(site.blurb)}</p>
      {site.sponsored && <footer className="cs-sponsor">Sponsored by <CompanyMark company={game.company} className="co-mark cs-sponsor-mark" />{game.company.name}</footer>}
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
        <button className="yt-player" aria-label="Play" onClick={() => window.open(VIDEO_REAL, "_blank", "noopener,noreferrer")}>
          <span className="yt-play"><Play aria-hidden fill="currentColor" /></span>
        </button>
        <h1>{VIDEO_TITLE}</h1>
        <div className="yt-meta">
          <span className="yt-artist"><i>R</i>{VIDEO_ARTIST}</span>
          <span className="num">{VIEWS.toLocaleString("en-US")} views</span>
          <button className="yt-like" aria-pressed={liked} onClick={() => setLiked(!liked)}>{liked ? "Liked" : "Like"}</button>
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
        <h1>Online-Banking</h1>
        <label>Branch<input inputMode="numeric" /></label>
        <label>Account<input inputMode="numeric" /></label>
        <label>PIN<input type="password" /></label>
        <button>Log in</button>
      </form>
    </div>
  );
}

export function NotFound({ host }: { host: string }) {
  return (
    <div className="br-error">
      <h1>Not found</h1>
      <p>The address {host} does not lead to a page.</p>
    </div>
  );
}

export function CannotReach({ host }: { host: string }) {
  return (
    <div className="br-error">
      <h1>Cannot reach this site</h1>
      <p>{host} took too long to respond.</p>
    </div>
  );
}

export function HostPage({ host }: { host: string }) {
  return (
    <div className="br-error">
      <h1>This host serves no web page</h1>
      <p>{host}</p>
    </div>
  );
}
