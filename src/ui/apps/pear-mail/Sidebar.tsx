import { Activity, Archive, FileText, Folder, Inbox, MailX, Plus, Send, Trash2, TriangleAlert, type LucideIcon } from "lucide-react";
import { t } from "../../../i18n/en";
import { LOCALE } from "../../../i18n/lang";
import type { Folder as MailFolder } from "../../../sim/42-mail/types";
import { clientError } from "../../../sim/43-pear-mail/check";
import { clientFolders, clientUnread, UNIFIED } from "../../../sim/43-pear-mail/view";
import type { GameState } from "../../../sim/50-state";
import { getMail } from "../../../sim/90-actions/pear-mail";
import { useSessionState } from "../../session";
import { useStore } from "../../store";
import type { Box } from "./PearMailApp";

const ICONS: Record<string, LucideIcon> = { inbox: Inbox, drafts: FileText, sent: Send, junk: MailX, trash: Trash2, archive: Archive };
const GREY = new Set(["junk", "trash"]);

const depth = (f: MailFolder, all: MailFolder[]): number => {
  let n = 0;
  for (let p = f.parent; p; p = all.find((x) => x.id === p)?.parent ?? null) n++;
  return n;
};

function Item({ label, folder, count, active, level = 0, onClick }: { label: string; folder: string; count: number; active: boolean; level?: number; onClick: () => void }) {
  const Icon = ICONS[folder] ?? Folder;
  return (
    <button className={`side-item pm-box${active ? " active" : ""}`} style={{ paddingLeft: 8 + level * 14 }} aria-current={active || undefined} onClick={onClick}>
      <Icon />
      <span className="pm-box-name">{label}</span>
      {count > 0 && <span className={`pm-count${GREY.has(folder) ? " grey" : ""}`}>{count.toLocaleString(LOCALE)}</span>}
    </button>
  );
}

const ACTIVITY_SHOWN = 6;

// The Mail Activity pane at the foot of the mailbox list, newest line first.
function ActivityPane({ game }: { game: GameState }) {
  const act = useStore((s) => s.act), pm = game.pearMail;
  const lines = pm.activity.slice(-ACTIVITY_SHOWN).reverse();
  return (
    <div className="pm-activity" aria-label={t("pearMail.activity")}>
      {lines.map((l, i) => {
        const account = pm.accounts.find((c) => c.id === l.clientId)?.description ?? "";
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

export function Sidebar({ game, box, onBox, onAdd, onAlert }: { game: GameState; box: Box; onBox: (b: Box) => void; onAdd: () => void; onAlert: (clientId: string) => void }) {
  const on = game.pearMail.accounts.filter((c) => c.enabled);
  const [activity, setActivity] = useSessionState("pm.activity", false);
  return (
    <aside className="sidebar pm-side">
      <div className="side-h">{t("pearMail.mailboxes")}</div>
      {UNIFIED.map((f) => (
        <Item key={f} label={t(`mail.folder.${f}`)} folder={f} count={on.reduce((n, c) => n + clientUnread(game, c, f), 0)} active={box.c === null && box.f === f} onClick={() => onBox({ c: null, f })} />
      ))}
      {game.pearMail.accounts.map((c) => {
        const error = clientError(game, c), folders = clientFolders(game, c);
        return (
          <div key={c.id} className={c.enabled ? "pm-account" : "pm-account off"}>
            <div className="side-h pm-account-h">
              <span>{c.description}</span>
              {error && <button className="pm-warn" title={t(error)} aria-label={t(error)} onClick={() => onAlert(c.id)}><TriangleAlert /></button>}
            </div>
            {folders.map((f) => (
              <Item key={f.id} label={f.name} folder={f.id} level={depth(f, folders)} count={c.enabled ? clientUnread(game, c, f.id) : 0} active={box.c === c.id && box.f === f.id} onClick={() => onBox({ c: c.id, f: f.id })} />
            ))}
          </div>
        );
      })}
      <span className="pm-grow" />
      {activity && <ActivityPane game={game} />}
      <div className="pm-side-foot">
        <button aria-label={t("pearMail.add.title")} title={t("pearMail.add.title")} onClick={onAdd}><Plus /></button>
        <button aria-label={t("pearMail.activity")} title={t("pearMail.activity")} aria-pressed={activity} className={activity ? "on" : ""} onClick={() => setActivity(!activity)}><Activity /></button>
      </div>
    </aside>
  );
}
