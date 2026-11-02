import { useEffect, useRef, useState, type CSSProperties, type DragEvent, type MouseEvent } from "react";
import { Forward, Mail, MailX, Reply, ReplyAll, Search, SquarePen, Trash2 } from "lucide-react";
import { t } from "../../../i18n/en";
import { mailBuild } from "../../../sim/10-catalog/pear-mail";
import { isRead } from "../../../sim/42-mail/model";
import { MY_PEAR } from "../../../sim/43-pear-mail/state";
import { clientFolders, mailboxRows, sortMessages, type Row } from "../../../sim/43-pear-mail/view";
import type { GameState } from "../../../sim/50-state";
import { markMessages } from "../../../sim/90-actions/mailmsg";
import { dismissPearWelcome, getMail, markPearMessages } from "../../../sim/90-actions/pear-mail";
import { PearMailMark } from "../../art/mailmarks";
import { VaultOffer } from "../../vault";
import { useSessionState } from "../../session";
import { openMenu } from "../../desktop/ContextMenu";
import { uiSound, useFocus, useStore, useWin } from "../../store";
import { matches, useSelection, type SearchScope } from "../mail-kit/mail-kit";
import { AccountAlert, Assistant } from "./Assistant";
import { compose, deleteRows, junkRows, SMART, targets, transferRows, type Box } from "./commands";
import { RuleSheet, SmartSheet } from "./Rules";
import { Preferences, WhatsNew } from "./Preferences";
import { smartRows } from "../../../sim/43-pear-mail/smart";
import { MessageList } from "./List";
import { MailboxSheet } from "./Mailboxes";
import { messageMenu, runShortcut, setPearCtx, type PearCtx, type Sheet, type Sort } from "./menus";
import { Preview } from "./Preview";
import { dragRows, Sidebar } from "./Sidebar";
import "./pear-mail.css";

const SCOPES: SearchScope[] = ["all", "from", "to", "subject"];

function rowsOf(s: GameState, box: Box, query: string, scope: SearchScope, everywhere: boolean, sort: Sort): Row[] {
  const smart = box.c === SMART ? s.pearMail.smart.find((x) => x.id === box.f) : undefined;
  const all = everywhere && query.trim()
    ? s.pearMail.accounts.filter((c) => c.enabled).flatMap((c) => clientFolders(s, c).flatMap((f) => mailboxRows(s, c.id, f.id)))
    : smart ? smartRows(s, smart) : mailboxRows(s, box.c, box.f);
  return sortMessages(s, all.filter((r) => matches(s, r.m, query, scope)), (r) => r.m, sort.key, sort.asc);
}

// The mailbox that holds a message, for a notification or a search hit.
function boxOf(s: GameState, id: string): Box | null {
  const local = s.pearMail.local.messages.find((m) => m.id === id);
  if (local) { const [, c, f] = local.folder.split(":"); return { c, f }; }
  const c = s.pearMail.accounts.find((x) => (s.mail.msgs[x.accountId] ?? []).some((m) => m.id === id));
  const m = c && s.mail.msgs[c.accountId].find((x) => x.id === id);
  return c && m ? { c: c.id, f: m.folder } : null;
}

// Marks what the reader opened: the server copy for IMAP, the downloaded one for POP.
export function markRead(act: ReturnType<typeof useStore.getState>["act"], rows: Row[], read: boolean): void {
  const local = rows.filter((r) => r.c.protocol === "pop").map((r) => r.m.id);
  if (local.length) act(markPearMessages, local, { read });
  for (const c of new Set(rows.filter((r) => r.c.protocol === "imap").map((r) => r.c))) {
    act(markMessages, c.accountId, rows.filter((r) => r.c === c).map((r) => r.m.id), { read });
  }
}

