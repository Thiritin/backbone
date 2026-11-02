import { Archive, FileText, Folder, Inbox, MailX, Send, Trash2, TriangleAlert, type LucideIcon } from "lucide-react";
import { t } from "../../../i18n/en";
import { LOCALE } from "../../../i18n/lang";
import type { Folder as MailFolder } from "../../../sim/42-mail/types";
import { clientError } from "../../../sim/43-pear-mail/check";
import { clientFolders, clientUnread, UNIFIED } from "../../../sim/43-pear-mail/view";
import type { GameState } from "../../../sim/50-state";
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

export function Sidebar({ game, box, onBox }: { game: GameState; box: Box; onBox: (b: Box) => void }) {
  const on = game.pearMail.accounts.filter((c) => c.enabled);
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
              {error && <TriangleAlert className="pm-warn" aria-label={t(error)} />}
            </div>
            {folders.map((f) => (
              <Item key={f.id} label={f.name} folder={f.id} level={depth(f, folders)} count={c.enabled ? clientUnread(game, c, f.id) : 0} active={box.c === c.id && box.f === f.id} onClick={() => onBox({ c: c.id, f: f.id })} />
            ))}
          </div>
        );
      })}
    </aside>
  );
}
