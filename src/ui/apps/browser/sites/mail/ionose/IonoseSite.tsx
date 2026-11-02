import { useState, type MouseEvent, type ReactNode } from "react";
import { t } from "../../../../../../i18n/en";
import { LOCALE } from "../../../../../../i18n/lang";
import { euroCents } from "../../../../../../sim/00-core/money";
import { dateOf, nextMonthStart, yearOf } from "../../../../../../sim/00-core/time";
import { mailSiteUrl } from "../../../../../../sim/10-catalog/mail-consumer";
import { IONOSE_OWA, IONOSE_SPF, ionoseLook } from "../../../../../../sim/10-catalog/mail-hosted";
import { GRACE_DAYS, mailboxCap, mailHost, mailPlan, mxSetAt, quotaMbAt } from "../../../../../../sim/10-catalog/mail-providers";
import { companyDomain } from "../../../../../../sim/30-customers/domains";
import { checkMailLogin, openBoxes, PROVIDER_NAMES, seatsBilled } from "../../../../../../sim/42-mail/accounts";
import { capsOf, mxTarget } from "../../../../../../sim/42-mail/caps";
import { leftBehind } from "../../../../../../sim/42-mail/imports";
import type { MailAccount, MailRole, MailTenant } from "../../../../../../sim/42-mail/types";
import type { GameState } from "../../../../../../sim/50-state";
import { mxHostsAt, recordAt } from "../../../../../../sim/60-infra/company-zone";
import { registrarUrl } from "../../../../../../sim/80-business/browser";
import { endTenant, resubscribe, setTenantPlan } from "../../../../../../sim/90-actions/mail";
import { checkIonoseDomain, orderIonose } from "../../../../../../sim/90-actions/mail-hosted";
import {
  addAlias, createMailAccount, deleteMailAccount, removeAlias, requestPasswordReset, resetPassword, setAccountPassword, setAccountRoles, setCatchAll, setForward, setPrimary,
} from "../../../../../../sim/90-actions/mailbox";
import { setVacation } from "../../../../../../sim/90-actions/mailmsg";
import { IonoseMark } from "../../../../../art/mailmarks";
import { useSessionState, writeSession } from "../../../../../session";
import { offerLogin, savedLogin } from "../../../../../vault";
import { usePageAct } from "../../../pageAct";
import { ImportForm, ImportRuns, LeftBehind } from "../switching";
import "./ionose.css";

// docs/design/plans/webmail-server.md, 7.1: the product site, the order and the Control area of Hosted Exchange.
export const IONOSE_SESSION = "ionose.account";
const PLANS = ["exchange", "business"] as const;
const TABS = ["mailboxes", "addresses", "forwarding", "vacation", "plan", "domain", "import", "switch"] as const;
const ROLES: MailRole[] = ["sales", "support", "abuse"];
const HOST = mailSiteUrl("ionose").split("/")[0];

const price = (plan: string, hour: number) => mailPlan("ionose", plan)!.price(yearOf(hour));
const gb = (mb: number) => (mb / 1024).toLocaleString(LOCALE, { maximumFractionDigits: 1 });
const day = (hour: number) => dateOf(hour).toLocaleDateString(LOCALE, { timeZone: "UTC" });
const addressOf = (a: MailAccount) => `${a.local}@${a.domain}`;

export const ionoseTitle = (path: string): string => (path.replace(/^\/+/, "").startsWith("control") ? t("ionose.control.title") : "Ionose");

interface SiteProps { game: GameState; path: string; go: (url: string) => void }
type To = (path: string) => void;

function Link({ to, path, children, className }: { to: To; path: string; children: ReactNode; className?: string }) {
  const click = (e: MouseEvent) => { e.preventDefault(); to(path); };
  return <a href={`#${path}`} className={className} onClick={click}>{children}</a>;
}

