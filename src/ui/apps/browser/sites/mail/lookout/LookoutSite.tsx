import { useState, type MouseEvent, type ReactNode } from "react";
import { t } from "../../../../../../i18n/en";
import { LOCALE } from "../../../../../../i18n/lang";
import { euroCents } from "../../../../../../sim/00-core/money";
import { dateOf, nextMonthStart, yearOf } from "../../../../../../sim/00-core/time";
import { LOOKOUT_ADMIN, LOOKOUT_AUTODISCOVER, LOOKOUT_OWA, LOOKOUT_SPF, lookoutLook, lookoutToken } from "../../../../../../sim/10-catalog/mail-hosted";
import { GRACE_DAYS, mailboxCap, mailPlan, mxSetAt, quotaMbAt } from "../../../../../../sim/10-catalog/mail-providers";
import { companyDomain } from "../../../../../../sim/30-customers/domains";
import { checkMailLogin, openBoxes, seatsBilled } from "../../../../../../sim/42-mail/accounts";
import { deliveryTrace } from "../../../../../../sim/42-mail/deliver";
import type { MailAccount, MailAct, MailTenant } from "../../../../../../sim/42-mail/types";
import type { GameState } from "../../../../../../sim/50-state";
import { mxHostsAt, recordAt } from "../../../../../../sim/60-infra/company-zone";
import { registrarUrl } from "../../../../../../sim/80-business/browser";
import { endTenant, resubscribe, setTenantPlan } from "../../../../../../sim/90-actions/mail";
import { addOrgRule, signUpLookout, verifyLookout } from "../../../../../../sim/90-actions/mail-hosted";
import { createMailAccount, deleteFilter, deleteMailAccount, importMail, requestPasswordReset, resetPassword, setAccountPassword } from "../../../../../../sim/90-actions/mailbox";
import { LookoutMark } from "../../../../../art/mailmarks";
import { useSessionState, writeSession } from "../../../../../session";
import { offerLogin, savedLogin } from "../../../../../vault";
import { usePageAct } from "../../../pageAct";
import { ImportRuns, LeftBehind } from "../switching";
import "./lookout.css";

// docs/design/plans/webmail-server.md, 7.2: the sign-up site and the admin center of Lookout 365.
export const LOOKOUT_SESSION = "lookout.account";
const PLANS = ["business", "standard"] as const;
const PAGES = ["home", "users", "shared", "domains", "mailflow", "trace", "migration", "billing"] as const;

const price = (plan: string, hour: number) => mailPlan("lookout", plan)!.price(yearOf(hour));
const gb = (mb: number) => (mb / 1024).toLocaleString(LOCALE, { maximumFractionDigits: 0 });
const day = (hour: number) => dateOf(hour).toLocaleDateString(LOCALE, { timeZone: "UTC" });
const when = (min: number) => new Intl.DateTimeFormat(LOCALE, { dateStyle: "short", timeStyle: "short", timeZone: "UTC" }).format(dateOf(min / 60));
const addressOf = (a: MailAccount) => `${a.local}@${a.domain}`;
const isAdmin = (game: GameState, a: MailAccount) => game.mail.tenants.some((x) => x.id === a.tenant && x.host === "lookout" && x.admin === a.id);

export const lookoutTitle = (host: string): string => (host === LOOKOUT_ADMIN ? t("lookout.admin.title") : "Lookout 365");

interface SiteProps { game: GameState; host: string; path: string; go: (url: string) => void }
type To = (path: string) => void;

function Link({ to, path, children, className }: { to: To; path: string; children: ReactNode; className?: string }) {
  const click = (e: MouseEvent) => { e.preventDefault(); to(path); };
  return <a href={`#${path}`} className={className} onClick={click}>{children}</a>;
}

