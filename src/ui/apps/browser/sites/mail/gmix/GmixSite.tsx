import { useEffect, useState, type MouseEvent, type ReactNode } from "react";
import { t } from "../../../../../../i18n/en";
import { LOCALE } from "../../../../../../i18n/lang";
import { dateOf, nextMonthStart, yearOf } from "../../../../../../sim/00-core/time";
import { mailSiteUrl } from "../../../../../../sim/10-catalog/mail-consumer";
import { GMIX_OFFER, mailHost, mailPlan, quotaMbAt } from "../../../../../../sim/10-catalog/mail-providers";
import { checkMailLogin } from "../../../../../../sim/42-mail/accounts";
import { capsOf } from "../../../../../../sim/42-mail/caps";
import { GMIX_DOMAIN } from "../../../../../../sim/42-mail/new";
import type { MailAccount, MailTenant } from "../../../../../../sim/42-mail/types";
import type { GameState } from "../../../../../../sim/50-state";
import { sky } from "../../../../../../sim/20-world/weather";
import { VIDEO_URL } from "../../../../../../sim/80-business/browser";
import { gmixSuggestions } from "../../../../../../sim/80-business/mail-provider";
import { feed } from "../../../../../../sim/80-business/news";
import { acceptGmixOffer, deleteGmixMailbox, setGmixTier, signUpGmix } from "../../../../../../sim/90-actions/mail-provider";
import { LeftBehind } from "../switching";
import { changePassword, requestPasswordReset, resetPassword } from "../../../../../../sim/90-actions/mailbox";
import { GMixMark } from "../../../../../art/mailmarks";
import { readSession, useSessionState, writeSession } from "../../../../../session";
import { offerLogin, savedLogin } from "../../../../../vault";
import { degrees } from "../../../../weather/WeatherApp";
import { usePageAct } from "../../../pageAct";
import { eraAtHour } from "../../era";
import { GmixMail } from "./GmixMail";
import "./gmix.css";

// docs/design/plans/webmail-consumer.md, sections 3.2 to 3.5 and 5: the GMix portal in its three looks.
const ERAS = [{ from: "2005-01", look: "frames" }, { from: "2012-03", look: "navigator" }, { from: "2018-09", look: "flat" }] as const;
export type GmixLook = (typeof ERAS)[number]["look"];
export const gmixLook = (hour: number): GmixLook => eraAtHour([...ERAS], hour);

const TIERS = ["free", "pro", "top"] as const;
const TIER_PAGES: Record<string, (typeof TIERS)[number]> = { freemix: "free", promix: "pro", topmix: "top" };
const SUPPORT = { free: "forum", pro: "email", top: "phone" } as const;
const HOME_CITY = "Frankfurt";
const SITE = "www.gmix.net";
const GOGGLE_URL = "www.goggle.com/";

const planName = (id: string) => t(`mail.gmix.plan.${id}`);
const day = (hour: number) => dateOf(hour).toLocaleDateString(LOCALE, { timeZone: "UTC" });
const tenantOf = (game: GameState, a: MailAccount): MailTenant | undefined => game.mail.tenants.find((x) => x.id === a.tenant);

interface SiteProps { game: GameState; path: string; go: (url: string) => void }
type To = (path: string) => void;

function Link({ to, path, children, className }: { to: To; path: string; children: ReactNode; className?: string }) {
  const click = (e: MouseEvent) => { e.preventDefault(); to(path); };
  return <a href={`#${path}`} className={className} onClick={click}>{children}</a>;
}

