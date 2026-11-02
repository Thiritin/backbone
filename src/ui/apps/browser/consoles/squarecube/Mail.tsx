import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { squarecubeFeatures } from "../../../../../sim/10-catalog/squarecube";
import { isRead, view } from "../../../../../sim/42-mail/model";
import type { Message } from "../../../../../sim/42-mail/types";
import type { GameState } from "../../../../../sim/50-state";
import type { Cluster } from "../../../../../sim/60-infra/cluster";
import { webmailUser } from "../../../../../sim/80-business/webmail";
import { folderTree, quotaPercent, specialFolder } from "../../../../../sim/80-business/webmail-view";
import { copyMessages, emptyFolder } from "../../../../../sim/90-actions/mailmsg";
import { deleteWebmailMessages, saveWebmailDraft, sendWebmailMessage } from "../../../../../sim/90-actions/webmail";
import { t } from "../../../../../i18n/en";
import { useStore } from "../../../../store";
import { folderRows, readDrag, useMailActions, useMailDrag, type SearchScope } from "../../../mail-kit/mail-kit";
import { TicketSlot } from "../../../mail-kit/TicketSlot";
import { mailDate } from "../../../pear-mail/List";

export interface Ctx { game: GameState; c: Cluster; account: string; version: string }
export interface Draft { to: string; cc: string; bcc: string; subject: string; text: string; re?: string; fwd?: string; id?: string }
export const PAGE_SIZE = 40;
const pageSize = (ctx: Ctx) => Number(webmailUser(ctx.game, ctx.c.id, ctx.account).prefs.pageSize ?? PAGE_SIZE);
const kb = (n: number) => `${Math.max(1, Math.round(n))} KB`;