export function LookoutSite({ game, host, path, go }: SiteProps) {
  const [route, query = ""] = path.replace(/^\/+/, "").split("?");
  const params = new URLSearchParams(query);
  const site: To = (p) => go(`www.lookout365.macrosoft.com/${p}`), admin: To = (p) => go(`${LOOKOUT_ADMIN}/${p}`);
  const [signedIn, setSession] = useSessionState<string | null>(LOOKOUT_SESSION, null);
  const setSignedIn = (id: string | null) => { writeSession(LOOKOUT_SESSION, id); setSession(id); };
  const account = game.mail.accounts.find((a) => a.id === signedIn && a.closedAt === null && isAdmin(game, a)) ?? null;
  const tenant = account ? game.mail.tenants.find((x) => x.id === account.tenant) : undefined;
  if (host === LOOKOUT_ADMIN) {
    if (route === "reset") return <Shell look={lookoutLook(game.hour)}><Reset game={game} to={admin} /></Shell>;
    if (!account || !tenant) return <Shell look={lookoutLook(game.hour)}><SignIn game={game} to={admin} signIn={setSignedIn} /></Shell>;
    return <Admin game={game} tenant={tenant} admin={account} page={route || "home"} to={admin} go={go} out={() => { setSignedIn(null); site(""); }} />;
  }
  const page = route === "pricing" ? <Pricing game={game} to={site} />
    : route === "signup" ? <SignUp game={game} admin={admin} signIn={setSignedIn} wanted={params.get("plan")} />
      : <Home game={game} to={site} />;
  return (
    <div className="lk lk-site">
      <header className="lk-head">
        <Link to={site} path="" className="lk-logo"><LookoutMark className="lk-mark" /><b>Lookout 365</b></Link>
        <nav className="lk-nav">
          <Link to={site} path="pricing">{t("lookout.nav.pricing")}</Link>
          <a href="#mail" onClick={(e) => { e.preventDefault(); go(`${LOOKOUT_OWA}/`); }}>{t("lookout.nav.mail")}</a>
          <a href="#admin" onClick={(e) => { e.preventDefault(); admin(""); }}>{t("lookout.nav.admin")}</a>
        </nav>
      </header>
      <main className="lk-main">{page}</main>
      <footer className="lk-foot">{t("lookout.footer", { year: yearOf(game.hour) })}</footer>
    </div>
  );
}

function Shell({ look, children }: { look: string; children: ReactNode }) {
  return <div className={`lk lk-admin lk-${look}`}><main className="lk-main">{children}</main></div>;
}

function Home({ game, to }: { game: GameState; to: To }) {
  return (
    <section className="lk-hero">
      <h1>{t("lookout.home.title")}</h1>
      <p>{t("lookout.home.lead", { price: euroCents(price("business", game.hour)) })}</p>
      <Link to={to} path="pricing" className="lk-cta">{t("lookout.home.plans")}</Link>
    </section>
  );
}

function Pricing({ game, to }: { game: GameState; to: To }) {
  const hour = game.hour;
  return (
    <section>
      <h1>{t("lookout.pricing.title")}</h1>
      <div className="lk-cards">{PLANS.map((p) => (
        <article key={p} className="lk-card">
          <h2>{t(`lookout.plan.${p}`)}</h2>
          <p className="lk-price">{t("lookout.value.perUser", { price: euroCents(price(p, hour)) })}</p>
          <ul>
            <li>{t("lookout.pricing.users", { n: mailboxCap("lookout", p, hour) ?? 0 })}</li>
            <li>{t("lookout.pricing.storage", { n: gb(quotaMbAt("lookout", p, hour)) })}</li>
            <li>{t("lookout.pricing.shared")}</li>
          </ul>
          <Link to={to} path={`signup?plan=${p}`} className="lk-cta">{t("lookout.pricing.buy")}</Link>
        </article>
      ))}</div>
    </section>
  );
}