function Confirm({ label, ask, onYes, danger }: { label: string; ask: string; onYes: () => void; danger?: boolean }) {
  const [asking, setAsking] = useState(false);
  if (!asking) return <button type="button" className={danger ? "io-danger" : "io-quiet"} onClick={() => setAsking(true)}>{label}</button>;
  return (
    <span className="io-confirm">{ask}
      <button type="button" className="io-danger" onClick={() => { setAsking(false); onYes(); }}>{t("ionose.yes")}</button>
      <button type="button" className="io-quiet" onClick={() => setAsking(false)}>{t("ionose.no")}</button>
    </span>
  );
}

export function IonoseSite({ game, path, go }: SiteProps) {
  const [route, query = ""] = path.replace(/^\/+/, "").split("?");
  const params = new URLSearchParams(query), look = ionoseLook(game.hour);
  const to: To = (p) => go(mailSiteUrl("ionose", p));
  const [signedIn, setSession] = useSessionState<string | null>(IONOSE_SESSION, null);
  const setSignedIn = (id: string | null) => { writeSession(IONOSE_SESSION, id); setSession(id); };
  const account = game.mail.accounts.find((a) => a.id === signedIn && a.closedAt === null) ?? null;
  const tenant = account ? game.mail.tenants.find((x) => x.id === account.tenant && x.host === "ionose" && x.admin === account.id) : undefined;
  const page = (() => {
    if (route === "exchange") return <Plans game={game} to={to} />;
    if (route === "order") return <Order game={game} to={to} signIn={setSignedIn} wanted={params.get("plan")} />;
    if (route === "control/forgot") return <Forgot game={game} to={to} />;
    if (route === "control/reset") return <Reset to={to} />;
    if (route.startsWith("control")) {
      if (!account || !tenant) return <SignIn game={game} to={to} signIn={setSignedIn} />;
      return <Control game={game} to={to} go={go} tenant={tenant} admin={account} tab={route.split("/")[1] || "mailboxes"} />;
    }
    return <Home game={game} to={to} />;
  })();
  return (
    <div className={`io io-${look}`}>
      <header className="io-head">
        <Link to={to} path="" className="io-logo"><IonoseMark className="io-mark" /><b>Ionose</b></Link>
        <nav className="io-nav">
          <Link to={to} path="exchange">{t("ionose.nav.exchange")}</Link>
          <a href="#owa" onClick={(e) => { e.preventDefault(); go(`${IONOSE_OWA}/`); }}>{t("ionose.nav.webmail")}</a>
          {account && tenant
            ? <a href="#out" onClick={(e) => { e.preventDefault(); setSignedIn(null); to(""); }}>{t("ionose.nav.logout")}</a>
            : <Link to={to} path="control">{t("ionose.nav.login")}</Link>}
        </nav>
      </header>
      <main className="io-main">{page}</main>
      <footer className="io-foot">{t("ionose.footer", { year: yearOf(game.hour) })}</footer>
    </div>
  );
}

function Home({ game, to }: { game: GameState; to: To }) {
  return (
    <section className="io-hero">
      <h1>{t("ionose.home.title")}</h1>
      <p>{t("ionose.home.lead", { price: euroCents(price("exchange", game.hour)) })}</p>
      <div className="io-buttons"><Link to={to} path="exchange" className="io-cta">{t("ionose.home.plans")}</Link></div>
    </section>
  );
}

function Plans({ game, to }: { game: GameState; to: To }) {
  const h = mailHost("ionose")!, hour = game.hour;
  const rows: [string, (p: string) => ReactNode][] = [
    ["ionose.plans.price", (p) => t("ionose.value.perMailbox", { price: euroCents(price(p, hour)) })],
    ["ionose.plans.mailboxes", (p) => String(mailboxCap("ionose", p, hour))],
    ["ionose.plans.quota", (p) => t("ionose.value.gb", { n: gb(quotaMbAt("ionose", p, hour)) })],
    ["ionose.plans.aliases", () => String(h.aliasMax)],
    ["ionose.plans.webmail", () => t("ionose.value.yes")],
    ["ionose.plans.imap", () => t("ionose.value.yes")],
  ];
  return (
    <section className="io-page">
      <h1>{t("ionose.plans.title")}</h1>
      <table className="io-table io-plans">
        <thead><tr><th />{PLANS.map((p) => <th key={p}>{t(`ionose.plan.${p}`)}</th>)}</tr></thead>
        <tbody>
          {rows.map(([k, f]) => <tr key={k}><th>{t(k)}</th>{PLANS.map((p) => <td key={p}>{f(p)}</td>)}</tr>)}
          <tr><th />{PLANS.map((p) => <td key={p}><Link to={to} path={`order?plan=${p}`} className="io-cta">{t("ionose.plans.order")}</Link></td>)}</tr>
        </tbody>
      </table>
    </section>
  );
}