// The mailbox: folder list with the quota, toolbar, search, message list and the preview below.
export function Mailbox({ ctx, compose }: { ctx: Ctx; compose: (d: Partial<Draft>) => void }) {
  const { game, c, account, version } = ctx, act = useStore((x) => x.act), f = squarecubeFeatures(version), ops = useMailActions(account);
  const [folder, setFolder] = useState("inbox"), [sel, setSel] = useState<string[]>([]), [page, setPage] = useState(0);
  const [query, setQuery] = useState(""), [scope, setScope] = useState<SearchScope>("subject"), [over, setOver] = useState<string | null>(null);
  const rows = folderRows(game, account, folder, { query, scope }), size = pageSize(ctx), shown = rows.slice(page * size, (page + 1) * size);
  const open = sel.length === 1 ? rows.find((m) => m.id === sel[0]) : undefined, outgoing = folder === "sent" || folder === "drafts";
  const trash = specialFolder(game, c.id, account, "trash");
  const go = (id: string) => { setFolder(id); setSel([]); setPage(0); };
  const pick = (m: Message, meta: boolean) => {
    setSel(meta ? (sel.includes(m.id) ? sel.filter((x) => x !== m.id) : [...sel, m.id]) : [m.id]);
    if (!meta && !isRead(game, m)) ops.mark([m.id], { read: true });
  };
  const remove = (ids: string[]) => {
    if (!ids.length || ((folder === trash || !trash) && !window.confirm(t("mailserver.sc.deleteConfirm")))) return;
    act(deleteWebmailMessages, c.id, account, ids);
    setSel([]);
  };
  const empty = () => { if (window.confirm(t("mailserver.sc.emptyConfirm"))) act(emptyFolder, account, folder as "trash" | "junk"); };
  const reply = (all: boolean) => {
    if (!open) return;
    const v = view(game, open);
    compose({ to: [v.fromAddress, ...(all ? v.cc : [])].join(", "), subject: `Re: ${v.subject}`, text: `\n\n${v.fromName} <${v.fromAddress}>:\n> ${v.text.split("\n").join("\n> ")}`, re: open.id });
  };
  const forward = () => { if (open) { const v = view(game, open); compose({ subject: `Fwd: ${v.subject}`, text: `\n\n-------- ${t("mailserver.sc.forwarded")} --------\n${v.text}`, fwd: open.id }); } };
  const mark = (k: string) => {
    if (sel.length) ops.mark(sel, k === "read" ? { read: true } : k === "unread" ? { read: false } : { star: k === "flagged" });
  };
  const key = (e: KeyboardEvent) => { if (e.key === "Delete" && sel.length) remove(sel); };
  const drop = (id: string, copy: boolean, ids: string[]) => { if (id !== folder) { if (copy && f.copy) act(copyMessages, account, ids, id); else ops.move(ids, id); setSel([]); } };
  return (
    <div className="scw-mail">
      <aside>
        <h3>{t("mailserver.sc.folders")}</h3>
        <ul className="scw-folders">
          {folderTree(game, account).map(({ folder: x, depth, unread: n }) => (
            <li key={x.id} className={`${x.id === folder ? "on" : ""}${over === x.id ? " over" : ""}`} style={{ paddingLeft: 8 + depth * 14 }}
              onClick={() => go(x.id)}
              onDragOver={(e) => { if (readDrag(e) !== undefined) { e.preventDefault(); setOver(x.id); } }} onDragLeave={() => setOver(null)}
              onDrop={(e) => { e.preventDefault(); setOver(null); const d = readDrag(e); if (d && d.accountId === account) drop(x.id, e.ctrlKey || e.altKey, d.ids); }}>
              {n > 0 ? <b>{x.name} ({n})</b> : x.name}
            </li>
          ))}
        </ul>
        <div className="scw-quota" title={`${quotaPercent(game, account)}%`}>{t("mailserver.sc.quota")}: <span className="bar"><span style={{ width: `${quotaPercent(game, account)}%` }} /></span> {quotaPercent(game, account)}%</div>
      </aside>
      <section onKeyDown={key} tabIndex={0}>
        <div className="scw-toolbar">
          <button onClick={() => compose({})}>{t("mailserver.sc.compose")}</button>
          <button disabled={!open} onClick={() => reply(false)}>{t("mailserver.sc.reply")}</button>
          <button disabled={!open} onClick={() => reply(true)}>{t("mailserver.sc.replyAll")}</button>
          <button disabled={!open} onClick={forward}>{t("mailserver.sc.forward")}</button>
          <button disabled={!sel.length} onClick={() => remove(sel)}>{t("mailserver.sc.delete")}</button>
          <select aria-label={t("mailserver.sc.mark")} value="" disabled={!sel.length} onChange={(e) => mark(e.target.value)}>
            <option value="">{t("mailserver.sc.mark")}</option>
            {["read", "unread", "flagged", "unflagged"].map((k) => <option key={k} value={k}>{t(`mailserver.sc.mark.${k}`)}</option>)}
          </select>
          {(folder === "trash" || folder === "junk") && <button onClick={empty}>{t("mailserver.sc.empty")}</button>}
          <span className="scw-search">
            <select aria-label={t("mailserver.sc.searchScope")} value={scope} onChange={(e) => setScope(e.target.value as SearchScope)}>
              {(["subject", "from", "to", "all"] as const).map((k) => <option key={k} value={k}>{t(`mailserver.sc.scope.${k}`)}</option>)}
            </select>
            <input type="search" aria-label={t("mailserver.sc.search")} value={query} onChange={(e) => { setQuery(e.target.value); setPage(0); }} />
          </span>
        </div>
        <div className="scw-select">
          {t("mailserver.sc.select")}{" "}
          <a href="#all" onClick={(e) => { e.preventDefault(); setSel(shown.map((m) => m.id)); }}>{t("mailserver.sc.select.all")}</a>{" "}
          <a href="#unread" onClick={(e) => { e.preventDefault(); setSel(shown.filter((m) => !isRead(game, m)).map((m) => m.id)); }}>{t("mailserver.sc.select.unread")}</a>{" "}
          <a href="#none" onClick={(e) => { e.preventDefault(); setSel([]); }}>{t("mailserver.sc.select.none")}</a>
          <span className="count">
            <button disabled={page === 0} onClick={() => setPage(page - 1)}>&lt;</button>
            {rows.length ? t("mailserver.sc.count", { from: page * size + 1, to: page * size + shown.length, n: rows.length }) : t("mailserver.sc.listEmpty")}
            <button disabled={(page + 1) * size >= rows.length} onClick={() => setPage(page + 1)}>&gt;</button>
          </span>
        </div>
        <table className="scw-list">
          <thead><tr><th /><th>{t("mailserver.sc.subject")}</th><th>{t(outgoing ? "mailserver.sc.recipient" : "mailserver.sc.sender")}</th><th>{t("mailserver.sc.date")}</th><th>{t("mailserver.sc.size")}</th><th /></tr></thead>
          <tbody>{shown.map((m) => <Row key={m.id} ctx={ctx} m={m} outgoing={outgoing} on={sel.includes(m.id)} ids={sel.includes(m.id) ? sel : [m.id]} pick={pick} />)}</tbody>
        </table>
        {open && <Reader ctx={ctx} m={open} />}
      </section>
    </div>
  );
}

