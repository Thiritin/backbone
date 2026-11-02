import { useState } from "react";
import { t } from "../../../../../../i18n/en";
import { deskHas, STATUS_LABELS } from "../../../../../../sim/10-catalog/desks";
import { channelsOf } from "../../../../../../sim/40-support/desk-channels";
import { held, inDesk, OWNER } from "../../../../../../sim/40-support/desk-work";
import { isFinal, type Ticket } from "../../../../../../sim/40-support/tickets";
import type { GameState } from "../../../../../../sim/50-state";
import { markSpam, mergeTickets, addNote } from "../../../../../../sim/90-actions/desk";
import { assignTicket, closeTicket, resolveTicket } from "../../../../../../sim/90-actions/support";
import { useStore } from "../../../../../store";
import { ReplyPanel, type ReplyHandlers } from "../headless/ReplyPanel";
import { useTicketPane, type PaneItem } from "../headless/useTicketPane";
import { useTicketReplies } from "../headless/useTicketReplies";
import { emailOf, FOLDERS, folderTickets, isSpam, mailboxOf, mid, nameOf, Panel, when, type Folder, type FsPage, type FsProps } from "./FreeScootSite";

export function MailboxPage(p: FsProps) {
  const page = p.route.page as FsPage;
  if (page === "mailbox" || page === "folder") return <MailboxView {...p} />;
  if (page === "conversation") return <Conversation {...p} />;
  if (page === "customers") return <Customers {...p} />;
  if (page === "search") return <Search {...p} />;
  // Reports is a paid module that is not installed.
  if (page === "reports") return <Panel title={t("desk.site.notFound")}><p>{t("desk.site.notFoundText", { path: "/reports" })}</p></Panel>;
  return <Dashboard {...p} />;
}

const statusLabel = (tk: Ticket) => t(`fs.status.${STATUS_LABELS.freescoot[isSpam(tk) ? "spam" : tk.status]}`);
export const userName = (s: GameState, id: string | null): string => (id === OWNER ? t("support.you") : s.staff.find((e) => e.id === id)?.name ?? "");

function Dashboard(p: FsProps) {
  const { game, nav } = p, boxes = channelsOf(game);
  return (
    <Panel title={t("fs.nav.dashboard")}>
      <div className="fs-cards">
        {boxes.map((ch) => (
          <article key={ch.id} className="fs-card">
            <h2><a onClick={() => nav("mailbox", { id: mid(ch) })}>{nameOf(game, ch)}</a></h2>
            <p className="fs-muted">{emailOf(game, ch)}</p>
            <ul>{(["unassigned", "mine", "assigned"] as Folder[]).map((f) => (
              <li key={f}><a onClick={() => nav("folder", { id: mid(ch), folder: f })}><b>{folderTickets(game, ch, f).length}</b> {t(`fs.folder.${f}`)}</a></li>
            ))}</ul>
            <button type="button" className="fs-btn" onClick={() => nav("mailbox", { id: mid(ch) })}>{t("fs.openMailbox")}</button>
          </article>
        ))}
      </div>
      {!boxes.length && <p className="fs-muted">{t("fs.noMailboxes")}</p>}
    </Panel>
  );
}

function MailboxView(p: FsProps) {
  const { game, nav, route } = p, boxes = channelsOf(game);
  const ch = mailboxOf(game, route.args.id);
  if (!ch) return <Panel title={t("fs.nav.mailbox")}><p className="fs-error">{t("fs.noMailbox")}</p></Panel>;
  const folder = (FOLDERS as readonly string[]).includes(route.args.folder ?? "") ? (route.args.folder as Folder) : "unassigned";
  const list = folderTickets(game, ch, folder);
  return (
    <div className="fs-mailbox">
      <aside className="fs-side">
        <select aria-label={t("fs.nav.mailbox")} value={mid(ch)} onChange={(e) => nav("mailbox", { id: e.target.value })}>
          {boxes.map((b) => <option key={b.id} value={mid(b)}>{nameOf(game, b)}</option>)}
        </select>
        <ul>{FOLDERS.map((f) => (
          <li key={f} className={f === folder ? "active" : ""}><a onClick={() => nav("folder", { id: mid(ch), folder: f })}>{t(`fs.folder.${f}`)}<span>{folderTickets(game, ch, f).length}</span></a></li>
        ))}</ul>
        <a className="fs-side-settings" onClick={() => nav("mailboxSettings", { id: mid(ch) })}>{t("fs.mailboxSettings")}</a>
      </aside>
      <section className="fs-list">
        <header><h1>{t(`fs.folder.${folder}`)}</h1></header>
        <ConversationTable {...p} list={list} />
      </section>
    </div>
  );
}

