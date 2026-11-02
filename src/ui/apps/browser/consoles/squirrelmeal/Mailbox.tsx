import { useEffect, useState, type ReactNode } from "react";
import { dateOf } from "../../../../../sim/00-core/time";
import { boxOf, foldersOf, isRead, listFolder, view } from "../../../../../sim/42-mail/model";
import type { Attachment, Message } from "../../../../../sim/42-mail/types";
import type { GameState } from "../../../../../sim/50-state";
import type { Cluster } from "../../../../../sim/60-infra/cluster";
import { webmailOf, webmailPref, webmailUser } from "../../../../../sim/80-business/webmail";
import { deleteWebmailMessages, saveContact } from "../../../../../sim/90-actions/webmail";
import { markMessages, moveMessages, saveAttachment, saveDraft, sendMessage } from "../../../../../sim/90-actions/mailmsg";
import { t } from "../../../../../i18n/en";
import { LOCALE } from "../../../../../i18n/lang";
import { matches, sortMessages, threadsOf, type SearchScope, type SortKey } from "../../../mail-kit/mail-kit";
import type { useStore } from "../../../../store";

export interface Seed { to?: string; cc?: string; subject?: string; text?: string; re?: string; fwd?: string; att?: Attachment[]; draftId?: string }
export type Screen =
  | { k: "list" } | { k: "read"; id: string } | { k: "compose"; seed: Seed } | { k: "options"; page: string }
  | { k: "folders" } | { k: "addresses" } | { k: "search" };
export interface Ctx {
  game: GameState; c: Cluster; account: string; folder: string;
  act: ReturnType<typeof useStore.getState>["act"]; go: (s: Screen) => void; open: (folder: string) => void;
}