function Row({ ctx, m, outgoing, on, ids, pick }: { ctx: Ctx; m: Message; outgoing: boolean; on: boolean; ids: string[]; pick: (m: Message, meta: boolean) => void }) {
  const v = view(ctx.game, m), drag = useMailDrag(ctx.account, ids);
  const cls = [on ? "on" : "", isRead(ctx.game, m) ? "" : "unread", m.star ? "flagged" : ""].join(" ").trim();
  return (
    <tr className={cls} {...drag} onClick={(e) => pick(m, e.metaKey || e.ctrlKey)}>
      <td className="icon">{m.star && <span className="flag" />}</td>
      <td>{v.subject}</td>
      <td>{outgoing ? v.to : v.fromName || v.fromAddress}</td>
      <td>{mailDate(m.at)}</td>
      <td>{kb(m.kb)}</td>
      <td className="icon">{v.att.length > 0 && <span className="att" />}</td>
    </tr>
  );
}

function Reader({ ctx, m }: { ctx: Ctx; m: Message }) {
  const v = view(ctx.game, m), openApp = useStore((x) => x.openApp);
  return (
    <article className="scw-reader">
      <table className="headers"><tbody>
        <tr><th>{t("mailserver.sc.subjectH")}</th><td><b>{v.subject}</b></td></tr>
        <tr><th>{t("mailserver.sc.fromH")}</th><td>{v.fromName ? `${v.fromName} <${v.fromAddress}>` : v.fromAddress}</td></tr>
        <tr><th>{t("mailserver.sc.toH")}</th><td>{v.to}</td></tr>
        {v.cc.length > 0 && <tr><th>{t("mailserver.sc.ccH")}</th><td>{v.cc.join(", ")}</td></tr>}
        <tr><th>{t("mailserver.sc.dateH")}</th><td>{mailDate(m.at)}</td></tr>
      </tbody></table>
      <pre>{v.text}</pre>
      <TicketSlot game={ctx.game} message={m} previews={false}
        desk={(url) => <p><a href="#desk" onClick={(e) => { e.preventDefault(); openApp("Browser", { kind: "url", id: url }); }}>{url}</a></p>}
        frame={(b) => <div className="scw-ticket">{b}</div>}
        templates={(r, h) => <p>{r.templates!.map((x) => <button key={x.id} disabled={r.locked} onClick={() => h.reply(x.id)}>{x.title}</button>)}</p>}
        offers={(r, h) => <p>{r.offers!.map((o) => <button key={o.id} disabled={r.locked} onClick={() => h.retain(o.id)}>{o.title} {o.value}</button>)}</p>}
        transfer={(r, h) => <TransferCode locked={r.locked} onAnswer={h.transfer} />}
        buttons={(r, h) => (
          <p>
            {r.actions.map((a) => <button key={a.id} disabled={a.disabled} onClick={() => h.action(a.id)}>{a.label}</button>)}
            {r.answers.map((a) => <button key={a.id} disabled={a.disabled} onClick={() => h.answer(a.id)}>{a.label}</button>)}
            {r.close !== null && <button disabled={r.locked} onClick={h.close}>{r.close}</button>}
            {r.resolve && <button disabled={r.locked} onClick={h.resolve}>{t("support.resolve")}</button>}
          </p>
        )} />
    </article>
  );
}

function TransferCode({ locked, onAnswer }: { locked: boolean; onAnswer: (code: string) => void }) {
  const [code, setCode] = useState("");
  return <p><input aria-label="AuthCode" value={code} onChange={(e) => setCode(e.target.value)} /> <button disabled={locked || !code.trim()} onClick={() => onAnswer(code.trim())}>{t("mailserver.sc.send")}</button></p>;
}