export function GmixSite({ game, path, go }: SiteProps) {
  const [route, query = ""] = path.replace(/^\/+/, "").split("?");
  const params = new URLSearchParams(query), look = gmixLook(game.hour);
  const to: To = (p) => go(mailSiteUrl("gmix", p));
  const [signedIn, setSession] = useSessionState<string | null>("gmix.account", null);
  // Written at once, since a sign-in navigates and the next page mounts before the hook would store it.
  const setSignedIn = (id: string | null) => { writeSession("gmix.account", id); setSession(id); };
  // The starter box is already signed in from the stored login, so the start page opens its inbox.
  useEffect(() => {
    const box = game.mail.accounts.find((a) => a.id === game.mail.primary && a.closedAt === null && a.domain === GMIX_DOMAIN);
    if (!signedIn && !readSession("gmix.out", false) && route === "" && box && game.logins[`mail:${box.local}@${box.domain}`]) { setSignedIn(box.id); to("mail/inbox"); }
  }, []);
  const account = game.mail.accounts.find((a) => a.id === signedIn && a.closedAt === null && a.domain === GMIX_DOMAIN) ?? null;
  const page = (() => {
    if (route === "plans") return <Plans game={game} to={to} go={go} tiers={[...TIERS]} />;
    if (TIER_PAGES[route]) return <Plans game={game} to={to} go={go} tiers={[TIER_PAGES[route]]} />;
    if (route === "signup") return <SignUp game={game} to={to} plan={params.get("plan") ?? "free"} signIn={setSignedIn} />;
    if (route === "reset") return <Reset game={game} to={to} />;
    if (route === "account/delete") return <Delete game={game} to={to} account={account} signOut={() => setSignedIn(null)} />;
    if (route === "mail" || route.startsWith("mail/")) {
      if (!account) return <LoginPage game={game} to={to} signIn={setSignedIn} />;
      return <GmixMail game={game} to={to} go={go} account={account} look={look} route={route.slice(5)} params={params} />;
    }
    if (route.startsWith("account") || route === "welcome" || route === "login") {
      if (!account) return <LoginPage game={game} to={to} signIn={setSignedIn} />;
      if (route === "welcome") return <AdFree to={to} />;
      if (route === "account/cancel") return <Cancel game={game} to={to} account={account} step={params.get("step") ?? "1"} />;
      return <Account game={game} to={to} account={account} />;
    }
    return <Home game={game} to={to} look={look} go={go} signIn={setSignedIn} />;
  })();
  return (
    <div className={`gx gx-${look}`}>
      <header className="gx-head">
        <Link to={to} path="" className="gx-logo"><GMixMark className="gx-mark" /><b>GMix</b></Link>
        <span className="gx-tag">{t("gmix.tagline")}</span>
        <nav className="gx-nav">
          <Link to={to} path="">{t("gmix.nav.home")}</Link>
          <Link to={to} path="plans">{t("gmix.nav.plans")}</Link>
          {account && <Link to={to} path="mail/inbox">{t("gmix.nav.mail")}</Link>}
          {account ? <Link to={to} path="account">{t("gmix.nav.account")}</Link> : <Link to={to} path="signup">{t("gmix.nav.join")}</Link>}
          {account && <a href="#logout" onClick={(e) => { e.preventDefault(); writeSession("gmix.out", true); setSignedIn(null); to("login"); }}>{t("gmix.nav.logout")}</a>}
        </nav>
      </header>
      <main className="gx-main">{page}</main>
      <Footer game={game} look={look} />
    </div>
  );
}

function LoginBox({ game, to, signIn, title }: { game: GameState; to: To; signIn: (id: string) => void; title: string }) {
  const site = game.mail.accounts.filter((a) => a.domain === GMIX_DOMAIN).map((a) => `mail:${a.local}@${a.domain}`).find((k) => game.logins[k]) ?? "mail:";
  const [saved] = useState(() => savedLogin(game, site, 2));
  const [address, setAddress] = useState(saved[0]), [password, setPassword] = useState(saved[1]), [error, setError] = useState<string | null>(null);
  const submit = () => {
    const r = checkMailLogin(game, address, password);
    if (!r.ok || r.account.domain !== GMIX_DOMAIN) return setError(t(r.ok ? "error.mailLogin" : r.error));
    offerLogin(game, `mail:${r.account.local}@${r.account.domain}`, SITE, [address, password]);
    signIn(r.account.id);
    to(gmixLook(game.hour) === "flat" && tenantOf(game, r.account)?.plan === "free" ? "welcome" : "mail/inbox");
  };
  return (
    <form className="gx-login" onSubmit={(e) => { e.preventDefault(); submit(); }}>
      <h3>{title}</h3>
      <label>{t("gmix.login.address")}<input name="address" value={address} onChange={(e) => setAddress(e.target.value)} autoComplete="off" /></label>
      <label>{t("gmix.login.password")}<input name="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="off" /></label>
      {error && <p className="gx-error" role="alert">{error}</p>}
      <button type="submit">{t("gmix.login.submit")}</button>
      <Link to={to} path="reset" className="gx-small">{t("gmix.login.forgot")}</Link>
      <Link to={to} path="signup" className="gx-small">{t("gmix.login.signup")}</Link>
    </form>
  );
}

