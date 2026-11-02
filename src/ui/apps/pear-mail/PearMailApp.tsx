import { useEffect, useState } from "react";
import { Mail, Search } from "lucide-react";
import { t } from "../../../i18n/en";
import { mailBuild } from "../../../sim/10-catalog/pear-mail";
import { isRead } from "../../../sim/42-mail/model";
import { clientFolders, mailboxRows, sortMessages, type Row, type SortKey } from "../../../sim/43-pear-mail/view";
import type { GameState } from "../../../sim/50-state";
import { markMessages } from "../../../sim/90-actions/mailmsg";
import { dismissPearWelcome, getMail, markPearMessages } from "../../../sim/90-actions/pear-mail";
import { PearMailMark } from "../../art/mailmarks";
import { useSessionState } from "../../session";
import { useFocus, useStore } from "../../store";
import { matches, useSelection, type SearchScope } from "../mail-kit/mail-kit";
import { MessageList } from "./List";
import { Preview } from "./Preview";
import { Sidebar } from "./Sidebar";
import "./pear-mail.css";

// A mailbox in the sidebar: c null is the unified mailbox over every enabled account.
export interface Box { c: string | null; f: string }
export interface Sort { key: SortKey; asc: boolean }
const SCOPES: SearchScope[] = ["all", "from", "to", "subject"];

function rowsOf(s: GameState, box: Box, query: string, scope: SearchScope, everywhere: boolean, sort: Sort): Row[] {
  const all = everywhere && query.trim()
    ? s.pearMail.accounts.filter((c) => c.enabled).flatMap((c) => clientFolders(s, c).flatMap((f) => mailboxRows(s, c.id, f.id)))
    : mailboxRows(s, box.c, box.f);
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

  useFocus("Pear Mail", (f) => {
    const b = f.kind === "message" ? boxOf(useStore.getState().game, f.id) : null;
    if (b) { setBox(b); setQuery(""); sel.set([f.id]); }
  });
  useEffect(() => {
    if (shown && !isRead(game, shown.m)) markRead(act, [shown], true);
  }, [shown?.m.id]);

  return (
    <div className="pm" data-build={build.version}>
      <div className="pm-toolbar">
        <button className="pm-tool" disabled={!pm.accounts.length} onClick={() => act(getMail)}><span className="pm-tool-face"><Mail /></span>{t("pearMail.getMail")}</button>
        <span className="pm-grow" />
        <label className="pm-search">
          <select aria-label={t("pearMail.search.scope")} value={scope} onChange={(e) => setScope(e.target.value as SearchScope)}>
            {SCOPES.map((x) => <option key={x} value={x}>{t(`pearMail.scope.${x}`)}</option>)}
          </select>
          <Search />
          <input type="search" aria-label={t("pearMail.search")} placeholder={t("pearMail.search")} value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
      </div>
      {query.trim() && (
        <div className="pm-searchbar" role="radiogroup">
          {[false, true].map((x) => <button key={String(x)} role="radio" aria-checked={everywhere === x} className={everywhere === x ? "on" : ""} onClick={() => setEverywhere(x)}>{t(x ? "pearMail.search.everywhere" : "pearMail.search.here")}</button>)}
        </div>
      )}
      <div className="pm-split">
        <Sidebar game={game} box={box} onBox={(b) => { setBox(b); setQuery(""); }} />
        <div className="pm-content">
          <MessageList game={game} rows={rows} box={box} sort={sort} onSort={setSort} threads={threads} onThreads={setThreads} sel={sel} />
          <Preview game={game} row={shown} />
        </div>
      </div>
      {!pm.welcomed && !pm.accounts.length && (
        <div className="pm-sheet" role="dialog" aria-labelledby="pm-welcome">
          <PearMailMark className="pm-sheet-icon" />
          <h2 id="pm-welcome">{t("pearMail.welcome.title")}</h2>
          <button className="btn primary" onClick={() => act(dismissPearWelcome)}>{t("pearMail.welcome.add")}</button>
        </div>
      )}
    </div>
  );
}
