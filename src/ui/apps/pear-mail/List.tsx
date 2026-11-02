import { useState, type DragEvent, type MouseEvent } from "react";
import { ChevronDown, ChevronRight, Flag, Paperclip } from "lucide-react";
import { t } from "../../../i18n/en";
import { LOCALE } from "../../../i18n/lang";
import { dateOf } from "../../../sim/00-core/time";
import { isRead, view } from "../../../sim/42-mail/model";
import { threadsOf, type Row, type SortKey } from "../../../sim/43-pear-mail/view";
import type { GameState } from "../../../sim/50-state";
import { menuOn } from "../../desktop/ContextMenu";
import type { useSelection } from "../mail-kit/mail-kit";
import type { Box } from "./commands";
import type { Sort } from "./menus";

export const mailDate = (at: number): string => new Intl.DateTimeFormat(LOCALE, { dateStyle: "short", timeStyle: "short", timeZone: "UTC" }).format(dateOf(at / 60));
const SORTS: SortKey[] = ["from", "subject", "date"];

interface Props {
  game: GameState; rows: Row[]; box: Box; sort: Sort; onSort: (s: Sort) => void; threads: boolean; onThreads: (on: boolean) => void;
  sel: ReturnType<typeof useSelection>;
  onDrag: (e: DragEvent, r: Row) => void; onMenu: (e: MouseEvent, r: Row) => void;
}

export function MessageList({ game, rows, box, sort, onSort, threads, onThreads, sel, onDrag, onMenu }: Props) {
  const [open, setOpen] = useState<string[]>([]);
  const outgoing = box.f === "sent" || box.f === "drafts";
  const groups = threads ? threadsOf(rows, (r) => r.m) : rows.map((r) => [r]);
  const label = (k: SortKey) => t(k === "from" && outgoing ? "pearMail.col.to" : `pearMail.col.${k}`);
  const head = menuOn(() => [
    ...SORTS.map((k) => ({ label: label(k), checked: sort.key === k, run: () => onSort({ key: k, asc: k !== "date" }) })),
    null,
    { label: t("pearMail.organize"), checked: threads, run: () => onThreads(!threads) },
  ]);
  const line = (r: Row, lead: Row[] | null) => {
    const v = view(game, r.m), unread = !isRead(game, r.m), id = r.m.id, expanded = lead && open.includes(r.m.thread);
    return (
      <tr key={id} className={`${sel.ids.includes(id) ? "sel" : ""}${unread ? " unread" : ""}`} data-color={game.pearMail.colors[id]} aria-selected={sel.ids.includes(id)} onClick={(e) => sel.click(id, e)}
        draggable onDragStart={(e) => onDrag(e, r)} onContextMenu={(e) => onMenu(e, r)}>
        <td className="pm-c-mark">
          {lead && lead.length > 1
            ? <button className="pm-disclose" aria-expanded={!!expanded} onClick={(e) => { e.stopPropagation(); setOpen(expanded ? open.filter((x) => x !== r.m.thread) : [...open, r.m.thread]); }}>{expanded ? <ChevronDown /> : <ChevronRight />}</button>
            : unread && <span className="pm-dot" aria-label={t("pearMail.unread")} />}
        </td>
        <td className="pm-c-mark">{r.m.star && <Flag className="pm-flag" aria-label={t("pearMail.flagged")} />}</td>
        <td className="pm-c-mark">{r.m.att?.length ? <Paperclip aria-label={t("pearMail.attachment")} /> : null}</td>
        <td className="pm-c-from">{outgoing ? v.to : v.fromName}{lead && lead.length > 1 && <span className="pm-thread-n">{lead.length.toLocaleString(LOCALE)}</span>}</td>
        <td className="pm-c-subject">{v.subject}</td>
        <td className="pm-c-date num">{mailDate(r.m.at)}</td>
      </tr>
    );
  };
  return (
    <div className="pm-list" tabIndex={0} onKeyDown={sel.onKeyDown}>
      <table className="table pm-table">
        <thead onContextMenu={head}>
          <tr>
            <th className="pm-c-mark" aria-label={t("pearMail.unread")} />
            <th className="pm-c-mark" aria-label={t("pearMail.flagged")} />
            <th className="pm-c-mark" aria-label={t("pearMail.attachment")} />
            {SORTS.map((k) => (
              <th key={k} className={`pm-c-${k}`} aria-sort={sort.key === k ? (sort.asc ? "ascending" : "descending") : undefined}>
                <button onClick={() => onSort({ key: k, asc: sort.key === k ? !sort.asc : k !== "date" })}>
                  {label(k)}{sort.key === k && <span className={`pm-arrow${sort.asc ? " up" : ""}`} />}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {groups.flatMap((g) => (g.length > 1 && open.includes(g[0].m.thread) ? [line(g[0], g), ...g.slice(1).map((r) => line(r, null))] : [line(g[0], threads ? g : null)]))}
        </tbody>
      </table>
    </div>
  );
}