function LoginPage({ game, to, signIn }: { game: GameState; to: To; signIn: (id: string) => void }) {
  return <section className="gx-page gx-narrow"><LoginBox game={game} to={to} signIn={signIn} title={t("gmix.login.title")} /></section>;
}

function Home({ game, to, look, go, signIn }: { game: GameState; to: To; look: GmixLook; go: (url: string) => void; signIn: (id: string) => void }) {
  if (look === "flat") {
    return (
      <section className="gx-flat-home">
        <LoginBox game={game} to={to} signIn={signIn} title={t("gmix.login.title")} />
        <aside className="gx-banner"><strong>{t("gmix.flat.banner")}</strong><Link to={to} path="signup?plan=pro" className="gx-button">{t("gmix.flat.try")}</Link></aside>
      </section>
    );
  }
  const news = feed(game).slice(0, 4), weather = (
    <section className="gx-box">
      <h3>{t("gmix.box.weather")}</h3>
      <p>{t("gmix.weather.in", { city: HOME_CITY, sky: t(`weather.sky.${sky(HOME_CITY, game.hour)}`), degrees: degrees(HOME_CITY, game.hour) })}</p>
    </section>
  );
  const newsBox = (
    <section className="gx-box gx-news">
      <h3>{t("gmix.box.news")}</h3>
      {news.length === 0 ? <p>{t("gmix.box.empty")}</p> : <ul>{news.map((n) => <li key={`${n.key}-${n.hour}`}>{t(`${n.key}.title`, n.params)}</li>)}</ul>}
    </section>
  );
  if (look === "navigator") {
    return (
      <section className="gx-nav-home">
        <div className="gx-logins">{TIERS.map((id) => <LoginBox key={id} game={game} to={to} signIn={signIn} title={t("gmix.login.tier", { plan: planName(id) })} />)}</div>
        <div className="gx-tiles">
          {(["mail", "cloud", "contacts", "calendar"] as const).map((k) => <div key={k} className={`gx-tile gx-tile-${k}`}>{t(`gmix.tile.${k}`)}</div>)}
        </div>
        <div className="gx-cols">{newsBox}{weather}</div>
      </section>
    );
  }
  const sign = Math.floor(game.hour / 24) % 6;
  return (
    <section className="gx-portal">
      <aside className="gx-promos">
        {(["dsl", "sms", "game"] as const).map((k) => <div key={k} className="gx-promo">{t(`gmix.ad.${k}`)}</div>)}
      </aside>
      <div className="gx-content">
        <p className="gx-crumb">{t("gmix.nav.home")}</p>
        <div className="gx-grid">
          <LoginBox game={game} to={to} signIn={signIn} title={t("gmix.login.title")} />
          {newsBox}
          {weather}
          <section className="gx-box"><h3>{t("gmix.box.horoscope")}</h3><p>{t(`gmix.horoscope.${sign}`)}</p></section>
          <section className="gx-box"><h3>{t("gmix.box.lotto")}</h3><p>{t("gmix.box.lottoText")}</p></section>
        </div>
        <p className="gx-claim"><a href="#claim" onClick={(e) => { e.preventDefault(); go(VIDEO_URL); }}>{t("gmix.claim")}</a></p>
        <p className="gx-small">{t("gmix.ad.foot")}</p>
      </div>
    </section>
  );
}

function Footer({ game, look }: { game: GameState; look: GmixLook }) {
  const visitors = new Intl.NumberFormat(LOCALE).format(48_213 + Math.floor(game.hour / 3));
  return (
    <footer className="gx-foot">
      {look === "frames" && <p className="gx-counter">{t("gmix.counter", { n: visitors })} {t("gmix.bestViewed")}</p>}
      <p>{`© ${yearOf(game.hour)} GMix`} | {t("gmix.footer.about")} | {t("gmix.footer.imprint")} | {t("gmix.footer.press")} | {t("gmix.footer.careers")} | {t("gmix.footer.advertise")}</p>
    </footer>
  );
}

