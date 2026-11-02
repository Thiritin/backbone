import { useState, type DragEvent, type MouseEvent as ReactMouseEvent, type ReactNode } from "react";
import { Activity, Archive, Ban, FolderCog, FileText, Folder, Inbox, MailX, Plus, Send, Trash2, TriangleAlert, type LucideIcon } from "lucide-react";
import { t } from "../../../i18n/en";
import { LOCALE } from "../../../i18n/lang";
import { isRead } from "../../../sim/42-mail/model";
import type { Folder as MailFolder } from "../../../sim/42-mail/types";
import { clientError } from "../../../sim/43-pear-mail/check";
import { MY_PEAR } from "../../../sim/43-pear-mail/state";
import { clientFolders, clientUnread, mailboxRows, myFolders, ON_MY_PEAR, UNIFIED, type Row } from "../../../sim/43-pear-mail/view";
import type { GameState } from "../../../sim/50-state";
import { getMail, transferMessages } from "../../../sim/90-actions/pear-mail";
import { menuOn } from "../../desktop/ContextMenu";
import { useStore } from "../../store";
import { dragPayload, MAIL_DRAG, readDrag } from "../mail-kit/mail-kit";
import { customBox, mailboxOps, SMART, type Box } from "./commands";
import { smartRows } from "../../../sim/43-pear-mail/smart";
import { mailboxMenu, type PearCtx } from "./menus";

const ICONS: Record<string, LucideIcon> = { smart: FolderCog, inbox: Inbox, drafts: FileText, sent: Send, junk: MailX, trash: Trash2, archive: Archive };
const GREY = new Set(["junk", "trash"]);

const depth = (f: MailFolder, all: MailFolder[]): number => {
  let n = 0;
  for (let p = f.parent; p; p = all.find((x) => x.id === p)?.parent ?? null) n++;
  return n;
};

const FROM = "application/x-pear-from-", BOX = "application/x-pear-box", BOX_FROM = "application/x-pear-box-";
// The client id a drag came from, read from its type list, since dragover cannot read the data itself.
const sourceOf = (e: DragEvent, prefix: string) => e.dataTransfer.types.find((x) => x.startsWith(prefix))?.slice(prefix.length) ?? null;
// Mail goes within its account or to and from On My Pear; the unified Inbox, Junk and Trash take each message to its own account's.
const takes = (src: string | null, b: Box) => !!src && (b.c === null ? ["inbox", "junk", "trash"].includes(b.f) : src === b.c || src === MY_PEAR || b.c === MY_PEAR);

export function dragRows(e: DragEvent, rows: Row[]): void {
  const c = rows[0].c.id;
  e.dataTransfer.setData(MAIL_DRAG, dragPayload(c, rows.map((r) => r.m.id)));
  e.dataTransfer.setData(FROM + c, "");
  e.dataTransfer.effectAllowed = "copyMove";
}

interface Drops { drop?: Box; nest?: { c: string; f: string | null }; drag?: { c: string; f: string } }
// Drop handling shared by mailbox rows and headers: messages move or copy (Option), mailboxes nest.
function useDrops({ drop, nest, drag }: Drops) {
  const act = useStore((s) => s.act);
  const [hot, setHot] = useState(false);
  const accepts = (e: DragEvent) => (drop && e.dataTransfer.types.includes(MAIL_DRAG) && takes(sourceOf(e, FROM), drop))
    || (nest && e.dataTransfer.types.includes(BOX) && sourceOf(e, BOX_FROM) === nest.c);
  return {
    hot,
    draggable: !!drag || undefined,
    onDragStart: drag && ((e: DragEvent) => { e.dataTransfer.setData(BOX, JSON.stringify(drag)); e.dataTransfer.setData(BOX_FROM + drag.c, ""); e.dataTransfer.effectAllowed = "move"; }),
    onDragOver: (e: DragEvent) => {
      if (!accepts(e)) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = e.dataTransfer.types.includes(BOX) || !e.altKey ? "move" : "copy";
      setHot(true);
    },
    onDragLeave: () => setHot(false),
    onDrop: (e: DragEvent) => {
      setHot(false);
      if (!accepts(e)) return;
      e.preventDefault();
      const d = readDrag(e), game = useStore.getState().game;
      if (d && drop) act(transferMessages, d.accountId, d.ids, drop.c ?? d.accountId, drop.f, e.altKey);
      else if (nest) {
        const b = JSON.parse(e.dataTransfer.getData(BOX)) as { c: string; f: string };
        if (b.f !== nest.f) mailboxOps(game, act, nest.c).nest(b.f, nest.f);
      }
    },
  };
}

function Item({ label, folder, count, active, level = 0, onClick, onMenu, ...drops }: Drops & { label: string; folder: string; count: number; active: boolean; level?: number; onClick: () => void; onMenu: (e: ReactMouseEvent) => void }) {
  const Icon = ICONS[folder] ?? Folder;
  const { hot, ...dnd } = useDrops(drops);
  return (
    <button className={`side-item pm-box${active ? " active" : ""}${hot ? " drop" : ""}`} style={{ paddingLeft: 8 + level * 14 }} aria-current={active || undefined} onClick={onClick} onContextMenu={onMenu} {...dnd}>
      <Icon />
      <span className="pm-box-name">{label}</span>
      {count > 0 && <span className={`pm-count${GREY.has(folder) ? " grey" : ""}`}>{count.toLocaleString(LOCALE)}</span>}
    </button>
  );
}

