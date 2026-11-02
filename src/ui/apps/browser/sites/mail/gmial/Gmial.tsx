import { useEffect, useState, type ReactNode } from "react";
import { t } from "../../../../../../i18n/en";
import { LOCALE } from "../../../../../../i18n/lang";
import { dateOf, hourOfMonth } from "../../../../../../sim/00-core/time";
import { brandAt, gmialUrl, GOGGLE_ACCOUNTS } from "../../../../../../sim/10-catalog/mail-consumer";
import { mailHost, mailPlan, quotaMbAt } from "../../../../../../sim/10-catalog/mail-providers";
import { capsOf } from "../../../../../../sim/42-mail/caps";
import { matchesConditions } from "../../../../../../sim/42-mail/deliver";
import { boxOf, isRead, tenantOf, view } from "../../../../../../sim/42-mail/model";
import type { Attachment, MailAccount, MailAct, MailCond, Message, ServerFilter } from "../../../../../../sim/42-mail/types";
import type { GameState } from "../../../../../../sim/50-state";
import { importantLabel, searchMailbox } from "../../../../../../sim/80-business/mail-search";
import { applyFilter, markImportant } from "../../../../../../sim/90-actions/mail-provider";
import {
  changePassword, deleteFetchRule, deleteFilter, runFetchRule, saveFetchRule, saveFilter, setAccountPrefs, setForward,
} from "../../../../../../sim/90-actions/mailbox";
import {
  createMailFolder, deleteMailFolder, discardDraft, emptyFolder, expungeMessages, moveMailFolder, renameMailFolder, saveAttachment, saveDraft, sendMessage, setFolderStyle, setVacation,
} from "../../../../../../sim/90-actions/mailmsg";
import { threadsOf, useMailActions } from "../../../../mail-kit/mail-kit";
import { TicketSlot } from "../../../../mail-kit/TicketSlot";
import { useSessionState, writeSession } from "../../../../../session";
import { usePageAct } from "../../../pageAct";
import { seenAddresses } from "../gmix/GmixMail";
import { GOGGLE_SESSION, SignIn } from "../goggle/GoggleSite";
import "./gmial.css";

// docs/design/plans/webmail-consumer.md, section 4.5 and milestone 8: Gmial in the classic look of 2005 to 2010.
const VIEWS: Record<string, string> = { inbox: "in:inbox", starred: "is:starred", sent: "in:sent", drafts: "in:drafts", all: "", spam: "in:spam", trash: "in:trash" };
const RAIL = ["inbox", "starred", "sent", "drafts", "all", "spam", "trash"] as const;
const PAGE_SIZES = [25, 50, 100];
const TABS = ["general", "accounts", "labels", "filters", "forward"] as const;
const BETA_UNTIL = "2009-07", COLOURS_FROM = "2009-01", NESTED_FROM = "2010-01", IMAP_FROM = "2007-10", IMPORTANT_FROM = "2010-01";
// Label chip colours by Folder.colour: background and text.
export const LABEL_COLOURS: [string, string][] = [
  ["#ddd", "#333"], ["#cc3a21", "#fff"], ["#eaa041", "#fff"], ["#f2c960", "#000"], ["#149e60", "#fff"], ["#2da2bb", "#fff"],
  ["#3c78d8", "#fff"], ["#8e63ce", "#fff"], ["#e07798", "#fff"], ["#999", "#fff"],
];
const ADS = 6;

type To = (path: string) => void;
interface P { game: GameState; account: MailAccount; to: To; go: (url: string) => void; params: URLSearchParams }

