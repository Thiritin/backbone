import { useEffect, useState, type DragEvent, type MouseEvent, type ReactNode } from "react";
import { t } from "../../../../../../i18n/en";
import { LOCALE } from "../../../../../../i18n/lang";
import { dateOf } from "../../../../../../sim/00-core/time";
import { owaAt, owaLimited, type OwaGen } from "../../../../../../sim/10-catalog/mail-hosted";
import { checkMailLogin } from "../../../../../../sim/42-mail/accounts";
import { boxOf, foldersOf, isRead, unread, view } from "../../../../../../sim/42-mail/model";
import type { MailAccount, MailAct, Message } from "../../../../../../sim/42-mail/types";
import type { GameState } from "../../../../../../sim/50-state";
import { changePassword, deleteFilter, saveFilter } from "../../../../../../sim/90-actions/mailbox";
import { saveDraft, sendMessage, setVacation } from "../../../../../../sim/90-actions/mailmsg";
import { useFolder, useFolderDrop, useMailActions, useMailDrag } from "../../../../mail-kit/mail-kit";
import { TicketSlot } from "../../../../mail-kit/TicketSlot";
import { useSessionState, writeSession } from "../../../../../session";
import { offerLogin, savedLogin } from "../../../../../vault";
import { usePageAct } from "../../../pageAct";
import "./owa.css";

// docs/design/plans/webmail-server.md, 7.1 and 7.2: Lookout Web Access and Lookout Web App in the generation of the year.
// Before 2010 the full client needs Internet Explorer, so the Browser gets Basic (2003) or Light (2007): no reading pane,
// no drag and drop and no rules.
export type OwaProvider = "ionose" | "lookout";
interface Session { id: string; light: boolean }

const product = (gen: OwaGen) => t(`owa.product.${gen}`);
const addressOf = (a: MailAccount) => `${a.local}@${a.domain}`;
const when = (at: number) => new Intl.DateTimeFormat(LOCALE, { dateStyle: "short", timeStyle: "short", timeZone: "UTC" }).format(dateOf(at / 60));
const sessionKey = (p: OwaProvider) => `owa.${p}`;

export const owaTitle = (game: GameState, provider: OwaProvider): string => product(owaAt(provider, game.hour));

interface Props { game: GameState; provider: OwaProvider; host: string; path: string; go: (url: string) => void }

export function Owa({ game, provider, host, path, go }: Props) {
  const gen = owaAt(provider, game.hour);
  const [route, query = ""] = path.replace(/^\/+/, "").split("?");
  const params = new URLSearchParams(query), nav = (p: string) => go(`${host}/${p}`);
  const [session, setSession] = useSessionState<Session | null>(sessionKey(provider), null);
  const save = (v: Session | null) => { writeSession(sessionKey(provider), v); setSession(v); };
  const account = game.mail.accounts.find((a) => a.id === session?.id && a.closedAt === null
    && game.mail.tenants.some((x) => x.id === a.tenant && x.host === provider)) ?? null;
  if (route === "premium") return <Unsupported gen={gen} nav={nav} />;
  if (!account) return <Login game={game} provider={provider} gen={gen} host={host} nav={nav} signIn={save} />;
  const light = owaLimited(gen) || !!session?.light;
  const out = () => { save(null); nav(""); };
  return <Mailbox game={game} gen={gen} light={light} account={account} route={route} params={params} nav={nav} go={go} out={out} />;
}

function Unsupported({ gen, nav }: { gen: OwaGen; nav: (p: string) => void }) {
  return (
    <div className={`owa owa-${gen} owa-login-page`}>
      <section className="owa-login owa-unsupported">
        <h1>{product(gen)}</h1>
        <p>{t("owa.premium.unsupported", { product: product(gen) })}</p>
        <a href="#back" onClick={(e) => { e.preventDefault(); nav(""); }}>{t("owa.premium.back")}</a>
      </section>
    </div>
  );
}