function Order({ game, to, signIn, wanted }: { game: GameState; to: To; signIn: (id: string) => void; wanted: string | null }) {
  const act = usePageAct(), hour = game.hour;
  const [plan, setPlan] = useState<string>(PLANS.includes(wanted as never) ? wanted! : "exchange");
  const [domain, setDomain] = useState(game.company.domain ? companyDomain(game) : "");
  const [local, setLocal] = useState("info"), [title, setTitle] = useState(game.company.name);
  const [password, setPassword] = useState(""), [repeat, setRepeat] = useState(""), [error, setError] = useState<string | null>(null);
  const cap = mailboxCap("ionose", plan, hour) ?? 0, boxes = Math.min(cap, 1 + game.staff.length), clean = domain.trim().toLowerCase();
  const submit = () => {
    if (password !== repeat) return setError(t("ionose.order.mismatch"));
    setError(null);
    const r = act(orderIonose, { domain: clean, plan, local, title, password });
    if (!r.ok) return;
    const address = `${local.trim().toLowerCase()}@${clean}`;
    offerLogin(game, `mail:${address}`, HOST, [address, password]);
    signIn(r.id!);
    to("control/domain");
  };
  return (
    <section className="io-page">
      <h1>{t("ionose.order.title")}</h1>
      <form className="io-form" onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <fieldset className="io-choice">
          <legend>{t("ionose.order.plan")}</legend>
          {PLANS.map((p) => <label key={p}><input type="radio" name="plan" checked={plan === p} onChange={() => setPlan(p)} />{t(`ionose.plan.${p}`)} <small>{t("ionose.value.perMailbox", { price: euroCents(price(p, hour)) })}</small></label>)}
        </fieldset>
        <label>{t("ionose.order.domain")}<input name="domain" value={domain} onChange={(e) => setDomain(e.target.value)} autoComplete="off" /></label>
        <label>{t("ionose.order.name")}<input name="title" value={title} onChange={(e) => setTitle(e.target.value)} autoComplete="off" /></label>
        <label>{t("ionose.order.mailbox")}<span className="io-addr"><input name="local" value={local} onChange={(e) => setLocal(e.target.value)} autoComplete="off" />@{clean}</span></label>
        <label>{t("ionose.order.password")}<input name="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" /></label>
        <label>{t("ionose.order.repeat")}<input name="repeat" type="password" value={repeat} onChange={(e) => setRepeat(e.target.value)} autoComplete="new-password" /></label>
        <dl className="io-summary">
          <dt>{t("ionose.order.boxes")}</dt><dd>{boxes}</dd>
          <dt>{t("ionose.order.total")}</dt><dd data-total>{euroCents(boxes * price(plan, hour))}</dd>
          <dt>{t("ionose.order.firstInvoice")}</dt><dd>{day(nextMonthStart(hour))}</dd>
        </dl>
        {error && <p className="io-error" role="alert">{error}</p>}
        <div className="io-buttons"><button type="submit">{t("ionose.order.submit")}</button></div>
      </form>
    </section>
  );
}