// Compose: identity, recipients, subject, the editor type and Save, Send and Cancel with the leave warning.
export function Compose({ ctx, initial, close }: { ctx: Ctx; initial: Partial<Draft>; close: () => void }) {
  const { game, c, account } = ctx, act = useStore((x) => x.attempt), u = webmailUser(game, c.id, account);
  const [from, setFrom] = useState(0), sig = u.identities[from]?.signature;
  const [d, setD] = useState<Draft>({ to: "", cc: "", bcc: "", subject: "", text: sig ? `\n\n-- \n${sig}` : "", ...initial });
  const [html, setHtml] = useState(!!u.prefs.htmlEditor), [dirty, setDirty] = useState(false), [note, setNote] = useState<string | null>(null);
  const editor = useRef<HTMLDivElement>(null);
  useEffect(() => { if (html && editor.current) editor.current.innerText = d.text; }, [html]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = (k: keyof Draft, v: string) => { setD({ ...d, [k]: v }); setDirty(true); };
  const list = (x: string) => x.split(",").map((y) => y.trim()).filter(Boolean);
  const body = { to: list(d.to), cc: list(d.cc), bcc: list(d.bcc), subject: d.subject, text: d.text, ...(d.re && { re: d.re }) };
  const save = () => {
    const r = act(saveWebmailDraft, c.id, account, { ...body, ...(d.id && { id: d.id }) });
    if (r.ok) { setD({ ...d, id: r.id }); setDirty(false); }
    setNote(r.ok ? t("mailserver.sc.saved") : t(r.error ?? "mailserver.sc.sendFailed"));
  };
  const send = () => {
    if (!body.to.length && !body.cc.length && !body.bcc.length) return setNote(t("mailserver.sc.noRecipient"));
    const r = act(sendWebmailMessage, c.id, account, { ...body, from: u.identities[from]?.email ?? "", ...(d.fwd && { fwd: d.fwd }), ...(d.id && { draftId: d.id }) });
    if (!r.ok) return setNote(r.error === "error.mailFrom" ? t("mailserver.sc.smtp553") : t(r.error ?? "mailserver.sc.sendFailed"));
    close();
  };
  const cancel = () => { if (!dirty || window.confirm(t("mailserver.sc.notSent"))) close(); };
  const cmd = (x: string) => { document.execCommand(x); editor.current?.focus(); };
  return (
    <div className="scw-compose">
      <div className="scw-toolbar">
        <button onClick={cancel}>{t("mailserver.sc.back")}</button>
        <button onClick={send}>{t("mailserver.sc.send")}</button>
        <button onClick={save}>{t("mailserver.sc.save")}</button>
        {note && <span className="scw-note" role="status">{note}</span>}
      </div>
      <table className="scw-form"><tbody>
        <tr><th><label htmlFor="scc-from">{t("mailserver.sc.fromH")}</label></th><td>
          <select id="scc-from" value={from} onChange={(e) => setFrom(Number(e.target.value))}>
            {u.identities.map((x, i) => <option key={i} value={i}>{x.name ? `${x.name} <${x.email}>` : x.email}</option>)}
          </select>
        </td></tr>
        {(["to", "cc", "bcc"] as const).map((k) => (
          <tr key={k}><th><label htmlFor={`scc-${k}`}>{t(`mailserver.sc.${k}H`)}</label></th><td><input id={`scc-${k}`} list="scc-abook" value={d[k]} onChange={(e) => set(k, e.target.value)} /></td></tr>
        ))}
        <tr><th><label htmlFor="scc-subject">{t("mailserver.sc.subjectH")}</label></th><td><input id="scc-subject" value={d.subject} onChange={(e) => set("subject", e.target.value)} /></td></tr>
        <tr><th>{t("mailserver.sc.editorType")}</th><td>
          <select aria-label={t("mailserver.sc.editorType")} value={html ? "html" : "plain"} onChange={(e) => setHtml(e.target.value === "html")}>
            <option value="plain">{t("mailserver.sc.plain")}</option><option value="html">HTML</option>
          </select>
        </td></tr>
      </tbody></table>
      <datalist id="scc-abook">{u.contacts.map((x) => <option key={x.nick} value={x.email}>{x.name}</option>)}</datalist>
      {html ? (
        <div className="scw-html">
          <div className="bar">{(["bold", "italic", "underline", "insertUnorderedList"] as const).map((x) => <button key={x} onMouseDown={(e) => { e.preventDefault(); cmd(x); }}>{t(`mailserver.sc.fmt.${x}`)}</button>)}</div>
          <div ref={editor} className="area" contentEditable suppressContentEditableWarning onInput={(e) => set("text", (e.target as HTMLDivElement).innerText)} />
        </div>
      ) : <textarea aria-label={t("mailserver.sc.body")} value={d.text} onChange={(e) => set("text", e.target.value)} />}
    </div>
  );
}