function Login({ game, provider, gen, host, nav, signIn }: { game: GameState; provider: OwaProvider; gen: OwaGen; host: string; nav: (p: string) => void; signIn: (s: Session) => void }) {
  const site = game.mail.accounts.filter((a) => game.mail.tenants.some((x) => x.id === a.tenant && x.host === provider)).map((a) => `mail:${addressOf(a)}`).find((k) => game.logins[k]) ?? "mail:";
  const [saved] = useState(() => savedLogin(game, site, 2));
  const [address, setAddress] = useState(saved[0]), [password, setPassword] = useState(saved[1]);
  const [light, setLight] = useState(false), [shared, setShared] = useState(true), [error, setError] = useState<string | null>(null);
  const limited = owaLimited(gen);
  const submit = () => {
    const r = checkMailLogin(game, address, password);
    if (!r.ok || !game.mail.tenants.some((x) => x.id === r.account.tenant && x.host === provider)) return setError(t(r.ok ? "error.mailLogin" : r.error));
    offerLogin(game, `mail:${addressOf(r.account)}`, host, [address, password]);
    signIn({ id: r.account.id, light: !limited && light });
  };
  const premium = (e: MouseEvent) => { e.preventDefault(); nav("premium"); };
  const security = gen !== "web" && (
    <fieldset className="owa-security">
      <legend>{t("owa.login.security")}</legend>
      <label><input type="radio" name="security" checked={shared} onChange={() => setShared(true)} />{t("owa.login.public")}</label>
      <label><input type="radio" name="security" checked={!shared} onChange={() => setShared(false)} />{t("owa.login.private")}</label>
    </fieldset>
  );
  return (
    <div className={`owa owa-${gen} owa-login-page`}>
      <form className="owa-login" onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <h1>{gen === "web" ? t("owa.login.signInTitle") : product(gen)}</h1>
        {gen !== "2003" && security}
        <label>{t(gen === "web" ? "owa.login.email" : "owa.login.user")}<input name="address" value={address} onChange={(e) => setAddress(e.target.value)} autoComplete="off" /></label>
        <label>{t("owa.login.password")}<input name="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="off" /></label>
        {gen === "2003" && (
          <fieldset className="owa-client">
            <legend>{t("owa.login.client")}</legend>
            <a href="#premium" className="owa-premium" data-premium onClick={premium}><input type="radio" name="client" disabled readOnly />{t("owa.login.premium")} <small>{t("owa.login.needsIe")}</small></a>
            <label><input type="radio" name="client" checked readOnly />{t("owa.login.basic")}</label>
          </fieldset>
        )}
        {gen === "2003" && security}
        {gen === "2007" && (
          <a href="#premium" className="owa-premium" data-premium onClick={premium}><input type="checkbox" checked disabled readOnly />{t("owa.login.useLight", { product: product(gen) })} <small>{t("owa.login.needsIe")}</small></a>
        )}
        {(gen === "2010" || gen === "2013") && (
          <label className="owa-check"><input type="checkbox" name="light" checked={light} onChange={(e) => setLight(e.target.checked)} />{t("owa.login.useLight", { product: product(gen) })}</label>
        )}
        {error && <p className="owa-error" role="alert">{error}</p>}
        <button type="submit">{t(gen === "2003" || gen === "2007" ? "owa.login.logOn" : "owa.login.signIn")}</button>
      </form>
    </div>
  );
}

interface BoxProps { game: GameState; gen: OwaGen; light: boolean; account: MailAccount; nav: (p: string) => void; go: (url: string) => void }

function Mailbox(p: BoxProps & { route: string; params: URLSearchParams; out: () => void }) {
  const { game, gen, light, account, route, params, nav, out } = p;
  const folder = params.get("folder") ?? "inbox";
  const body = route === "compose" ? <Compose {...p} params={params} />
    : route === "options" ? <Options {...p} page={params.get("page") ?? "oof"} />
      : route === "read" ? <Reader {...p} id={params.get("id") ?? ""} />
        : <List {...p} folder={folder} />;
  return (
    <div className={`owa owa-${gen}${light ? " owa-light" : ""}`}>
      <header className="owa-bar">
        <b>{product(gen)}{light && gen !== "web" ? ` ${t(gen === "2003" ? "owa.basic" : "owa.light")}` : ""}</b>
        <span>{account.title}</span>
        <a href="#options" onClick={(e) => { e.preventDefault(); nav("options"); }}>{t("owa.nav.options")}</a>
        <a href="#out" onClick={(e) => { e.preventDefault(); out(); }}>{t(gen === "2003" || gen === "2007" ? "owa.nav.logOff" : "owa.nav.signOut")}</a>
      </header>
      <div className="owa-body">
        <nav className="owa-folders">
          <button type="button" className="owa-new" onClick={() => nav("compose")}>{t("owa.new")}</button>
          <ul>{foldersOf(game, account.id).filter((f) => !f.label).map((f) => <FolderLink key={f.id} {...p} id={f.id} name={folderName(game, account.id, f.id)} current={route === "" && folder === f.id} />)}</ul>
          <NewFolder accountId={account.id} />
        </nav>
        <main className="owa-main">{body}</main>
      </div>
    </div>
  );
}