function SignIn({ game, to, signIn }: { game: GameState; to: To; signIn: (id: string) => void }) {
  const site = game.mail.accounts.filter((a) => game.mail.tenants.some((x) => x.id === a.tenant && x.host === "ionose")).map((a) => `mail:${addressOf(a)}`).find((k) => game.logins[k]) ?? "mail:";
  const [saved] = useState(() => savedLogin(game, site, 2));
  const [address, setAddress] = useState(saved[0]), [password, setPassword] = useState(saved[1]), [error, setError] = useState<string | null>(null);
  const submit = () => {
    const r = checkMailLogin(game, address, password);
    const admin = r.ok && game.mail.tenants.some((x) => x.id === r.account.tenant && x.host === "ionose" && x.admin === r.account.id);
    if (!r.ok || !admin) return setError(t(r.ok ? "error.mailAdmin" : r.error));
    offerLogin(game, `mail:${addressOf(r.account)}`, HOST, [address, password]);
    signIn(r.account.id);
    to("control");
  };
  return (
    <section className="io-page io-login">
      <h1>{t("ionose.login.title")}</h1>
      <form className="io-form" onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <label>{t("ionose.login.address")}<input name="address" value={address} onChange={(e) => setAddress(e.target.value)} autoComplete="off" /></label>
        <label>{t("ionose.login.password")}<input name="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="off" /></label>
        {error && <p className="io-error" role="alert">{error}</p>}
        <div className="io-buttons"><button type="submit">{t("ionose.login.submit")}</button></div>
        <Link to={to} path="control/forgot" className="io-small">{t("ionose.login.forgot")}</Link>
        <Link to={to} path="exchange" className="io-small">{t("ionose.login.new")}</Link>
      </form>
    </section>
  );
}

function Forgot({ game, to }: { game: GameState; to: To }) {
  const act = usePageAct();
  const [address, setAddress] = useSessionState("ionose.reset", ""), [typed, setTyped] = useState(address);
  const a = address ? game.mail.accounts.find((x) => addressOf(x) === address && x.closedAt === null) : undefined;
  const letter = a?.reset ? game.letters.find((l) => l.id === a.reset!.letter) : undefined;
  return (
    <section className="io-page io-login">
      <h1>{t("ionose.forgot.title")}</h1>
      {letter ? (
        <>
          <p data-letter>{t(letter.arrived ? "ionose.forgot.arrived" : "ionose.forgot.sent", { company: game.company.name, date: day(letter.at) })}</p>
          {letter.arrived && <Link to={to} path="control/reset" className="io-cta">{t("ionose.reset.title")}</Link>}
        </>
      ) : (
        <form className="io-form" onSubmit={(e) => { e.preventDefault(); const v = typed.trim().toLowerCase(); if (act(requestPasswordReset, v).ok) setAddress(v); }}>
          <label>{t("ionose.login.address")}<input name="address" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" /></label>
          <div className="io-buttons"><button type="submit">{t("ionose.forgot.send")}</button></div>
        </form>
      )}
    </section>
  );
}

function Reset({ to }: { to: To }) {
  const act = usePageAct();
  const [address, setAddress] = useState(""), [code, setCode] = useState(""), [fresh, setFresh] = useState(""), [done, setDone] = useState(false);
  if (done) return <section className="io-page io-login"><p className="io-ok">{t("ionose.reset.done")}</p><Link to={to} path="control" className="io-cta">{t("ionose.login.submit")}</Link></section>;
  return (
    <section className="io-page io-login">
      <h1>{t("ionose.reset.title")}</h1>
      <form className="io-form" onSubmit={(e) => { e.preventDefault(); if (act(resetPassword, address.trim().toLowerCase(), code, fresh).ok) { writeSession("ionose.reset", ""); setDone(true); } }}>
        <label>{t("ionose.login.address")}<input name="address" value={address} onChange={(e) => setAddress(e.target.value)} autoComplete="off" /></label>
        <label>{t("ionose.reset.code")}<input name="code" value={code} onChange={(e) => setCode(e.target.value)} autoComplete="one-time-code" /></label>
        <label>{t("ionose.reset.new")}<input name="new" type="password" value={fresh} onChange={(e) => setFresh(e.target.value)} autoComplete="new-password" /></label>
        <div className="io-buttons"><button type="submit">{t("ionose.reset.save")}</button></div>
      </form>
    </section>
  );
}

interface ControlProps { game: GameState; tenant: MailTenant; admin: MailAccount }

