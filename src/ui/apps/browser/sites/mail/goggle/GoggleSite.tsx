import { useState, type MouseEvent, type ReactNode } from "react";
import { t } from "../../../../../../i18n/en";
import { LOCALE } from "../../../../../../i18n/lang";
import { dateOf, hourOfMonth, nextMonthStart, yearOf } from "../../../../../../sim/00-core/time";
import { COMPETITORS } from "../../../../../../sim/10-catalog/economy";
import { brandAt, editionAt, GOGGLE_ACCOUNTS, goggleToken, mailSiteUrl, verificationAt, type GoggleBrand } from "../../../../../../sim/10-catalog/mail-consumer";
import { mailboxCap, mailPlan, mxSetAt, onSale, quotaMbAt } from "../../../../../../sim/10-catalog/mail-providers";
import { companyDomain } from "../../../../../../sim/30-customers/domains";
import { checkMailLogin, mailboxTaken, openBoxes } from "../../../../../../sim/42-mail/accounts";
import { mxTarget } from "../../../../../../sim/42-mail/caps";
import { seededPassword } from "../../../../../../sim/42-mail/new";
import type { MailAccount, MailTenant } from "../../../../../../sim/42-mail/types";
import type { GameState } from "../../../../../../sim/50-state";
import { mxHostsAt } from "../../../../../../sim/60-infra/company-zone";
import { HOME_URL, registrarUrl } from "../../../../../../sim/80-business/browser";
import { connectGoggleDns, signUpGoggle, verifyDomain } from "../../../../../../sim/90-actions/mail-provider";
import { createMailAccount, requestPasswordReset, resetPassword } from "../../../../../../sim/90-actions/mailbox";
import { euroCents } from "../../../../../../sim/00-core/money";
import { GoggleMark } from "../../../../../art/mailmarks";
import { useSessionState, writeSession } from "../../../../../session";
import { offerLogin, savedLogin } from "../../../../../vault";
import { usePageAct } from "../../../pageAct";
import "./goggle.css";

// docs/design/plans/webmail-consumer.md, sections 4.1 to 4.3 and 5: the product site, the sign-up wizard and the sign-in.
const LAUNCH = "2006-08";
const SESSION = "goggle.account";
const PLANS = ["free", "paid"] as const;
const SALES: Record<GoggleBrand, string[]> = { appsDomain: [], apps: ["education", "partner"], swoot: ["business", "enterprise"], workspace: ["standard", "plus", "enterprise"] };
const SUGGESTED = ["info", "sales", "support"];

const brandName = (hour: number) => t(`mail.goggle.brand.${brandAt(hour)}`);
const editionName = (plan: string, hour: number) => t(`mail.goggle.edition.${editionAt(plan, hour)}`);
const day = (hour: number) => dateOf(hour).toLocaleDateString(LOCALE, { timeZone: "UTC" });
const price = (plan: string, hour: number) => mailPlan("goggle", plan)!.price(yearOf(hour));
const perUser = (n: number) => (n === 0 ? t("goggle.value.free") : t("goggle.value.perUser", { price: n }));
const gb = (mb: number) => (mb / 1024).toLocaleString(LOCALE, { maximumFractionDigits: 1 });
const onSaleNow = (hour: number) => PLANS.filter((p) => onSale(mailPlan("goggle", p)!, hour));
const tenantOf = (game: GameState, a: MailAccount): MailTenant | undefined => game.mail.tenants.find((x) => x.id === a.tenant && x.host === "goggle");
const launched = (hour: number) => hour >= hourOfMonth(LAUNCH);

export const goggleTitle = (game: GameState, host: string): string =>
  host === GOGGLE_ACCOUNTS ? t("goggle.signin.tab") : launched(game.hour) ? brandName(game.hour) : "Goggle";

interface SiteProps { game: GameState; host: string; path: string; go: (url: string) => void }
type To = (path: string) => void;

function Link({ to, path, children, className }: { to: To; path: string; children: ReactNode; className?: string }) {
  const click = (e: MouseEvent) => { e.preventDefault(); to(path); };
  return <a href={`#${path}`} className={className} onClick={click}>{children}</a>;
}