function ConversationTable({ game, nav, list }: FsProps & { list: Ticket[] }) {
  if (!list.length) return <p className="fs-empty">{t("fs.noConversations")}</p>;
  return (
    <table className="fs-table">
      <thead><tr><th>{t("fs.col.customer")}</th><th>{t("fs.col.conversation")}</th><th>{t("fs.col.number")}</th><th>{t("fs.col.waiting")}</th></tr></thead>
      <tbody>
        {list.map((tk) => {
          const m = useTicketPane(game, tk), open = () => nav("conversation", { n: tk.ref ?? "" });
          return (
            <tr key={tk.id} className={tk.unread ? "unread" : ""} onClick={open}>
              <td>{m.customer?.name ?? m.sender?.from ?? ""}</td>
              <td><a onClick={open}>{m.subject}</a> <span className="fs-muted">{statusLabel(tk)}</span></td>
              <td>#{tk.ref}</td>
              <td>{when(tk.updatedAt)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

type Mode = "reply" | "note" | null;

function Conversation(p: FsProps) {
  const { game, nav, route } = p;
  const act = useStore((s) => s.act);
  const [mode, setMode] = useState<Mode>(null);
  const tk = game.desk ? game.tickets.find((x) => x.ref === route.args.n && inDesk(x) && held(x)) : undefined;
  if (!tk) return <Panel title={t("fs.conversation")}><p className="fs-error">{t("fs.noConversation")}</p></Panel>;
  const m = useTicketPane(game, tk), r = useTicketReplies(game, tk), open = !isFinal(tk) && !isSpam(tk);
  const ch = channelsOf(game).find((c) => c.id === tk.channelId);
  const customer = game.customers.find((c) => c.id === tk.customerId);
  const earlier = customer ? game.tickets.filter((x) => x.customerId === customer.id && x.id !== tk.id && x.ref && inDesk(x) && held(x)) : [];
  const dups = deskHas(game, "merge") ? earlier.filter((x) => x.kind === tk.kind && !isFinal(x)) : [];
  const status = (v: string) => { if (v === "spam") act(markSpam, tk.id); else if (v === "closed") act(r.resolve ? resolveTicket : closeTicket, tk.id); };
  return (
    <div className="fs-conv">
      <article>
        {open && (
          <nav className="fs-toolbar">
            <button type="button" className={mode === "reply" ? "fs-btn on" : "fs-btn"} onClick={() => setMode("reply")}>{t("fs.reply")}</button>
            <button type="button" className={mode === "note" ? "fs-btn on" : "fs-btn"} onClick={() => setMode("note")}>{t("fs.note")}</button>
            <label><span>{t("fs.assignee")}</span>
              <select aria-label={t("fs.assignee")} value={tk.assignee ?? ""} onChange={(e) => act(assignTicket, tk.id, e.target.value || null)}>
                <option value="">{t("fs.anyone")}</option>
                <option value={OWNER}>{t("fs.me")}</option>
                {game.staff.filter((e) => e.role === "support").map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            </label>
            <label><span>{t("fs.col.status")}</span>
              <select aria-label={t("fs.col.status")} value="" onChange={(e) => status(e.target.value)}>
                <option value="">{statusLabel(tk)}</option>
                {(r.resolve || r.close !== null) && <option value="closed">{t("fs.status.closed")}</option>}
                <option value="spam">{t("fs.status.spam")}</option>
              </select>
            </label>
            {dups.length > 0 && (
              <select aria-label={t("fs.merge")} value="" onChange={(e) => act(mergeTickets, tk.id, [e.target.value])}>
                <option value="">{t("fs.merge")}</option>
                {dups.map((x) => <option key={x.id} value={x.id}>#{x.ref}</option>)}
              </select>
            )}
          </nav>
        )}
        <header className="fs-chead">
          <h1>{m.subject}</h1>
          <p><span className="fs-status">{statusLabel(tk)}</span> <span>#{tk.ref}</span> {ch && <a onClick={() => nav("mailbox", { id: mid(ch) })}>{nameOf(game, ch)}</a>}</p>
        </header>
        {open && mode === "reply" && <Composer {...p} tk={tk} done={() => setMode(null)} />}
        {open && mode === "note" && <NoteBox tk={tk} done={() => setMode(null)} />}
        <div className="fs-thread">{[...m.items].sort((a, b) => at(b) - at(a)).map((it, i) => <Item key={i} it={it} />)}</div>
      </article>
      {deskHas(game, "customerSidebar") && (
        <aside className="fs-profile">
          {m.customer ? <><h3>{m.customer.name}</h3><p>{customer?.address.email}</p><p className="fs-muted">{m.customer.line}</p></> : <h3>{m.sender?.from}</h3>}
          <h4>{t("fs.previous")}</h4>
          <ul>{earlier.map((x) => <li key={x.id}><a onClick={() => nav("conversation", { n: x.ref ?? "" })}>#{x.ref} {useTicketPane(game, x).subject}</a> <span className="fs-muted">{statusLabel(x)}</span></li>)}</ul>
          {!earlier.length && <p className="fs-muted">{t("fs.none")}</p>}
        </aside>
      )}
    </div>
  );
}

// The thread newest first, as FreeScoot shows it: customer, agent and note blocks.
const at = (it: PaneItem): number => (it.type === "event" ? it.hour ?? Infinity : it.type === "note" ? it.hour : it.msg.hour);
function Item({ it }: { it: PaneItem }) {
  if (it.type === "event") return it.hour === null ? null : <p className="fs-event">{it.text} <time>{when(it.hour)}</time></p>;
  if (it.type === "note") return <Block cls="note" who={it.by} hour={it.hour} text={it.text} />;
  return (
    <>
      <Block cls={it.msg.you ? "agent" : "customer"} who={it.msg.from} hour={it.msg.hour} text={it.msg.text} />
      {it.type === "reply" && it.followUp && <Block cls="customer" who={it.followUp.from} hour={it.followUp.hour} text={it.followUp.text} />}
    </>
  );
}
const Block = ({ cls, who, hour, text }: { cls: string; who: string; hour: number; text: string }) => (
  <div className={`fs-block ${cls}`}><header><b>{who}</b><time>{when(hour)}</time></header><p>{text}</p></div>
);

function NoteBox({ tk, done }: { tk: Ticket; done: () => void }) {
  const act = useStore((s) => s.act), [note, setNote] = useState("");
  return (
    <form className="fs-editor note" onSubmit={(e) => { e.preventDefault(); if (act(addNote, tk.id, note).ok) { setNote(""); done(); } }}>
      <textarea rows={4} aria-label={t("fs.note")} value={note} onChange={(e) => setNote(e.target.value)} />
      <footer><button type="submit" className="fs-btn primary" disabled={!note.trim()}>{t("fs.addNote")}</button></footer>
    </form>
  );
}

// What the reply picks: a reply text, a retention offer, a ticket action, an answer or closing the conversation.
type Pick = "" | `tpl:${string}` | `offer:${string}` | `action:${string}` | `answer:${string}` | "close";
function runPick(h: ReplyHandlers, pick: Pick): void {
  const [kind, id] = pick.split(":") as [string, never];
  if (kind === "tpl") h.reply(id);
  else if (kind === "offer") h.retain(id);
  else if (kind === "action") h.action(id);
  else if (kind === "answer") h.answer(id);
  else if (kind === "close") h.close();
}

// The reply editor. Saved replies are a paid module, so the core shows no reply texts.
function Composer({ game, tk, done }: FsProps & { tk: Ticket; done: () => void }) {
  const [pick, setPick] = useState<Pick>(""), [code, setCode] = useState("");
  return (
    <ReplyPanel
      game={game}
      ticket={tk}
      frame={(b) => <div className="fs-editor">{b}</div>}
      buttons={(m, h) => (
        <>
          <select aria-label={t("fs.reply")} value={pick} disabled={m.locked} onChange={(e) => setPick(e.target.value as Pick)}>
            <option value="" />
            {!!m.templates?.length && <optgroup label={t("fs.reply")}>{m.templates.map((x) => <option key={x.id} value={`tpl:${x.id}`}>{x.title}</option>)}</optgroup>}
            {!!m.offers?.length && <optgroup label={t("support.retentionOffers")}>{m.offers.map((o) => <option key={o.id} value={`offer:${o.id}`}>{`${o.title} (${o.value}, ${o.oddsLabel})`}</option>)}</optgroup>}
            {(m.actions.length > 0 || m.answers.length > 0 || m.close !== null) && (
              <optgroup label={t("fs.actions")}>
                {m.actions.map((a) => <option key={a.id} value={`action:${a.id}`} disabled={a.disabled}>{a.amount !== null ? `${a.label} (${a.amount})` : a.label}</option>)}
                {m.answers.map((a) => <option key={a.id} value={`answer:${a.id}`} disabled={a.disabled}>{a.label}</option>)}
                {m.close !== null && <option value="close">{m.close}</option>}
              </optgroup>
            )}
          </select>
          {m.transfer && (
            <p className="fs-transfer">
              <input aria-label={t("registrarForm.authCode")} placeholder={t("registrarForm.authCode")} value={code} onChange={(e) => setCode(e.target.value)} />
              <button type="button" className="fs-btn" disabled={m.locked || !code.trim()} onClick={() => h.transfer(code)}>{t("support.sendCode")}</button>
              <button type="button" className="fs-btn" disabled={m.locked} onClick={() => h.transfer(null)}>{t("support.refuseTransfer")}</button>
            </p>
          )}
          <footer>
            {m.resolve && <button type="button" className="fs-btn" disabled={m.locked} onClick={h.resolve}>{t("support.resolve")}</button>}
            <button type="button" className="fs-btn primary" disabled={m.locked || !pick} onClick={() => { runPick(h, pick); setPick(""); done(); }}>{t("fs.sendReply")}</button>
          </footer>
        </>
      )}
    />
  );
}

function Customers({ game }: FsProps) {
  const people = game.customers.filter((c) => c.churnedAt === null);
  return (
    <Panel title={t("fs.nav.customers")}>
      <table className="fs-table">
        <thead><tr><th>{t("fs.col.name")}</th><th>{t("fs.email")}</th><th>{t("fs.conversations")}</th></tr></thead>
        <tbody>{people.map((c) => <tr key={c.id}><td>{c.name}</td><td>{c.address.email}</td><td>{game.tickets.filter((x) => x.customerId === c.id && x.channelId).length}</td></tr>)}</tbody>
      </table>
    </Panel>
  );
}

function Search(p: FsProps) {
  const { game } = p, [q, setQ] = useState("");
  const all = game.tickets.filter((x) => x.channelId && inDesk(x));
  const needle = q.trim().toLowerCase();
  const hits = needle ? all.filter((x) => `${x.ref} ${useTicketPane(game, x).subject} ${game.customers.find((c) => c.id === x.customerId)?.name ?? ""}`.toLowerCase().includes(needle)) : [];
  return (
    <Panel title={t("fs.nav.search")}>
      <input className="fs-search" type="search" aria-label={t("fs.nav.search")} value={q} onChange={(e) => setQ(e.target.value)} />
      {needle && <ConversationTable {...p} list={hits.sort((a, b) => b.updatedAt - a.updatedAt)} />}
    </Panel>
  );
}