function SignUp({ game, admin, signIn, wanted }: { game: GameState; admin: To; signIn: (id: string) => void; wanted: string | null }) {
  const act = usePageAct(), hour = game.hour;
  const [plan, setPlan] = useState<string>(PLANS.includes(wanted as never) ? wanted! : "business");
  const [domain, setDomain] = useState(game.company.domain ? companyDomain(game) : "");
  const [local, setLocal] = useState("admin"), [title, setTitle] = useState(game.company.name), [password, setPassword] = useState("");
  const clean = domain.trim().toLowerCase(), users = Math.min(mailboxCap("lookout", plan, hour) ?? 0, 1 + game.staff.length);
  const submit = () => {
    const r = act(signUpLookout, { domain: clean, plan, local, title, password });
    if (!r.ok) return;
    const address = `${local.trim().toLowerCase()}@${clean}`;
    offerLogin(game, `mail:${address}`, LOOKOUT_ADMIN, [address, password]);
    signIn(r.id!);
    admin("domains");
  };
  return (
    <section>
      <h1>{t("lookout.signup.title")}</h1>
      <form className="lk-form" onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <fieldset className="lk-choice">
          <legend>{t("lookout.signup.plan")}</legend>
          {PLANS.map((p) => <label key={p}><input type="radio" name="plan" checked={plan === p} onChange={() => setPlan(p)} />{t(`lookout.plan.${p}`)} <small>{t("lookout.value.perUser", { price: euroCents(price(p, hour)) })}</small></label>)}
        </fieldset>
        <label>{t("lookout.signup.domain")}<input name="domain" value={domain} onChange={(e) => setDomain(e.target.value)} autoComplete="off" /></label>
        <label>{t("lookout.signup.name")}<input name="title" value={title} onChange={(e) => setTitle(e.target.value)} autoComplete="off" /></label>
        <label>{t("lookout.signup.user")}<span className="lk-addr"><input name="local" value={local} onChange={(e) => setLocal(e.target.value)} autoComplete="off" />@{clean}</span></label>
        <label>{t("lookout.signup.password")}<input name="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" /></label>
        <dl className="lk-summary">
          <dt>{t("lookout.signup.licences")}</dt><dd>{users}</dd>
          <dt>{t("lookout.billing.total")}</dt><dd data-total>{euroCents(users * price(plan, hour))}</dd>
          <dt>{t("lookout.billing.next")}</dt><dd>{day(nextMonthStart(hour))}</dd>
        </dl>
        <button type="submit" className="lk-cta">{t("lookout.signup.submit")}</button>
      </form>
    </section>
  );
}

function SignIn({ game, to, signIn }: { game: GameState; to: To; signIn: (id: string) => void }) {
  const site = game.mail.accounts.filter((a) => isAdmin(game, a)).map((a) => `mail:${addressOf(a)}`).find((k) => game.logins[k]) ?? "mail:";
  const [saved] = useState(() => savedLogin(game, site, 2));
  const [address, setAddress] = useState(saved[0]), [password, setPassword] = useState(saved[1]), [error, setError] = useState<string | null>(null);
  const submit = () => {
    const r = checkMailLogin(game, address, password);
    if (!r.ok || !isAdmin(game, r.account)) return setError(t(r.ok ? "error.mailAdmin" : r.error));
    offerLogin(game, `mail:${addressOf(r.account)}`, LOOKOUT_ADMIN, [address, password]);
    signIn(r.account.id);
    to("");
  };
  return (
    <form className="lk-form lk-signin" onSubmit={(e) => { e.preventDefault(); submit(); }}>
      <h1>{t("lookout.signin.title")}</h1>
      <label>{t("lookout.signin.user")}<input name="address" value={address} onChange={(e) => setAddress(e.target.value)} autoComplete="off" /></label>
      <label>{t("lookout.signup.password")}<input name="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="off" /></label>
      {error && <p className="lk-error" role="alert">{error}</p>}
      <button type="submit" className="lk-cta">{t("lookout.signin.submit")}</button>
      <Link to={to} path="reset" className="lk-small">{t("lookout.signin.forgot")}</Link>
    </form>
  );
}