function Control({ game, to, go, tenant, admin, tab }: ControlProps & { to: To; go: (url: string) => void; tab: string }) {
  const body = (() => {
    if (tab === "addresses") return <Addresses game={game} tenant={tenant} admin={admin} />;
    if (tab === "forwarding") return <Forwarding game={game} tenant={tenant} admin={admin} />;
    if (tab === "vacation") return <Vacation game={game} tenant={tenant} admin={admin} />;
    if (tab === "plan") return <Plan game={game} tenant={tenant} admin={admin} />;
    if (tab === "domain") return <Domain game={game} tenant={tenant} admin={admin} go={go} />;
    if (tab === "import") return <Migration game={game} tenant={tenant} admin={admin} />;
    if (tab === "switch") return <Switching game={game} tenant={tenant} admin={admin} to={to} />;
    return <Mailboxes game={game} tenant={tenant} admin={admin} />;
  })();
  return (
    <section className="io-control">
      <aside className="io-side">
        <h2>{tenant.domain}</h2>
        <ul>{TABS.map((id) => <li key={id} className={id === tab ? "on" : ""}><Link to={to} path={`control/${id}`}>{t(`ionose.tab.${id}`)}</Link></li>)}</ul>
        <a href="#owa" className="io-cta" onClick={(e) => { e.preventDefault(); go(`${IONOSE_OWA}/`); }}>{t("ionose.nav.webmail")}</a>
      </aside>
      <div className="io-panel">
        {tenant.endsAt !== null && <p className="io-error" data-ends>{t("ionose.plan.ends", { date: day(tenant.endsAt) })}</p>}
        {body}
      </div>
    </section>
  );
}

const total = (game: GameState, tenant: MailTenant, extra = 0) => euroCents((seatsBilled(game, tenant) + extra) * price(tenant.plan, game.hour));

function Mailboxes({ game, tenant, admin }: ControlProps) {
  const act = usePageAct(), boxes = openBoxes(game, tenant.id);
  const [local, setLocal] = useState(""), [title, setTitle] = useState(""), [password, setPassword] = useState("");
  const [reset, setReset] = useState<string | null>(null), [fresh, setFresh] = useState(""), [done, setDone] = useState<string | null>(null);
  const toggle = (a: MailAccount, r: MailRole) => act(setAccountRoles, a.id, a.roles.includes(r) ? a.roles.filter((x) => x !== r) : [...a.roles, r]);
  return (
    <>
      <h1>{t("ionose.tab.mailboxes")}</h1>
      <table className="io-table" data-table="mailboxes">
        <thead><tr><th>{t("ionose.box.name")}</th><th>{t("ionose.box.address")}</th><th>{t("ionose.box.quota")}</th><th>{t("ionose.box.used")}</th><th>{t("ionose.box.receives")}</th><th /></tr></thead>
        <tbody>{boxes.map((a) => (
          <tr key={a.id}>
            <td>{a.title}</td><td>{addressOf(a)}</td>
            <td>{t("ionose.value.gb", { n: gb(capsOf(game, a).quotaMb) })}</td><td>{t("ionose.value.mb", { n: (a.usedKb / 1024).toLocaleString(LOCALE, { maximumFractionDigits: 1 }) })}</td>
            <td><span className="io-roles">
              <label><input type="radio" name="primary" checked={game.mail.primary === a.id} onChange={() => act(setPrimary, a.id)} />{t("ionose.box.primary")}</label>
              {ROLES.map((r) => <label key={r}><input type="checkbox" checked={a.roles.includes(r)} onChange={() => toggle(a, r)} />{t(`mailserver.role.${r}`)}</label>)}
            </span></td>
            <td className="io-row-tools">
              {a.id !== admin.id && <button type="button" className="io-quiet" onClick={() => { setReset(a.id); setFresh(""); setDone(null); }}>{t("ionose.box.reset")}</button>}
              {a.id !== admin.id && <Confirm label={t("ionose.box.delete")} ask={t("ionose.box.deleteConfirm", { address: addressOf(a) })} onYes={() => act(deleteMailAccount, a.id)} />}
            </td>
          </tr>
        ))}</tbody>
      </table>
      {reset && (
        <form className="io-form io-inline" onSubmit={(e) => { e.preventDefault(); if (act(setAccountPassword, admin.id, reset, fresh).ok) { setDone(reset); setReset(null); } }}>
          <label>{t("ionose.reset.new")}<input name="fresh" type="password" value={fresh} onChange={(e) => setFresh(e.target.value)} autoComplete="new-password" /></label>
          <button type="submit">{t("ionose.reset.save")}</button>
        </form>
      )}
      {done && <p className="io-ok">{t("ionose.reset.done")}</p>}
      <form className="io-form io-inline" onSubmit={(e) => { e.preventDefault(); if (act(createMailAccount, { tenant: tenant.id, local, title, password }).ok) { setLocal(""); setTitle(""); setPassword(""); } }}>
        <h2>{t("ionose.box.add")}</h2>
        <label>{t("ionose.box.name")}<input name="title" value={title} onChange={(e) => setTitle(e.target.value)} autoComplete="off" /></label>
        <label>{t("ionose.box.address")}<span className="io-addr"><input name="local" value={local} onChange={(e) => setLocal(e.target.value)} autoComplete="off" />@{tenant.domain}</span></label>
        <label>{t("ionose.order.password")}<input name="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" /></label>
        <p data-total>{t("ionose.box.totals", { now: total(game, tenant), after: total(game, tenant, 1) })}</p>
        <button type="submit">{t("ionose.box.create")}</button>
      </form>
    </>
  );
}