const folderName = (game: GameState, accountId: string, id: string) =>
  ["inbox", "sent", "drafts", "junk", "trash", "archive"].includes(id) ? t(`owa.folder.${id}`) : game.mail.folders.find((f) => f.id === id && f.accountId === accountId)?.name ?? id;

function FolderLink({ game, light, account, nav, id, name, current }: BoxProps & { id: string; name: string; current: boolean }) {
  const drop = useFolderDrop(account.id, id), n = unread(game, account.id, id);
  const handlers = light ? {} : { onDragOver: (e: DragEvent) => drop.onDragOver(e), onDragLeave: drop.onDragLeave, onDrop: (e: DragEvent) => drop.onDrop(e) };
  return (
    <li className={`${current ? "on" : ""}${drop.over ? " over" : ""}`} data-folder={id} {...handlers}>
      <a href={`#${id}`} onClick={(e) => { e.preventDefault(); nav(`?folder=${id}`); }}>{name}{n > 0 && <b> ({n})</b>}</a>
    </li>
  );
}

function NewFolder({ accountId }: { accountId: string }) {
  const kit = useMailActions(accountId), [name, setName] = useState("");
  return (
    <form className="owa-newfolder" onSubmit={(e) => { e.preventDefault(); if (!kit.createFolder(name.trim())) setName(""); }}>
      <input name="folderName" value={name} onChange={(e) => setName(e.target.value)} aria-label={t("owa.folder.new")} placeholder={t("owa.folder.new")} autoComplete="off" />
    </form>
  );
}

function Row({ game, light, account, m, count, checked, check, open, active }: BoxProps & { m: Message; count: number; checked: boolean; check: (on: boolean) => void; open: () => void; active: boolean }) {
  const drag = useMailDrag(account.id, [m.id]), v = view(game, m);
  const dragProps = light ? {} : { draggable: true, onDragStart: (e: DragEvent) => drag.onDragStart(e) };
  return (
    <tr className={`${isRead(game, m) ? "" : "unread"}${active ? " on" : ""}`} data-id={m.id} {...dragProps} onClick={light ? undefined : open}>
      <td><input type="checkbox" checked={checked} onClick={(e) => e.stopPropagation()} onChange={(e) => check(e.target.checked)} aria-label={v.subject} /></td>
      <td>{m.folder === "sent" || m.folder === "drafts" ? v.to : v.fromName || v.fromAddress}</td>
      <td>{light ? <a href="#read" onClick={(e) => { e.preventDefault(); open(); }}>{v.subject || t("owa.noSubject")}</a> : v.subject || t("owa.noSubject")}{count > 1 && <small> ({count})</small>}</td>
      <td>{when(m.at)}</td>
    </tr>
  );
}