export const when = (min: number) => new Date(dateOf(Math.floor(min / 60)).getTime() + (min % 60) * 60_000).toLocaleString(LOCALE, { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" });
export const Link = ({ on, children }: { on: () => void; children: ReactNode }) => (
  <a href="#sm" onClick={(e) => { e.preventDefault(); on(); }}>{children}</a>
);
export const Title = ({ children }: { children: ReactNode }) => <div className="smw-title">{children}</div>;
const sep = (xs: ReactNode[]) => xs.flatMap((x, i) => (i ? [" | ", x] : [x]));
const sentLike = (folder: string) => folder === "sent" || folder === "drafts";
const attName = (game: GameState, a: Attachment) => (a.k === "file" ? a.name : a.k === "doc" ? game.docs.find((d) => d.id === a.id)?.title ?? "" : t(`gmix.mail.att.${a.k}`));

// Folder picker over every folder of the mailbox, subfolders indented.
export function FolderSelect({ game, account, value, set, none }: { game: GameState; account: string; value: string; set: (v: string) => void; none?: string }) {
  const all = foldersOf(game, account), depth = (id: string | null, n = 0): number => (id ? depth(all.find((f) => f.id === id)?.parent ?? null, n + 1) : n - 1);
  return (
    <select value={value} onChange={(e) => set(e.target.value)}>
      {none !== undefined && <option value="">{none}</option>}
      {all.map((f) => <option key={f.id} value={f.id}>{`${"  ".repeat(Math.max(0, depth(f.id)))}${f.name}`}</option>)}
    </select>
  );
}

// right_main.php: the message list of one folder.
export function List({ ctx }: { ctx: Ctx }) {
  const { game, account, folder, act, go } = ctx;
  const per = Math.max(1, Number(webmailPref(webmailUser(game, ctx.c.id, account), "perPage")) || 15);
  const [sort, setSort] = useState<{ key: SortKey; asc: boolean }>({ key: "date", asc: false });
  const [threads, setThreads] = useState(false), [page, setPage] = useState(0), [sel, setSel] = useState<string[]>([]), [target, setTarget] = useState("inbox");
  const sorted = sortMessages(game, listFolder(game, account, folder), (m) => m, sort.key, sort.asc);
  const rows = threads ? threadsOf(sorted, (m) => m).flat() : sorted, pages = Math.max(1, Math.ceil(rows.length / per));
  const shown = page < 0 ? rows : rows.slice(page * per, page * per + per), from = rows.length ? (page < 0 ? 1 : page * per + 1) : 0;
  const run = (fn: () => unknown) => { fn(); setSel([]); };
  const head = (key: SortKey, label: string) => (
    <th><Link on={() => setSort({ key, asc: sort.key === key ? !sort.asc : key !== "date" })}>{label}</Link>{sort.key === key && (sort.asc ? " ▲" : " ▼")}</th>
  );
  const pager = sep([
    page > 0 ? <Link key="p" on={() => setPage(page - 1)}>{t("mailserver.sm.prev")}</Link> : t("mailserver.sm.prev"),
    page >= 0 && page < pages - 1 ? <Link key="n" on={() => setPage(page + 1)}>{t("mailserver.sm.next")}</Link> : t("mailserver.sm.next"),
    page < 0 ? <Link key="a" on={() => setPage(0)}>{t("mailserver.sm.paginate")}</Link> : <Link key="a" on={() => setPage(-1)}>{t("mailserver.sm.showAll")}</Link>,
  ]);
  return (
    <>
      <div className="smw-bar">
        <span>{t("mailserver.frame.viewing", { from, to: from ? from + shown.length - 1 : 0, total: rows.length })}</span>
        <span>{pager} | <Link on={() => setThreads(!threads)}>{t(threads ? "mailserver.sm.unthread" : "mailserver.sm.thread")}</Link></span>
      </div>
      <div className="smw-tools">
        <span>{t("mailserver.sm.moveTo")} <FolderSelect game={game} account={account} value={target} set={setTarget} /> <button type="button" disabled={!sel.length} onClick={() => run(() => act(moveMessages, account, sel, target))}>{t("mailserver.sm.move")}</button></span>
        <span>{t("mailserver.sm.transform")}{" "}
          {([["read", { read: true }], ["unread", { read: false }], ["flag", { star: true }], ["unflag", { star: false }]] as const).map(([k, f]) => (
            <button key={k} type="button" disabled={!sel.length} onClick={() => run(() => act(markMessages, account, sel, f))}>{t(`mailserver.sm.${k}`)}</button>
          ))}
          <button type="button" disabled={!sel.length} onClick={() => run(() => act(deleteWebmailMessages, ctx.c.id, account, sel))}>{t("mailserver.sm.delete")}</button>
        </span>
      </div>
      <table className="smw-list">
        <thead><tr><th />{head("from", t(sentLike(folder) ? "mailserver.sm.to" : "mailserver.frame.from"))}{head("date", t("mailserver.frame.date"))}<th />{head("subject", t("mailserver.frame.subject"))}</tr></thead>
        <tbody>
          {shown.map((m) => {
            const v = view(game, m), on = sel.includes(m.id);
            return (
              <tr key={m.id} className={`${isRead(game, m) ? "" : "unseen"} ${m.star ? "flagged" : ""}`}>
                <td><input type="checkbox" checked={on} onChange={() => setSel(on ? sel.filter((x) => x !== m.id) : [...sel, m.id])} /></td>
                <td>{sentLike(folder) ? v.to : v.fromName || v.fromAddress}</td>
                <td>{when(m.at)}</td>
                <td className="smw-flags">{`${m.ans ? "A" : ""}${m.star ? "F" : ""}${v.att.length ? "+" : ""}`}</td>
                <td><Link on={() => go(m.draft ? { k: "compose", seed: { to: v.to, cc: v.cc.join(", "), subject: v.subject, text: v.text, att: v.att, re: m.re, draftId: m.id } } : { k: "read", id: m.id })}>{v.subject || t("mailserver.sm.noSubject")}</Link></td>
              </tr>
            );
          })}
          {!shown.length && <tr><td colSpan={5} className="c">{t("mailserver.sm.empty")}</td></tr>}
        </tbody>
      </table>
      <div className="smw-tools"><Link on={() => setSel(sel.length === shown.length ? [] : shown.map((m) => m.id))}>{t("mailserver.sm.toggleAll")}</Link></div>
    </>
  );
}

const quote = (text: string) => text.split("\n").map((l) => `> ${l}`).join("\n");

// read_body.php: one message with the links above it.
export function Read({ ctx, id }: { ctx: Ctx; id: string }) {
  const { game, account, act, go } = ctx;
  const m = boxOf(game, account).find((x) => x.id === id);
  useEffect(() => { if (m && !isRead(game, m)) act(markMessages, account, [id], { read: true }); }, [id]);
  if (!m) return <List ctx={ctx} />;
  const v = view(game, m), order = listFolder(game, account, m.folder).map((x) => x.id), at = order.indexOf(id);
  const a = game.mail.accounts.find((x) => x.id === account)!, me = `${a.local}@${a.domain}`;
  const original = [t("mailserver.sm.original"), `${t("mailserver.sm.hSubject")} ${v.subject}`, `${t("mailserver.sm.hFrom")} ${v.fromName} <${v.fromAddress}>`, `${t("mailserver.sm.hDate")} ${when(m.at)}`, `${t("mailserver.sm.hTo")} ${v.to}`, "", v.text].join("\n");
  const reply = (all: boolean): Seed => ({
    to: v.fromAddress, cc: all ? [...v.to.split(","), ...v.cc].map((x) => x.trim()).filter((x) => x && x !== me && x !== v.fromAddress).join(", ") : "",
    subject: /^re:/i.test(v.subject) ? v.subject : `Re: ${v.subject}`, text: `\n\n${t("mailserver.sm.wrote", { name: v.fromName || v.fromAddress })}\n${quote(v.text)}`, re: m.id,
  });
  const nav = (n: number) => (order[n] ? <Link key={n} on={() => go({ k: "read", id: order[n] })}>{t(n < at ? "mailserver.sm.prev" : "mailserver.sm.next")}</Link> : t(n < at ? "mailserver.sm.prev" : "mailserver.sm.next"));
  return (
    <>
      <div className="smw-bar"><span>{sep([
        <Link key="l" on={() => go({ k: "list" })}>{t("mailserver.sm.messageList")}</Link>,
        <Link key="d" on={() => { act(deleteWebmailMessages, ctx.c.id, account, [id]); go({ k: "list" }); }}>{t("mailserver.sm.delete")}</Link>,
      ])}</span><span>{sep([nav(at - 1), nav(at + 1)])}</span></div>
      <div className="smw-bar"><span>{sep([
        <Link key="f" on={() => go({ k: "compose", seed: { subject: `Fwd: ${v.subject}`, text: `\n\n${original}`, fwd: m.id, att: v.att } })}>{t("mailserver.sm.forward")}</Link>,
        <Link key="fa" on={() => go({ k: "compose", seed: { subject: `Fwd: ${v.subject}`, fwd: m.id, att: [{ k: "file", name: `${v.subject || "message"}.eml`, kb: m.kb }] } })}>{t("mailserver.sm.forwardAtt")}</Link>,
        <Link key="r" on={() => go({ k: "compose", seed: reply(false) })}>{t("mailserver.sm.reply")}</Link>,
        <Link key="ra" on={() => go({ k: "compose", seed: reply(true) })}>{t("mailserver.sm.replyAll")}</Link>,
      ])}</span></div>
      <table className="smw-head">
        <tbody>
          <tr><th>{t("mailserver.sm.hSubject")}</th><td><b>{v.subject}</b></td></tr>
          <tr><th>{t("mailserver.sm.hFrom")}</th><td>{v.fromName && v.fromName !== v.fromAddress ? `"${v.fromName}" <${v.fromAddress}>` : v.fromAddress}</td></tr>
          <tr><th>{t("mailserver.sm.hDate")}</th><td>{when(m.at)}</td></tr>
          <tr><th>{t("mailserver.sm.hTo")}</th><td>{v.to}</td></tr>
          {v.cc.length > 0 && <tr><th>{t("mailserver.sm.hCc")}</th><td>{v.cc.join(", ")}</td></tr>}
          <tr><th>{t("mailserver.sm.hPriority")}</th><td>{t("mailserver.sm.normal")}</td></tr>
          <tr><th>{t("mailserver.sm.hOptions")}</th><td><Link on={() => act(saveContact, ctx.c.id, account, { nick: v.fromAddress.split("@")[0], name: v.fromName, email: v.fromAddress, info: "" })}>{t("mailserver.sm.addToBook")}</Link></td></tr>
        </tbody>
      </table>
      <pre className="smw-body">{v.text}</pre>
      {v.att.length > 0 && (
        <table className="smw-head">
          <tbody>
            <tr><th colSpan={2}>{t("mailserver.sm.attachments")}</th></tr>
            {v.att.map((x, i) => <tr key={i}><td>{attName(game, x)}</td><td>{(x.k === "file" || x.k === "doc") && <Link on={() => act(saveAttachment, account, id, i)}>{t("mailserver.sm.download")}</Link>}</td></tr>)}
          </tbody>
        </table>
      )}
    </>
  );
}

// compose.php: plain text only, Save Draft and Send, the address book in the same frame.
export function Compose({ ctx, seed }: { ctx: Ctx; seed: Seed }) {
  const { game, account, act, go } = ctx;
  const u = webmailUser(game, ctx.c.id, account), sig = u.identities[0]?.signature;
  const [from, setFrom] = useState(0), [book, setBook] = useState(false), [note, setNote] = useState<string | null>(null), [draftId, setDraftId] = useState(seed.draftId);
  const [d, setD] = useState({ to: seed.to ?? "", cc: seed.cc ?? "", bcc: "", subject: seed.subject ?? "", text: seed.text ?? (sig ? `\n\n-- \n${sig}` : ""), att: seed.att ?? [] });
  const [doc, setDoc] = useState("");
  const set = (p: Partial<typeof d>) => setD({ ...d, ...p });
  const draft = { to: [d.to], cc: [d.cc], bcc: [d.bcc], subject: d.subject, text: d.text, att: d.att, re: seed.re };
  const send = () => {
    const r = act(sendMessage, account, { ...draft, from: u.identities[from]?.email ?? "", fwd: seed.fwd, draftId });
    if (r.ok) go({ k: "list" }); else setNote(t(r.error ?? "error.mailAddress"));
  };
  const save = () => {
    const r = act(saveDraft, account, { ...draft, id: draftId });
    if (r.ok) { setDraftId(r.id); setNote(t("mailserver.sm.draftSaved")); } else setNote(t(r.error ?? "error.mailUnknown"));
  };
  const add = (field: "to" | "cc" | "bcc", email: string) => set({ [field]: [d[field], email].filter(Boolean).join(", ") });
  const spelt = webmailOf(game, ctx.c).plugins.includes("squirrelspelt");
  return (
    <form className="smw-compose" onSubmit={(e) => { e.preventDefault(); send(); }}>
      {note && <p className="smw-note">{note}</p>}
      <table className="smw-head">
        <tbody>
          {u.identities.length > 1 && <tr><th>{t("mailserver.sm.hFrom")}</th><td><select value={from} onChange={(e) => setFrom(Number(e.target.value))}>{u.identities.map((x, i) => <option key={i} value={i}>{`${x.name} <${x.email}>`}</option>)}</select></td></tr>}
          {(["to", "cc", "bcc"] as const).map((k) => <tr key={k}><th>{t(`mailserver.sm.${k}Field`)}</th><td><input value={d[k]} onChange={(e) => set({ [k]: e.target.value })} /></td></tr>)}
          <tr><th>{t("mailserver.sm.hSubject")}</th><td><input value={d.subject} onChange={(e) => set({ subject: e.target.value })} /></td></tr>
          <tr><td colSpan={2} className="c">
            {sig && <button type="button" onClick={() => set({ text: `${d.text}\n\n-- \n${sig}` })}>{t("mailserver.sm.signature")}</button>}
            <button type="button" onClick={() => setBook(!book)}>{t("mailserver.sm.addresses")}</button>
            {spelt && <button type="button" onClick={() => setNote(t("mailserver.sm.spellDone"))}>{t("mailserver.sm.spell")}</button>}
            <button type="button" onClick={save}>{t("mailserver.sm.saveDraft")}</button>
            <button type="submit">{t("mailserver.sm.send")}</button>
          </td></tr>
        </tbody>
      </table>
      {book && (
        <table className="smw-list">
          <thead><tr><th /><th>{t("mailserver.sm.nick")}</th><th>{t("mailserver.sm.name")}</th><th>{t("mailserver.sm.email")}</th></tr></thead>
          <tbody>
            {u.contacts.map((x) => (
              <tr key={x.nick}><td>{(["to", "cc", "bcc"] as const).map((k) => <button key={k} type="button" onClick={() => add(k, x.email)}>{t(`mailserver.sm.${k}Button`)}</button>)}</td><td>{x.nick}</td><td>{x.name}</td><td>{x.email}</td></tr>
            ))}
            {!u.contacts.length && <tr><td colSpan={4} className="c">{t("mailserver.sm.bookEmpty")}</td></tr>}
          </tbody>
        </table>
      )}
      <textarea rows={18} value={d.text} onChange={(e) => set({ text: e.target.value })} />
      <div className="smw-tools">
        <span>{t("mailserver.sm.attach")} <select value={doc} onChange={(e) => setDoc(e.target.value)}><option value="" />{game.docs.map((x) => <option key={x.id} value={x.id}>{x.title}</option>)}</select>{" "}
          <button type="button" disabled={!doc} onClick={() => { set({ att: [...d.att, { k: "doc", id: doc }] }); setDoc(""); }}>{t("mailserver.sm.add")}</button></span>
        <button type="submit">{t("mailserver.sm.send")}</button>
      </div>
      {d.att.length > 0 && <ul className="smw-att">{d.att.map((x, i) => <li key={i}>{attName(game, x)} <Link on={() => set({ att: d.att.filter((_, j) => j !== i) })}>{t("mailserver.sm.delete")}</Link></li>)}</ul>}
    </form>
  );
}

// search.php: one folder, one field.
export function Search({ ctx }: { ctx: Ctx }) {
  const { game, account, go } = ctx;
  const [where, setWhere] = useState(ctx.folder), [q, setQ] = useState(""), [scope, setScope] = useState<SearchScope>("subject");
  const [done, setDone] = useState<{ where: string; q: string; scope: SearchScope } | null>(null);
  const hits: Message[] = done ? listFolder(game, account, done.where).filter((m) => matches(game, m, done.q, done.scope)) : [];
  return (
    <>
      <Title>{t("mailserver.sm.search")}</Title>
      <form className="smw-tools" onSubmit={(e) => { e.preventDefault(); setDone({ where, q, scope }); }}>
        <FolderSelect game={game} account={account} value={where} set={setWhere} />
        <input value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={scope} onChange={(e) => setScope(e.target.value as SearchScope)}>{(["subject", "from", "to", "all"] as const).map((x) => <option key={x} value={x}>{t(`mailserver.sm.scope.${x}`)}</option>)}</select>
        <button type="submit">{t("mailserver.sm.search")}</button>
      </form>
      {done && (
        <table className="smw-list">
          <thead><tr><th>{t("mailserver.frame.from")}</th><th>{t("mailserver.frame.date")}</th><th>{t("mailserver.frame.subject")}</th></tr></thead>
          <tbody>
            {hits.map((m) => { const v = view(game, m); return <tr key={m.id} className={isRead(game, m) ? "" : "unseen"}><td>{v.fromName || v.fromAddress}</td><td>{when(m.at)}</td><td><Link on={() => go({ k: "read", id: m.id })}>{v.subject || t("mailserver.sm.noSubject")}</Link></td></tr>; })}
            {!hits.length && <tr><td colSpan={3} className="c">{t("mailserver.sm.noHits")}</td></tr>}
          </tbody>
        </table>
      )}
    </>
  );
}
