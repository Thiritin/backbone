import { useState, type MouseEvent, type ReactNode } from "react";
import { t } from "../../../../../../i18n/en";
import { LOCALE } from "../../../../../../i18n/lang";
import { euroCents } from "../../../../../../sim/00-core/money";
import { dateOf, hourOfMonth, nextMonthStart, yearOf } from "../../../../../../sim/00-core/time";
import { consoleUrl, editionAt, GOGGLE_CONVERSION } from "../../../../../../sim/10-catalog/mail-consumer";
import { mailPlan, onSale } from "../../../../../../sim/10-catalog/mail-providers";
import { openBoxes, seatsBilled } from "../../../../../../sim/42-mail/accounts";
import type { MailAccount, MailRole, MailTenant } from "../../../../../../sim/42-mail/types";
import type { GameState } from "../../../../../../sim/50-state";
import { providerById } from "../../../../../../sim/80-business/mail";
import { goggleReport } from "../../../../../../sim/80-business/mail-provider";
import { endTenant, resubscribe } from "../../../../../../sim/90-actions/mail";
import {
  deleteGoggleUser, GOGGLE_MIGRATION_FROM, GOGGLE_POP_MIGRATION_FROM, GOGGLE_TRANSFER_FROM, makeGoggleAdmin, migrateMailbox, restoreUser, suspendUser, upgradeGoggleEdition,
} from "../../../../../../sim/90-actions/mail-provider";
import {
  addAlias, createMailAccount, createMailGroup, deleteMailGroup, removeAlias, setAccountPassword, setAccountRoles, setCatchAll, setMailGroupMembers,
} from "../../../../../../sim/90-actions/mailbox";
import { GoggleMark } from "../../../../../art/mailmarks";
import { usePageAct } from "../../../pageAct";
import { MxStep, VerifyStep } from "./GoggleSite";

// docs/design/plans/webmail-consumer.md, section 4.4: the tabbed control panel until 2012, the card console from 2013.
const PAGES = ["users", "groups", "settings", "domains", "billing", "migration", "reports", "status", "support"] as const;
const ROLES: MailRole[] = ["owner", "sales", "support", "abuse"];
const CATCH_ALL_FROM = 2008;
const SERVICES = ["mail", "calendar", "docs", "sites", "talk"] as const;

const day = (hour: number) => dateOf(hour).toLocaleDateString(LOCALE, { timeZone: "UTC" });
const mb = (kb: number) => (kb / 1024).toLocaleString(LOCALE, { maximumFractionDigits: 1 });
const addr = (a: MailAccount) => `${a.local}@${a.domain}`;

interface Props { game: GameState; tenant: MailTenant; admin: MailAccount; page: string; go: (url: string) => void; signOut: () => void }
type To = (page: string) => void;

function Link({ to, page, children, className }: { to: To; page: string; children: ReactNode; className?: string }) {
  const click = (e: MouseEvent) => { e.preventDefault(); to(page); };
  return <a href={`#${page}`} className={className} onClick={click}>{children}</a>;
}