function List(p: BoxProps & { folder: string }) {
  const { game, gen, light, account, nav, folder } = p;
  const conversations = !light && (gen === "2013" || gen === "web");
  const { threads } = useFolder(account.id, folder, { threads: conversations });
  const kit = useMailActions(account.id);
  const [picked, setPicked] = useState<string[]>([]), [active, setActive] = useState<string | null>(null), [target, setTarget] = useState("");
  const [error, setError] = useState<string | null>(null);
  const ids = picked.length ? picked : active ? [active] : [];
  const others = foldersOf(game, account.id).filter((f) => !f.label && f.id !== folder && f.id !== "drafts");
  const open = (m: Message) => (m.draft ? nav(`compose?draft=${m.id}`) : light ? nav(`read?id=${m.id}`) : setActive(m.id));
  const report = (e: string | null) => { setError(e && t(e)); if (!e) setPicked([]); };
  return (
    <div className={light ? "owa-list-only" : "owa-split"}>
      <section className="owa-list">
        <div className="owa-tools">
          <h2>{folderName(game, account.id, folder)}</h2>
          <button type="button" disabled={!ids.length} onClick={() => report(kit.remove(ids))}>{t("owa.delete")}</button>
          <select value={target} onChange={(e) => setTarget(e.target.value)} aria-label={t("owa.moveTo")}>
            <option value="">{t("owa.moveTo")}</option>
            {others.map((f) => <option key={f.id} value={f.id}>{folderName(game, account.id, f.id)}</option>)}
          </select>
          <button type="button" disabled={!ids.length || !target} onClick={() => report(kit.move(ids, target))}>{t("owa.move")}</button>
          <button type="button" disabled={!ids.length} onClick={() => report(kit.junk(ids, folder !== "junk"))}>{t(folder === "junk" ? "owa.notJunk" : "owa.junk")}</button>
          <button type="button" disabled={!ids.length} onClick={() => report(kit.mark(ids, { read: false }))}>{t("owa.markUnread")}</button>
        </div>
        {error && <p className="owa-error" role="alert">{error}</p>}
        <table className="owa-rows">
          <thead><tr><th /><th>{t("owa.col.from")}</th><th>{t("owa.col.subject")}</th><th>{t("owa.col.received")}</th></tr></thead>
          <tbody>{threads.map((th) => {
            const m = th[0];
            return <Row key={m.id} {...p} m={m} count={th.length} active={active === m.id} checked={picked.includes(m.id)}
              check={(on) => setPicked(on ? [...picked, m.id] : picked.filter((x) => x !== m.id))} open={() => open(m)} />;
          })}</tbody>
        </table>
        {!threads.length && <p className="owa-empty">{t("owa.empty")}</p>}
      </section>
      {!light && (
        <section className="owa-pane" data-reading-pane>
          {active ? <Reader {...p} id={active} /> : <p className="owa-empty">{t("owa.pane.empty")}</p>}
        </section>
      )}
    </div>
  );
}

function Reader({ game, account, nav, go, id }: BoxProps & { id: string }) {
  const kit = useMailActions(account.id), m = boxOf(game, account.id).find((x) => x.id === id), seen = m ? isRead(game, m) : true;
  useEffect(() => { if (!seen) kit.mark([id], { read: true }); }, [id, seen]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!m) return <p className="owa-empty">{t("owa.pane.empty")}</p>;
  const v = view(game, m);
  return (
    <article className="owa-read">
      <div className="owa-tools">
        {(["reply", "all", "fwd"] as const).map((mode) => <button key={mode} type="button" onClick={() => nav(`compose?re=${m.id}&mode=${mode}`)}>{t(`owa.${mode}`)}</button>)}
        <button type="button" onClick={() => { if (!kit.remove([m.id])) nav(`?folder=${m.folder}`); }}>{t("owa.delete")}</button>
      </div>
      <h2>{v.subject || t("owa.noSubject")}</h2>
      <dl className="owa-head">
        <dt>{t("owa.col.from")}</dt><dd>{v.fromName ? `${v.fromName} <${v.fromAddress}>` : v.fromAddress}</dd>
        <dt>{t("owa.to")}</dt><dd>{v.to}</dd>
        {v.cc.length > 0 && <><dt>{t("owa.cc")}</dt><dd>{v.cc.join(", ")}</dd></>}
        <dt>{t("owa.sent")}</dt><dd>{when(m.at)}</dd>
      </dl>
      {v.att.length > 0 && <p className="owa-att">{v.att.map((a) => (a.k === "file" ? a.name : a.k === "doc" ? game.docs.find((d) => d.id === a.id)?.title : t(`gmix.mail.att.${a.k}`))).join(", ")}</p>}
      <div className="owa-text">{v.text}</div>
      <TicketSlot game={game} message={m} previews={false} desk={(url) => <p><a href="#desk" onClick={(e) => { e.preventDefault(); go(url); }}>{t("gmix.mail.desk")}</a></p>} />
    </article>
  );
}

const listOf = (v: string) => v.split(/[,;]/).map((x) => x.trim().toLowerCase()).filter(Boolean);