function Reset({ game, to }: { game: GameState; to: To }) {
  const act = usePageAct();
  const [address, setAddress] = useSessionState("lookout.reset", ""), [typed, setTyped] = useState(address);
  const [code, setCode] = useState(""), [fresh, setFresh] = useState(""), [done, setDone] = useState(false);
  const a = address ? game.mail.accounts.find((x) => addressOf(x) === address && x.closedAt === null) : undefined;
  const letter = a?.reset ? game.letters.find((l) => l.id === a.reset!.letter) : undefined;
  const body = done ? <><p className="lk-ok">{t("lookout.reset.done")}</p><Link to={to} path="" className="lk-cta">{t("lookout.signin.submit")}</Link></>
    : !letter ? (
      <form className="lk-form" onSubmit={(e) => { e.preventDefault(); const v = typed.trim().toLowerCase(); if (act(requestPasswordReset, v).ok) setAddress(v); }}>
        <label>{t("lookout.signin.user")}<input name="address" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" /></label>
        <button type="submit" className="lk-cta">{t("lookout.reset.send")}</button>
      </form>
    ) : !letter.arrived ? <p data-letter>{t("lookout.reset.sent", { company: game.company.name, date: day(letter.at) })}</p>
      : (
        <form className="lk-form" onSubmit={(e) => { e.preventDefault(); if (act(resetPassword, address, code, fresh).ok) { setDone(true); setAddress(""); } }}>
          <p>{address}</p>
          <label>{t("lookout.reset.code")}<input name="code" value={code} onChange={(e) => setCode(e.target.value)} autoComplete="one-time-code" /></label>
          <label>{t("lookout.reset.new")}<input name="new" type="password" value={fresh} onChange={(e) => setFresh(e.target.value)} autoComplete="new-password" /></label>
          <button type="submit" className="lk-cta">{t("lookout.reset.save")}</button>
        </form>
      );
  return <section className="lk-signin"><h1>{t("lookout.reset.title")}</h1>{body}</section>;
}

interface AdminProps { game: GameState; tenant: MailTenant; admin: MailAccount }

function Admin({ game, tenant, admin, page, to, go, out }: AdminProps & { page: string; to: To; go: (url: string) => void; out: () => void }) {
  const look = lookoutLook(game.hour);
  const body = page === "users" ? <Users game={game} tenant={tenant} admin={admin} shared={false} />
    : page === "shared" ? <Users game={game} tenant={tenant} admin={admin} shared />
      : page === "domains" ? <Domains game={game} tenant={tenant} admin={admin} go={go} />
        : page === "mailflow" ? <MailFlow game={game} tenant={tenant} admin={admin} />
          : page === "trace" ? <Trace game={game} tenant={tenant} admin={admin} />
            : page === "migration" ? <Migration game={game} tenant={tenant} admin={admin} />
              : page === "billing" ? <Billing game={game} tenant={tenant} admin={admin} />
                : <Dashboard game={game} tenant={tenant} admin={admin} />;
  return (
    <div className={`lk lk-admin lk-${look}`}>
      <header className="lk-bar">
        <LookoutMark className="lk-mark" /><b>{t(`lookout.admin.brand.${look}`)}</b>
        <span>{admin.title}</span>
        <a href="#mail" onClick={(e) => { e.preventDefault(); go(`${LOOKOUT_OWA}/`); }}>{t("lookout.nav.mail")}</a>
        <a href="#out" onClick={(e) => { e.preventDefault(); out(); }}>{t("lookout.admin.signOut")}</a>
      </header>
      <div className="lk-body">
        <nav className="lk-side"><ul>{PAGES.map((p) => <li key={p} className={p === page || (p === "home" && !PAGES.includes(page as never)) ? "on" : ""}><Link to={to} path={p === "home" ? "" : p}>{t(`lookout.page.${p}`)}</Link></li>)}</ul></nav>
        <main className="lk-panel">
          {tenant.endsAt !== null && <p className="lk-error" data-ends>{t("lookout.billing.ends", { date: day(tenant.endsAt) })}</p>}
          {body}
        </main>
      </div>
    </div>
  );
}

const total = (game: GameState, tenant: MailTenant, extra = 0) => euroCents((seatsBilled(game, tenant) + extra) * price(tenant.plan, game.hour));

function Dashboard({ game, tenant }: AdminProps) {
  const users = openBoxes(game, tenant.id).filter((a) => !a.shared).length;
  return (
    <>
      <h1>{t("lookout.page.home")}</h1>
      <dl className="lk-summary">
        <dt>{t("lookout.page.users")}</dt><dd>{users}</dd>
        <dt>{t("lookout.domains.status")}</dt><dd>{t(tenant.verified ? "lookout.domains.verified" : "lookout.domains.unverified")}</dd>
        <dt>{t("lookout.billing.total")}</dt><dd>{total(game, tenant)}</dd>
      </dl>
    </>
  );
}