export function PearMailApp() {
  const game = useStore((s) => s.game);
  const act = useStore((s) => s.act);
  const build = mailBuild(game.os, game.hour), pm = game.pearMail;
  const [box, setBox] = useSessionState<Box>("pm.box", { c: null, f: "inbox" });
  const [sort, setSort] = useSessionState<Sort>("pm.sort", { key: "date", asc: false });
  const [threads, setThreads] = useSessionState("pm.threads", false);
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<SearchScope>("all");
  const [everywhere, setEverywhere] = useState(false);
  const rows = rowsOf(game, box, query, scope, everywhere, sort);
  const sel = useSelection(rows.map((r) => r.m.id));
  const shown = sel.ids.length === 1 ? rows.find((r) => r.m.id === sel.ids[0]) ?? null : null;
  const picked = rows.filter((r) => sel.ids.includes(r.m.id)), one = new Set(picked.map((r) => r.c.id)).size === 1 ? picked[0]?.c : undefined;
  const home = (box.c && pm.accounts.find((c) => c.id === box.c)) || pm.accounts.find((c) => c.enabled);
  const inJunk = box.f === "junk";
  const [adding, setAdding] = useState(false);
  const [alert, setAlert] = useState<string | null>(null);
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [activity, setActivity] = useSessionState("pm.activity", false);
  const win = useWin(), search = useRef<HTMLInputElement>(null);
  // A refused password asks once per session until the player answers.
  const [asked, setAsked] = useState<string[]>([]);
  const prompt = pm.accounts.find((c) => c.id === alert) ?? (!adding ? pm.accounts.find((c) => c.authFailed && c.enabled && !asked.includes(c.id)) : undefined);
  // A reply to a customer request goes through the ticket pane under the message.
  const reply = (mode: "reply" | "all" | "forward", row = shown ?? undefined) => {
    const pane = mode !== "forward" && row === shown && document.querySelector<HTMLElement>(".pm-ticket");
    if (pane) { pane.scrollIntoView({ block: "nearest" }); pane.querySelector<HTMLElement>("button, input")?.focus(); return; }
    // On My Pear mail is answered from the first account.
    const from = row?.c.id === MY_PEAR ? home : row?.c;
    if (row && from) compose(game, act, from.id, row, mode);
  };
  const ctx: PearCtx = {
    game, act, box, picked, home, sort, setSort, threads, setThreads, reply, newMessage: () => home && compose(game, act, home.id), addAccount: () => setAdding(true),
    sheet: setSheet, activity, setActivity, search: () => search.current?.focus(), close: () => win.close(),
  };
  setPearCtx(ctx);
  // The shortcuts of the front Pear Mail window.
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const front = [...useStore.getState().windows].filter((w) => !w.minimized).sort((a, b) => b.z - a.z)[0];
      if (front?.id === win.id) runShortcut(e);
    };
    window.addEventListener("keydown", key);
    return () => { window.removeEventListener("keydown", key); setPearCtx(null); };
  }, [win.id]);
  // A drag or a right-click on an unselected row takes that row alone.
  const rowsFor = (r: Row) => (sel.ids.includes(r.m.id) ? picked.filter((x) => x.c.id === r.c.id) : [r]);
  const onDrag = (e: DragEvent, r: Row) => dragRows(e, rowsFor(r));
  const onMenu = (e: MouseEvent, r: Row) => {
    e.preventDefault();
    if (!sel.ids.includes(r.m.id)) sel.set([r.m.id]);
    openMenu(e.clientX, e.clientY, messageMenu(ctx, rowsFor(r)));
  };
  const tool = (label: string, Icon: typeof Mail, run: () => void, disabled = false) => (
    <button className="pm-tool" disabled={disabled} onClick={run}><span className="pm-tool-face"><Icon /></span>{t(label)}</button>
  );

  useFocus("Pear Mail", (f) => {
    if (f.kind === "addAccount") return setAdding(true);
    const b = f.kind === "message" ? boxOf(useStore.getState().game, f.id) : null;
    if (b) { setBox(b); setQuery(""); sel.set([f.id]); }
  });
  useEffect(() => {
    if (shown && !isRead(game, shown.m)) markRead(act, [shown], true);
  }, [shown?.m.id]);
  // A rule's Play Sound.
  const chimes = useRef(pm.chimes);
  useEffect(() => { if (pm.chimes > chimes.current && pm.prefs.sound) uiSound("post"); chimes.current = pm.chimes; }, [pm.chimes]);

  return (
    <div className={`pm${pm.prefs.fixedWidth ? " mono" : ""}${pm.prefs.boldUnread ? " bold-unread" : ""}`} data-build={build.version}
      style={{ "--pm-list": `${pm.prefs.listSize}px`, "--pm-msg": `${pm.prefs.msgSize}px` } as CSSProperties}>
      <div className="pm-toolbar">
        {tool("pearMail.getMail", Mail, () => act(getMail), !pm.accounts.length)}
        {tool("pearMail.delete", Trash2, () => deleteRows(act, picked), !picked.length)}
        {tool(inJunk ? "pearMail.notJunk" : "pearMail.junk", MailX, () => junkRows(act, picked, !inJunk), !picked.length)}
        {tool("pearMail.reply", Reply, () => reply("reply"), !shown)}
        {tool("pearMail.replyAll", ReplyAll, () => reply("all"), !shown)}
        {tool("pearMail.forward", Forward, () => reply("forward"), !shown)}
        {tool("pearMail.new", SquarePen, () => home && compose(game, act, home.id), !home)}
        <select className="pm-move" aria-label={t("pearMail.moveTo")} value="" disabled={!one} onChange={(e) => { const [c, f] = e.target.value.split(":"); transferRows(act, picked, { c, f }); }}>
          <option value="" disabled>{t("pearMail.moveTo")}</option>
          {one && targets(game, one).map((g) => (
            <optgroup key={g.c} label={g.label}>
              {g.folders.filter((f) => !(g.c === one.id && f.id === box.f)).map((f) => <option key={f.id} value={`${g.c}:${f.id}`}>{f.name}</option>)}
            </optgroup>
          ))}
        </select>
        <span className="pm-grow" />
        <label className="pm-search">
          <select aria-label={t("pearMail.search.scope")} value={scope} onChange={(e) => setScope(e.target.value as SearchScope)}>
            {SCOPES.map((x) => <option key={x} value={x}>{t(`pearMail.scope.${x}`)}</option>)}
          </select>
          <Search />
          <input ref={search} type="search" aria-label={t("pearMail.search")} placeholder={t("pearMail.search")} value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
      </div>
      <VaultOffer />
      {query.trim() && (
        <div className="pm-searchbar" role="radiogroup">
          {[false, true].map((x) => <button key={String(x)} role="radio" aria-checked={everywhere === x} className={everywhere === x ? "on" : ""} onClick={() => setEverywhere(x)}>{t(x ? "pearMail.search.everywhere" : "pearMail.search.here")}</button>)}
        </div>
      )}
      <div className="pm-split">
        <Sidebar game={game} box={box} onBox={(b) => { setBox(b); setQuery(""); }} onAdd={() => setAdding(true)} onAlert={setAlert} activity={activity} onActivity={setActivity} ctx={ctx} />
        <div className="pm-content">
          <MessageList game={game} rows={rows} box={box} sort={sort} onSort={setSort} threads={threads} onThreads={setThreads} sel={sel} onDrag={onDrag} onMenu={onMenu} />
          <Preview game={game} row={shown} />
        </div>
      </div>
      {!pm.welcomed && !pm.accounts.length && !adding && (
        <div className="pm-sheet" role="dialog" aria-labelledby="pm-welcome">
          <PearMailMark className="pm-sheet-icon" />
          <h2 id="pm-welcome">{t("pearMail.welcome.title")}</h2>
          <button className="btn primary" onClick={() => { act(dismissPearWelcome); setAdding(true); }}>{t("pearMail.welcome.add")}</button>
        </div>
      )}
      {adding && <Assistant onClose={() => setAdding(false)} />}
      {!adding && !sheet && <WhatsNew />}
      {sheet?.k === "prefs" && <Preferences tab={sheet.tab} onTab={(tab) => setSheet({ k: "prefs", tab })} onEditRule={(rule) => setSheet({ k: "rule", rule })} onAdd={() => { setSheet(null); setAdding(true); }} onClose={() => setSheet(null)} />}
      {sheet?.k === "rule" && <RuleSheet rule={sheet.rule} from={sheet.from} onClose={() => setSheet(sheet.from ? null : { k: "prefs", tab: "rules" })} />}
      {sheet?.k === "smart" && <SmartSheet smart={pm.smart.find((x) => x.id === sheet.id)} onClose={() => setSheet(null)} />}
      {sheet && sheet.k !== "prefs" && sheet.k !== "rule" && sheet.k !== "smart" && !adding && <MailboxSheet sheet={sheet} box={box} onClose={() => setSheet(null)} onGone={(b) => { if (b.c === box.c && b.f === box.f) setBox({ c: null, f: "inbox" }); }} />}
      {prompt && !adding && <AccountAlert key={prompt.id} c={prompt} onClose={() => { setAlert(null); setAsked([...asked, prompt.id]); }} />}
    </div>
  );
}