export function GoggleSite({ game, host, path, go }: SiteProps) {
  const [route, query = ""] = path.replace(/^\/+/, "").split("?");
  const params = new URLSearchParams(query), look = brandAt(game.hour);
  const to: To = (p) => go(mailSiteUrl("goggle", p));
  const accounts: To = (p) => go(`${GOGGLE_ACCOUNTS}/${p}`);
  const [signedIn, setSession] = useSessionState<string | null>(SESSION, null);
  const setSignedIn = (id: string | null) => { writeSession(SESSION, id); setSession(id); };
  const account = game.mail.accounts.find((a) => a.id === signedIn && a.closedAt === null) ?? null;
  const tenant = account ? tenantOf(game, account) : undefined;
  const admin = tenant && tenant.admin === account?.id ? account : null;
  const page = (() => {
    if (host === GOGGLE_ACCOUNTS) {
      if (route === "recovery") return <Recovery game={game} accounts={accounts} />;
      return <SignIn game={game} accounts={accounts} signIn={setSignedIn} next={params.get("continue") ?? ""} go={go} />;
    }
    if (!launched(game.hour)) return <Search go={go} />;
    if (route === "pricing") return <Pricing game={game} to={to} />;
    if (route === "signup") return <SignUp game={game} to={to} signIn={setSignedIn} wanted={params.get("plan")} />;
    if (route === "setup") {
      if (!admin || !tenant) return <SignIn game={game} accounts={accounts} signIn={setSignedIn} next={mailSiteUrl("goggle", path.replace(/^\/+/, ""))} go={go} />;
      return <Setup game={game} to={to} go={go} tenant={tenant} step={params.get("step") ?? "verify"} />;
    }
    return <Home game={game} to={to} look={look} />;
  })();
  const out = () => { setSignedIn(null); to(""); };
  return (
    <div className={`gg gg-${launched(game.hour) ? look : "search"}`}>
      {host !== GOGGLE_ACCOUNTS && launched(game.hour) && (
        <header className="gg-head">
          <Link to={to} path="" className="gg-logo"><GoggleMark className="gg-mark" /><b>{brandName(game.hour)}</b>{look === "appsDomain" && <sup className="gg-beta">BETA</sup>}</Link>
          <nav className="gg-nav">
            <Link to={to} path="">{t("goggle.nav.product")}</Link>
            <Link to={to} path="pricing">{t("goggle.nav.pricing")}</Link>
            {admin && <Link to={to} path="setup">{t("goggle.nav.setup")}</Link>}
            {account ? <a href="#signout" onClick={(e) => { e.preventDefault(); out(); }}>{t("goggle.nav.signOut")}</a>
              : <a href="#signin" onClick={(e) => { e.preventDefault(); accounts(""); }}>{t("goggle.nav.signIn")}</a>}
            {!tenant && <Link to={to} path="signup" className="gg-cta">{t(`goggle.nav.start.${look}`)}</Link>}
          </nav>
        </header>
      )}
      <main className="gg-main">{page}</main>
      <footer className="gg-foot">{t("goggle.footer", { year: yearOf(game.hour) })}</footer>
    </div>
  );
}

// Before Goggle sold anything for a domain, the address is the search page.
function Search({ go }: { go: (url: string) => void }) {
  const [q, setQ] = useState("");
  return (
    <form className="gg-search" onSubmit={(e) => { e.preventDefault(); go(HOME_URL); }}>
      <h1 className="gg-word"><GoggleMark className="gg-mark" />Goggle</h1>
      <input name="q" value={q} onChange={(e) => setQ(e.target.value)} autoComplete="off" aria-label={t("goggle.search.button")} />
      <button type="submit">{t("goggle.search.button")}</button>
    </form>
  );
}

function Home({ game, to, look }: { game: GameState; to: To; look: GoggleBrand }) {
  const cap = onSale(mailPlan("goggle", "free")!, game.hour) ? mailboxCap("goggle", "free", game.hour) : null;
  return (
    <section className="gg-home">
      <div className="gg-hero">
        <h1>{t(`goggle.home.${look}.title`)}</h1>
        <p className="gg-pitch">{t(`goggle.home.${look}.pitch`)}</p>
        {cap !== null && look !== "appsDomain" && <p className="gg-free">{t("goggle.home.freeUpTo", { n: cap })}</p>}
        <Link to={to} path="signup" className="gg-cta">{t(`goggle.nav.start.${look}`)}</Link>
        <Link to={to} path="pricing" className="gg-more">{t("goggle.home.compare")}</Link>
      </div>
      <ul className="gg-features">
        {[1, 2, 3].map((n) => <li key={n}>{t(`goggle.home.${look}.f${n}`, { quota: gb(quotaMbAt("goggle", "free", game.hour)) })}</li>)}
      </ul>
      <div className="gg-customers">
        <h2>{t("goggle.home.customers")}</h2>
        <ul>{COMPETITORS.map((c) => <li key={c.name}>{c.name}</li>)}</ul>
      </div>
    </section>
  );
}