// One column per tier, with the numbers of the catalog row as they stand this month.
function Plans({ game, to, go, tiers }: { game: GameState; to: To; go: (url: string) => void; tiers: (typeof TIERS)[number][] }) {
  const year = yearOf(game.hour), yes = (v: boolean) => t(v ? "gmix.value.yes" : "gmix.value.no");
  const rows: [string, (id: (typeof TIERS)[number]) => ReactNode][] = [
    ["price", (id) => { const v = mailPlan("gmix", id)!.price(year); return v === 0 ? t("gmix.value.free") : t("gmix.value.perMonth", { price: v }); }],
    ["address", () => `name@${GMIX_DOMAIN}`],
    ["storage", (id) => t("gmix.value.gb", { gb: new Intl.NumberFormat(LOCALE).format(quotaMbAt("gmix", id, game.hour) / 1024) })],
    ["attach", (id) => t("gmix.value.mb", { mb: mailPlan("gmix", id)!.attachMb(year) })],
    ["ads", (id) => t(mailPlan("gmix", id)!.ads ? "gmix.value.ads" : "gmix.value.noAds")],
    ["pop", (id) => { const gap = mailPlan("gmix", id)!.pollGapMin(year); return gap > 0 ? t("gmix.value.slowPop", { min: gap }) : yes(true); }],
    ["imap", (id) => yes(year >= mailPlan("gmix", id)!.imapFrom)],
    ["collector", (id) => mailPlan("gmix", id)!.collectors],
    ["folders", (id) => { const p = mailPlan("gmix", id)!; return t("gmix.value.both", { folders: p.folderMax, filters: p.filterMax }); }],
    ["forward", (id) => yes(!mailPlan("gmix", id)!.ads)],
    ["alias", () => yes(mailHost("gmix")!.aliasMax > 0)],
    ["support", (id) => t(`gmix.value.${SUPPORT[id]}`)],
    ["domain", () => <a href="#goggle" onClick={(e) => { e.preventDefault(); go(GOGGLE_URL); }}>{t("gmix.value.goggle")}</a>],
  ];
  return (
    <section className="gx-page">
      <h1>{tiers.length > 1 ? t("gmix.plans.title") : planName(tiers[0])}</h1>
      <table className="gx-plans">
        <thead><tr><th />{tiers.map((id) => <th key={id} scope="col"><Link to={to} path={`${id}mix`}>{planName(id)}</Link><small>{t(`gmix.plans.${id}`)}</small></th>)}</tr></thead>
        <tbody>
          {rows.map(([key, value]) => <tr key={key} data-row={key}><th scope="row">{t(`gmix.row.${key}`)}</th>{tiers.map((id) => <td key={id}>{value(id)}</td>)}</tr>)}
          <tr><th />{tiers.map((id) => <td key={id}><Link to={to} path={id === "free" ? "signup" : `signup?plan=${id}`} className="gx-button">{t(id === "free" ? "gmix.plans.signup" : "gmix.plans.order")}</Link></td>)}</tr>
        </tbody>
      </table>
      {tiers.length === 1 && <Link to={to} path="plans">{t("gmix.plans.title")}</Link>}
    </section>
  );
}

const strength = (pw: string): 0 | 1 | 2 | 3 => {
  if (pw.length === 0) return 0;
  const kinds = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^a-zA-Z0-9]/].filter((r) => r.test(pw)).length;
  return pw.length >= 10 && kinds >= 3 ? 3 : pw.length >= 8 && kinds >= 2 ? 2 : 1;
};
const STRENGTH = ["", "weak", "medium", "strong"] as const;