function Compose({ game, account, nav, params }: BoxProps & { params: URLSearchParams }) {
  const act = usePageAct();
  const [f, setF] = useState(() => {
    const box = boxOf(game, account.id), draft = box.find((x) => x.id === params.get("draft") && x.draft);
    if (draft) { const v = view(game, draft); return { to: v.to, cc: v.cc.join("; "), bcc: (draft.bcc ?? []).join("; "), subject: v.subject, text: v.text, re: draft.re, fwd: undefined as string | undefined, draftId: draft.id as string | undefined }; }
    const re = box.find((x) => x.id === params.get("re")), mode = params.get("mode");
    if (!re) return { to: "", cc: "", bcc: "", subject: "", text: "", re: undefined, fwd: undefined, draftId: undefined };
    const v = view(game, re), quote = `\n\n${t("owa.quote", { from: v.fromAddress, date: when(re.at) })}\n${v.text}`;
    const cc = mode === "all" ? [...listOf(v.to), ...v.cc].filter((x) => x !== addressOf(account) && x !== v.fromAddress) : [];
    return mode === "fwd"
      ? { to: "", cc: "", bcc: "", subject: t("owa.fwSubject", { subject: v.subject }), text: quote, re: undefined, fwd: re.id, draftId: undefined }
      : { to: v.fromAddress, cc: cc.join("; "), bcc: "", subject: t("owa.reSubject", { subject: v.subject }), text: quote, re: re.id, fwd: undefined, draftId: undefined };
  });
  const [sent, setSent] = useState(false);
  const set = (k: "to" | "cc" | "bcc" | "subject" | "text", v: string) => setF({ ...f, [k]: v });
  const draft = { to: [f.to.replace(/;/g, ",")], cc: [f.cc.replace(/;/g, ",")], bcc: [f.bcc.replace(/;/g, ",")], subject: f.subject, text: f.text, att: [], re: f.re };
  if (sent) return <p className="owa-ok">{t("owa.sentDone")}</p>;
  return (
    <form className="owa-compose" onSubmit={(e) => { e.preventDefault(); if (act(sendMessage, account.id, { ...draft, from: addressOf(account), fwd: f.fwd, draftId: f.draftId }).ok) setSent(true); }}>
      <div className="owa-tools">
        <button type="submit">{t("owa.send")}</button>
        <button type="button" onClick={() => { const r = act(saveDraft, account.id, { ...draft, id: f.draftId }); if (r.ok) setF({ ...f, draftId: r.id }); }}>{t("owa.save")}</button>
        <button type="button" onClick={() => nav("")}>{t("owa.cancel")}</button>
      </div>
      {(["to", "cc", "bcc"] as const).map((k) => <label key={k}>{t(`owa.${k}`)}<input name={k} value={f[k]} onChange={(e) => set(k, e.target.value)} autoComplete="off" /></label>)}
      <label>{t("owa.col.subject")}<input name="subject" value={f.subject} onChange={(e) => set("subject", e.target.value)} autoComplete="off" /></label>
      <textarea name="text" rows={14} value={f.text} onChange={(e) => set("text", e.target.value)} aria-label={t("owa.col.subject")} />
    </form>
  );
}

const PAGES = ["oof", "rules", "password"] as const;

function Options(p: BoxProps & { page: string }) {
  const { gen, light, nav, page } = p;
  const pages = PAGES.filter((x) => x !== "rules" || !light);
  const body = page === "rules" && !light ? <Rules {...p} /> : page === "password" ? <Password {...p} /> : <OutOfOffice {...p} />;
  return (
    <section className="owa-options">
      <ul className="owa-tabs">{pages.map((x) => <li key={x} className={x === page ? "on" : ""}><a href={`#${x}`} onClick={(e) => { e.preventDefault(); nav(`options?page=${x}`); }}>{t(`owa.options.${x}.${x === "oof" && (gen === "2003" || gen === "2007") ? "old" : "new"}`)}</a></li>)}</ul>
      {body}
    </section>
  );
}