function Pricing({ game, to }: { game: GameState; to: To }) {
  const hour = game.hour, plans = onSaleNow(hour), look = brandAt(hour);
  const rows: [string, (p: string) => string][] = [
    ["price", (p) => perUser(price(p, hour))],
    ["users", (p) => { const n = mailboxCap("goggle", p, hour); return n === null ? t("goggle.value.unlimited") : t("goggle.value.upTo", { n }); }],
    ["storage", (p) => t("goggle.value.gb", { n: gb(quotaMbAt("goggle", p, hour)) })],
    ["ads", (p) => t(mailPlan("goggle", p)!.ads ? "goggle.value.yes" : "goggle.value.no")],
    ["imap", (p) => t(yearOf(hour) >= mailPlan("goggle", p)!.imapFrom ? "goggle.value.yes" : "goggle.value.no")],
    ["sla", (p) => (p === "paid" ? t("goggle.value.sla") : t("goggle.value.no"))],
  ];
  return (
    <section className="gg-page">
      <h1>{t("goggle.pricing.title")}</h1>
      {look === "apps" && plans.includes("free") && <p className="gg-pitch">{t("goggle.pricing.premierAds")}</p>}
      <table className="gg-table gg-editions">
        <thead><tr><th />{plans.map((p) => <th key={p} data-plan={p}>{editionName(p, hour)}</th>)}</tr></thead>
        <tbody>
          {rows.map(([id, cell]) => <tr key={id} data-row={id}><th>{t(`goggle.pricing.${id}`)}</th>{plans.map((p) => <td key={p}>{cell(p)}</td>)}</tr>)}
          <tr><th />{plans.map((p) => <td key={p}><Link to={to} path={`signup?plan=${p}`} className="gg-cta">{t(`goggle.nav.start.${look}`)}</Link></td>)}</tr>
        </tbody>
      </table>
      {SALES[look].length > 0 && (
        <div className="gg-sales">
          {SALES[look].map((id) => <div key={id} className="gg-card"><h3>{t(`goggle.sales.${id}`)}</h3><p>{t("goggle.sales.contact")}</p></div>)}
        </div>
      )}
    </section>
  );
}

const STEPS = ["domain", "admin", "edition", "summary"] as const;