function Users({ game, tenant, admin, shared }: AdminProps & { shared: boolean }) {
  const act = usePageAct(), boxes = openBoxes(game, tenant.id).filter((a) => !!a.shared === shared);
  const [local, setLocal] = useState(""), [title, setTitle] = useState(""), [password, setPassword] = useState("");
  const [reset, setReset] = useState<string | null>(null), [fresh, setFresh] = useState(""), [done, setDone] = useState(false);
  const free = mailHostFree(game, tenant);
  return (
    <>
      <h1>{t(shared ? "lookout.page.shared" : "lookout.page.users")}</h1>
      <table className="lk-table" data-table={shared ? "shared" : "users"}>
        <thead><tr><th>{t("lookout.users.name")}</th><th>{t("lookout.users.address")}</th>{!shared && <th>{t("lookout.users.licence")}</th>}<th /></tr></thead>
        <tbody>{boxes.map((a) => (
          <tr key={a.id}>
            <td>{a.title}</td><td>{addressOf(a)}</td>
            {!shared && <td>{t(`lookout.plan.${tenant.plan}`)}</td>}
            <td className="lk-tools">
              {!shared && a.id !== admin.id && <button type="button" className="lk-quiet" onClick={() => { setReset(a.id); setFresh(""); setDone(false); }}>{t("lookout.users.reset")}</button>}
              {a.id !== admin.id && <button type="button" className="lk-quiet" onClick={() => act(deleteMailAccount, a.id)}>{t("lookout.users.delete")}</button>}
            </td>
          </tr>
        ))}</tbody>
      </table>
      {reset && (
        <form className="lk-form lk-inline" onSubmit={(e) => { e.preventDefault(); if (act(setAccountPassword, admin.id, reset, fresh).ok) { setReset(null); setDone(true); } }}>
          <label>{t("lookout.reset.new")}<input name="fresh" type="password" value={fresh} onChange={(e) => setFresh(e.target.value)} autoComplete="new-password" /></label>
          <button type="submit" className="lk-cta">{t("lookout.reset.save")}</button>
        </form>
      )}
      {done && <p className="lk-ok">{t("lookout.reset.done")}</p>}
      <form className="lk-form lk-inline" onSubmit={(e) => { e.preventDefault(); if (act(createMailAccount, { tenant: tenant.id, local, title, password, shared }).ok) { setLocal(""); setTitle(""); setPassword(""); } }}>
        <h2>{t(shared ? "lookout.shared.add" : "lookout.users.add")}</h2>
        <label>{t("lookout.users.name")}<input name="title" value={title} onChange={(e) => setTitle(e.target.value)} autoComplete="off" /></label>
        <label>{t("lookout.users.address")}<span className="lk-addr"><input name="local" value={local} onChange={(e) => setLocal(e.target.value)} autoComplete="off" />@{tenant.domain}</span></label>
        {!shared && <label>{t("lookout.signup.password")}<input name="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" /></label>}
        <p data-total>{shared ? t("lookout.shared.free", { total: total(game, tenant) }) : t("lookout.users.totals", { now: total(game, tenant), after: total(game, tenant, 1), free })}</p>
        <button type="submit" className="lk-cta">{t("lookout.users.create")}</button>
      </form>
    </>
  );
}

const mailHostFree = (game: GameState, tenant: MailTenant) => Math.max(0, (mailboxCap("lookout", tenant.plan, tenant.since) ?? 0) - openBoxes(game, tenant.id).length);

