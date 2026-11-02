import { useEffect, useState, type ReactNode } from "react";
import { t } from "../../../../../../i18n/en";
import { LOCALE } from "../../../../../../i18n/lang";
import { dateOf, yearOf } from "../../../../../../sim/00-core/time";
import { IMAP_FREE_FROM, mailHost, mailPlan } from "../../../../../../sim/10-catalog/mail-providers";
import { capsOf } from "../../../../../../sim/42-mail/caps";
import { boxOf, foldersOf, isRead, SYS_FOLDERS, unread, view } from "../../../../../../sim/42-mail/model";
import type { Attachment, MailAccount, MailAct, Message } from "../../../../../../sim/42-mail/types";
import type { GameState } from "../../../../../../sim/50-state";
import { VIDEO_URL } from "../../../../../../sim/80-business/browser";
import { gmixAd } from "../../../../../../sim/80-business/mail-provider";
import {
  deleteFetchRule, deleteFilter, runFetchRule, saveFetchRule, saveFilter, setAccountPrefs, setExternalAccess, setFilterOn, setForward,
} from "../../../../../../sim/90-actions/mailbox";
import {
  createMailFolder, deleteMailFolder, emptyFolder, expungeMessages, moveMailFolder, purgeOlder, renameMailFolder, saveAttachment, saveDraft, sendMessage, setVacation,
} from "../../../../../../sim/90-actions/mailmsg";
import { folderRows, useMailActions } from "../../../../mail-kit/mail-kit";
import { TicketSlot } from "../../../../mail-kit/TicketSlot";
import { usePageAct } from "../../../pageAct";
import type { GmixLook } from "./GmixSite";
import "./gmix-mail.css";

// docs/design/plans/webmail-consumer.md, section 3.4: the GMix webmail in the frames, Navigator and flat looks.
const PAGE = 20;
const SORTS = ["from", "subject", "date", "size"] as const;
type Sort = (typeof SORTS)[number];
const SETTINGS = ["spam", "filters", "folders", "signature", "access", "collector", "forward"] as const;
type To = (path: string) => void;

const when = (at: number) => new Intl.DateTimeFormat(LOCALE, { dateStyle: "short", timeStyle: "short", timeZone: "UTC" }).format(dateOf(at / 60));
const kb = (n: number) => t("gmix.mail.kb", { n: new Intl.NumberFormat(LOCALE).format(Math.max(1, Math.round(n))) });
const addressOf = (a: MailAccount) => `${a.local}@${a.domain}`;
const listOf = (v: unknown) => String(v ?? "").split(",").map((x) => x.trim().toLowerCase()).filter(Boolean);

function Go({ to, path, children, className }: { to: To; path: string; children: ReactNode; className?: string }) {
  return <a href={`#${path}`} className={className} onClick={(e) => { e.preventDefault(); to(path); }}>{children}</a>;
}

// A button that asks once more before it acts.
function Confirm({ label, onYes, danger }: { label: string; onYes: () => void; danger?: boolean }) {
  const [asking, setAsking] = useState(false);
  if (!asking) return <button type="button" className={danger ? "gx-danger" : undefined} onClick={() => setAsking(true)}>{label}</button>;
  return (
    <span className="gxm-confirm">{t("gmix.mail.sure")}
      <button type="button" className="gx-danger" onClick={() => { setAsking(false); onYes(); }}>{t("gmix.mail.yes")}</button>
      <button type="button" className="gx-quiet" onClick={() => setAsking(false)}>{t("gmix.mail.no")}</button>
    </span>
  );
}

export const folderName = (game: GameState, accountId: string, id: string) =>
  (SYS_FOLDERS as string[]).includes(id) ? t(`mail.gmix.folder.${id}`) : game.mail.folders.find((f) => f.id === id && f.accountId === accountId)?.name ?? id;

// Every address the mailbox has written to or heard from, most recent first.
export function seenAddresses(game: GameState, a: MailAccount): string[] {
  const own = new Set([addressOf(a), ...a.aliases.map((l) => `${l}@${a.domain}`)]), out: string[] = [];
  for (const m of [...boxOf(game, a.id)].reverse()) {
    const v = view(game, m), xs = m.folder === "sent" ? [...listOf(v.to), ...v.cc] : m.from === "daemon" ? [] : [v.fromAddress.toLowerCase()];
    for (const x of xs) if (x.includes("@") && !own.has(x) && !out.includes(x)) out.push(x);
  }
  return out;
}

// The tab title: the unread count is the only notice a webmail-only player gets.
export const gmixTitle = (game: GameState, accountId: string | null): string => {
  const n = accountId && game.mail.accounts.some((a) => a.id === accountId && a.closedAt === null) ? unread(game, accountId) : 0;
  return n ? `GMix (${n})` : "GMix";
};

interface MailProps { game: GameState; to: To; go: (url: string) => void; account: MailAccount; look: GmixLook; route: string; params: URLSearchParams }