function OutOfOffice({ gen, account }: BoxProps) {
  const act = usePageAct(), old = gen === "2003" || gen === "2007";
  const [on, setOn] = useState(!!account.vacation?.on), [text, setText] = useState(account.vacation?.text ?? ""), [saved, setSaved] = useState(false);
  const subject = account.vacation?.subject || t(old ? "owa.oof.subjectOld" : "owa.oof.subjectNew");
  return (
    <form className="owa-form" onSubmit={(e) => { e.preventDefault(); setSaved(act(setVacation, account.id, { on, subject, text, until: null }).ok); }}>
      <label><input type="radio" name="oof" checked={!on} onChange={() => setOn(false)} />{t(old ? "owa.oof.offOld" : "owa.oof.offNew")}</label>
      <label><input type="radio" name="oof" checked={on} onChange={() => setOn(true)} />{t(old ? "owa.oof.onOld" : "owa.oof.onNew")}</label>
      <textarea name="text" rows={6} value={text} onChange={(e) => setText(e.target.value)} aria-label={t(old ? "owa.oof.onOld" : "owa.oof.onNew")} />
      <div><button type="submit">{t("owa.save")}</button>{saved && <span className="owa-ok">{t("owa.saved")}</span>}</div>
    </form>
  );
}

const RULE_ACTS = ["move", "trash", "read"] as const;

function Rules({ game, account }: BoxProps) {
  const act = usePageAct(), mine = game.mail.filters.filter((x) => x.accountId === account.id);
  const custom = foldersOf(game, account.id).filter((f) => !f.label && !["inbox", "drafts", "sent"].includes(f.id));
  const [field, setField] = useState<"from" | "subject">("from"), [value, setValue] = useState("");
  const [does, setDoes] = useState<(typeof RULE_ACTS)[number]>("move"), [folder, setFolder] = useState(custom[0]?.id ?? "archive");
  const save = () => {
    const a: MailAct = does === "move" ? { do: "move", folder } : { do: does };
    if (act(saveFilter, account.id, { name: value, on: true, match: "all", conds: [{ field, op: "contains", value }], acts: [a] }).ok) setValue("");
  };
  return (
    <>
      <table className="owa-rows" data-table="rules"><tbody>{mine.map((f) => (
        <tr key={f.id}><td>{f.name}</td><td><button type="button" onClick={() => act(deleteFilter, f.id)}>{t("owa.delete")}</button></td></tr>
      ))}</tbody></table>
      <form className="owa-form" onSubmit={(e) => { e.preventDefault(); save(); }}>
        <label>{t("owa.rule.when")}
          <select value={field} onChange={(e) => setField(e.target.value as typeof field)}>{(["from", "subject"] as const).map((k) => <option key={k} value={k}>{t(`owa.rule.${k}`)}</option>)}</select>
        </label>
        <label>{t("owa.rule.contains")}<input name="ruleValue" value={value} onChange={(e) => setValue(e.target.value)} autoComplete="off" /></label>
        <label>{t("owa.rule.then")}
          <select value={does} onChange={(e) => setDoes(e.target.value as typeof does)}>{RULE_ACTS.map((k) => <option key={k} value={k}>{t(`owa.rule.do.${k}`)}</option>)}</select>
        </label>
        {does === "move" && <label>{t("owa.rule.folder")}<select value={folder} onChange={(e) => setFolder(e.target.value)}>{custom.map((f) => <option key={f.id} value={f.id}>{folderName(game, account.id, f.id)}</option>)}</select></label>}
        <button type="submit">{t("owa.rule.add")}</button>
      </form>
    </>
  );
}

function Password({ account }: BoxProps) {
  const act = usePageAct(), [old, setOld] = useState(""), [fresh, setFresh] = useState(""), [repeat, setRepeat] = useState(""), [done, setDone] = useState<ReactNode>(null);
  return (
    <form className="owa-form" onSubmit={(e) => { e.preventDefault(); if (fresh !== repeat) return setDone(<span className="owa-error">{t("owa.password.mismatch")}</span>); if (act(changePassword, account.id, old, fresh).ok) setDone(<span className="owa-ok">{t("owa.password.done")}</span>); }}>
      <label>{t("owa.password.old")}<input name="old" type="password" value={old} onChange={(e) => setOld(e.target.value)} autoComplete="current-password" /></label>
      <label>{t("owa.password.new")}<input name="new" type="password" value={fresh} onChange={(e) => setFresh(e.target.value)} autoComplete="new-password" /></label>
      <label>{t("owa.password.repeat")}<input name="repeat" type="password" value={repeat} onChange={(e) => setRepeat(e.target.value)} autoComplete="new-password" /></label>
      <div><button type="submit">{t("owa.save")}</button>{done}</div>
    </form>
  );
}