function Domains({ game, tenant, go }: AdminProps & { go: (url: string) => void }) {
  const act = usePageAct(), token = lookoutToken(game.seed, tenant.domain), mx = mxHostsAt(game, game.hour);
  const txt = recordAt(game, "TXT", "@", game.hour).map((r) => r.data.replace(/"/g, "").trim());
  const cname = recordAt(game, "CNAME", "autodiscover", game.hour).some((r) => r.data.replace(/\.$/, "") === LOOKOUT_AUTODISCOVER);
  const rows: [string, string, string, boolean][] = [
    ["TXT", "@", token, txt.includes(token)],
    ...mxSetAt("lookout", tenant.domain, game.hour).map(([p, h]): [string, string, string, boolean] => ["MX", "@", `${p} ${h}`, mx.includes(h)]),
    ["TXT", "@", LOOKOUT_SPF, txt.includes(LOOKOUT_SPF)],
    ["CNAME", "autodiscover", LOOKOUT_AUTODISCOVER, cname],
  ];
  return (
    <>
      <h1>{t("lookout.page.domains")}</h1>
      <p className={tenant.verified ? "lk-ok" : "lk-error"} data-verified={tenant.verified}>{tenant.domain}: {t(tenant.verified ? "lookout.domains.verified" : "lookout.domains.unverified")}</p>
      <table className="lk-table" data-table="records">
        <thead><tr><th>{t("lookout.domains.type")}</th><th>{t("lookout.domains.host")}</th><th>{t("lookout.domains.value")}</th><th>{t("lookout.domains.status")}</th></tr></thead>
        <tbody>{rows.map(([type, name, value, ok]) => <tr key={value}><td>{type}</td><td>{name}</td><td><code>{value}</code></td><td>{t(ok ? "lookout.domains.ok" : "lookout.domains.missing")}</td></tr>)}</tbody>
      </table>
      <div className="lk-buttons">
        {!tenant.verified && <button type="button" className="lk-cta" onClick={() => act(verifyLookout, tenant.id)}>{t("lookout.domains.verify")}</button>}
        <button type="button" className="lk-quiet" onClick={() => go(`${registrarUrl(game)}login/dns`)}>{t("lookout.domains.registrar")}</button>
      </div>
    </>
  );
}

const RULE_ACTS = ["junk", "read", "trash"] as const;

function MailFlow({ game, tenant }: AdminProps) {
  const act = usePageAct(), ids = new Set(openBoxes(game, tenant.id).map((a) => a.id));
  const rules = game.mail.filters.filter((f) => ids.has(f.accountId));
  const [field, setField] = useState<"from" | "subject">("subject"), [value, setValue] = useState(""), [does, setDoes] = useState<(typeof RULE_ACTS)[number]>("junk");
  const box = (id: string) => game.mail.accounts.find((a) => a.id === id);
  const add = () => {
    const a: MailAct = { do: does };
    if (act(addOrgRule, tenant.id, { name: value, on: true, match: "all", conds: [{ field, op: "contains", value }], acts: [a] }).ok) setValue("");
  };
  return (
    <>
      <h1>{t("lookout.page.mailflow")}</h1>
      <table className="lk-table" data-table="rules">
        <thead><tr><th>{t("lookout.flow.rule")}</th><th>{t("lookout.users.address")}</th><th /></tr></thead>
        <tbody>{rules.map((f) => <tr key={f.id}><td>{f.name}</td><td>{box(f.accountId) && addressOf(box(f.accountId)!)}</td><td><button type="button" className="lk-quiet" onClick={() => act(deleteFilter, f.id)}>{t("lookout.users.delete")}</button></td></tr>)}</tbody>
      </table>
      <form className="lk-form lk-inline" onSubmit={(e) => { e.preventDefault(); add(); }}>
        <h2>{t("lookout.flow.add")}</h2>
        <label>{t("lookout.flow.if")}<select value={field} onChange={(e) => setField(e.target.value as typeof field)}>{(["subject", "from"] as const).map((k) => <option key={k} value={k}>{t(`lookout.flow.field.${k}`)}</option>)}</select></label>
        <label>{t("lookout.flow.contains")}<input name="ruleValue" value={value} onChange={(e) => setValue(e.target.value)} autoComplete="off" /></label>
        <label>{t("lookout.flow.then")}<select value={does} onChange={(e) => setDoes(e.target.value as typeof does)}>{RULE_ACTS.map((k) => <option key={k} value={k}>{t(`lookout.flow.do.${k}`)}</option>)}</select></label>
        <button type="submit" className="lk-cta">{t("lookout.flow.save")}</button>
      </form>
    </>
  );
}

function Trace({ game, tenant }: AdminProps) {
  const [address, setAddress] = useState(""), [shown, setShown] = useState<string | null>(null);
  const rows = shown === null ? [] : deliveryTrace(game, { sinceHours: 24 * 7, ...(shown && { address: shown }) }).filter((e) => e.to.endsWith(`@${tenant.domain}`));
  return (
    <>
      <h1>{t("lookout.page.trace")}</h1>
      <form className="lk-form lk-inline" onSubmit={(e) => { e.preventDefault(); setShown(address.trim().toLowerCase()); }}>
        <label>{t("lookout.trace.recipient")}<input name="recipient" value={address} onChange={(e) => setAddress(e.target.value)} autoComplete="off" /></label>
        <button type="submit" className="lk-cta">{t("lookout.trace.search")}</button>
      </form>
      {shown !== null && (rows.length ? (
        <table className="lk-table" data-table="trace">
          <thead><tr><th>{t("lookout.trace.date")}</th><th>{t("lookout.trace.sender")}</th><th>{t("lookout.trace.recipient")}</th><th>{t("lookout.trace.status")}</th><th>{t("lookout.trace.detail")}</th></tr></thead>
          <tbody>{rows.map((e, i) => <tr key={i}><td>{when(e.at)}</td><td>{e.from.replace(/^(n|ext|acct):/, "")}</td><td>{e.to}</td><td>{t(`lookout.trace.result.${e.result}`)}</td><td>{t(`lookout.trace.why.${e.why}`)}</td></tr>)}</tbody>
        </table>
      ) : <p>{t("lookout.trace.none")}</p>)}
    </>
  );
}

function Migration({ game, tenant }: AdminProps) {
  const act = usePageAct(), boxes = openBoxes(game, tenant.id);
  const [target, setTarget] = useState(boxes[0]?.id ?? ""), [source, setSource] = useState(""), [password, setPassword] = useState("");
  return (
    <>
      <h1>{t("lookout.page.migration")}</h1>
      <form className="lk-form" onSubmit={(e) => { e.preventDefault(); if (act(importMail, target, { source, password, proto: "imap" }).ok) { setSource(""); setPassword(""); } }}>
        <label>{t("lookout.migration.source")}<input name="source" value={source} onChange={(e) => setSource(e.target.value)} autoComplete="off" /></label>
        <label>{t("lookout.signup.password")}<input name="sourcePassword" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="off" /></label>
        <label>{t("lookout.migration.target")}<select name="target" value={target} onChange={(e) => setTarget(e.target.value)}>{boxes.map((a) => <option key={a.id} value={a.id}>{addressOf(a)}</option>)}</select></label>
        <button type="submit" className="lk-cta">{t("lookout.migration.start")}</button>
      </form>
      <ImportRuns game={game} into={boxes.map((a) => a.id)} className="lk-table" />
    </>
  );
}

function Billing({ game, tenant }: AdminProps) {
  const act = usePageAct(), [asking, setAsking] = useState(false);
  return (
    <>
      <h1>{t("lookout.page.billing")}</h1>
      <dl className="lk-summary">
        <dt>{t("lookout.signup.plan")}</dt><dd>{t(`lookout.plan.${tenant.plan}`)}</dd>
        <dt>{t("lookout.signup.licences")}</dt><dd>{seatsBilled(game, tenant)}</dd>
        <dt>{t("lookout.billing.available")}</dt><dd>{mailHostFree(game, tenant)}</dd>
        <dt>{t("lookout.billing.total")}</dt><dd>{total(game, tenant)}</dd>
      </dl>
      <div className="lk-buttons">{PLANS.filter((p) => p !== tenant.plan).map((p) => (
        <button key={p} type="button" className="lk-quiet" onClick={() => act(setTenantPlan, tenant.id, p)}>{t("lookout.billing.switch", { plan: t(`lookout.plan.${p}`), price: euroCents(price(p, game.hour)) })}</button>
      ))}</div>
      <h2>{t("lookout.billing.cancelTitle")}</h2>
      <LeftBehind game={game} tenantId={tenant.id} className="lk-error" />
      {tenant.endsAt !== null ? <button type="button" className="lk-quiet" onClick={() => act(resubscribe, tenant.id)}>{t("lookout.billing.reactivate")}</button>
        : asking ? (
          <p className="lk-confirm">{t("lookout.billing.cancelConfirm", { days: GRACE_DAYS.lookout })}
            <button type="button" className="lk-danger" onClick={() => { setAsking(false); act(endTenant, tenant.id); }}>{t("lookout.billing.cancel")}</button>
            <button type="button" className="lk-quiet" onClick={() => setAsking(false)}>{t("lookout.billing.keep")}</button>
          </p>
        ) : <button type="button" className="lk-danger" onClick={() => setAsking(true)}>{t("lookout.billing.cancel")}</button>}
    </>
  );
}