function SignUp({ game, to, plan, signIn }: { game: GameState; to: To; plan: string; signIn: (id: string) => void }) {
  const act = usePageAct();
  const [local, setLocal] = useState(""), [title, setTitle] = useState(game.company.name), [password, setPassword] = useState(""), [repeat, setRepeat] = useState("");
  const [tier, setTier] = useState(TIERS.includes(plan as never) ? plan : "free"), [mismatch, setMismatch] = useState(false), [taken, setTaken] = useState<string | null>(null);
  const level = strength(password);
  const submit = () => {
    setMismatch(password !== repeat);
    if (password !== repeat) return;
    const r = act(signUpGmix, { local, title, password, plan: tier });
    setTaken(r.ok || r.error !== "error.mailTaken" ? null : local.trim().toLowerCase());
    if (!r.ok) return;
    offerLogin(game, `mail:${local.trim().toLowerCase()}@${GMIX_DOMAIN}`, SITE, [`${local.trim().toLowerCase()}@${GMIX_DOMAIN}`, password]);
    signIn(r.id!);
    to("account");
  };
  const options = taken ? gmixSuggestions(game, taken) : [];
  return (
    <section className="gx-page gx-narrow">
      <h1>{t("gmix.signup.title")}</h1>
      <form className="gx-form" onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <label>{t("gmix.signup.name")}<span className="gx-addr"><input name="local" value={local} onChange={(e) => setLocal(e.target.value)} autoComplete="off" />@{GMIX_DOMAIN}</span></label>
        {taken && (
          <div className="gx-taken">
            <p className="gx-error">{t("gmix.signup.taken", { address: `${taken}@${GMIX_DOMAIN}` })}</p>
            {options.length > 0 && <p>{t("gmix.signup.free")}: {options.map((o) => <button type="button" key={o} className="gx-suggest" onClick={() => { setLocal(o); setTaken(null); }}>{o}</button>)}</p>}
          </div>
        )}
        <label>{t("gmix.signup.sender")}<input name="title" value={title} onChange={(e) => setTitle(e.target.value)} autoComplete="off" /></label>
        <label>{t("gmix.signup.password")}<input name="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" /></label>
        <div className="gx-strength" data-level={level}>
          <span>{t("gmix.signup.strength")}</span><i style={{ width: `${level * 33.4}%` }} />
          {level > 0 && <b>{t(`gmix.signup.${STRENGTH[level]}`)}</b>}
        </div>
        <label>{t("gmix.signup.repeat")}<input name="repeat" type="password" value={repeat} onChange={(e) => setRepeat(e.target.value)} autoComplete="new-password" /></label>
        {mismatch && <p className="gx-error">{t("gmix.signup.mismatch")}</p>}
        <fieldset className="gx-tiers">
          <legend>{t("gmix.signup.plan")}</legend>
          {TIERS.map((id) => (
            <label key={id}><input type="radio" name="tier" checked={tier === id} onChange={() => setTier(id)} />{planName(id)}
              <small>{mailPlan("gmix", id)!.price(yearOf(game.hour)) === 0 ? t("gmix.value.free") : t("gmix.value.perMonth", { price: mailPlan("gmix", id)!.price(yearOf(game.hour)) })}</small></label>
          ))}
        </fieldset>
        <button type="submit">{t("gmix.signup.submit")}</button>
      </form>
    </section>
  );
}

function AdFree({ to }: { to: To }) {
  return (
    <section className="gx-page gx-adfree">
      <h1>{t("gmix.adfree.title")}</h1>
      <Link to={to} path="promix" className="gx-button gx-big">{t("gmix.adfree.go")}</Link>
      <Link to={to} path="mail/inbox" className="gx-small gx-grey">{t("gmix.adfree.continue")}</Link>
    </section>
  );
}