export function AdminConsole({ game, tenant, admin, page, go, signOut }: Props) {
  const hour = game.hour, look = hour < hourOfMonth("2013-01") ? "control" : "console", workspace = hour >= hourOfMonth("2020-10");
  const to: To = (p) => go(consoleUrl(hour, tenant.domain, p));
  const [section, id] = page.split("/");
  const shown = PAGES.filter((p) => (p !== "migration" || yearOf(hour) >= GOGGLE_MIGRATION_FROM));
  const body = (() => {
    if (tenant.locked) return <Locked game={game} tenant={tenant} />;
    if (section === "users" && id === "new") return <NewUser game={game} tenant={tenant} to={to} />;
    if (section === "users" && id) return <User game={game} tenant={tenant} admin={admin} id={id} to={to} />;
    if (section === "users") return <Users game={game} tenant={tenant} to={to} />;
    if (section === "groups" && id === "new") return <NewGroup game={game} tenant={tenant} to={to} />;
    if (section === "groups" && id) return <Group game={game} tenant={tenant} id={id} to={to} />;
    if (section === "groups") return <Groups game={game} tenant={tenant} to={to} />;
    if (section === "settings") return <Settings game={game} tenant={tenant} />;
    if (section === "domains") return <><VerifyStep game={game} tenant={tenant} go={go} /><MxStep game={game} tenant={tenant} go={go} /></>;
    if (section === "billing") return <Billing game={game} tenant={tenant} />;
    if (section === "migration") return <Migration game={game} tenant={tenant} />;
    if (section === "reports") return <Reports game={game} tenant={tenant} look={look} />;
    if (section === "status") return <Status />;
    if (section === "support") return <Support />;
    return <Dashboard game={game} tenant={tenant} to={to} pages={shown} look={look} />;
  })();
  const conversion = tenant.plan === "free" && !tenant.locked && hour >= hourOfMonth(GOGGLE_CONVERSION.notice);
  return (
    <div className={`ga ga-${look}${workspace ? " ga-ws" : ""}`}>
      <header className="ga-head">
        <Link to={to} page="" className="ga-logo"><GoggleMark className="ga-mark" /><b>{t(look === "control" ? "goggle.admin.control" : "goggle.admin.title")}</b></Link>
        <span className="ga-domain">{tenant.domain}</span>
        <span className="ga-user">{addr(admin)}</span>
        <a href="#signout" onClick={(e) => { e.preventDefault(); signOut(); }}>{t("goggle.nav.signOut")}</a>
      </header>
      {!tenant.locked && (
        <nav className="ga-nav">
          <Link to={to} page="" className={section === "" ? "on" : ""}>{t("goggle.admin.nav.dashboard")}</Link>
          {shown.map((p) => <Link key={p} to={to} page={p} className={section === p ? "on" : ""}>{t(`goggle.admin.nav.${p}`)}</Link>)}
        </nav>
      )}
      {conversion && <ConversionBanner tenant={tenant} />}
      <main className="ga-main">{body}</main>
    </div>
  );
}

function ConversionBanner({ tenant }: { tenant: MailTenant }) {
  const act = usePageAct();
  return (
    <div className="ga-banner" role="status">
      <span>{t("goggle.admin.conversion")}</span>
      <button type="button" onClick={() => act(upgradeGoggleEdition, tenant.id)}>{t("goggle.admin.upgradeNow")}</button>
    </div>
  );
}

function Locked({ game, tenant }: { game: GameState; tenant: MailTenant }) {
  const act = usePageAct();
  return (
    <section className="ga-locked">
      <h1>{t("goggle.admin.locked.title")}</h1>
      <p>{t("goggle.admin.locked.text")}</p>
      <button type="button" onClick={() => act(upgradeGoggleEdition, tenant.id)}>{t("goggle.admin.locked.choose", { edition: t(`mail.goggle.edition.${editionAt("paid", game.hour)}`) })}</button>
    </section>
  );
}

function Dashboard({ game, tenant, to, pages, look }: { game: GameState; tenant: MailTenant; to: To; pages: readonly string[]; look: string }) {
  const boxes = openBoxes(game, tenant.id).length;
  return (
    <section>
      <h1>{t("goggle.admin.nav.dashboard")}</h1>
      <dl className="ga-facts">
        <dt>{t("goggle.admin.edition")}</dt><dd>{t(`mail.goggle.edition.${editionAt(tenant.plan, game.hour)}`)}</dd>
        <dt>{t("goggle.admin.nav.users")}</dt><dd>{boxes}</dd>
        <dt>{t("goggle.admin.nav.domains")}</dt><dd>{t(tenant.verified ? "goggle.setup.verified" : "goggle.setup.unverified")}</dd>
      </dl>
      {look === "console" && (
        <div className="ga-cards">{pages.map((p) => <Link key={p} to={to} page={p} className="ga-card">{t(`goggle.admin.nav.${p}`)}</Link>)}</div>
      )}
    </section>
  );
}