function SignUp({ game, to, signIn, wanted }: { game: GameState; to: To; signIn: (id: string) => void; wanted: string | null }) {
  const act = usePageAct(), hour = game.hour, plans = onSaleNow(hour);
  const [step, setStep] = useState(0), [error, setError] = useState<string | null>(null);
  const [domain, setDomain] = useState(game.company.domain ? companyDomain(game) : "");
  const [first, setFirst] = useState(""), [last, setLast] = useState(""), [local, setLocal] = useState("admin");
  const [password, setPassword] = useState(""), [repeat, setRepeat] = useState("");
  const [plan, setPlan] = useState<string>(plans.includes(wanted as never) ? wanted! : plans[0] ?? "paid");
  const cap = mailboxCap("goggle", plan, hour), staff = game.staff.slice(0, cap === null ? undefined : Math.max(0, cap - 1));
  const boxes = 1 + staff.length, clean = domain.trim().toLowerCase();
  const next = () => {
    const problem = step === 0 && (!game.company.domain || clean !== companyDomain(game)) ? "error.needsDomain"
      : step === 1 && (!first.trim() || !local.trim()) ? "goggle.signup.required"
        : step === 1 && password.length < 6 ? "error.mailPassword"
          : step === 1 && password !== repeat ? "goggle.signup.mismatch" : null;
    setError(problem && t(problem));
    if (!problem) setStep(step + 1);
  };
  const confirm = () => {
    const name = [first.trim(), last.trim()].filter(Boolean).join(" ");
    const r = act(signUpGoggle, { domain: clean, plan, local, title: name, password });
    if (!r.ok) return;
    const address = `${local.trim().toLowerCase()}@${clean}`;
    offerLogin(game, `mail:${address}`, GOGGLE_ACCOUNTS, [address, password]);
    signIn(r.id!);
    to("setup?step=verify");
  };
  const field = (name: string, label: string, value: string, set: (v: string) => void, type?: string) => (
    <label>{label}<input name={name} type={type} value={value} onChange={(e) => set(e.target.value)} autoComplete="off" /></label>
  );
  const body = (() => {
    if (step === 0) return field("domain", t("goggle.signup.domain"), domain, setDomain);
    if (step === 1) return (
      <>
        {field("first", t("goggle.signup.first"), first, setFirst)}
        {field("last", t("goggle.signup.last"), last, setLast)}
        <label>{t("goggle.signup.username")}<span className="gg-addr"><input name="local" value={local} onChange={(e) => setLocal(e.target.value)} autoComplete="off" />@{clean}</span></label>
        {field("password", t("goggle.signup.password"), password, setPassword, "password")}
        {field("repeat", t("goggle.signup.repeat"), repeat, setRepeat, "password")}
      </>
    );
    if (step === 2) return (
      <fieldset className="gg-plans">
        <legend>{t("goggle.signup.edition")}</legend>
        {plans.map((p) => (
          <label key={p}><input type="radio" name="plan" checked={plan === p} onChange={() => setPlan(p)} />{editionName(p, hour)}
            <small>{perUser(price(p, hour))}</small></label>
        ))}
      </fieldset>
    );
    return (
      <>
        <dl className="gg-summary">
          <dt>{t("goggle.signup.domain")}</dt><dd>{clean}</dd>
          <dt>{t("goggle.signup.adminAccount")}</dt><dd>{`${local.trim().toLowerCase()}@${clean}`}</dd>
          <dt>{t("goggle.signup.edition")}</dt><dd>{editionName(plan, hour)}</dd>
          <dt>{t("goggle.signup.total")}</dt><dd>{euroCents(price(plan, hour) * boxes)}</dd>
          <dt>{t("goggle.signup.firstInvoice")}</dt><dd>{price(plan, hour) === 0 ? t("goggle.value.free") : day(nextMonthStart(hour))}</dd>
        </dl>
        <table className="gg-table" data-table="mailboxes">
          <thead><tr><th>{t("goggle.users.name")}</th><th>{t("goggle.users.address")}</th></tr></thead>
          <tbody>
            <tr><td>{[first, last].join(" ").trim()}</td><td>{`${local.trim().toLowerCase()}@${clean}`}</td></tr>
            {staff.map((e) => <tr key={e.id}><td>{e.name}</td><td>{t("goggle.signup.staffBox")}</td></tr>)}
          </tbody>
        </table>
      </>
    );
  })();
  return (
    <section className="gg-page gg-wizard">
      <h1>{t("goggle.signup.title", { brand: brandName(hour) })}</h1>
      {brandAt(hour) === "appsDomain" && <p className="gg-beta-line">{t("goggle.signup.beta")}</p>}
      <ol className="gg-steps">{STEPS.map((id, i) => <li key={id} className={i === step ? "on" : i < step ? "done" : ""}>{t(`goggle.signup.step.${id}`)}</li>)}</ol>
      <form className="gg-form" onSubmit={(e) => { e.preventDefault(); if (step < 3) next(); else confirm(); }}>
        {body}
        {error && <p className="gg-error" role="alert">{error}</p>}
        <div className="gg-buttons">
          {step > 0 && <button type="button" className="gg-quiet" onClick={() => { setError(null); setStep(step - 1); }}>{t("goggle.signup.back")}</button>}
          <button type="submit">{t(step < 3 ? "goggle.signup.next" : "goggle.signup.accept")}</button>
        </div>
      </form>
    </section>
  );
}

const SETUP = ["verify", "mx", "users"] as const;