function Account({ game, to, account }: { game: GameState; to: To; account: MailAccount }) {
  const act = usePageAct(), tenant = tenantOf(game, account)!, year = yearOf(game.hour), caps = capsOf(game, account);
  const [old, setOld] = useState(""), [fresh, setFresh] = useState(""), [saved, setSaved] = useState(false);
  const address = `${account.local}@${account.domain}`, next = nextMonthStart(game.hour);
  const onOffer = tenant.offerUntil !== undefined && game.hour <= tenant.offerUntil;
  const price = tenant.next ? mailPlan("gmix", tenant.next)!.price(year) : onOffer ? GMIX_OFFER : mailPlan("gmix", tenant.plan)!.price(year);
  const access = [t("sim.index.webmail"), caps.pop && "POP3", caps.imap && "IMAP"].filter(Boolean).join(", ");
  const receives = account.roles.length ? account.roles.map((r) => t(`mailserver.role.${r}`)).join(", ") : t("gmix.account.personal");
  const save = () => {
    const r = act(changePassword, account.id, old, fresh);
    setSaved(r.ok);
    if (r.ok) { setOld(""); setFresh(""); }
  };
  return (
    <section className="gx-page">
      <h1>{t("gmix.account.title")}</h1>
      <LeftBehind game={game} tenantId={tenant.id} className="gx-error" />
      <table className="gx-facts">
        <tbody>
          <tr><th>{t("gmix.account.address")}</th><td>{address}</td></tr>
          <tr><th>{t("gmix.account.plan")}</th><td>{planName(tenant.plan)}{tenant.next && <small> {t("gmix.account.changesTo", { plan: planName(tenant.next), date: day(next) })}</small>}
            {onOffer && <small> {t("gmix.account.offer", { price: GMIX_OFFER, date: day(tenant.offerUntil!) })}</small>}</td></tr>
          <tr><th>{t("gmix.account.next")}</th><td>{price > 0 ? t("gmix.account.charge", { amount: price, date: day(next) }) : t("gmix.account.none")}</td></tr>
          <tr><th>{t("gmix.account.receives")}</th><td>{receives}</td></tr>
          <tr><th>{t("gmix.account.access")}</th><td>{access}</td></tr>
          <tr><th>{t("gmix.account.collectors")}</th><td>{t("gmix.account.collectorsMax", { n: caps.collectors })}</td></tr>
        </tbody>
      </table>
      <div className="gx-actions">
        {TIERS.filter((id) => id !== tenant.plan && id !== tenant.next).map((id) => id === "free"
          ? <Link key={id} to={to} path="account/cancel" className="gx-button gx-quiet">{t("gmix.account.downgrade", { plan: planName(tenant.plan) })}</Link>
          : <button key={id} type="button" onClick={() => act(setGmixTier, tenant.id, id)}>{t("gmix.account.switch", { plan: planName(id) })}</button>)}
      </div>
      <form className="gx-form" onSubmit={(e) => { e.preventDefault(); save(); }}>
        <h2>{t("gmix.account.passwordTitle")}</h2>
        <label>{t("gmix.account.old")}<input name="old" type="password" value={old} onChange={(e) => { setOld(e.target.value); setSaved(false); }} autoComplete="current-password" /></label>
        <label>{t("gmix.account.new")}<input name="new" type="password" value={fresh} onChange={(e) => { setFresh(e.target.value); setSaved(false); }} autoComplete="new-password" /></label>
        <button type="submit">{t("gmix.account.save")}</button>
        {saved && <span className="gx-ok">{t("gmix.account.saved")}</span>}
      </form>
      <Link to={to} path="account/delete" className="gx-small">{t("gmix.account.delete")}</Link>
    </section>
  );
}

// The famously long way out of a paid tier, always in the old look.
function Cancel({ game, to, account, step }: { game: GameState; to: To; account: MailAccount; step: string }) {
  const act = usePageAct(), tenant = tenantOf(game, account)!, plan = planName(tenant.plan), free = planName("free");
  const [reason, setReason] = useState("price");
  const go = (s: string) => to(`account/cancel?step=${s}`);
  const body = (() => {
    if (step === "done") return <p>{t("gmix.cancel.done", { free, date: day(nextMonthStart(game.hour)) })}</p>;
    if (step === "kept") return <p>{t("gmix.cancel.kept", { plan })}</p>;
    if (tenant.plan === "free") return <p>{t("gmix.cancel.kept", { plan })}</p>;
    if (step === "1") return (<>
      <p>{t("gmix.cancel.sure", { plan, free })}</p>
      <button type="button" onClick={() => go("2")}>{t("gmix.cancel.yes")}</button>
      <Link to={to} path="account" className="gx-button">{t("gmix.cancel.keep", { plan })}</Link>
    </>);
    if (step === "2") return (<>
      <fieldset className="gx-reasons"><legend>{t("gmix.cancel.why")}</legend>
        {(["price", "use", "switch", "other"] as const).map((k) => <label key={k}><input type="radio" name="reason" checked={reason === k} onChange={() => setReason(k)} />{t(`gmix.cancel.reason.${k}`)}</label>)}
      </fieldset>
      <button type="button" onClick={() => go(tenant.offerUntil === undefined ? "3" : "4")}>{t("gmix.cancel.next")}</button>
    </>);
    if (step === "3" && tenant.offerUntil === undefined) return (<>
      <h2>{t("gmix.cancel.offerTitle")}</h2>
      <p>{t("gmix.cancel.offer", { plan, price: GMIX_OFFER })}</p>
      <button type="button" onClick={() => { if (act(acceptGmixOffer, tenant.id).ok) go("kept"); }}>{t("gmix.cancel.accept")}</button>
      <button type="button" className="gx-quiet" onClick={() => go("4")}>{t("gmix.cancel.decline")}</button>
    </>);
    return (<>
      <h2>{t("gmix.cancel.final")}</h2>
      <p>{t("gmix.cancel.letter")}</p>
      <button type="button" onClick={() => { if (act(setGmixTier, tenant.id, "free").ok) go("done"); }}>{t("gmix.cancel.confirm")}</button>
    </>);
  })();
  return <section className="gx-page gx-cancel gx-frames-box"><h1>{t("gmix.cancel.title", { plan })}</h1><div className="gx-sad" aria-hidden="true">✉</div>{body}</section>;
}