function Users({ game, tenant, to }: { game: GameState; tenant: MailTenant; to: To }) {
  const report = goggleReport(game, tenant.id);
  return (
    <section>
      <h1>{t("goggle.admin.nav.users")}</h1>
      <div className="ga-actions"><Link to={to} page="users/new" className="ga-button">{t("goggle.admin.users.add")}</Link></div>
      <table className="ga-table" data-table="users">
        <thead><tr><th>{t("goggle.users.name")}</th><th>{t("goggle.users.address")}</th><th>{t("goggle.admin.users.status")}</th><th>{t("goggle.admin.users.storage")}</th></tr></thead>
        <tbody>
          {openBoxes(game, tenant.id).map((a) => (
            <tr key={a.id} data-user={a.local}>
              <td><Link to={to} page={`users/${a.id}`}>{a.title}</Link></td>
              <td>{addr(a)}</td>
              <td>{t(a.id === tenant.admin ? "goggle.admin.users.admin" : a.suspended ? "goggle.admin.users.suspended" : "goggle.admin.users.active")}</td>
              <td>{t("goggle.admin.mb", { n: mb(report.rows.find((r) => r.id === a.id)?.kb ?? 0) })}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function NewUser({ game, tenant, to }: { game: GameState; tenant: MailTenant; to: To }) {
  const act = usePageAct();
  const [first, setFirst] = useState(""), [last, setLast] = useState(""), [local, setLocal] = useState(""), [password, setPassword] = useState("");
  const submit = () => {
    const r = act(createMailAccount, { tenant: tenant.id, local, title: [first.trim(), last.trim()].filter(Boolean).join(" "), password });
    if (r.ok) to(`users/${r.id}`);
  };
  return (
    <section>
      <h1>{t("goggle.admin.users.add")}</h1>
      <form className="ga-form" onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <label>{t("goggle.signup.first")}<input name="first" value={first} onChange={(e) => setFirst(e.target.value)} autoComplete="off" /></label>
        <label>{t("goggle.signup.last")}<input name="last" value={last} onChange={(e) => setLast(e.target.value)} autoComplete="off" /></label>
        <label>{t("goggle.signup.username")}<span className="ga-addr"><input name="local" value={local} onChange={(e) => setLocal(e.target.value)} autoComplete="off" />@{tenant.domain}</span></label>
        <label>{t("goggle.signup.password")}<input name="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" /></label>
        <p className="ga-price">{t("goggle.admin.users.price", { price: euroCents(mailPlan("goggle", tenant.plan)!.price(yearOf(game.hour))) })}</p>
        <button type="submit">{t("goggle.admin.users.create")}</button>
      </form>
    </section>
  );
}

function User({ game, tenant, admin, id, to }: { game: GameState; tenant: MailTenant; admin: MailAccount; id: string; to: To }) {
  const act = usePageAct(), a = openBoxes(game, tenant.id).find((x) => x.id === id);
  const [fresh, setFresh] = useState(""), [alias, setAlias] = useState(""), [done, setDone] = useState<string | null>(null);
  const others = openBoxes(game, tenant.id).filter((x) => x.id !== id);
  const [receiver, setReceiver] = useState(""), [asAlias, setAsAlias] = useState(false), [transfer, setTransfer] = useState(false);
  if (!a) return <p>{t("goggle.admin.users.gone")}</p>;
  const self = a.id === admin.id, staff = a.employee ? game.staff.find((e) => e.id === a.employee) : undefined;
  const toggleRole = (r: MailRole) => act(setAccountRoles, a.id, a.roles.includes(r) ? a.roles.filter((x) => x !== r) : [...a.roles, r]);
  const remove = () => {
    if (act(deleteGoggleUser, a.id, { to: receiver || null, alias: asAlias, transfer }).ok) to("users");
  };
  return (
    <section>
      <h1>{a.title}</h1>
      <dl className="ga-facts">
        <dt>{t("goggle.users.address")}</dt><dd>{addr(a)}</dd>
        <dt>{t("goggle.admin.users.status")}</dt><dd>{t(self ? "goggle.admin.users.admin" : a.suspended ? "goggle.admin.users.suspended" : "goggle.admin.users.active")}</dd>
        {staff && <><dt>{t("goggle.admin.users.employee")}</dt><dd>{staff.name}</dd><dt>{t("goggle.signup.password")}</dt><dd><code>{a.password}</code></dd></>}
      </dl>
      {done && <p className="ga-ok">{done}</p>}
      {!self && (
        <div className="ga-actions">
          <button type="button" onClick={() => act(a.suspended ? restoreUser : suspendUser, a.id)}>{t(a.suspended ? "goggle.admin.users.restore" : "goggle.admin.users.suspend")}</button>
          <button type="button" onClick={() => act(makeGoggleAdmin, a.id)}>{t("goggle.admin.users.makeAdmin")}</button>
        </div>
      )}
      {!self && (
        <form className="ga-inline" onSubmit={(e) => { e.preventDefault(); if (act(setAccountPassword, admin.id, a.id, fresh).ok) { setFresh(""); setDone(t("goggle.recovery.done")); } }}>
          <label>{t("goggle.recovery.new")}<input name="fresh" type="password" value={fresh} onChange={(e) => setFresh(e.target.value)} autoComplete="new-password" /></label>
          <button type="submit">{t("goggle.admin.users.reset")}</button>
        </form>
      )}
      <h2>{t("goggle.admin.users.receives")}</h2>
      <div className="ga-checks">
        {ROLES.map((r) => <label key={r}><input type="checkbox" checked={a.roles.includes(r)} onChange={() => toggleRole(r)} />{t(`goggle.admin.role.${r}`)}</label>)}
      </div>
      <h2>{t("goggle.admin.users.aliases")}</h2>
      <ul className="ga-list">{a.aliases.map((l) => <li key={l}>{`${l}@${a.domain}`} <button type="button" className="ga-quiet" onClick={() => act(removeAlias, a.id, l)}>{t("goggle.admin.remove")}</button></li>)}</ul>
      <form className="ga-inline" onSubmit={(e) => { e.preventDefault(); if (act(addAlias, a.id, alias).ok) setAlias(""); }}>
        <span className="ga-addr"><input name="alias" value={alias} onChange={(e) => setAlias(e.target.value)} autoComplete="off" />@{a.domain}</span>
        <button type="submit">{t("goggle.admin.users.addAlias")}</button>
      </form>
      {!self && !a.employee && (
        <>
          <h2>{t("goggle.admin.users.delete")}</h2>
          <form className="ga-form" onSubmit={(e) => { e.preventDefault(); remove(); }}>
            <label>{t("goggle.admin.users.receiver")}
              <select name="receiver" value={receiver} onChange={(e) => setReceiver(e.target.value)}>
                <option value="">{t("goggle.admin.users.nobody")}</option>
                {others.map((o) => <option key={o.id} value={o.id}>{addr(o)}</option>)}
              </select>
            </label>
            <label className="ga-check"><input type="checkbox" checked={asAlias} disabled={!receiver} onChange={(e) => setAsAlias(e.target.checked)} />{t("goggle.admin.users.asAlias")}</label>
            {yearOf(game.hour) >= GOGGLE_TRANSFER_FROM && <label className="ga-check"><input type="checkbox" checked={transfer} disabled={!receiver} onChange={(e) => setTransfer(e.target.checked)} />{t("goggle.admin.users.transfer")}</label>}
            <p className="ga-warn">{t(transfer && receiver ? "goggle.admin.users.moves" : "goggle.admin.users.loses")}</p>
            <button type="submit" className="ga-danger">{t("goggle.admin.users.delete")}</button>
          </form>
        </>
      )}
    </section>
  );
}

function Groups({ game, tenant, to }: { game: GameState; tenant: MailTenant; to: To }) {
  const groups = game.mail.groups.filter((g) => g.tenant === tenant.id);
  return (
    <section>
      <h1>{t("goggle.admin.nav.groups")}</h1>
      <div className="ga-actions"><Link to={to} page="groups/new" className="ga-button">{t("goggle.admin.groups.add")}</Link></div>
      <table className="ga-table" data-table="groups">
        <thead><tr><th>{t("goggle.users.name")}</th><th>{t("goggle.users.address")}</th><th>{t("goggle.admin.groups.members")}</th></tr></thead>
        <tbody>{groups.map((g) => <tr key={g.id}><td><Link to={to} page={`groups/${g.id}`}>{g.title}</Link></td><td>{`${g.local}@${tenant.domain}`}</td><td>{g.members.length}</td></tr>)}</tbody>
      </table>
    </section>
  );
}

function Members({ game, tenant, chosen, set }: { game: GameState; tenant: MailTenant; chosen: string[]; set: (v: string[]) => void }) {
  return (
    <fieldset className="ga-checks">
      <legend>{t("goggle.admin.groups.members")}</legend>
      {openBoxes(game, tenant.id).map((a) => (
        <label key={a.id}><input type="checkbox" checked={chosen.includes(a.id)} onChange={() => set(chosen.includes(a.id) ? chosen.filter((x) => x !== a.id) : [...chosen, a.id])} />{addr(a)}</label>
      ))}
    </fieldset>
  );
}

function NewGroup({ game, tenant, to }: { game: GameState; tenant: MailTenant; to: To }) {
  const act = usePageAct(), [title, setTitle] = useState(""), [local, setLocal] = useState(""), [members, setMembers] = useState<string[]>([]);
  return (
    <section>
      <h1>{t("goggle.admin.groups.add")}</h1>
      <form className="ga-form" onSubmit={(e) => { e.preventDefault(); if (act(createMailGroup, { tenant: tenant.id, local, title, members }).ok) to("groups"); }}>
        <label>{t("goggle.users.name")}<input name="title" value={title} onChange={(e) => setTitle(e.target.value)} autoComplete="off" /></label>
        <label>{t("goggle.users.address")}<span className="ga-addr"><input name="local" value={local} onChange={(e) => setLocal(e.target.value)} autoComplete="off" />@{tenant.domain}</span></label>
        <Members game={game} tenant={tenant} chosen={members} set={setMembers} />
        <p className="ga-price">{t("goggle.value.free")}</p>
        <button type="submit">{t("goggle.admin.groups.create")}</button>
      </form>
    </section>
  );
}

function Group({ game, tenant, id, to }: { game: GameState; tenant: MailTenant; id: string; to: To }) {
  const act = usePageAct(), g = game.mail.groups.find((x) => x.id === id && x.tenant === tenant.id);
  const [members, setMembers] = useState<string[]>(g?.members ?? []);
  if (!g) return <p>{t("goggle.admin.users.gone")}</p>;
  return (
    <section>
      <h1>{g.title}</h1>
      <p>{`${g.local}@${tenant.domain}`}</p>
      <form className="ga-form" onSubmit={(e) => { e.preventDefault(); act(setMailGroupMembers, g.id, members); }}>
        <Members game={game} tenant={tenant} chosen={members} set={setMembers} />
        <div className="ga-actions">
          <button type="submit">{t("goggle.admin.save")}</button>
          <button type="button" className="ga-danger" onClick={() => { if (act(deleteMailGroup, g.id).ok) to("groups"); }}>{t("goggle.admin.groups.delete")}</button>
        </div>
      </form>
    </section>
  );
}

function Settings({ game, tenant }: { game: GameState; tenant: MailTenant }) {
  const act = usePageAct(), boxes = openBoxes(game, tenant.id);
  const current = boxes.some((a) => a.id === game.mail.catchAll) ? game.mail.catchAll! : "";
  return (
    <section>
      <h1>{t("goggle.admin.nav.settings")}</h1>
      <label className="ga-field">{t("goggle.admin.settings.unknown")}
        {yearOf(game.hour) >= CATCH_ALL_FROM ? (
          <select name="catchAll" value={current} onChange={(e) => act(setCatchAll, e.target.value || null)}>
            <option value="">{t("goggle.admin.settings.reject")}</option>
            {boxes.map((a) => <option key={a.id} value={a.id}>{t("goggle.admin.settings.forward", { address: addr(a) })}</option>)}
          </select>
        ) : <span>{t("goggle.admin.settings.reject")}</span>}
      </label>
    </section>
  );
}

function Billing({ game, tenant }: { game: GameState; tenant: MailTenant }) {
  const act = usePageAct(), hour = game.hour, price = mailPlan("goggle", tenant.plan)!.price(yearOf(hour)), seats = seatsBilled(game, tenant);
  const name = providerById("goggleWorkspace")!.name;
  const lines = game.ledger.filter((e) => e.key === "ledger.companyMail" && e.params?.name === name && e.hour >= tenant.since).slice(-12).reverse();
  const paid = mailPlan("goggle", "paid")!;
  return (
    <section>
      <h1>{t("goggle.admin.nav.billing")}</h1>
      <dl className="ga-facts">
        <dt>{t("goggle.admin.edition")}</dt><dd>{t(`mail.goggle.edition.${editionAt(tenant.plan, hour)}`)}</dd>
        <dt>{t("goggle.admin.billing.mailboxes")}</dt><dd>{seats}</dd>
        <dt>{t("goggle.users.price")}</dt><dd>{euroCents(price)}</dd>
        <dt>{t("goggle.signup.total")}</dt><dd>{euroCents(price * seats)}</dd>
        <dt>{t(tenant.endsAt === null ? "goggle.admin.billing.next" : "goggle.admin.billing.ends")}</dt><dd>{day(tenant.endsAt ?? nextMonthStart(hour))}</dd>
      </dl>
      <div className="ga-actions">
        {tenant.plan === "free" && onSale(paid, hour) && <button type="button" onClick={() => act(upgradeGoggleEdition, tenant.id)}>{t("goggle.admin.billing.upgrade", { edition: t(`mail.goggle.edition.${editionAt("paid", hour)}`) })}</button>}
        {tenant.endsAt === null
          ? <button type="button" className="ga-danger" onClick={() => act(endTenant, tenant.id)}>{t("goggle.admin.billing.cancel")}</button>
          : <button type="button" onClick={() => act(resubscribe, tenant.id)}>{t("goggle.admin.billing.resubscribe")}</button>}
      </div>
      <h2>{t("goggle.admin.billing.history")}</h2>
      <table className="ga-table" data-table="invoices">
        <thead><tr><th>{t("goggle.admin.billing.date")}</th><th>{t("goggle.admin.billing.mailboxes")}</th><th>{t("goggle.admin.billing.amount")}</th></tr></thead>
        <tbody>{lines.map((e, i) => <tr key={i}><td>{day(e.hour)}</td><td>{e.params.seats}</td><td>{euroCents(-e.amount)}</td></tr>)}</tbody>
      </table>
    </section>
  );
}

function Migration({ game, tenant }: { game: GameState; tenant: MailTenant }) {
  const act = usePageAct(), boxes = openBoxes(game, tenant.id), pop = yearOf(game.hour) >= GOGGLE_POP_MIGRATION_FROM;
  const [source, setSource] = useState(""), [password, setPassword] = useState(""), [proto, setProto] = useState<"imap" | "pop">("imap");
  const [target, setTarget] = useState(boxes[0]?.id ?? ""), [done, setDone] = useState(false);
  return (
    <section>
      <h1>{t("goggle.admin.nav.migration")}</h1>
      <form className="ga-form" onSubmit={(e) => { e.preventDefault(); setDone(act(migrateMailbox, target, { source, password, proto }).ok); }}>
        <label>{t("goggle.admin.migration.source")}<input name="source" value={source} onChange={(e) => setSource(e.target.value)} autoComplete="off" /></label>
        <label>{t("goggle.signup.password")}<input name="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="off" /></label>
        <label>{t("goggle.admin.migration.protocol")}
          <select name="proto" value={proto} onChange={(e) => setProto(e.target.value as "imap" | "pop")}>
            <option value="imap">IMAP</option>
            {pop && <option value="pop">POP3</option>}
          </select>
        </label>
        <label>{t("goggle.admin.migration.target")}
          <select name="target" value={target} onChange={(e) => setTarget(e.target.value)}>{boxes.map((a) => <option key={a.id} value={a.id}>{addr(a)}</option>)}</select>
        </label>
        <button type="submit">{t("goggle.admin.migration.start")}</button>
        {done && <p className="ga-ok">{t("goggle.admin.migration.done")}</p>}
      </form>
    </section>
  );
}

function Reports({ game, tenant, look }: { game: GameState; tenant: MailTenant; look: string }) {
  const r = goggleReport(game, tenant.id);
  return (
    <section>
      <h1>{t("goggle.admin.nav.reports")}</h1>
      {look === "console" && r.sent > 0 && r.inside === r.sent && <p className="ga-headline">{t("goggle.admin.reports.self", { n: r.sent })}</p>}
      <table className="ga-table" data-table="reports">
        <thead><tr><th>{t("goggle.users.address")}</th><th>{t("goggle.admin.reports.sent")}</th><th>{t("goggle.admin.reports.received")}</th><th>{t("goggle.admin.users.storage")}</th></tr></thead>
        <tbody>
          {r.rows.map((x) => {
            const a = game.mail.accounts.find((b) => b.id === x.id)!;
            return <tr key={x.id}><td>{addr(a)}</td><td>{x.sent}</td><td>{x.received}</td><td>{t("goggle.admin.mb", { n: mb(x.kb) })}</td></tr>;
          })}
        </tbody>
      </table>
    </section>
  );
}

function Status() {
  return (
    <section>
      <h1>{t("goggle.admin.status.title")}</h1>
      <ul className="ga-status">{SERVICES.map((s) => <li key={s}><i className="ga-dot" />{t(`goggle.admin.status.${s}`)}<span>{t("goggle.admin.status.ok")}</span></li>)}</ul>
    </section>
  );
}

function Support() {
  return (
    <section>
      <h1>{t("goggle.admin.nav.support")}</h1>
      <dl className="ga-facts">
        <dt>{t("goggle.admin.support.phone")}</dt><dd>+1 650 555 0142</dd>
        <dt>{t("goggle.admin.support.wait")}</dt><dd>{t("goggle.admin.support.na")}</dd>
      </dl>
    </section>
  );
}