function BoxPicker({ boxes, value, set }: { boxes: MailAccount[]; value: string; set: (id: string) => void }) {
  return <select name="box" value={value} onChange={(e) => set(e.target.value)} aria-label={t("ionose.box.address")}>{boxes.map((a) => <option key={a.id} value={a.id}>{addressOf(a)}</option>)}</select>;
}

function Addresses({ game, tenant }: ControlProps) {
  const act = usePageAct(), boxes = openBoxes(game, tenant.id), max = mailHost("ionose")!.aliasMax;
  const [local, setLocal] = useState(""), [target, setTarget] = useState(boxes[0]?.id ?? "");
  const used = boxes.reduce((n, a) => n + a.aliases.length, 0), catchAll = boxes.find((a) => a.id === game.mail.catchAll);
  return (
    <>
      <h1>{t("ionose.tab.addresses")}</h1>
      <p>{t("ionose.alias.count", { n: used, max })}</p>
      <table className="io-table" data-table="aliases">
        <thead><tr><th>{t("ionose.alias.address")}</th><th>{t("ionose.alias.target")}</th><th /></tr></thead>
        <tbody>{boxes.flatMap((a) => a.aliases.map((l) => (
          <tr key={`${a.id}-${l}`}><td>{`${l}@${a.domain}`}</td><td>{addressOf(a)}</td>
            <td><button type="button" className="io-quiet" onClick={() => act(removeAlias, a.id, l)}>{t("ionose.box.delete")}</button></td></tr>
        )))}</tbody>
      </table>
      <form className="io-form io-inline" onSubmit={(e) => { e.preventDefault(); if (act(addAlias, target, local).ok) setLocal(""); }}>
        <label>{t("ionose.alias.address")}<span className="io-addr"><input name="alias" value={local} onChange={(e) => setLocal(e.target.value)} autoComplete="off" />@{tenant.domain}</span></label>
        <label>{t("ionose.alias.target")}<BoxPicker boxes={boxes} value={target} set={setTarget} /></label>
        <button type="submit">{t("ionose.alias.add")}</button>
      </form>
      <label className="io-form io-inline">{t("ionose.alias.catchAll")}
        <select name="catchAll" value={catchAll?.id ?? ""} onChange={(e) => act(setCatchAll, e.target.value || null)}>
          <option value="">{t("ionose.alias.none")}</option>
          {boxes.map((a) => <option key={a.id} value={a.id}>{addressOf(a)}</option>)}
        </select>
      </label>
    </>
  );
}