export function GmixMail(p: MailProps) {
  const { game, account, route, look } = p;
  const ads = !!mailPlan("gmix", game.mail.tenants.find((x) => x.id === account.tenant)?.plan ?? "free")?.ads;
  const [head, ...rest] = route.split("/"), arg = rest.join("/");
  const page = (() => {
    if (head === "read") return <Reader {...p} id={arg} />;
    if (head === "compose") return <Compose {...p} />;
    if (head === "contacts") return <Contacts {...p} />;
    if (head === "space") return <Space {...p} />;
    if (head === "settings") return <Settings {...p} page={arg} />;
    return <List {...p} folder={head || "inbox"} ads={ads} />;
  })();
  return (
    <div className="gxm">
      {ads && <Ad {...p} slot={0} className="gxm-banner" />}
      <div className="gxm-body">
        <Nav {...p} current={head === "read" || head === "compose" ? "" : head || "inbox"} />
        <section className="gxm-main">{page}</section>
        {ads && look === "frames" && <Ad {...p} slot={1} className="gxm-sky" />}
      </div>
    </div>
  );
}

function Ad({ game, account, go, slot, className }: MailProps & { slot: number; className: string }) {
  const n = gmixAd(game.hour, account.id, slot);
  const body = <><small>{t("gmix.mail.adLabel")}</small><span>{t(`gmix.mail.ad.${n}`)}</span></>;
  if (n === 0) return <a href="#prize" className={`gxm-ad ${className}`} data-ad={n} onClick={(e) => { e.preventDefault(); go(VIDEO_URL); }}>{body}</a>;
  return <aside className={`gxm-ad ${className}`} data-ad={n}>{body}</aside>;
}

function Nav({ game, to, account, current }: MailProps & { current: string }) {
  const folders = foldersOf(game, account.id);
  const tree = (parent: string | null, depth: number): ReactNode[] => folders.filter((f) => f.parent === parent && !(SYS_FOLDERS as string[]).includes(f.id)).flatMap((f) => [
    <FolderLink key={f.id} game={game} to={to} account={account} id={f.id} depth={depth} current={current} />, ...tree(f.id, depth + 1),
  ]);
  return (
    <nav className="gxm-nav">
      <Go to={to} path="mail/compose" className="gx-button gxm-write">{t("gmix.mail.write")}</Go>
      <h3>{t("gmix.mail.folders")}</h3>
      <ul>
        {SYS_FOLDERS.map((id) => <FolderLink key={id} game={game} to={to} account={account} id={id} depth={0} current={current} />)}
        {tree(null, 1)}
      </ul>
      <ul className="gxm-links">
        <li><Go to={to} path="mail/contacts" className={current === "contacts" ? "gxm-on" : undefined}>{t("gmix.mail.contacts")}</Go></li>
        <li><Go to={to} path="mail/settings" className={current === "settings" ? "gxm-on" : undefined}>{t("gmix.mail.settings")}</Go></li>
        <li><Go to={to} path="account">{t("gmix.nav.account")}</Go></li>
      </ul>
    </nav>
  );
}

function FolderLink({ game, to, account, id, depth, current }: { game: GameState; to: To; account: MailAccount; id: string; depth: number; current: string }) {
  const n = unread(game, account.id, id);
  return (
    <li style={{ paddingLeft: depth * 10 }}>
      <Go to={to} path={`mail/${id}`} className={current === id ? "gxm-on" : undefined}>{folderName(game, account.id, id)}{n > 0 && <b> ({n})</b>}</Go>
    </li>
  );
}

function Storage({ game, to, account }: MailProps) {
  const quota = capsOf(game, account).quotaMb * 1024, pct = Math.min(100, Math.round((account.usedKb / quota) * 100));
  const plan = game.mail.tenants.find((x) => x.id === account.tenant)!.plan, up = plan === "free" ? "pro" : plan === "pro" ? "top" : null;
  const used = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 1 }).format(account.usedKb / 1024);
  const total = new Intl.NumberFormat(LOCALE).format(quota / 1024 / 1024);
  return (
    <div className="gxm-storage">
      {pct >= 90 && (
        <p className={`gxm-full${pct >= 100 ? " gxm-red" : ""}`} role="status">
          {t(pct >= 100 ? "gmix.mail.full" : "gmix.mail.nearlyFull", { pct })}
          {up && <Go to={to} path={`${up}mix`} className="gx-button">{t("gmix.account.switch", { plan: t(`mail.gmix.plan.${up}`) })}</Go>}
        </p>
      )}
      <span>{t("gmix.mail.used", { used, total, pct })}</span>
      <i className="gxm-meter"><i style={{ width: `${pct}%` }} /></i>
      <Go to={to} path="mail/space">{t("gmix.mail.space")}</Go>
    </div>
  );
}