function Delete({ game, to, account, signOut }: { game: GameState; to: To; account: MailAccount | null; signOut: () => void }) {
  const act = usePageAct();
  const [password, setPassword] = useState(""), [again, setAgain] = useState(""), [mismatch, setMismatch] = useState(false), [done, setDone] = useState(false);
  if (done) return <section className="gx-page gx-narrow"><p className="gx-ok">{t("gmix.account.deleted")}</p><Link to={to} path="">{t("gmix.nav.home")}</Link></section>;
  if (!account) return <LoginPage game={game} to={to} signIn={() => to("account/delete")} />;
  const address = `${account.local}@${account.domain}`;
  const submit = () => {
    setMismatch(again.trim().toLowerCase() !== address);
    if (again.trim().toLowerCase() !== address) return;
    if (!act(deleteGmixMailbox, account.id, password).ok) return;
    setDone(true);
    signOut();
  };
  return (
    <section className="gx-page gx-narrow">
      <h1>{t("gmix.account.delete")}</h1>
      <form className="gx-form" onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <label>{t("gmix.login.password")}<input name="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" /></label>
        <label>{t("gmix.account.retype")}<input name="again" value={again} onChange={(e) => setAgain(e.target.value)} autoComplete="off" /></label>
        {mismatch && <p className="gx-error">{t("gmix.account.mismatch")}</p>}
        <button type="submit" className="gx-danger">{t("gmix.account.delete")}</button>
      </form>
    </section>
  );
}

// Forgot password: the code comes by post, and the page waits for the letter.
function Reset({ game, to }: { game: GameState; to: To }) {
  const act = usePageAct();
  const [address, setAddress] = useSessionState("gmix.reset", ""), [typed, setTyped] = useState(address);
  const [code, setCode] = useState(""), [fresh, setFresh] = useState(""), [done, setDone] = useState(false);
  const a = address ? game.mail.accounts.find((x) => `${x.local}@${x.domain}` === address && x.closedAt === null) : undefined;
  const letter = a?.reset ? game.letters.find((l) => l.id === a.reset!.letter) : undefined;
  const body = (() => {
    if (done) return <><p className="gx-ok">{t("gmix.reset.done")}</p><Link to={to} path="login">{t("gmix.login.title")}</Link></>;
    if (!letter) return (
      <form className="gx-form" onSubmit={(e) => { e.preventDefault(); const v = typed.trim().toLowerCase(); if (act(requestPasswordReset, v).ok) setAddress(v); }}>
        <label>{t("gmix.login.address")}<input name="address" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" /></label>
        <button type="submit">{t("gmix.reset.request")}</button>
      </form>
    );
    if (!letter.arrived) return <><p>{t("gmix.reset.sent")}</p><p>{t("gmix.reset.due", { date: day(letter.at) })}</p></>;
    return (
      <form className="gx-form" onSubmit={(e) => { e.preventDefault(); if (act(resetPassword, address, code, fresh).ok) { setDone(true); setAddress(""); } }}>
        <p>{address}</p>
        <label>{t("gmix.reset.code")}<input name="code" value={code} onChange={(e) => setCode(e.target.value)} autoComplete="one-time-code" /></label>
        <label>{t("gmix.reset.new")}<input name="new" type="password" value={fresh} onChange={(e) => setFresh(e.target.value)} autoComplete="new-password" /></label>
        <button type="submit">{t("gmix.reset.save")}</button>
      </form>
    );
  })();
  return <section className="gx-page gx-narrow"><h1>{t("gmix.reset.title")}</h1>{body}</section>;
}