function Forwarding({ game, tenant }: ControlProps) {
  const act = usePageAct(), boxes = openBoxes(game, tenant.id);
  const [id, setId] = useState(boxes[0]?.id ?? ""), a = boxes.find((x) => x.id === id);
  const [target, setTarget] = useState(a?.forward?.to ?? ""), [keep, setKeep] = useState(a?.forward?.keep ?? true), [saved, setSaved] = useState(false);
  const pick = (next: string) => { const b = boxes.find((x) => x.id === next); setId(next); setTarget(b?.forward?.to ?? ""); setKeep(b?.forward?.keep ?? true); setSaved(false); };
  return (
    <>
      <h1>{t("ionose.tab.forwarding")}</h1>
      <form className="io-form" onSubmit={(e) => { e.preventDefault(); setSaved(act(setForward, id, target.trim() || null, keep).ok); }}>
        <label>{t("ionose.box.address")}<BoxPicker boxes={boxes} value={id} set={pick} /></label>
        <label>{t("ionose.forward.to")}<input name="forward" value={target} onChange={(e) => setTarget(e.target.value)} autoComplete="off" /></label>
        <label className="io-check"><input type="checkbox" checked={keep} onChange={(e) => setKeep(e.target.checked)} />{t("ionose.forward.keep")}</label>
        <div className="io-buttons"><button type="submit">{t("ionose.save")}</button>{saved && <span className="io-ok">{t("ionose.saved")}</span>}</div>
      </form>
    </>
  );
}

function Vacation({ game, tenant }: ControlProps) {
  const act = usePageAct(), boxes = openBoxes(game, tenant.id);
  const [id, setId] = useState(boxes[0]?.id ?? ""), a = boxes.find((x) => x.id === id);
  const [on, setOn] = useState(!!a?.vacation?.on), [subject, setSubject] = useState(a?.vacation?.subject ?? ""), [text, setText] = useState(a?.vacation?.text ?? ""), [saved, setSaved] = useState(false);
  const pick = (next: string) => { const b = boxes.find((x) => x.id === next); setId(next); setOn(!!b?.vacation?.on); setSubject(b?.vacation?.subject ?? ""); setText(b?.vacation?.text ?? ""); setSaved(false); };
  return (
    <>
      <h1>{t("ionose.tab.vacation")}</h1>
      <form className="io-form" onSubmit={(e) => { e.preventDefault(); setSaved(act(setVacation, id, { on, subject, text, until: null }).ok); }}>
        <label>{t("ionose.box.address")}<BoxPicker boxes={boxes} value={id} set={pick} /></label>
        <label className="io-check"><input type="checkbox" name="on" checked={on} onChange={(e) => setOn(e.target.checked)} />{t("ionose.vacation.on")}</label>
        <label>{t("ionose.vacation.subject")}<input name="subject" value={subject} onChange={(e) => setSubject(e.target.value)} autoComplete="off" /></label>
        <label>{t("ionose.vacation.text")}<textarea name="text" rows={5} value={text} onChange={(e) => setText(e.target.value)} /></label>
        <div className="io-buttons"><button type="submit">{t("ionose.save")}</button>{saved && <span className="io-ok">{t("ionose.saved")}</span>}</div>
      </form>
    </>
  );
}

function Plan({ game, tenant }: ControlProps) {
  const act = usePageAct(), cap = mailboxCap("ionose", tenant.plan, tenant.since) ?? 0, used = openBoxes(game, tenant.id).length;
  return (
    <>
      <h1>{t("ionose.tab.plan")}</h1>
      <dl className="io-summary">
        <dt>{t("ionose.order.plan")}</dt><dd>{t(`ionose.plan.${tenant.plan}`)}</dd>
        <dt>{t("ionose.plan.slots")}</dt><dd data-slots>{t("ionose.plan.slotsValue", { free: Math.max(0, cap - used), cap })}</dd>
        <dt>{t("ionose.order.total")}</dt><dd>{total(game, tenant)}</dd>
      </dl>
      <div className="io-buttons">
        {PLANS.filter((p) => p !== tenant.plan).map((p) => (
          <button key={p} type="button" onClick={() => act(setTenantPlan, tenant.id, p)}>{t("ionose.plan.change", { plan: t(`ionose.plan.${p}`), price: euroCents(price(p, game.hour)) })}</button>
        ))}
      </div>
      <h2>{t("ionose.plan.cancelTitle")}</h2>
      <LeftBehind game={game} tenantId={tenant.id} className="io-error" />
      {tenant.endsAt === null
        ? <Confirm danger label={t("ionose.plan.cancel")} ask={t("ionose.plan.cancelConfirm", { days: GRACE_DAYS.ionose })} onYes={() => act(endTenant, tenant.id)} />
        : <button type="button" onClick={() => act(resubscribe, tenant.id)}>{t("ionose.plan.keep")}</button>}
    </>
  );
}