function Header({ children, nest, onMenu }: { children: ReactNode; nest?: { c: string; f: null }; onMenu?: (e: ReactMouseEvent) => void }) {
  const { hot, ...dnd } = useDrops({ nest });
  return <div className={`side-h pm-account-h${hot ? " drop" : ""}`} onContextMenu={onMenu} {...dnd}>{children}</div>;
}

const ACTIVITY_SHOWN = 6;

// The Mail Activity pane at the foot of the mailbox list, newest line first.
function ActivityPane({ game }: { game: GameState }) {
  const act = useStore((s) => s.act), pm = game.pearMail;
  const lines = pm.activity.filter((l) => pm.accounts.some((c) => c.id === l.clientId)).slice(-ACTIVITY_SHOWN).reverse();
  return (
    <div className="pm-activity" aria-label={t("pearMail.activity")}>
      {lines.map((l, i) => {
        const c = pm.accounts.find((x) => x.id === l.clientId)!, account = c.description || c.address;
        return (
          <div key={i} className={l.error ? "pm-act-line error" : "pm-act-line"}>
            <span>{l.error ? t("pearMail.activity.failed", { account, error: t(l.error) }) : t("pearMail.activity.checked", { account, count: l.count.toLocaleString(LOCALE) })}</span>
            {l.error && i === lines.findIndex((x) => x.clientId === l.clientId) && account && <button className="btn" onClick={() => act(getMail, l.clientId)}>{t("pearMail.tryAgain")}</button>}
          </div>
        );
      })}
    </div>
  );
}

interface Props { game: GameState; box: Box; onBox: (b: Box) => void; onAdd: () => void; onAlert: (clientId: string) => void; activity: boolean; onActivity: (on: boolean) => void; ctx: PearCtx }

export function Sidebar({ game, box, onBox, onAdd, onAlert, activity, onActivity, ctx }: Props) {
  const unreadIn = (f: string) => mailboxRows(game, null, f).filter((r) => !isRead(game, r.m)).length;
  const menu = (c: string | null, f: string | null) => menuOn(() => mailboxMenu(ctx, c, f));
  const tree = (c: string, folders: MailFolder[], count: (f: string) => number) => folders.map((f) => {
    const mine = !!customBox(game, { c, f: f.id });
    return (
      <Item key={f.id} label={f.name} folder={f.id} level={depth(f, folders)} count={count(f.id)} active={box.c === c && box.f === f.id} onClick={() => onBox({ c, f: f.id })} onMenu={menu(c, f.id)}
        drop={{ c, f: f.id }} nest={mine ? { c, f: f.id } : undefined} drag={mine ? { c, f: f.id } : undefined} />
    );
  });
  const mine = myFolders(game);
  return (
    <aside className="sidebar pm-side">
      <div className="side-h">{t("pearMail.mailboxes")}</div>
      {UNIFIED.map((f) => (
        <Item key={f} label={t(`mail.folder.${f}`)} folder={f} count={unreadIn(f)} active={box.c === null && box.f === f} onClick={() => onBox({ c: null, f })} onMenu={menu(null, f)} drop={{ c: null, f }} />
      ))}
      {game.pearMail.accounts.map((c) => {
        const error = clientError(game, c);
        return (
          <div key={c.id} className={c.enabled ? "pm-account" : "pm-account off"}>
            <Header nest={c.protocol === "imap" ? { c: c.id, f: null } : undefined} onMenu={menu(c.id, null)}>
              <span>{c.description}</span>
              {error && <button className={error === "error.mailClosed" ? "pm-warn closed" : "pm-warn"} title={t(error)} aria-label={t(error)} onClick={() => onAlert(c.id)}>{error === "error.mailClosed" ? <Ban /> : <TriangleAlert />}</button>}
            </Header>
            {tree(c.id, clientFolders(game, c), (f) => (c.enabled ? clientUnread(game, c, f) : 0))}
          </div>
        );
      })}
      <div className="pm-account">
        <Header onMenu={menu(SMART, null)}><span>{t("pearMail.smart.section")}</span></Header>
        {game.pearMail.smart.map((sm) => (
          <Item key={sm.id} label={sm.name} folder="smart" count={smartRows(game, sm).filter((r) => !isRead(game, r.m)).length} active={box.c === SMART && box.f === sm.id}
            onClick={() => onBox({ c: SMART, f: sm.id })} onMenu={menu(SMART, sm.id)} />
        ))}
      </div>
      {mine.length > 0 && (
        <div className="pm-account">
          <Header nest={{ c: MY_PEAR, f: null }} onMenu={menu(MY_PEAR, null)}><span>{t("pearMail.onMyPear")}</span></Header>
          {tree(MY_PEAR, mine, (f) => clientUnread(game, ON_MY_PEAR, f))}
        </div>
      )}
      <span className="pm-grow" />
      {activity && <ActivityPane game={game} />}
      <div className="pm-side-foot">
        <button aria-label={t("pearMail.add.title")} title={t("pearMail.add.title")} onClick={onAdd}><Plus /></button>
        <button aria-label={t("pearMail.activity")} title={t("pearMail.activity")} aria-pressed={activity} className={activity ? "on" : ""} onClick={() => onActivity(!activity)}><Activity /></button>
      </div>
    </aside>
  );
}