function Setup({ game, to, go, tenant, step }: { game: GameState; to: To; go: (url: string) => void; tenant: MailTenant; step: string }) {
  const act = usePageAct(), hour = game.hour, [connect, setConnect] = useState(false);
  const v = verificationAt(tenant.since, goggleToken(game.seed, tenant.domain)), mx = mxSetAt("goggle", tenant.domain, hour);
  const live = mxHostsAt(game, hour), delivering = mxTarget(game)?.id === tenant.id;
  const automatic = game.registrar?.id === "goDuddy" && yearOf(hour) >= 2019;
  const registrar = (
    <div className="gg-buttons">
      <button type="button" className="gg-quiet" onClick={() => go(`${registrarUrl(game)}login/dns`)}>{t("goggle.setup.openRegistrar")}</button>
      {automatic && <button type="button" onClick={() => setConnect(true)}>{t("goggle.setup.connect")}</button>}
    </div>
  );
  const panel = connect && (
    <div className="gg-connect" role="dialog">
      <h3>GoDuddy</h3>
      <p>{t("goggle.setup.connectAs", { name: game.company.name, domain: tenant.domain })}</p>
      <ul>{[`${v.type} ${v.name} ${v.data}`, ...mx.map(([p, h]) => `MX @ ${p} ${h}`)].map((r) => <li key={r}><code>{r}</code></li>)}</ul>
      <div className="gg-buttons">
        <button type="button" className="gg-quiet" onClick={() => setConnect(false)}>{t("goggle.setup.cancel")}</button>
        <button type="button" onClick={() => { if (act(connectGoggleDns, tenant.id).ok) setConnect(false); }}>{t("goggle.setup.allow")}</button>
      </div>
    </div>
  );
  const body = (() => {
    if (step === "mx") return (
      <>
        <h2>{t("goggle.setup.mxTitle")}</h2>
        <table className="gg-table" data-table="mx">
          <thead><tr><th>{t("goggle.setup.priority")}</th><th>{t("goggle.setup.server")}</th><th>{t("goggle.setup.status")}</th></tr></thead>
          <tbody>{mx.map(([p, h]) => <tr key={h}><td>{p}</td><td><code>{h.toUpperCase()}</code></td><td>{t(live.includes(h) ? "goggle.setup.found" : "goggle.setup.missing")}</td></tr>)}</tbody>
        </table>
        <p className="gg-joke">{t(mx.length === 1 ? "goggle.setup.mxOne" : "goggle.setup.mxShout")}</p>
        <p className={delivering ? "gg-ok" : "gg-error"} data-delivery>{t(delivering ? "goggle.setup.delivering" : "goggle.setup.notDelivering")}</p>
        {registrar}
      </>
    );
    if (step === "users") return <Users game={game} tenant={tenant} />;
    return (
      <>
        <h2>{t("goggle.setup.verifyTitle")}</h2>
        <p className={tenant.verified ? "gg-ok" : "gg-error"} data-verified={tenant.verified}>{t(tenant.verified ? "goggle.setup.verified" : "goggle.setup.unverified")}</p>
        <table className="gg-table" data-table="verify">
          <thead><tr><th>{t("goggle.setup.type")}</th><th>{t("goggle.setup.host")}</th><th>{t("goggle.setup.value")}</th></tr></thead>
          <tbody><tr><td>{v.type}</td><td><code>{v.name}</code></td><td><code>{v.data}</code></td></tr></tbody>
        </table>
        {!tenant.verified && <div className="gg-buttons"><button type="button" onClick={() => act(verifyDomain, tenant.id)}>{t("goggle.setup.verify")}</button></div>}
        {registrar}
      </>
    );
  })();
  return (
    <section className="gg-page gg-setup">
      <h1>{t("goggle.setup.title", { domain: tenant.domain })}</h1>
      <ol className="gg-steps">{SETUP.map((id) => <li key={id} className={id === step ? "on" : ""}><Link to={to} path={`setup?step=${id}`}>{t(`goggle.setup.step.${id}`)}</Link></li>)}</ol>
      {body}
      {panel}
    </section>
  );
}

function Users({ game, tenant }: { game: GameState; tenant: MailTenant }) {
  const act = usePageAct(), hour = game.hour, each = price(tenant.plan, hour), boxes = openBoxes(game, tenant.id);
  const add = (local: string) => act(createMailAccount, { tenant: tenant.id, local, title: local, password: seededPassword(game.seed, game.nextId) });
  const free = SUGGESTED.filter((l) => !mailboxTaken(game, tenant, l));
  return (
    <>
      <h2>{t("goggle.setup.usersTitle")}</h2>
      <table className="gg-table" data-table="users">
        <thead><tr><th>{t("goggle.users.address")}</th><th>{t("goggle.users.name")}</th><th>{t("goggle.users.price")}</th></tr></thead>
        <tbody>{boxes.map((a) => <tr key={a.id}><td>{`${a.local}@${a.domain}`}</td><td>{a.title}</td><td>{euroCents(each)}</td></tr>)}</tbody>
      </table>
      <p data-total>{t("goggle.setup.total", { n: boxes.length, total: euroCents(each * boxes.length) })}</p>
      {free.length > 0 && (
        <div className="gg-chips">
          {free.map((l) => <button key={l} type="button" className="gg-chip" onClick={() => add(l)}>{`${l}@${tenant.domain}`} <small>{perUser(each)}</small></button>)}
        </div>
      )}
    </>
  );
}