function Domain({ game, tenant, go }: ControlProps & { go: (url: string) => void }) {
  const act = usePageAct(), found = mxHostsAt(game, game.hour), target = mxTarget(game);
  const spf = recordAt(game, "TXT", "@", game.hour).some((r) => r.data.replace(/"/g, "").trim() === IONOSE_SPF);
  return (
    <>
      <h1>{t("ionose.tab.domain")}</h1>
      <p className={tenant.verified ? "io-ok" : "io-error"} data-verified={tenant.verified}>{t(tenant.verified ? "ionose.domain.verified" : "ionose.domain.unverified")}</p>
      <table className="io-table" data-table="records">
        <thead><tr><th>{t("ionose.domain.type")}</th><th>{t("ionose.domain.host")}</th><th>{t("ionose.domain.value")}</th><th>{t("ionose.domain.status")}</th></tr></thead>
        <tbody>
          {mxSetAt("ionose", tenant.domain, game.hour).map(([p, h]) => <tr key={h}><td>MX</td><td>@</td><td><code>{`${p} ${h}`}</code></td><td>{t(found.includes(h) ? "ionose.domain.found" : "ionose.domain.missing")}</td></tr>)}
          <tr><td>TXT</td><td>@</td><td><code>{IONOSE_SPF}</code></td><td>{t(spf ? "ionose.domain.found" : "ionose.domain.missing")}</td></tr>
        </tbody>
      </table>
      <p data-points>{t("ionose.domain.points", { provider: target ? PROVIDER_NAMES[target.host] : t("ionose.alias.none") })}</p>
      <div className="io-buttons">
        <button type="button" onClick={() => act(checkIonoseDomain, tenant.id)}>{t("ionose.domain.check")}</button>
        <button type="button" className="io-quiet" onClick={() => go(`${registrarUrl(game)}login/dns`)}>{t("ionose.domain.registrar")}</button>
      </div>
    </>
  );
}

function Migration({ game, tenant }: ControlProps) {
  const boxes = openBoxes(game, tenant.id);
  return (
    <>
      <h1>{t("ionose.tab.import")}</h1>
      <ImportForm targets={boxes} proto="imap" className="io-form io-inline" />
      <ImportRuns game={game} into={boxes.map((a) => a.id)} className="io-table" />
    </>
  );
}

const STEPS = ["create", "mx", "import", "cancel"] as const;

function Switching({ game, tenant, to }: ControlProps & { to: To }) {
  const others = game.mail.tenants.filter((x) => x.id !== tenant.id && x.domain === tenant.domain && x.endsAt === null && openBoxes(game, x.id).length > 0);
  const left = leftBehind(game, tenant.id);
  const done: Record<(typeof STEPS)[number], boolean> = {
    create: others.length > 0, mx: !!mxTarget(game) && mxTarget(game)!.id !== tenant.id, import: !!left && left.mail === 0 && !left.roles, cancel: tenant.endsAt !== null,
  };
  return (
    <>
      <h1>{t("ionose.tab.switch")}</h1>
      <ol className="io-steps">{STEPS.map((id) => <li key={id} className={done[id] ? "done" : ""}>{t(`ionose.switch.${id}`)}</li>)}</ol>
      <LeftBehind game={game} tenantId={tenant.id} className="io-error" />
      <Link to={to} path="control/plan" className="io-cta">{t("ionose.plan.cancelTitle")}</Link>
    </>
  );
}