function List(p: MailProps & { folder: string; ads: boolean }) {
  const { game, to, account, folder, look, params, ads } = p;
  const kit = useMailActions(account.id), act = usePageAct();
  const sort = (SORTS as readonly string[]).includes(params.get("sort") ?? "") ? params.get("sort") as Sort : "date", asc = params.get("asc") === "1";
  const all = folderRows(game, account.id, folder, { sort: sort === "size" ? "date" : sort, asc });
  if (sort === "size") all.sort((a, b) => (asc ? a.kb - b.kb : b.kb - a.kb));
  const pages = Math.max(1, Math.ceil(all.length / PAGE)), at = Math.min(pages, Math.max(1, Number(params.get("page")) || 1));
  const rows = all.slice((at - 1) * PAGE, at * PAGE);
  const [sel, setSel] = useState<string[]>([]), [blockable, setBlockable] = useState<string[]>([]);
  const picked = sel.filter((id) => rows.some((m) => m.id === id));
  const url = (o: Partial<Record<"sort" | "asc" | "page", string>>) => {
    const q = new URLSearchParams({ sort, asc: asc ? "1" : "0", page: String(at), ...o });
    return `mail/${folder}?${q}`;
  };
  const others = foldersOf(game, account.id).filter((f) => f.id !== folder && f.id !== "drafts");
  const remove = (ids: string[]) => (folder === "trash" ? act(expungeMessages, account.id, ids) : kit.remove(ids));
  const spam = (ids: string[]) => {
    kit.junk(ids, true);
    const from = [...new Set(rows.filter((m) => ids.includes(m.id)).map((m) => view(game, m).fromAddress.toLowerCase()).filter((x) => x.includes("@")))];
    setBlockable(from.filter((x) => !listOf(account.prefs?.block).includes(x)));
  };
  const block = () => {
    act(setAccountPrefs, account.id, { block: [...listOf(account.prefs?.block), ...blockable].join(", ") });
    setBlockable([]);
  };
  const head = (k: Sort) => <th key={k} scope="col"><Go to={to} path={url({ sort: k, asc: sort === k && !asc ? "1" : "0", page: "1" })}>{t(`gmix.mail.col.${k}`)}{sort === k ? (asc ? " ▲" : " ▼") : ""}</Go></th>;
  const check = (id: string) => <input type="checkbox" aria-label={t("gmix.mail.select")} checked={picked.includes(id)} onChange={(e) => setSel(e.target.checked ? [...picked, id] : picked.filter((x) => x !== id))} />;
  const subject = (m: Message) => view(game, m).subject || t("gmix.mail.noSubject");
  const sender = (m: Message) => { const v = view(game, m); return folder === "sent" || folder === "drafts" ? v.to : v.fromName || v.fromAddress; };
  const open = (m: Message) => (m.draft ? `mail/compose?draft=${m.id}` : `mail/read/${m.id}`);
  const body = rows.length === 0 ? <p className="gxm-empty">{t("gmix.mail.empty")}</p> : look === "frames" ? (
    <table className="gxm-list">
      <thead><tr><th><input type="checkbox" aria-label={t("gmix.mail.selectAll")} checked={picked.length === rows.length} onChange={(e) => setSel(e.target.checked ? rows.map((m) => m.id) : [])} /></th><th /><th />{SORTS.map(head)}</tr></thead>
      <tbody>
        {rows.map((m) => (
          <tr key={m.id} className={isRead(game, m) ? undefined : "gxm-unread"} data-id={m.id}>
            <td>{check(m.id)}</td>
            <td className="gxm-mark">{isRead(game, m) ? "" : "✉"}{m.star ? "⚑" : ""}</td>
            <td className="gxm-mark">{m.att?.length ? "📎" : ""}</td>
            <td>{sender(m)}</td>
            <td><Go to={to} path={open(m)}>{subject(m)}</Go></td>
            <td>{when(m.at)}</td>
            <td>{kb(m.kb)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  ) : (
    <ul className={`gxm-cards gxm-cards-${look}`}>
      {rows.map((m) => (
        <li key={m.id} className={isRead(game, m) ? undefined : "gxm-unread"} data-id={m.id}>
          {check(m.id)}
          <Go to={to} path={open(m)} className="gxm-card">
            <b>{sender(m)}</b><span>{subject(m)}</span>
            {look === "navigator" && <small>{view(game, m).text.slice(0, 90)}</small>}
            <time>{when(m.at)}</time>
          </Go>
          {look === "flat" && <span className="gxm-hover"><button type="button" onClick={() => remove([m.id])}>{t("gmix.mail.delete")}</button><button type="button" onClick={() => kit.mark([m.id], { read: !isRead(game, m) })}>{t(isRead(game, m) ? "gmix.mail.markUnread" : "gmix.mail.markRead")}</button></span>}
        </li>
      ))}
    </ul>
  );
  return (
    <>
      <h1>{folderName(game, account.id, folder)}</h1>
      <div className="gxm-tools">
        {folder === "trash" ? <Confirm label={t("gmix.mail.delete")} danger onYes={() => remove(picked)} /> : <button type="button" disabled={!picked.length} onClick={() => remove(picked)}>{t("gmix.mail.delete")}</button>}
        <select aria-label={t("gmix.mail.moveTo")} value="" disabled={!picked.length} onChange={(e) => { if (e.target.value) kit.move(picked, e.target.value); }}>
          <option value="">{t("gmix.mail.moveTo")}</option>
          {others.map((f) => <option key={f.id} value={f.id}>{folderName(game, account.id, f.id)}</option>)}
        </select>
        <button type="button" disabled={!picked.length} onClick={() => kit.mark(picked, { read: true })}>{t("gmix.mail.markRead")}</button>
        <button type="button" disabled={!picked.length} onClick={() => kit.mark(picked, { read: false })}>{t("gmix.mail.markUnread")}</button>
        <button type="button" disabled={!picked.length} onClick={() => kit.mark(picked, { star: !rows.find((m) => m.id === picked[0])?.star })}>{t("gmix.mail.flag")}</button>
        {folder === "junk" ? <button type="button" disabled={!picked.length} onClick={() => kit.junk(picked, false)}>{t("gmix.mail.notSpam")}</button>
          : <button type="button" disabled={!picked.length} onClick={() => spam(picked)}>{t("gmix.mail.spam")}</button>}
        {(folder === "trash" || folder === "junk") && rows.length > 0 && <Confirm label={t(`gmix.mail.empty.${folder}`)} danger onYes={() => act(emptyFolder, account.id, folder as "trash" | "junk")} />}
      </div>
      {blockable.length > 0 && <p className="gxm-block">{blockable.join(", ")} <button type="button" onClick={block}>{t("gmix.mail.block")}</button></p>}
      {body}
      {pages > 1 && <p className="gxm-pages">{Array.from({ length: pages }, (_, i) => i + 1).map((n) => (n === at ? <b key={n}>{n}</b> : <Go key={n} to={to} path={url({ page: String(n) })}>{n}</Go>))}</p>}
      {ads && <Ad {...p} slot={2} className="gxm-text" />}
      <Storage {...p} />
    </>
  );
}

function Att({ game, account, m, att, i }: { game: GameState; account: MailAccount; m: Message; att: Attachment; i: number }) {
  const act = usePageAct();
  const name = att.k === "file" ? att.name : att.k === "doc" ? game.docs.find((d) => d.id === att.id)?.title ?? "" : t(`gmix.mail.att.${att.k}`);
  return (
    <li>📎 {name}{att.k === "file" && <small> {kb(att.kb)}</small>}
      {(att.k === "file" || att.k === "doc") && <button type="button" onClick={() => act(saveAttachment, account.id, m.id, i)}>{t("gmix.mail.saveAtt")}</button>}
    </li>
  );
}

function Reader({ game, to, go, account, id }: MailProps & { id: string }) {
  const kit = useMailActions(account.id);
  const m = boxOf(game, account.id).find((x) => x.id === id);
  const seen = m ? isRead(game, m) : true;
  useEffect(() => { if (!seen) kit.mark([id], { read: true }); }, [id, seen]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!m) return <p className="gxm-empty">{t("gmix.mail.gone")}</p>;
  const v = view(game, m);
  return (
    <article className="gxm-read">
      <div className="gxm-tools">
        <Go to={to} path={`mail/compose?re=${m.id}&mode=reply`} className="gx-button">{t("gmix.mail.reply")}</Go>
        <Go to={to} path={`mail/compose?re=${m.id}&mode=all`} className="gx-button">{t("gmix.mail.replyAll")}</Go>
        <Go to={to} path={`mail/compose?re=${m.id}&mode=fwd`} className="gx-button">{t("gmix.mail.forward")}</Go>
        <button type="button" onClick={() => { if (!kit.remove([m.id])) to(`mail/${m.folder}`); }}>{t("gmix.mail.delete")}</button>
        <Go to={to} path={`mail/${m.folder}`}>{t("gmix.mail.back", { folder: folderName(game, account.id, m.folder) })}</Go>
      </div>
      <table className="gx-facts">
        <tbody>
          <tr><th>{t("gmix.mail.from")}</th><td>{v.fromName ? `${v.fromName} <${v.fromAddress}>` : v.fromAddress}</td></tr>
          <tr><th>{t("gmix.mail.to")}</th><td>{v.to}</td></tr>
          {v.cc.length > 0 && <tr><th>{t("gmix.mail.cc")}</th><td>{v.cc.join(", ")}</td></tr>}
          <tr><th>{t("gmix.mail.date")}</th><td>{when(m.at)}</td></tr>
          <tr><th>{t("gmix.mail.subject")}</th><td><b>{v.subject}</b></td></tr>
        </tbody>
      </table>
      <div className="gxm-text-body">{v.text}</div>
      {v.att.length > 0 && <ul className="gxm-atts">{v.att.map((a, i) => <Att key={i} game={game} account={account} m={m} att={a} i={i} />)}</ul>}
      <TicketSlot game={game} message={m} previews={false} desk={(url) => <p className="gxm-block"><a href="#desk" onClick={(e) => { e.preventDefault(); go(url); }}>{t("gmix.mail.desk")}</a></p>} />
    </article>
  );
}

interface Form { to: string; cc: string; bcc: string; subject: string; text: string; att: Attachment[]; re?: string; fwd?: string; draftId?: string }

function Compose({ game, to, account, params }: MailProps) {
  const act = usePageAct(), caps = capsOf(game, account);
  const [init] = useState((): Form => {
    const draft = boxOf(game, account.id).find((x) => x.id === params.get("draft") && x.draft);
    const sig = String(account.prefs?.signature ?? ""), tail = sig ? `\n\n-- \n${sig}` : "";
    if (draft) { const v = view(game, draft); return { to: v.to, cc: v.cc.join(", "), bcc: (draft.bcc ?? []).join(", "), subject: v.subject, text: v.text, att: draft.att ?? [], re: draft.re, draftId: draft.id }; }
    const re = boxOf(game, account.id).find((x) => x.id === params.get("re")), mode = params.get("mode");
    if (!re) return { to: params.get("to") ?? "", cc: "", bcc: "", subject: "", text: tail, att: [] };
    const v = view(game, re), quote = `\n\n${t("gmix.mail.wrote", { who: v.fromAddress, date: when(re.at) })}\n${v.text.split("\n").map((l) => `> ${l}`).join("\n")}`;
    if (mode === "fwd") return { to: "", cc: "", bcc: "", subject: t("gmix.mail.fwdSubject", { subject: v.subject }), text: `${tail}${quote}`, att: re.att ?? [], fwd: re.id };
    const own = addressOf(account), cc = mode === "all" ? [...listOf(v.to), ...v.cc].filter((x) => x !== own && x !== v.fromAddress) : [];
    return { to: v.fromAddress, cc: cc.join(", "), bcc: "", subject: t("gmix.mail.reSubject", { subject: v.subject }), text: `${tail}${quote}`, att: [], re: re.id };
  });
  const [f, setF] = useState(init), [sent, setSent] = useState(false), [saved, setSaved] = useState(false);
  const set = (k: "to" | "cc" | "bcc" | "subject" | "text", v: string) => { setF({ ...f, [k]: v }); setSaved(false); };
  const draft = { to: [f.to], cc: [f.cc], bcc: [f.bcc], subject: f.subject, text: f.text, att: f.att, re: f.re };
  if (sent) return <><p className="gx-ok">{t("gmix.mail.sent")}</p><Go to={to} path="mail/inbox">{folderName(game, account.id, "inbox")}</Go></>;
  const docs = game.docs.filter((d) => !f.att.some((a) => a.k === "doc" && a.id === d.id));
  return (
    <form className="gx-form gxm-compose" onSubmit={(e) => { e.preventDefault(); if (act(sendMessage, account.id, { ...draft, from: addressOf(account), fwd: f.fwd, draftId: f.draftId }).ok) setSent(true); }}>
      <h1>{t("gmix.mail.write")}</h1>
      <datalist id="gxm-seen">{seenAddresses(game, account).map((x) => <option key={x} value={x} />)}</datalist>
      <label>{t("gmix.mail.from")}<input value={`${account.title} <${addressOf(account)}>`} readOnly /></label>
      {(["to", "cc", "bcc"] as const).map((k) => <label key={k}>{t(`gmix.mail.${k}`)}<input name={k} list="gxm-seen" value={f[k]} onChange={(e) => set(k, e.target.value)} autoComplete="off" /></label>)}
      <label>{t("gmix.mail.subject")}<input name="subject" value={f.subject} onChange={(e) => set("subject", e.target.value)} autoComplete="off" /></label>
      <label>{t("gmix.mail.text")}<textarea name="text" rows={12} value={f.text} onChange={(e) => set("text", e.target.value)} /></label>
      <div className="gxm-attach">
        <span>{t("gmix.mail.attachments", { mb: caps.attachMb })}</span>
        <ul>{f.att.map((a, i) => (
          <li key={i}>📎 {a.k === "file" ? `${a.name} (${kb(a.kb)})` : a.k === "doc" ? game.docs.find((d) => d.id === a.id)?.title : t(`gmix.mail.att.${a.k}`)}
            <button type="button" className="gx-quiet" onClick={() => setF({ ...f, att: f.att.filter((_, j) => j !== i) })}>{t("gmix.mail.remove")}</button></li>
        ))}</ul>
        {docs.length > 0 && (
          <select aria-label={t("gmix.mail.attach")} value="" onChange={(e) => { if (e.target.value) setF({ ...f, att: [...f.att, { k: "doc", id: e.target.value }] }); }}>
            <option value="">{t("gmix.mail.attach")}</option>
            {docs.map((d) => <option key={d.id} value={d.id}>{d.title || t("gmix.mail.untitled")}</option>)}
          </select>
        )}
      </div>
      <div className="gx-actions">
        <button type="submit">{t("gmix.mail.send")}</button>
        <button type="button" className="gx-quiet" onClick={() => { const r = act(saveDraft, account.id, { ...draft, id: f.draftId }); if (r.ok) { setF({ ...f, draftId: r.id }); setSaved(true); } }}>{t("gmix.mail.saveDraft")}</button>
        {saved && <span className="gx-ok">{t("gmix.account.saved")}</span>}
      </div>
    </form>
  );
}

function Contacts({ game, to, account }: MailProps) {
  const act = usePageAct(), blocked = listOf(account.prefs?.block), seen = seenAddresses(game, account);
  return (
    <>
      <h1>{t("gmix.mail.contacts")}</h1>
      {seen.length === 0 ? <p className="gxm-empty">{t("gmix.mail.noContacts")}</p> : (
        <table className="gxm-list">
          <tbody>{seen.map((x) => (
            <tr key={x}><td>{x}</td><td><Go to={to} path={`mail/compose?to=${encodeURIComponent(x)}`}>{t("gmix.mail.write")}</Go></td>
              <td>{blocked.includes(x) ? t("gmix.mail.blocked") : <button type="button" onClick={() => act(setAccountPrefs, account.id, { block: [...blocked, x].join(", ") })}>{t("gmix.mail.block")}</button>}</td></tr>
          ))}</tbody>
        </table>
      )}
    </>
  );
}

function Space({ game, to, account, ...p }: MailProps) {
  const act = usePageAct(), sizeOf = (f: string) => boxOf(game, account.id).filter((m) => m.folder === f).reduce((n, m) => n + m.kb, 0);
  return (
    <>
      <h1>{t("gmix.mail.space")}</h1>
      <table className="gx-facts">
        <tbody>
          {(["trash", "junk"] as const).map((f) => (
            <tr key={f}><th>{folderName(game, account.id, f)}</th><td>{kb(sizeOf(f))}</td><td><Confirm label={t(`gmix.mail.empty.${f}`)} danger onYes={() => act(emptyFolder, account.id, f)} /></td></tr>
          ))}
          <tr><th>{t("gmix.mail.older")}</th><td>{t("gmix.mail.olderCount", { n: account.older.n, size: kb(account.older.kb) })}</td>
            <td><Confirm label={t("gmix.mail.purge")} danger onYes={() => act(purgeOlder, account.id)} /></td></tr>
        </tbody>
      </table>
      <Storage game={game} to={to} account={account} {...p} />
    </>
  );
}

function Settings(p: MailProps & { page: string }) {
  const { to, page } = p;
  const body = (() => {
    if (page === "spam") return <SpamSettings {...p} />;
    if (page === "filters") return <FilterSettings {...p} />;
    if (page === "folders") return <FolderSettings {...p} />;
    if (page === "signature") return <SignatureSettings {...p} />;
    if (page === "access") return <AccessSettings {...p} />;
    if (page === "collector") return <CollectorSettings {...p} />;
    if (page === "forward") return <ForwardSettings {...p} />;
    return null;
  })();
  return (
    <div className="gxm-settings">
      <h1>{t("gmix.mail.settings")}</h1>
      <ul className="gxm-tabs">{SETTINGS.map((k) => <li key={k}><Go to={to} path={`mail/settings/${k}`} className={page === k ? "gxm-on" : undefined}>{t(`gmix.mail.set.${k}`)}</Go></li>)}</ul>
      {body}
    </div>
  );
}

function useSaved(): [boolean, (ok: boolean) => void, ReactNode] {
  const [saved, setSaved] = useState(false);
  return [saved, setSaved, saved ? <span className="gx-ok">{t("gmix.account.saved")}</span> : null];
}

function SpamSettings({ account }: MailProps) {
  const act = usePageAct(), pr = account.prefs ?? {}, [, setSaved, mark] = useSaved();
  const [level, setLevel] = useState(String(pr.spam ?? "normal")), [action, setAction] = useState(String(pr.spamAction ?? "junk"));
  const [allow, setAllow] = useState(listOf(pr.allow).join("\n")), [block, setBlock] = useState(listOf(pr.block).join("\n"));
  const lines = (v: string) => v.split(/[\s,]+/).map((x) => x.trim().toLowerCase()).filter(Boolean).join(", ");
  return (
    <form className="gx-form" onSubmit={(e) => { e.preventDefault(); setSaved(act(setAccountPrefs, account.id, { spam: level, spamAction: action, allow: lines(allow), block: lines(block) }).ok); }}>
      <fieldset><legend>{t("gmix.mail.spamLevel")}</legend>
        {(["off", "normal", "strict"] as const).map((k) => <label key={k}><input type="radio" name="spam" checked={level === k} onChange={() => setLevel(k)} />{t(`gmix.mail.level.${k}`)}</label>)}
      </fieldset>
      <fieldset><legend>{t("gmix.mail.spamAction")}</legend>
        {(["junk", "delete"] as const).map((k) => <label key={k}><input type="radio" name="spamAction" checked={action === k} onChange={() => setAction(k)} />{t(`gmix.mail.action.${k}`)}</label>)}
      </fieldset>
      <label>{t("gmix.mail.allowed")}<textarea name="allow" rows={4} value={allow} onChange={(e) => setAllow(e.target.value)} /></label>
      <label>{t("gmix.mail.blockedList")}<textarea name="block" rows={4} value={block} onChange={(e) => setBlock(e.target.value)} /></label>
      <div className="gx-actions"><button type="submit">{t("gmix.account.save")}</button>{mark}</div>
    </form>
  );
}

const FILTER_ACTS = ["move", "trash", "read", "star", "junk"] as const;
function FilterSettings({ game, account }: MailProps) {
  const act = usePageAct(), caps = capsOf(game, account), mine = game.mail.filters.filter((x) => x.accountId === account.id);
  const custom = foldersOf(game, account.id).filter((f) => f.id !== "drafts" && f.id !== "inbox");
  const [name, setName] = useState(""), [field, setField] = useState<"from" | "to" | "subject">("from"), [value, setValue] = useState("");
  const [does, setDoes] = useState<(typeof FILTER_ACTS)[number]>("move"), [folder, setFolder] = useState(custom[0]?.id ?? "archive");
  const save = () => {
    const a: MailAct = does === "move" ? { do: "move", folder } : { do: does };
    if (act(saveFilter, account.id, { name: name || value, on: true, match: "all", conds: [{ field, op: "contains", value }], acts: [a] }).ok) { setName(""); setValue(""); }
  };
  return (
    <>
      <p>{t("gmix.mail.count", { what: t("gmix.mail.set.filters"), n: mine.length, max: caps.filterMax })}</p>
      {mine.length > 0 && (
        <table className="gxm-list"><tbody>{mine.map((f) => (
          <tr key={f.id}><td><input type="checkbox" aria-label={t("gmix.mail.on")} checked={f.on} onChange={(e) => act(setFilterOn, f.id, e.target.checked)} /></td><td>{f.name}</td>
            <td><Confirm label={t("gmix.mail.delete")} onYes={() => act(deleteFilter, f.id)} /></td></tr>
        ))}</tbody></table>
      )}
      <form className="gx-form" onSubmit={(e) => { e.preventDefault(); save(); }}>
        <h2>{t("gmix.mail.newFilter")}</h2>
        <label>{t("gmix.mail.filterName")}<input name="filterName" value={name} onChange={(e) => setName(e.target.value)} /></label>
        <label>{t("gmix.mail.when")}
          <select value={field} onChange={(e) => setField(e.target.value as typeof field)}>{(["from", "to", "subject"] as const).map((k) => <option key={k} value={k}>{t(`gmix.mail.${k}`)}</option>)}</select>
        </label>
        <label>{t("gmix.mail.contains")}<input name="filterValue" value={value} onChange={(e) => setValue(e.target.value)} /></label>
        <label>{t("gmix.mail.then")}
          <select value={does} onChange={(e) => setDoes(e.target.value as typeof does)}>{FILTER_ACTS.map((k) => <option key={k} value={k}>{t(`gmix.mail.do.${k}`)}</option>)}</select>
        </label>
        {does === "move" && <label>{t("gmix.mail.folder")}<select value={folder} onChange={(e) => setFolder(e.target.value)}>{custom.map((f) => <option key={f.id} value={f.id}>{folderName(game, account.id, f.id)}</option>)}</select></label>}
        <button type="submit">{t("gmix.mail.addFilter")}</button>
      </form>
    </>
  );
}

function FolderRow({ game, account, id }: { game: GameState; account: MailAccount; id: string }) {
  const act = usePageAct(), f = game.mail.folders.find((x) => x.id === id)!;
  const [name, setName] = useState(f.name);
  const others = game.mail.folders.filter((x) => x.accountId === account.id && x.id !== id && !x.label);
  return (
    <tr>
      <td><input aria-label={t("gmix.mail.folderName")} value={name} onChange={(e) => setName(e.target.value)} /><button type="button" onClick={() => act(renameMailFolder, account.id, id, name)}>{t("gmix.mail.rename")}</button></td>
      <td><select aria-label={t("gmix.mail.parent")} value={f.parent ?? ""} onChange={(e) => act(moveMailFolder, account.id, id, e.target.value || null)}>
        <option value="">{t("gmix.mail.top")}</option>{others.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
      </select></td>
      <td><Confirm label={t("gmix.mail.delete")} onYes={() => act(deleteMailFolder, account.id, id)} /></td>
    </tr>
  );
}

function FolderSettings({ game, account }: MailProps) {
  const act = usePageAct(), caps = capsOf(game, account);
  const mine = game.mail.folders.filter((x) => x.accountId === account.id && !x.label);
  const [name, setName] = useState(""), [parent, setParent] = useState("");
  const create = () => { if (act(createMailFolder, account.id, name, parent || null).ok) setName(""); };
  return (
    <>
      <p>{t("gmix.mail.count", { what: t("gmix.mail.set.folders"), n: mine.length, max: caps.folderMax })}</p>
      {mine.length > 0 && <table className="gxm-list"><tbody>{mine.map((f) => <FolderRow key={f.id} game={game} account={account} id={f.id} />)}</tbody></table>}
      <form className="gx-form" onSubmit={(e) => { e.preventDefault(); create(); }}>
        <h2>{t("gmix.mail.newFolder")}</h2>
        <label>{t("gmix.mail.folderName")}<input name="folderName" value={name} onChange={(e) => setName(e.target.value)} /></label>
        <label>{t("gmix.mail.parent")}<select name="parent" value={parent} onChange={(e) => setParent(e.target.value)}><option value="">{t("gmix.mail.top")}</option>{mine.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}</select></label>
        <button type="submit">{t("gmix.mail.createFolder")}</button>
      </form>
    </>
  );
}

function SignatureSettings({ account }: MailProps) {
  const act = usePageAct(), [text, setText] = useState(String(account.prefs?.signature ?? "")), [, setSaved, mark] = useSaved();
  return (
    <form className="gx-form" onSubmit={(e) => { e.preventDefault(); setSaved(act(setAccountPrefs, account.id, { signature: text.slice(0, 500) }).ok); }}>
      <label>{t("gmix.mail.set.signature")}<textarea name="signature" rows={5} value={text} onChange={(e) => { setText(e.target.value); setSaved(false); }} /></label>
      <div className="gx-actions"><button type="submit">{t("gmix.account.save")}</button>{mark}</div>
    </form>
  );
}

function AccessSettings({ game, to, account }: MailProps) {
  const act = usePageAct(), caps = capsOf(game, account), servers = mailHost("gmix")!.servers!;
  const plan = game.mail.tenants.find((x) => x.id === account.tenant)!.plan, imapLater = plan === "free" && yearOf(game.hour) < IMAP_FREE_FROM;
  return (
    <div className="gx-form">
      <label className="gxm-switch"><input type="checkbox" name="external" checked={!!account.external} onChange={(e) => act(setExternalAccess, account.id, e.target.checked)} />{t("gmix.mail.external")}</label>
      <table className="gx-facts">
        <tbody>
          <tr><th>POP3</th><td>{servers.pop}</td><td>{t(caps.pop ? "gmix.mail.available" : "gmix.mail.unavailable")}</td></tr>
          <tr><th>IMAP</th><td>{servers.imap}</td><td>{caps.imap ? t("gmix.mail.available") : imapLater ? <Go to={to} path="promix">{t("gmix.mail.proFeature")}</Go> : t("gmix.mail.unavailable")}</td></tr>
          <tr><th>SMTP</th><td>{servers.smtp}</td><td>{t("gmix.mail.available")}</td></tr>
        </tbody>
      </table>
      {caps.pollGapMin > 0 && <p>{t("gmix.mail.pollGap", { min: caps.pollGapMin })}</p>}
    </div>
  );
}

function CollectorSettings({ game, account }: MailProps) {
  const act = usePageAct(), caps = capsOf(game, account), mine = game.mail.fetch.filter((r) => r.accountId === account.id);
  const sources = game.mail.accounts.filter((a) => a.id !== account.id && a.closedAt === null && !a.shared);
  const folders = foldersOf(game, account.id).filter((f) => !["drafts", "sent", "trash", "junk"].includes(f.id));
  const [source, setSource] = useState(sources[0]?.id ?? ""), [proto, setProto] = useState<"pop" | "imap">("pop"), [password, setPassword] = useState("");
  const [leave, setLeave] = useState(true), [folder, setFolder] = useState("inbox");
  const name = (id: string) => { const a = game.mail.accounts.find((x) => x.id === id); return a ? addressOf(a) : id; };
  const add = () => { if (act(saveFetchRule, account.id, { source, proto, password, leave, folder: folder === "inbox" ? null : folder }).ok) setPassword(""); };
  return (
    <>
      <p>{t("gmix.mail.count", { what: t("gmix.mail.set.collector"), n: mine.length, max: caps.collectors })}</p>
      {mine.length > 0 && (
        <table className="gxm-list"><tbody>{mine.map((r) => (
          <tr key={r.id}>
            <td>{name(r.source)}</td><td>{r.proto === "pop" ? "POP3" : "IMAP"}</td><td>{t(r.leave ? "gmix.mail.keepCopy" : "gmix.mail.noCopy")}</td>
            <td>{folderName(game, account.id, r.folder ?? "inbox")}</td>
            <td>{r.err ? <span className="gx-error">{t(r.err)}</span> : r.lastAt > 0 ? when(r.lastAt) : ""}</td>
            <td><button type="button" onClick={() => act(runFetchRule, r.id)}>{t("gmix.mail.checkNow")}</button><Confirm label={t("gmix.mail.delete")} onYes={() => act(deleteFetchRule, r.id)} /></td>
          </tr>
        ))}</tbody></table>
      )}
      {sources.length > 0 && (
        <form className="gx-form" onSubmit={(e) => { e.preventDefault(); add(); }}>
          <h2>{t("gmix.mail.newCollector")}</h2>
          <label>{t("gmix.mail.account")}<select name="source" value={source} onChange={(e) => setSource(e.target.value)}>{sources.map((a) => <option key={a.id} value={a.id}>{addressOf(a)}</option>)}</select></label>
          <label>{t("gmix.mail.protocol")}<select value={proto} onChange={(e) => setProto(e.target.value as "pop" | "imap")}><option value="pop">POP3</option><option value="imap">IMAP</option></select></label>
          <label>{t("gmix.login.password")}<input name="sourcePassword" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="off" /></label>
          <label><input type="checkbox" checked={leave} onChange={(e) => setLeave(e.target.checked)} />{t("gmix.mail.keepCopy")}</label>
          <label>{t("gmix.mail.folder")}<select value={folder} onChange={(e) => setFolder(e.target.value)}>{folders.map((f) => <option key={f.id} value={f.id}>{folderName(game, account.id, f.id)}</option>)}</select></label>
          <button type="submit">{t("gmix.mail.addCollector")}</button>
        </form>
      )}
    </>
  );
}

function ForwardSettings({ game, to, account }: MailProps) {
  const act = usePageAct(), [, setSaved, mark] = useSaved();
  const free = game.mail.tenants.find((x) => x.id === account.tenant)!.plan === "free";
  const [fwd, setFwd] = useState(account.forward?.to ?? ""), [keep, setKeep] = useState(account.forward?.keep ?? true);
  const [on, setOn] = useState(!!account.vacation?.on), [subject, setSubject] = useState(account.vacation?.subject ?? ""), [text, setText] = useState(account.vacation?.text ?? "");
  if (free) return <p className="gxm-locked">{t("gmix.mail.locked", { plan: t("mail.gmix.plan.pro") })} <Go to={to} path="promix" className="gx-button">{t("gmix.account.switch", { plan: t("mail.gmix.plan.pro") })}</Go></p>;
  const save = () => {
    const a = act(setForward, account.id, fwd.trim() || null, keep);
    const b = a.ok && act(setVacation, account.id, on || subject || text ? { on, subject, text, until: null } : null);
    setSaved(!!b && b.ok);
  };
  return (
    <form className="gx-form" onSubmit={(e) => { e.preventDefault(); save(); }}>
      <h2>{t("gmix.mail.forwarding")}</h2>
      <label>{t("gmix.mail.forwardTo")}<input name="forward" value={fwd} onChange={(e) => setFwd(e.target.value)} autoComplete="off" /></label>
      <label><input type="checkbox" checked={keep} onChange={(e) => setKeep(e.target.checked)} />{t("gmix.mail.keepCopy")}</label>
      <h2>{t("gmix.mail.absence")}</h2>
      <label><input type="checkbox" name="absent" checked={on} onChange={(e) => setOn(e.target.checked)} />{t("gmix.mail.absenceOn")}</label>
      <label>{t("gmix.mail.subject")}<input name="absenceSubject" value={subject} onChange={(e) => setSubject(e.target.value)} /></label>
      <label>{t("gmix.mail.text")}<textarea name="absenceText" rows={4} value={text} onChange={(e) => setText(e.target.value)} /></label>
      <div className="gx-actions"><button type="submit">{t("gmix.account.save")}</button>{mark}</div>
    </form>
  );
}