function SignIn({ game, accounts, signIn, next, go }: { game: GameState; accounts: To; signIn: (id: string) => void; next: string; go: (url: string) => void }) {
  const site = game.mail.accounts.filter((a) => tenantOf(game, a)).map((a) => `mail:${a.local}@${a.domain}`).find((k) => game.logins[k]) ?? "mail:";
  const [saved] = useState(() => savedLogin(game, site, 2));
  const [address, setAddress] = useState(saved[0]), [password, setPassword] = useState(saved[1]), [error, setError] = useState<string | null>(null);
  const card = game.hour >= hourOfMonth("2013-01");
  const submit = () => {
    const r = checkMailLogin(game, address, password);
    if (!r.ok || !tenantOf(game, r.account)) return setError(t(r.ok ? "error.mailLogin" : r.error));
    offerLogin(game, `mail:${r.account.local}@${r.account.domain}`, GOGGLE_ACCOUNTS, [address, password]);
    signIn(r.account.id);
    const admin = tenantOf(game, r.account)!.admin === r.account.id;
    go(next || mailSiteUrl("goggle", admin ? "setup" : ""));
  };
  return (
    <section className={`gg-signin ${card ? "gg-signin-card" : "gg-signin-box"}`}>
      <h1 className="gg-word"><GoggleMark className="gg-mark" />Goggle</h1>
      <form className="gg-form" onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <h2>{t(card ? "goggle.signin.title" : "goggle.signin.classic")}</h2>
        {card && <p>{t("goggle.signin.sub")}</p>}
        <label>{t("goggle.signin.email")}<input name="address" value={address} onChange={(e) => setAddress(e.target.value)} autoComplete="off" /></label>
        <label>{t("goggle.signin.password")}<input name="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="off" /></label>
        {error && <p className="gg-error" role="alert">{error}</p>}
        <button type="submit">{t("goggle.signin.submit")}</button>
        <a href="#recovery" className="gg-small" onClick={(e) => { e.preventDefault(); accounts("recovery"); }}>{t(card ? "goggle.signin.forgot" : "goggle.signin.cantAccess")}</a>
      </form>
    </section>
  );
}

function Recovery({ game, accounts }: { game: GameState; accounts: To }) {
  const act = usePageAct();
  const [address, setAddress] = useSessionState("goggle.reset", ""), [typed, setTyped] = useState(address);
  const [code, setCode] = useState(""), [fresh, setFresh] = useState(""), [done, setDone] = useState(false);
  const a = address ? game.mail.accounts.find((x) => `${x.local}@${x.domain}` === address && x.closedAt === null) : undefined;
  const letter = a?.reset ? game.letters.find((l) => l.id === a.reset!.letter) : undefined;
  const body = (() => {
    if (done) return <><p className="gg-ok">{t("goggle.recovery.done")}</p><a href="#signin" onClick={(e) => { e.preventDefault(); accounts(""); }}>{t("goggle.signin.submit")}</a></>;
    if (!letter) return (
      <form className="gg-form" onSubmit={(e) => { e.preventDefault(); const v = typed.trim().toLowerCase(); if (act(requestPasswordReset, v).ok) setAddress(v); }}>
        <label>{t("goggle.signin.email")}<input name="address" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" /></label>
        <button type="submit">{t("goggle.signup.next")}</button>
      </form>
    );
    if (!letter.arrived) return <><p>{t("goggle.recovery.sent", { company: game.company.name })}</p><p>{t("goggle.recovery.due", { date: day(letter.at) })}</p></>;
    return (
      <form className="gg-form" onSubmit={(e) => { e.preventDefault(); if (act(resetPassword, address, code, fresh).ok) { setDone(true); setAddress(""); } }}>
        <p>{address}</p>
        <label>{t("goggle.recovery.code")}<input name="code" value={code} onChange={(e) => setCode(e.target.value)} autoComplete="one-time-code" /></label>
        <label>{t("goggle.recovery.new")}<input name="new" type="password" value={fresh} onChange={(e) => setFresh(e.target.value)} autoComplete="new-password" /></label>
        <button type="submit">{t("goggle.recovery.save")}</button>
      </form>
    );
  })();
  return <section className="gg-signin gg-signin-card"><h1 className="gg-word"><GoggleMark className="gg-mark" />Goggle</h1><div className="gg-form"><h2>{t("goggle.recovery.title")}</h2>{body}</div></section>;
}