const since = (game: GameState, ym: string) => game.hour >= hourOfMonth(ym);
const addressOf = (a: MailAccount) => `${a.local}@${a.domain}`;
const num = (n: number, digits = 0) => new Intl.NumberFormat(LOCALE, { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(n);
const queryOf = (v: string): string => (v.startsWith("label/") ? `label:${v.slice(6)}` : v.startsWith("search/") ? decodeURIComponent(v.slice(7)) : VIEWS[v] ?? "in:inbox");
const wide = (v: string) => v === "spam" || v === "trash";

function when(game: GameState, at: number): string {
  const d = dateOf(at / 60), now = dateOf(game.hour), utc = { timeZone: "UTC" } as const;
  if (d.toISOString().slice(0, 10) === now.toISOString().slice(0, 10)) return d.toLocaleTimeString(LOCALE, { ...utc, hour: "numeric", minute: "2-digit" });
  if (d.getUTCFullYear() === now.getUTCFullYear()) return d.toLocaleDateString(LOCALE, { ...utc, month: "short", day: "numeric" });
  return d.toLocaleDateString(LOCALE, { ...utc, dateStyle: "short" });
}
const full = (at: number) => new Intl.DateTimeFormat(LOCALE, { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(dateOf(at / 60));

// The messages of a conversation that a view shows, oldest first: Spam and Trash keep their own.
function convOf(game: GameState, accountId: string, thread: string, v: string): Message[] {
  const box = boxOf(game, accountId).filter((m) => m.thread === thread && !m.snooze);
  return wide(v) ? box.filter((m) => m.folder === (v === "spam" ? "junk" : "trash")) : box.filter((m) => m.folder !== "trash" && m.folder !== "junk");
}
const idsOf = (game: GameState, accountId: string, threads: string[], v: string) => threads.flatMap((th) => convOf(game, accountId, th, v).map((m) => m.id));
const labelsOf = (game: GameState, accountId: string) => game.mail.folders.filter((f) => f.accountId === accountId && f.label);
const userLabels = (game: GameState, accountId: string) => { const imp = importantLabel(game, accountId)?.id; return labelsOf(game, accountId).filter((f) => f.id !== imp); };
const labelName = (game: GameState, id: string) => game.mail.folders.find((f) => f.id === id)?.name ?? id;

export const gmialTitle = (game: GameState, accountId: string | null): string => {
  const a = accountId ? game.mail.accounts.find((x) => x.id === accountId && x.closedAt === null) : undefined;
  const n = a ? threadsOf(searchMailbox(game, a.id, "in:inbox is:unread"), (m) => m).length : 0;
  return a ? `Gmial - ${t("gmial.view.inbox")}${n ? ` (${n})` : ""}` : "Gmial";
};

function Go({ to, path, children, className }: { to: To; path: string; children: ReactNode; className?: string }) {
  return <a href={`#${path}`} className={className} onClick={(e) => { e.preventDefault(); to(path); }}>{children}</a>;
}

function Confirm({ label, onYes }: { label: string; onYes: () => void }) {
  const [asking, setAsking] = useState(false);
  if (!asking) return <button type="button" onClick={() => setAsking(true)}>{label}</button>;
  return (
    <span className="gml-confirm">{t("gmial.sure")}
      <button type="button" onClick={() => { setAsking(false); onYes(); }}>{t("gmial.yes")}</button>
      <button type="button" onClick={() => setAsking(false)}>{t("gmial.no")}</button>
    </span>
  );
}

function Chip({ game, id, onRemove }: { game: GameState; id: string; onRemove?: () => void }) {
  const f = game.mail.folders.find((x) => x.id === id), [bg, fg] = LABEL_COLOURS[f?.colour ?? 0] ?? LABEL_COLOURS[0];
  return <span className="gml-chip" style={{ background: bg, color: fg }} data-label={id}>{f?.name ?? id}{onRemove && <button type="button" aria-label={t("gmial.lab.remove")} onClick={onRemove}>×</button>}</span>;
}

export function Gmial({ game, path, go }: { game: GameState; path: string; go: (url: string) => void }) {
  const [route, query = ""] = path.replace(/^\/+/, "").split("?");
  const params = new URLSearchParams(query), segs = route.split("/").filter(Boolean);
  const rest = segs[0] === "a" ? segs.slice(2) : segs;
  const [signedIn, setSession] = useSessionState<string | null>(GOGGLE_SESSION, null);
  const signIn = (id: string | null) => { writeSession(GOGGLE_SESSION, id); setSession(id); };
  const account = game.mail.accounts.find((a) => a.id === signedIn && a.closedAt === null && tenantOf(game, a)?.host === "goggle");
  if (!account) {
    return (
      <div className={`gg gg-${brandAt(game.hour)}`}>
        <main className="gg-main"><SignIn game={game} accounts={(p) => go(`${GOGGLE_ACCOUNTS}/${p}`)} signIn={signIn} next={`mail.goggle.com/${path.replace(/^\/+/, "")}`} go={go} /></main>
      </div>
    );
  }
  const to: To = (p) => go(gmialUrl(account.domain, p));
  const p: P = { game, account, to, go, params };
  const out = () => { signIn(null); go(gmialUrl(account.domain)); };
  const [head = "inbox", ...more] = rest;
  const page = (() => {
    if (tenantOf(game, account)!.locked) return <p className="gml-error" role="alert">{t("error.mailLocked")}</p>;
    if (head === "settings") return <Settings {...p} tab={more[0] ?? "general"} />;
    if (head === "compose") return <Compose {...p} />;
    if (head === "filter") return <FilterCreate {...p} />;
    const keyed = head === "label" || head === "search", v = keyed ? `${head}/${more[0] ?? ""}` : head, thread = keyed ? more[1] : more[0];
    return thread ? <Conversation key={thread} {...p} v={v} thread={thread} /> : <List key={v} {...p} v={v} />;
  })();
  const current = head === "label" || head === "search" ? `${head}/${more[0] ?? ""}` : head;
  return (
    <div className="gml">
      <Top {...p} out={out} q={head === "search" ? decodeURIComponent(more[0] ?? "") : ""} />
      <div className="gml-body">
        <Rail {...p} current={current} />
        <main className="gml-main">{page}</main>
      </div>
      <Storage {...p} />
    </div>
  );
}

function Top({ game, account, to, out, q }: P & { out: () => void; q: string }) {
  const [typed, setTyped] = useState(q);
  return (
    <header className="gml-top">
      <Go to={to} path="inbox" className="gml-logo"><b>G</b><b>m</b><b>i</b><b>a</b><b>l</b>{!since(game, BETA_UNTIL) && <sup>BETA</sup>}<small>{account.domain}</small></Go>
      <form className="gml-search" onSubmit={(e) => { e.preventDefault(); if (typed.trim()) to(`search/${encodeURIComponent(typed.trim())}`); }}>
        <input name="q" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" aria-label={t("gmial.searchMail")} />
        <button type="submit">{t("gmial.searchMail")}</button>
        <Go to={to} path="filter" className="gml-small">{t("gmial.createFilter")}</Go>
      </form>
      <nav className="gml-links"><b>{addressOf(account)}</b> | <Go to={to} path="settings">{t("gmial.settings")}</Go> | <a href="#out" onClick={(e) => { e.preventDefault(); out(); }}>{t("gmial.signOut")}</a></nav>
    </header>
  );
}

const unreadThreads = (game: GameState, accountId: string, q: string) => threadsOf(searchMailbox(game, accountId, `${q} is:unread`), (m) => m).length;

function Rail({ game, account, to, current }: P & { current: string }) {
  const [shut, setShut] = useState<string[]>([]), nested = since(game, NESTED_FROM);
  const labels = userLabels(game, account.id).filter((f) => !f.hidden), imp = importantLabel(game, account.id);
  const count = (v: string) => (v === "inbox" || v === "spam" || v.startsWith("label/") ? unreadThreads(game, account.id, queryOf(v))
    : v === "drafts" ? searchMailbox(game, account.id, "in:drafts").length : 0);
  const item = (v: string, name: string, depth = 0, kids = false, colour?: number) => {
    const n = count(v), id = v.slice(6);
    return (
      <li key={v} className={current === v ? "gml-on" : undefined} style={depth ? { paddingLeft: depth * 12 } : undefined}>
        {kids && <button type="button" className="gml-twist" onClick={() => setShut(shut.includes(id) ? shut.filter((x) => x !== id) : [...shut, id])}>{shut.includes(id) ? "▸" : "▾"}</button>}
        {colour !== undefined && <i className="gml-swatch" style={{ background: LABEL_COLOURS[colour]?.[0] }} />}
        <Go to={to} path={v} className={n ? "gml-bold" : undefined}>{name}{n > 0 && ` (${n})`}</Go>
      </li>
    );
  };
  const tree = (parent: string | null, depth: number): ReactNode[] => labels.filter((f) => (nested ? f.parent === parent : parent === null)).flatMap((f) => {
    const kids = nested && labels.some((x) => x.parent === f.id);
    return [item(`label/${f.id}`, f.name, depth, kids, since(game, COLOURS_FROM) ? f.colour ?? 0 : undefined), ...(kids && !shut.includes(f.id) ? tree(f.id, depth + 1) : [])];
  });
  return (
    <nav className="gml-rail">
      <Go to={to} path="compose" className="gml-compose">{t("gmial.compose")}</Go>
      <ul>
        {RAIL.slice(0, 2).map((v) => item(v, t(`gmial.view.${v}`)))}
        {imp && since(game, IMPORTANT_FROM) && item(`label/${imp.id}`, t("gmial.important"))}
        {RAIL.slice(2).map((v) => item(v, t(`gmial.view.${v}`)))}
      </ul>
      <div className="gml-labels">
        <h3>{t("gmial.labels")}</h3>
        <ul>{tree(null, 0)}</ul>
        <Go to={to} path="settings/labels" className="gml-small">{t("gmial.editLabels")}</Go>
      </div>
    </nav>
  );
}

// The free edition's footer counter grows while the page is open, as the real one did; paid editions show their flat quota.
function Storage({ game, account }: P) {
  const tn = tenantOf(game, account)!, quota = capsOf(game, account).quotaMb, month = 30 * 24;
  const rate = (quotaMbAt(tn.host, tn.plan, game.hour + month) - quotaMbAt(tn.host, tn.plan, game.hour)) / (month * 3600);
  const [opened] = useState(() => Date.now()), [, tick] = useState(0);
  useEffect(() => { if (rate <= 0) return; const id = setInterval(() => tick((n) => n + 1), 1000); return () => clearInterval(id); }, [rate]);
  const shown = quota + (rate > 0 ? (rate * (Date.now() - opened)) / 1000 : 0), used = account.usedKb / 1024;
  return (
    <footer className="gml-foot" data-quota={quota}>
      {t("gmial.storage", { used: num(used), pct: num(Math.min(100, (used / quota) * 100)), total: rate > 0 ? num(shown, 6) : num(quota) })}
    </footer>
  );
}

function Toolbar({ game, account, to, v, ids, threads, done }: P & { v: string; ids: string[]; threads: string[]; done?: () => void }) {
  const kit = useMailActions(account.id), act = usePageAct(), box = boxOf(game, account.id).filter((m) => ids.includes(m.id));
  const none = !ids.length, labels = userLabels(game, account.id), here = v.startsWith("label/") ? v.slice(6) : null;
  const run = (f: () => unknown) => { f(); done?.(); };
  const inFolder = (f: string) => box.filter((m) => m.folder === f).map((m) => m.id);
  const moveTo = (target: string) => run(() => {
    if (target === "inbox") kit.move(inFolder("archive"), "inbox");
    else { kit.move(ids, target); if (here && here !== target) kit.label(ids, [], [here]); }
  });
  const sender = box[0] && view(game, box[0]).fromAddress;
  const has = (l: string) => box.length > 0 && box.every((m) => m.labels?.includes(l));
  if (wide(v)) return (
    <div className="gml-tools">
      {v === "spam" ? <button type="button" disabled={none} onClick={() => run(() => kit.junk(ids, false))}>{t("gmial.tool.notSpam")}</button>
        : <button type="button" disabled={none} onClick={() => run(() => kit.restore(ids))}>{t("gmial.tool.toInbox")}</button>}
      {!none && <Confirm label={t("gmial.tool.deleteForever")} onYes={() => run(() => act(expungeMessages, account.id, ids))} />}
    </div>
  );
  return (
    <div className="gml-tools">
      {v !== "sent" && v !== "drafts" && <button type="button" disabled={none || !inFolder("inbox").length} onClick={() => run(() => kit.move(inFolder("inbox"), "archive"))}>{t("gmial.tool.archive")}</button>}
      <button type="button" disabled={none} onClick={() => run(() => kit.junk(ids, true))}>{t("gmial.tool.spam")}</button>
      <button type="button" disabled={none} onClick={() => run(() => kit.remove(ids))}>{t("gmial.tool.delete")}</button>
      <select aria-label={t("gmial.tool.moveTo")} value="" disabled={none} onChange={(e) => { if (e.target.value) moveTo(e.target.value); }}>
        <option value="">{t("gmial.tool.moveTo")}</option>
        {v !== "inbox" && <option value="inbox">{t("gmial.view.inbox")}</option>}
        {labels.filter((f) => f.id !== here).map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
      </select>
      <details className="gml-menu" data-menu="labels">
        <summary>{t("gmial.labels")} ▾</summary>
        <ul>{labels.map((f) => (
          <li key={f.id}><label><input type="checkbox" disabled={none} checked={has(f.id)} onChange={(e) => kit.label(ids, e.target.checked ? [f.id] : [], e.target.checked ? [] : [f.id])} />{f.name}</label></li>
        ))}</ul>
        <NewLabel account={account} onMade={(id) => { if (ids.length) kit.label(ids, [id], []); }} />
      </details>
      <details className="gml-menu" data-menu="more">
        <summary>{t("gmial.tool.more")} ▾</summary>
        <ul>
          <li><button type="button" disabled={none} onClick={() => run(() => kit.mark(ids, { read: true }))}>{t("gmial.tool.markRead")}</button></li>
          <li><button type="button" disabled={none} onClick={() => run(() => kit.mark(ids, { read: false }))}>{t("gmial.tool.markUnread")}</button></li>
          <li><button type="button" disabled={none} onClick={() => kit.mark(threads.map((th) => convOf(game, account.id, th, v).at(-1)!.id), { star: true })}>{t("gmial.tool.star")}</button></li>
          <li><button type="button" disabled={none} onClick={() => kit.mark(ids, { star: false })}>{t("gmial.tool.unstar")}</button></li>
          {since(game, IMPORTANT_FROM) && <li><button type="button" disabled={none} onClick={() => act(markImportant, account.id, ids, true)}>{t("gmial.tool.important")}</button></li>}
          <li><button type="button" disabled={!sender} onClick={() => to(`filter?from=${encodeURIComponent(sender ?? "")}`)}>{t("gmial.tool.filterLike")}</button></li>
        </ul>
      </details>
    </div>
  );
}

function NewLabel({ account, onMade }: { account: MailAccount; onMade: (id: string) => void }) {
  const act = usePageAct(), [name, setName] = useState("");
  const make = () => { const r = act(createMailFolder, account.id, name, null); if (r.ok && r.id) { onMade(r.id); setName(""); } };
  return (
    <form className="gml-newlabel" onSubmit={(e) => { e.preventDefault(); make(); }}>
      <input name="newLabel" value={name} onChange={(e) => setName(e.target.value)} aria-label={t("gmial.tool.newLabel")} />
      <button type="submit" disabled={!name.trim()}>{t("gmial.lab.createBtn")}</button>
    </form>
  );
}

function List(p: P & { v: string }) {
  const { game, account, to, v, params } = p;
  const kit = useMailActions(account.id), act = usePageAct();
  const convs = threadsOf(searchMailbox(game, account.id, queryOf(v)), (m) => m);
  const size = Number(account.prefs?.pageSize ?? 50), start = Math.max(0, Math.min(Number(params.get("start")) || 0, Math.max(0, convs.length - 1)));
  const shown = convs.slice(start, start + size), [sel, setSel] = useState<string[]>([]);
  const picked = sel.filter((th) => shown.some((c) => c[0].thread === th)), here = v.startsWith("label/") ? v.slice(6) : null;
  const imp = importantLabel(game, account.id)?.id;
  const pick = (f: (c: Message[]) => boolean) => setSel(shown.filter(f).map((c) => c[0].thread));
  const all = (th: string) => convOf(game, account.id, th, v);
  const title = v.startsWith("label/") ? labelName(game, v.slice(6)) : v.startsWith("search/") ? t("gmial.view.search") : t(`gmial.view.${v}`);
  const names = (c: Message[]) => [...new Set(c.map((m) => (m.from === `acct:${account.id}` ? t("gmial.me") : view(game, m).fromName || view(game, m).fromAddress)))].join(", ");
  const open = (c: Message[]) => (c[0].draft ? `compose?draft=${c[0].id}` : `${v}/${c[0].thread}`);
  const empty = v === "inbox" ? t("gmial.empty.inbox") : v.startsWith("search/") ? t("gmial.empty.search") : t("gmial.empty.none");
  const nav = (n: number) => `${v}?start=${n}`;
  return (
    <>
      {params.get("sent") && <p className="gml-note" role="status">{t("gmial.sent")}</p>}
      <h1>{title}</h1>
      {wide(v) && (
        <p className="gml-purge">{t(`gmial.purge.${v}`)} {convs.length > 0 && <Confirm label={t(`gmial.purge.empty.${v}`)} onYes={() => act(emptyFolder, account.id, v === "spam" ? "junk" : "trash")} />}</p>
      )}
      <Toolbar {...p} ids={idsOf(game, account.id, picked, v)} threads={picked} done={() => setSel([])} />
      <p className="gml-select"><span>{t("gmial.select")}{" "}
        {([["all", () => true], ["none", () => false], ["read", (c) => c.every((m) => isRead(game, m))], ["unread", (c) => c.some((m) => !isRead(game, m))],
          ["starred", (c) => all(c[0].thread).some((m) => m.star)], ["unstarred", (c) => !all(c[0].thread).some((m) => m.star)]] as [string, (c: Message[]) => boolean][]).map(([k, f], i) => (
          <span key={k}>{i > 0 && ", "}<a href={`#${k}`} onClick={(e) => { e.preventDefault(); pick(f); }}>{t(`gmial.select.${k}`)}</a></span>
        ))}</span>
        {convs.length > 0 && (
          <span className="gml-range">
            {start > 0 && <Go to={to} path={nav(Math.max(0, start - size))}>{t("gmial.newer")}</Go>}{" "}
            {t("gmial.range", { from: start + 1, to: Math.min(convs.length, start + size), n: convs.length })}{" "}
            {start + size < convs.length && <Go to={to} path={nav(start + size)}>{t("gmial.older")}</Go>}
          </span>
        )}
      </p>
      {shown.length === 0 ? <p className="gml-empty">{empty}</p> : (
        <table className="gml-list">
          <tbody>
            {shown.map((c) => {
              const th = c[0].thread, every = all(th), unread = c.some((m) => !isRead(game, m)), starred = every.some((m) => m.star);
              const chips = [...new Set(every.flatMap((m) => m.labels ?? []))].filter((l) => l !== here && l !== imp);
              const v0 = view(game, every[0] ?? c[0]), snippet = view(game, c[0]).text;
              return (
                <tr key={th} data-id={th} className={`${unread ? "gml-unread" : "gml-read"}${picked.includes(th) ? " gml-picked" : ""}`}>
                  <td><input type="checkbox" aria-label={t("gmial.select.one")} checked={picked.includes(th)} onChange={(e) => setSel(e.target.checked ? [...picked, th] : picked.filter((x) => x !== th))} /></td>
                  <td><button type="button" className={`gml-star${starred ? " gml-star-on" : ""}`} aria-label={t(starred ? "gmial.tool.unstar" : "gmial.tool.star")} aria-pressed={starred}
                    onClick={() => kit.mark(starred ? every.map((m) => m.id) : [c[0].id], { star: !starred })}>{starred ? "★" : "☆"}</button></td>
                  <td className="gml-who" onClick={() => to(open(c))}><span className="gml-names">{c[0].draft ? <span className="gml-draft">{t("gmial.draft")}</span> : names(every)}</span>{every.length > 1 && ` (${every.length})`}</td>
                  <td className="gml-what" onClick={() => to(open(c))}>
                    {chips.map((l) => <Chip key={l} game={game} id={l} />)}
                    <Go to={to} path={open(c)}>{v0.subject || t("gmial.noSubject")}</Go>
                    <span className="gml-snippet"> - {snippet.replace(/\s+/g, " ").slice(0, 80)}</span>
                  </td>
                  <td>{every.some((m) => m.att?.length) ? "📎" : ""}</td>
                  <td className="gml-when">{when(game, c[0].at)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </>
  );
}

// Quoted lines from the first "> " on, with the attribution line before them.
function splitQuote(text: string): [string, string] {
  const lines = text.split("\n"), at = lines.findIndex((l) => l.startsWith(">"));
  if (at < 0) return [text, ""];
  const cut = at > 0 && lines[at - 1].trim().endsWith(":") ? at - 1 : at;
  return [lines.slice(0, cut).join("\n").trimEnd(), lines.slice(cut).join("\n")];
}

function Att({ game, account, m, att, i }: { game: GameState; account: MailAccount; m: Message; att: Attachment; i: number }) {
  const act = usePageAct();
  const name = att.k === "file" ? att.name : att.k === "doc" ? game.docs.find((d) => d.id === att.id)?.title ?? "" : t(`gmial.att.${att.k}`);
  return (
    <li>📎 <b>{name}</b>{att.k === "file" && ` ${num(att.kb)}K`}
      {(att.k === "file" || att.k === "doc") && <> <button type="button" className="gml-link" onClick={() => act(saveAttachment, account.id, m.id, i)}>{t("gmial.read.save")}</button></>}
    </li>
  );
}

function Msg({ game, account, to, go, m, open, toggle }: P & { m: Message; open: boolean; toggle: () => void }) {
  const kit = useMailActions(account.id), v = view(game, m), [quote, setQuote] = useState(false);
  if (!open) return (
    <div className="gml-msg gml-msg-shut" data-msg={m.id} onClick={toggle}>
      <b>{v.fromName || v.fromAddress}</b><span className="gml-snippet">{v.text.replace(/\s+/g, " ").slice(0, 90)}</span><time>{when(game, m.at)}</time>
    </div>
  );
  const [body, quoted] = splitQuote(v.text);
  return (
    <div className="gml-msg" data-msg={m.id}>
      <div className="gml-msg-head" onClick={toggle}>
        <b>{v.fromName || v.fromAddress}</b> {v.fromName && v.fromName !== v.fromAddress && <span className="gml-addr">&lt;{v.fromAddress}&gt;</span>}
        <time>{full(m.at)}</time>
        <button type="button" className={`gml-star${m.star ? " gml-star-on" : ""}`} aria-label={t(m.star ? "gmial.tool.unstar" : "gmial.tool.star")}
          onClick={(e) => { e.stopPropagation(); kit.mark([m.id], { star: !m.star }); }}>{m.star ? "★" : "☆"}</button>
      </div>
      <p className="gml-to">{t("gmial.read.to", { to: [v.to, ...v.cc].join(", ") })}</p>
      <div className="gml-text">{body}</div>
      {quoted && <button type="button" className="gml-link" onClick={() => setQuote(!quote)}>{t(quote ? "gmial.read.hideQuoted" : "gmial.read.showQuoted")}</button>}
      {quoted && quote && <div className="gml-text gml-quoted">{quoted}</div>}
      {v.att.length > 0 && <ul className="gml-atts">{v.att.map((a, i) => <Att key={i} game={game} account={account} m={m} att={a} i={i} />)}</ul>}
      <TicketSlot game={game} message={m} previews={false} desk={(url) => <p><a href="#desk" onClick={(e) => { e.preventDefault(); go(url); }}>{t("gmial.read.desk")}</a></p>} />
      <p className="gml-replies">
        {(["reply", "all", "fwd"] as const).map((k) => <Go key={k} to={to} path={`compose?re=${m.id}&mode=${k}`}>{t(`gmial.read.${k}`)}</Go>)}
      </p>
    </div>
  );
}

// The ad of a message: the first whose keywords appear in the subject, else one picked by the message id.
export function gmialAd(subject: string, id: string): number {
  const s = subject.toLowerCase();
  const hit = Array.from({ length: ADS }, (_, n) => n).find((n) => t(`gmial.ad.${n}.kw`).split(",").some((k) => k.trim() && s.includes(k.trim().toLowerCase())));
  return hit ?? [...id].reduce((n, c) => n + c.charCodeAt(0), 0) % ADS;
}

function Conversation(p: P & { v: string; thread: string }) {
  const { game, account, to, v, thread } = p;
  const kit = useMailActions(account.id), msgs = convOf(game, account.id, thread, v);
  const [opened, setOpened] = useState<string[]>(() => msgs.filter((m, i) => !isRead(game, m) || i === msgs.length - 1).map((m) => m.id));
  const unreadIds = msgs.filter((m) => !isRead(game, m)).map((m) => m.id).join(",");
  useEffect(() => { if (unreadIds) kit.mark(unreadIds.split(","), { read: true }); }, [unreadIds]); // eslint-disable-line react-hooks/exhaustive-deps
  const back = v.startsWith("label/") ? labelName(game, v.slice(6)) : v.startsWith("search/") ? t("gmial.view.search") : t(`gmial.view.${v}`);
  if (!msgs.length) return <><p className="gml-empty">{t("gmial.gone")}</p><Go to={to} path={v}>{t("gmial.tool.back", { view: back })}</Go></>;
  const ids = msgs.map((m) => m.id), imp = importantLabel(game, account.id)?.id;
  const chips = [...new Set(msgs.flatMap((m) => m.labels ?? []))].filter((l) => l !== imp);
  const tn = tenantOf(game, account)!, ads = !!mailPlan(tn.host, tn.plan)?.ads, subject = view(game, msgs[0]).subject;
  const ad = gmialAd(subject, msgs[0].id);
  return (
    <div className="gml-conv">
      <div className="gml-conv-main">
        <p><Go to={to} path={v}>{t("gmial.tool.back", { view: back })}</Go></p>
        <Toolbar {...p} ids={ids} threads={[thread]} done={() => to(v)} />
        <h2 className="gml-subject">{subject || t("gmial.noSubject")} {chips.map((l) => <Chip key={l} game={game} id={l} onRemove={() => kit.label(ids, [], [l])} />)}</h2>
        {msgs.map((m) => <Msg key={m.id} {...p} m={m} open={opened.includes(m.id)} toggle={() => setOpened(opened.includes(m.id) ? opened.filter((x) => x !== m.id) : [...opened, m.id])} />)}
      </div>
      {ads && (
        <aside className="gml-ads" data-ad={ad}>
          <h3>{t("gmial.ads")}</h3>
          <p><u>{t(`gmial.ad.${ad}.title`)}</u><br />{t(`gmial.ad.${ad}.text`)}<br /><small>{t(`gmial.ad.${ad}.site`)}</small></p>
        </aside>
      )}
    </div>
  );
}

interface Form { from: string; to: string; cc: string; bcc: string; subject: string; text: string; att: Attachment[]; re?: string; fwd?: string; draftId?: string }

function Compose({ game, account, to, params }: P) {
  const act = usePageAct(), own = [addressOf(account), ...account.aliases.map((l) => `${l}@${account.domain}`)];
  const [init] = useState((): Form => {
    const box = boxOf(game, account.id), draft = box.find((x) => x.id === params.get("draft") && x.draft);
    const sig = String(account.prefs?.signature ?? ""), tail = sig ? `\n\n${sig}` : "", from = own[0];
    if (draft) { const v = view(game, draft); return { from, to: v.to, cc: v.cc.join(", "), bcc: (draft.bcc ?? []).join(", "), subject: v.subject, text: v.text, att: draft.att ?? [], re: draft.re, draftId: draft.id }; }
    const re = box.find((x) => x.id === params.get("re")), mode = params.get("mode");
    if (!re) return { from, to: params.get("to") ?? "", cc: "", bcc: "", subject: "", text: tail, att: [] };
    const v = view(game, re), who = v.fromName ? `${v.fromName} <${v.fromAddress}>` : v.fromAddress;
    const quote = `\n\n${t("gmial.compose.wrote", { date: full(re.at), who })}\n${v.text.split("\n").map((l) => `> ${l}`).join("\n")}`;
    if (mode === "fwd") return { from, to: "", cc: "", bcc: "", subject: t("gmial.compose.fwdSubject", { subject: v.subject }), text: `${tail}\n\n${t("gmial.compose.fwdHead")}\n${v.text}`, att: re.att ?? [], fwd: re.id };
    const cc = mode === "all" ? [...v.to.split(","), ...v.cc].map((x) => x.trim().toLowerCase()).filter((x) => x && !own.includes(x) && x !== v.fromAddress) : [];
    const sent = re.from === `acct:${account.id}`;
    return { from, to: sent ? v.to : v.fromAddress, cc: cc.join(", "), bcc: "", subject: t("gmial.compose.reSubject", { subject: v.subject }), text: `${tail}${quote}`, att: [], re: re.id };
  });
  const [f, setF] = useState(init), [saved, setSaved] = useState(false), [more, setMore] = useState({ cc: !!init.cc, bcc: !!init.bcc });
  const set = (k: "from" | "to" | "cc" | "bcc" | "subject" | "text", v: string) => { setF({ ...f, [k]: v }); setSaved(false); };
  const draft = { to: [f.to], cc: [f.cc], bcc: [f.bcc], subject: f.subject, text: f.text, att: f.att, re: f.re };
  const docs = game.docs.filter((d) => !f.att.some((a) => a.k === "doc" && a.id === d.id));
  const send = () => { if (act(sendMessage, account.id, { ...draft, from: f.from, fwd: f.fwd, draftId: f.draftId }).ok) to("inbox?sent=1"); };
  const discard = () => { if (f.draftId) act(discardDraft, account.id, f.draftId); to("inbox"); };
  return (
    <form className="gml-write" onSubmit={(e) => { e.preventDefault(); send(); }}>
      <div className="gml-tools">
        <button type="submit">{t("gmial.compose.send")}</button>
        <button type="button" onClick={() => { const r = act(saveDraft, account.id, { ...draft, id: f.draftId }); if (r.ok) { setF({ ...f, draftId: r.id }); setSaved(true); } }}>{t("gmial.compose.saveNow")}</button>
        <button type="button" onClick={discard}>{t("gmial.compose.discard")}</button>
        {saved && <span className="gml-ok">{t("gmial.compose.saved")}</span>}
      </div>
      <datalist id="gml-seen">{seenAddresses(game, account).map((x) => <option key={x} value={x} />)}</datalist>
      <table className="gml-fields">
        <tbody>
          {own.length > 1 && <tr><th>{t("gmial.compose.from")}</th><td><select name="from" value={f.from} onChange={(e) => set("from", e.target.value)}>{own.map((x) => <option key={x} value={x}>{x}</option>)}</select></td></tr>}
          <tr><th>{t("gmial.compose.to")}</th><td><input name="to" list="gml-seen" value={f.to} onChange={(e) => set("to", e.target.value)} autoComplete="off" /></td></tr>
          {more.cc && <tr><th>{t("gmial.compose.cc")}</th><td><input name="cc" list="gml-seen" value={f.cc} onChange={(e) => set("cc", e.target.value)} autoComplete="off" /></td></tr>}
          {more.bcc && <tr><th>{t("gmial.compose.bcc")}</th><td><input name="bcc" list="gml-seen" value={f.bcc} onChange={(e) => set("bcc", e.target.value)} autoComplete="off" /></td></tr>}
          {(!more.cc || !more.bcc) && <tr><th /><td className="gml-small">
            {!more.cc && <a href="#cc" onClick={(e) => { e.preventDefault(); setMore({ ...more, cc: true }); }}>{t("gmial.compose.addCc")}</a>}{!more.cc && !more.bcc && " | "}
            {!more.bcc && <a href="#bcc" onClick={(e) => { e.preventDefault(); setMore({ ...more, bcc: true }); }}>{t("gmial.compose.addBcc")}</a>}
          </td></tr>}
          <tr><th>{t("gmial.compose.subject")}</th><td><input name="subject" value={f.subject} onChange={(e) => set("subject", e.target.value)} autoComplete="off" /></td></tr>
          <tr><th /><td>
            {f.att.map((a, i) => (
              <span key={i} className="gml-att">📎 {a.k === "file" ? a.name : a.k === "doc" ? game.docs.find((d) => d.id === a.id)?.title : t(`gmial.att.${a.k}`)}
                <button type="button" className="gml-link" onClick={() => setF({ ...f, att: f.att.filter((_, j) => j !== i) })}>{t("gmial.compose.remove")}</button></span>
            ))}
            {docs.length > 0 && (
              <select aria-label={t("gmial.compose.attach")} value="" onChange={(e) => { if (e.target.value) setF({ ...f, att: [...f.att, { k: "doc", id: e.target.value }] }); }}>
                <option value="">{t("gmial.compose.attach")}</option>
                {docs.map((d) => <option key={d.id} value={d.id}>{d.title || t("gmial.compose.untitled")}</option>)}
              </select>
            )}
          </td></tr>
        </tbody>
      </table>
      <textarea name="text" rows={16} value={f.text} onChange={(e) => set("text", e.target.value)} aria-label={t("gmial.compose.text")} />
    </form>
  );
}

// The filter dialog: criteria the server filter matcher evaluates, then the actions; "Has the words" matches the subject.
function FilterCreate({ game, account, to, params }: P) {
  const act = usePageAct(), caps = capsOf(game, account), labels = userLabels(game, account.id);
  const [c, setC] = useState({ from: params.get("from") ?? "", to: "", subject: "", has: "", att: false, size: "" });
  const [step, setStep] = useState(1);
  const [a, setA] = useState({ skip: false, read: false, star: false, label: "", forward: "", fwdOn: false, trash: false, notJunk: false, important: false, also: false });
  const conds: MailCond[] = [
    ...(["from", "to", "subject"] as const).filter((k) => c[k].trim()).map((k): MailCond => ({ field: k, op: "contains", value: c[k].trim() })),
    ...(c.has.trim() ? [{ field: "subject", op: "contains", value: c.has.trim() } as MailCond] : []),
    ...(c.att ? [{ field: "attachment", op: "contains", value: "" } as MailCond] : []),
    ...(Number(c.size) > 0 ? [{ field: "size", op: "over", value: Math.round(Number(c.size) * 1024) } as MailCond] : []),
  ];
  const hits = conds.length ? threadsOf(boxOf(game, account.id).filter((m) => m.folder !== "trash" && m.folder !== "junk" && !m.draft && matchesConditions(game, m, "all", conds)).reverse(), (m) => m) : [];
  const name = conds.map((x) => `${x.field}:(${x.field === "attachment" ? "" : x.value})`).join(" ");
  const create = () => {
    let imp: string | undefined;
    if (a.important) { const r = act(markImportant, account.id, [], true); if (!r.ok) return; imp = r.id; }
    const acts: MailAct[] = [
      ...(a.skip ? [{ do: "move", folder: "archive" } as MailAct] : []), ...(a.read ? [{ do: "read" } as MailAct] : []), ...(a.star ? [{ do: "star" } as MailAct] : []),
      ...(a.label ? [{ do: "label", label: a.label } as MailAct] : []), ...(imp ? [{ do: "label", label: imp } as MailAct] : []),
      ...(a.fwdOn && a.forward.trim() ? [{ do: "forward", to: a.forward.trim().toLowerCase() } as MailAct] : []),
      ...(a.notJunk ? [{ do: "notJunk" } as MailAct] : []), ...(a.trash ? [{ do: "trash" } as MailAct] : []),
    ];
    const r = act(saveFilter, account.id, { name, on: true, match: "all", conds, acts });
    if (!r.ok) return;
    if (a.also && r.id) act(applyFilter, r.id);
    to("settings/filters");
  };
  const box = (k: keyof typeof a, label: string) => <label><input type="checkbox" name={k} checked={!!a[k]} onChange={(e) => setA({ ...a, [k]: e.target.checked })} />{label}</label>;
  return (
    <>
      <div className="gml-filter">
        <h2>{t("gmial.filter.title")}</h2>
        {step === 1 ? (
          <form onSubmit={(e) => { e.preventDefault(); if (conds.length) setStep(2); }}>
            <p>{t("gmial.filter.step1")}</p>
            <table className="gml-fields"><tbody>
              {(["from", "to", "subject", "has"] as const).map((k) => (
                <tr key={k}><th>{t(`gmial.filter.${k}`)}</th><td><input name={`f-${k}`} value={c[k]} onChange={(e) => setC({ ...c, [k]: e.target.value })} autoComplete="off" /></td></tr>
              ))}
              <tr><th /><td><label><input type="checkbox" name="f-att" checked={c.att} onChange={(e) => setC({ ...c, att: e.target.checked })} />{t("gmial.filter.hasAtt")}</label></td></tr>
              <tr><th>{t("gmial.filter.size")}</th><td><input name="f-size" type="number" min="0" value={c.size} onChange={(e) => setC({ ...c, size: e.target.value })} /></td></tr>
            </tbody></table>
            <button type="submit" disabled={!conds.length}>{t("gmial.filter.next")}</button>
            <button type="button" onClick={() => to("inbox")}>{t("gmial.no")}</button>
          </form>
        ) : (
          <form onSubmit={(e) => { e.preventDefault(); create(); }}>
            <p>{t("gmial.filter.step2", { what: name })}</p>
            <ul className="gml-acts">
              <li>{box("skip", t("gmial.filter.skip"))}</li>
              <li>{box("read", t("gmial.filter.read"))}</li>
              <li>{box("star", t("gmial.filter.star"))}</li>
              <li><label>{t("gmial.filter.label")} <select name="label" value={a.label} onChange={(e) => setA({ ...a, label: e.target.value })}>
                <option value="">{t("gmial.filter.chooseLabel")}</option>{labels.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select></label></li>
              <li>{box("fwdOn", t("gmial.filter.forward"))} <input name="forward" value={a.forward} onChange={(e) => setA({ ...a, forward: e.target.value, fwdOn: !!e.target.value.trim() })} autoComplete="off" aria-label={t("gmial.filter.forward")} /></li>
              <li>{box("trash", t("gmial.filter.trash"))}</li>
              <li>{box("notJunk", t("gmial.filter.notJunk"))}</li>
              {since(game, IMPORTANT_FROM) && <li>{box("important", t("gmial.filter.important"))}</li>}
            </ul>
            <p>{box("also", t("gmial.filter.also", { n: hits.length }))}</p>
            <p className="gml-small">{t("gmial.filter.count", { n: game.mail.filters.filter((x) => x.accountId === account.id).length, max: caps.filterMax })}</p>
            <button type="button" onClick={() => setStep(1)}>{t("gmial.filter.back")}</button>
            <button type="submit">{t("gmial.filter.create")}</button>
          </form>
        )}
      </div>
      {hits.length > 0 && (
        <table className="gml-plain"><tbody>{hits.slice(0, 20).map((cv) => (
          <tr key={cv[0].thread} className="gml-read"><td className="gml-who">{view(game, cv[0]).fromName || view(game, cv[0]).fromAddress}</td><td className="gml-what">{view(game, cv[0]).subject}</td><td className="gml-when">{when(game, cv[0].at)}</td></tr>
        ))}</tbody></table>
      )}
    </>
  );
}

function Settings(p: P & { tab: string }) {
  const { game, to, tab } = p;
  const name = (k: (typeof TABS)[number]) => k === "accounts" && since(game, "2010-01") ? t("gmial.set.accountsImport")
    : k === "forward" ? t(since(game, IMAP_FROM) ? "gmial.set.forwardImap" : "gmial.set.forward") : t(`gmial.set.${k}`);
  const body = tab === "accounts" ? <AccountSettings {...p} /> : tab === "labels" ? <LabelSettings {...p} /> : tab === "filters" ? <FilterSettings {...p} />
    : tab === "forward" ? <ForwardSettings {...p} /> : <GeneralSettings {...p} />;
  return (
    <div className="gml-settings">
      <h1>{t("gmial.settings")}</h1>
      <ul className="gml-tabs">{TABS.map((k) => <li key={k} className={(tab === k || (k === "general" && !TABS.includes(tab as never))) ? "gml-on" : undefined}><Go to={to} path={`settings/${k}`}>{name(k)}</Go></li>)}</ul>
      <div className="gml-tab">{body}</div>
    </div>
  );
}

function useSaved(): [(ok: boolean) => void, ReactNode] {
  const [saved, setSaved] = useState(false);
  return [setSaved, saved ? <span className="gml-ok" role="status">{t("gmial.set.saved")}</span> : null];
}

function GeneralSettings({ account }: P) {
  const act = usePageAct(), [setSaved, mark] = useSaved();
  const [size, setSize] = useState(Number(account.prefs?.pageSize ?? 50)), [sig, setSig] = useState(String(account.prefs?.signature ?? ""));
  const vac = account.vacation, [on, setOn] = useState(!!vac?.on), [subject, setSubject] = useState(vac?.subject ?? ""), [text, setText] = useState(vac?.text ?? "");
  const save = () => {
    const a = act(setAccountPrefs, account.id, { pageSize: size, signature: sig.slice(0, 500) });
    const b = a.ok && act(setVacation, account.id, on || subject || text ? { on, subject, text, until: null } : null);
    setSaved(!!b && b.ok);
  };
  return (
    <form onSubmit={(e) => { e.preventDefault(); save(); }}>
      <table className="gml-fields"><tbody>
        <tr><th>{t("gmial.gen.pageSize")}</th><td><select name="pageSize" value={size} onChange={(e) => setSize(Number(e.target.value))}>
          {PAGE_SIZES.map((n) => <option key={n} value={n}>{t("gmial.gen.pageSizeOpt", { n })}</option>)}
        </select></td></tr>
        <tr><th>{t("gmial.gen.signature")}</th><td>
          <label><input type="radio" name="sig" checked={!sig} onChange={() => setSig("")} />{t("gmial.gen.noSig")}</label>
          <textarea name="signature" rows={3} value={sig} onChange={(e) => setSig(e.target.value)} />
        </td></tr>
        <tr><th>{t("gmial.gen.vacation")}</th><td>
          <label><input type="radio" name="vac" checked={!on} onChange={() => setOn(false)} />{t("gmial.gen.vacOff")}</label>
          <label><input type="radio" name="vac" checked={on} onChange={() => setOn(true)} />{t("gmial.gen.vacOn")}</label>
          <label>{t("gmial.compose.subject")} <input name="vacSubject" value={subject} onChange={(e) => setSubject(e.target.value)} /></label>
          <label>{t("gmial.gen.vacText")} <textarea name="vacText" rows={3} value={text} onChange={(e) => setText(e.target.value)} /></label>
        </td></tr>
      </tbody></table>
      <button type="submit">{t("gmial.set.save")}</button>{mark}
    </form>
  );
}

function AccountSettings({ game, account }: P) {
  const act = usePageAct(), caps = capsOf(game, account), [setSaved, mark] = useSaved();
  const [old, setOld] = useState(""), [fresh, setFresh] = useState("");
  const rules = game.mail.fetch.filter((r) => r.accountId === account.id);
  const sources = game.mail.accounts.filter((a) => a.id !== account.id && a.closedAt === null && !a.shared);
  const [source, setSource] = useState(sources[0]?.id ?? ""), [pw, setPw] = useState(""), [leave, setLeave] = useState(true), [label, setLabel] = useState("");
  const name = (id: string) => { const a = game.mail.accounts.find((x) => x.id === id); return a ? addressOf(a) : id; };
  return (
    <table className="gml-fields"><tbody>
      <tr><th>{t("gmial.acc.changePassword")}</th><td>
        <form onSubmit={(e) => { e.preventDefault(); const r = act(changePassword, account.id, old, fresh); setSaved(r.ok); if (r.ok) { setOld(""); setFresh(""); } }}>
          <label>{t("gmial.acc.old")} <input name="old" type="password" value={old} onChange={(e) => setOld(e.target.value)} autoComplete="current-password" /></label>
          <label>{t("gmial.acc.new")} <input name="new" type="password" value={fresh} onChange={(e) => setFresh(e.target.value)} autoComplete="new-password" /></label>
          <button type="submit">{t("gmial.set.save")}</button>{mark}
        </form>
      </td></tr>
      <tr><th>{t("gmial.acc.sendAs")}</th><td><ul>{[addressOf(account), ...account.aliases.map((l) => `${l}@${account.domain}`)].map((x) => <li key={x}>{account.title} &lt;{x}&gt;</li>)}</ul></td></tr>
      <tr><th>{t("gmial.acc.fetch")}</th><td>
        {rules.length > 0 && <ul>{rules.map((r) => (
          <li key={r.id}>{name(r.source)} {r.err ? <span className="gml-error">{t(r.err)}</span> : r.lastAt > 0 && t("gmial.acc.lastChecked", { date: full(r.lastAt) })}
            {" "}<button type="button" className="gml-link" onClick={() => act(runFetchRule, r.id)}>{t("gmial.acc.checkNow")}</button>
            {" "}<button type="button" className="gml-link" onClick={() => act(deleteFetchRule, r.id)}>{t("gmial.acc.delete")}</button></li>
        ))}</ul>}
        {sources.length > 0 && rules.length < caps.collectors && (
          <form onSubmit={(e) => { e.preventDefault(); if (act(saveFetchRule, account.id, { source, proto: "pop", password: pw, leave, label: label || null }).ok) setPw(""); }}>
            <b>{t("gmial.acc.addFetch")}</b>
            <label>{t("gmial.acc.account")} <select name="source" value={source} onChange={(e) => setSource(e.target.value)}>{sources.map((a) => <option key={a.id} value={a.id}>{addressOf(a)}</option>)}</select></label>
            <label>{t("gmial.acc.password")} <input name="sourcePassword" type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="off" /></label>
            <label><input type="checkbox" checked={leave} onChange={(e) => setLeave(e.target.checked)} />{t("gmial.acc.leave")}</label>
            <label>{t("gmial.acc.label")} <select name="fetchLabel" value={label} onChange={(e) => setLabel(e.target.value)}>
              <option value="">{t("gmial.lab.top")}</option>{userLabels(game, account.id).map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select></label>
            <button type="submit">{t("gmial.acc.addBtn")}</button>
          </form>
        )}
      </td></tr>
    </tbody></table>
  );
}

function LabelRow({ game, account, id }: { game: GameState; account: MailAccount; id: string }) {
  const act = usePageAct(), f = game.mail.folders.find((x) => x.id === id)!, [name, setName] = useState(f.name);
  const n = threadsOf(searchMailbox(game, account.id, `label:${id}`), (m) => m).length;
  const others = userLabels(game, account.id).filter((x) => x.id !== id);
  return (
    <tr data-label={id}>
      <td><input aria-label={t("gmial.lab.name")} value={name} onChange={(e) => setName(e.target.value)} onBlur={() => { if (name.trim() && name !== f.name) act(renameMailFolder, account.id, id, name); }} /></td>
      <td>{t("gmial.lab.count", { n })}</td>
      {since(game, COLOURS_FROM) && <td><select aria-label={t("gmial.lab.colour")} value={f.colour ?? 0} onChange={(e) => act(setFolderStyle, account.id, id, { colour: Number(e.target.value) })}>
        {LABEL_COLOURS.map((_, i) => <option key={i} value={i}>{t(`gmial.lab.colour.${i}`)}</option>)}
      </select></td>}
      {since(game, NESTED_FROM) && <td><select aria-label={t("gmial.lab.parent")} value={f.parent ?? ""} onChange={(e) => act(moveMailFolder, account.id, id, e.target.value || null)}>
        <option value="">{t("gmial.lab.top")}</option>{others.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
      </select></td>}
      <td><button type="button" className="gml-link" onClick={() => act(setFolderStyle, account.id, id, { hidden: !f.hidden })}>{t(f.hidden ? "gmial.lab.show" : "gmial.lab.hide")}</button></td>
      <td><Confirm label={t("gmial.lab.remove")} onYes={() => act(deleteMailFolder, account.id, id)} /></td>
    </tr>
  );
}

function LabelSettings({ game, account }: P) {
  const labels = userLabels(game, account.id);
  return (
    <>
      <NewLabel account={account} onMade={() => undefined} />
      {labels.length > 0 && <table className="gml-plain"><tbody>{labels.map((f) => <LabelRow key={f.id} game={game} account={account} id={f.id} />)}</tbody></table>}
    </>
  );
}

const actText = (game: GameState, a: MailAct, imp: string | undefined): string =>
  a.do === "move" ? (a.folder === "archive" ? t("gmial.fil.act.skip") : t("gmial.fil.act.label", { label: labelName(game, a.folder) }))
    : a.do === "label" ? (a.label === imp ? t("gmial.fil.act.important") : t("gmial.fil.act.label", { label: labelName(game, a.label) }))
      : a.do === "forward" ? t("gmial.fil.act.forward", { to: a.to }) : t(`gmial.fil.act.${a.do}`);

function FilterSettings({ game, account, to }: P) {
  const act = usePageAct(), mine: ServerFilter[] = game.mail.filters.filter((x) => x.accountId === account.id), imp = importantLabel(game, account.id)?.id;
  return (
    <>
      {mine.length > 0 && (
        <table className="gml-plain"><tbody>{mine.map((f) => (
          <tr key={f.id} className="gml-read" data-filter={f.id}>
            <td>{t("gmial.fil.matches", { what: f.name })}<br />{t("gmial.fil.do", { what: f.acts.map((a) => actText(game, a, imp)).join(", ") })}</td>
            <td><Confirm label={t("gmial.acc.delete")} onYes={() => act(deleteFilter, f.id)} /></td>
          </tr>
        ))}</tbody></table>
      )}
      <p><Go to={to} path="filter">{t("gmial.fil.new")}</Go></p>
    </>
  );
}

function ForwardSettings({ game, account }: P) {
  const act = usePageAct(), caps = capsOf(game, account), servers = mailHost("goggle")!.servers!, [setSaved, mark] = useSaved(), pr = account.prefs ?? {};
  const [fwdOn, setFwdOn] = useState(!!account.forward), [fwd, setFwd] = useState(account.forward?.to ?? ""), [keep, setKeep] = useState(account.forward?.keep ?? true);
  const [pop, setPop] = useState(pr.pop !== "off"), [imap, setImap] = useState(pr.imap !== "off"), [del, setDel] = useState(String(pr.imapDelete ?? "archive"));
  const save = () => {
    const a = act(setForward, account.id, fwdOn && fwd.trim() ? fwd.trim() : null, keep);
    const b = a.ok && act(setAccountPrefs, account.id, { pop: pop ? "all" : "off", imap: imap ? "on" : "off", imapDelete: del });
    setSaved(!!b && b.ok);
  };
  return (
    <form onSubmit={(e) => { e.preventDefault(); save(); }}>
      <table className="gml-fields"><tbody>
        <tr><th>{t("gmial.fwd.title")}</th><td>
          <label><input type="radio" name="fwd" checked={!fwdOn} onChange={() => setFwdOn(false)} />{t("gmial.fwd.off")}</label>
          <label><input type="radio" name="fwd" checked={fwdOn} onChange={() => setFwdOn(true)} />{t("gmial.fwd.on")} <input name="forward" value={fwd} onChange={(e) => setFwd(e.target.value)} autoComplete="off" aria-label={t("gmial.fwd.on")} /></label>
          <select name="keep" value={keep ? "keep" : "drop"} onChange={(e) => setKeep(e.target.value === "keep")} aria-label={t("gmial.fwd.title")}>
            <option value="keep">{t("gmial.fwd.keep")}</option><option value="drop">{t("gmial.fwd.drop")}</option>
          </select>
        </td></tr>
        <tr><th>{t("gmial.pop.title")}</th><td>
          <p>{t(caps.pop && pop ? "gmial.pop.status.on" : "gmial.pop.status.off")}</p>
          {caps.pop ? <>
            <label><input type="radio" name="pop" checked={pop} onChange={() => setPop(true)} />{t("gmial.pop.on")}</label>
            <label><input type="radio" name="pop" checked={!pop} onChange={() => setPop(false)} />{t("gmial.pop.off")}</label>
            <p className="gml-small">{servers.pop}</p>
          </> : <p>{t("gmial.unavailable")}</p>}
        </td></tr>
        {since(game, IMAP_FROM) && <tr><th>{t("gmial.imap.title")}</th><td>
          <p>{t(caps.imap && imap ? "gmial.imap.status.on" : "gmial.imap.status.off")}</p>
          {caps.imap ? <>
            <label><input type="radio" name="imap" checked={imap} onChange={() => setImap(true)} />{t("gmial.imap.on")}</label>
            <label><input type="radio" name="imap" checked={!imap} onChange={() => setImap(false)} />{t("gmial.imap.off")}</label>
            <p>{t("gmial.imap.delete")}</p>
            {(["archive", "trash", "expunge"] as const).map((k) => <label key={k}><input type="radio" name="imapDelete" checked={del === k} onChange={() => setDel(k)} />{t(`gmial.imap.del.${k}`)}</label>)}
            <p className="gml-small">{servers.imap}</p>
          </> : <p>{t("gmial.unavailable")}</p>}
        </td></tr>}
      </tbody></table>
      <button type="submit">{t("gmial.set.save")}</button>{mark}
    </form>
  );
}
