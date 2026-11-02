// The shared mail UI kit: selection, search, folder rows, actions and drag and drop that Pear Mail, the webmail sites and
// the desk build their own visuals on (docs/design/plans/mail-client.md, The shared mail UI kit).
import { useEffect, useRef, useState, type DragEvent, type KeyboardEvent, type MouseEvent } from "react";
import { foldersOf, isRead, listFolder, unread, view } from "../../../sim/42-mail/model";
import type { Attachment, Message } from "../../../sim/42-mail/types";
import { sortMessages, threadsOf, type SortKey } from "../../../sim/43-pear-mail/view";
import type { GameState } from "../../../sim/50-state";
import {
  createMailFolder, deleteMailFolder, deleteMessages, labelMessages, markMessages, moveMailFolder, moveMessages, renameMailFolder, reportJunk, restoreMessages,
} from "../../../sim/90-actions/mailmsg";
import { useStore } from "../../store";

export { sortMessages, threadsOf, type SortKey };

export type SearchScope = "all" | "from" | "to" | "subject";
// A case-blind match over the text a screen shows.
export function matches(s: GameState, m: Message, query: string, scope: SearchScope = "all"): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const v = view(s, m), from = `${v.fromName} ${v.fromAddress}`, to = [v.to, ...v.cc].join(" ");
  const text = scope === "from" ? from : scope === "to" ? to : scope === "subject" ? v.subject : `${from} ${to} ${v.subject} ${v.text}`;
  return text.toLowerCase().includes(q);
}

export interface Selection { ids: string[]; anchor: string | null }
// A click: plain picks one, Command toggles one, Shift extends from the anchor through the list order.
export function select(sel: Selection, id: string, order: string[], mods: { shift?: boolean; meta?: boolean } = {}): Selection {
  if (mods.shift && sel.anchor && order.includes(sel.anchor)) {
    const [a, b] = [order.indexOf(sel.anchor), order.indexOf(id)].sort((x, y) => x - y);
    return { ids: order.slice(a, b + 1), anchor: sel.anchor };
  }
  if (mods.meta) return { ids: sel.ids.includes(id) ? sel.ids.filter((x) => x !== id) : [...sel.ids, id], anchor: id };
  return { ids: [id], anchor: id };
}
// Arrow keys move a single selection one row.
export function step(sel: Selection, order: string[], by: 1 | -1): Selection {
  const at = sel.anchor ? order.indexOf(sel.anchor) : -1, id = order[Math.max(0, Math.min(order.length - 1, at + by))];
  return id ? { ids: [id], anchor: id } : sel;
}

export function useSelection(order: string[]) {
  const [sel, setSel] = useState<Selection>({ ids: [], anchor: null });
  const ids = sel.ids.filter((id) => order.includes(id));
  return {
    ids,
    set: (next: string[]) => setSel({ ids: next, anchor: next.at(-1) ?? null }),
    click: (id: string, e: MouseEvent) => setSel(select({ ids, anchor: sel.anchor }, id, order, { shift: e.shiftKey, meta: e.metaKey || e.ctrlKey })),
    onKeyDown: (e: KeyboardEvent) => {
      if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
      e.preventDefault();
      setSel(step({ ids, anchor: sel.anchor }, order, e.key === "ArrowDown" ? 1 : -1));
    },
  };
}

export const useFolders = (accountId: string) => {
  const game = useStore((s) => s.game);
  return foldersOf(game, accountId).map((f) => ({ ...f, unread: unread(game, accountId, f.id) }));
};

export interface FolderOptions { sort?: SortKey; asc?: boolean; query?: string; scope?: SearchScope }
export const folderRows = (s: GameState, accountId: string, folderId: string, o: FolderOptions = {}): Message[] =>
  sortMessages(s, listFolder(s, accountId, folderId).filter((m) => matches(s, m, o.query ?? "", o.scope)), (m) => m, o.sort ?? "date", o.asc ?? false);
export const useFolder = (accountId: string, folderId: string, o: FolderOptions & { threads?: boolean } = {}) => {
  const game = useStore((s) => s.game), rows = folderRows(game, accountId, folderId, o);
  return { rows, threads: o.threads ? threadsOf(rows, (m) => m) : rows.map((m) => [m]), read: (m: Message) => isRead(game, m) };
};

export const useMessage = (accountId: string, id: string | null) => {
  const game = useStore((s) => s.game), m = id ? (game.mail.msgs[accountId] ?? []).find((x) => x.id === id) : undefined;
  return m ? { m, v: view(game, m) } : null;
};

// Each wrapper runs through the store and returns the error key, null on success.
export function useMailActions(accountId: string) {
  const act = useStore((s) => s.act);
  const run = (r: { ok: boolean; error?: string }) => (r.ok ? null : r.error ?? null);
  return {
    move: (ids: string[], folder: string) => run(act(moveMessages, accountId, ids, folder)),
    remove: (ids: string[]) => run(act(deleteMessages, accountId, ids)),
    restore: (ids: string[]) => run(act(restoreMessages, accountId, ids)),
    mark: (ids: string[], f: Parameters<typeof markMessages>[3]) => run(act(markMessages, accountId, ids, f)),
    junk: (ids: string[], junk: boolean) => run(act(reportJunk, accountId, ids, junk)),
    label: (ids: string[], add: string[], remove: string[]) => run(act(labelMessages, accountId, ids, add, remove)),
    createFolder: (name: string, parent: string | null = null) => run(act(createMailFolder, accountId, name, parent)),
    renameFolder: (id: string, name: string) => run(act(renameMailFolder, accountId, id, name)),
    moveFolder: (id: string, parent: string | null) => run(act(moveMailFolder, accountId, id, parent)),
    deleteFolder: (id: string) => run(act(deleteMailFolder, accountId, id)),
  };
}

export const MAIL_DRAG = "application/x-backbone-mail";
export interface MailDrag { accountId: string; ids: string[] }
export const dragPayload = (accountId: string, ids: string[]): string => JSON.stringify({ accountId, ids } satisfies MailDrag);
export function readDrag(e: Pick<DragEvent, "dataTransfer">): MailDrag | null {
  try { return JSON.parse(e.dataTransfer.getData(MAIL_DRAG)) as MailDrag; } catch { return null; }
}

export const useMailDrag = (accountId: string, ids: string[]) => ({
  draggable: true,
  onDragStart: (e: DragEvent) => { e.dataTransfer.setData(MAIL_DRAG, dragPayload(accountId, ids)); e.dataTransfer.effectAllowed = "copyMove"; },
});

// A drop moves within one mailbox; mail from another mailbox is refused with the no-drop cursor.
export function useFolderDrop(accountId: string, folderId: string, onMove?: (ids: string[]) => void) {
  const [over, setOver] = useState(false);
  const { move } = useMailActions(accountId);
  return {
    over,
    onDragOver: (e: DragEvent) => {
      if (!e.dataTransfer.types.includes(MAIL_DRAG)) return;
      e.preventDefault();
      setOver(true);
    },
    onDragLeave: () => setOver(false),
    onDrop: (e: DragEvent) => {
      setOver(false);
      const d = readDrag(e);
      if (!d || d.accountId !== accountId) return;
      e.preventDefault();
      if (onMove) onMove(d.ids); else move(d.ids, folderId);
    },
  };
}

export interface DraftFields { to: string; cc: string; bcc: string; subject: string; text: string; att: Attachment[]; re?: string }
export interface DraftOps { save: (d: DraftFields) => void; discard: () => void; send: (d: DraftFields) => string | null }
export const draftEmpty = (d: DraftFields): boolean => !d.to.trim() && !d.cc.trim() && !d.bcc.trim() && !d.subject.trim() && !d.text.trim() && !d.att.length;

// An open draft: edits are saved after a pause, an empty draft is discarded when the window goes, send returns the error key.
export function useDraft(initial: DraftFields, ops: DraftOps, delay = 600) {
  const [draft, setDraft] = useState(initial);
  const latest = useRef({ draft, ops, sent: false, timer: 0, alive: false });
  latest.current.draft = draft;
  latest.current.ops = ops;
  useEffect(() => {
    const l = latest.current;
    l.alive = true;
    // Deferred, so a remount in the same tick (React's development double mount) keeps the draft.
    return () => {
      l.alive = false;
      setTimeout(() => {
        if (l.alive || l.sent) return;
        clearTimeout(l.timer);
        if (draftEmpty(l.draft)) l.ops.discard(); else l.ops.save(l.draft);
      }, 0);
    };
  }, []);
  return {
    draft,
    set: (patch: Partial<DraftFields>) => {
      const next = { ...latest.current.draft, ...patch };
      setDraft(next);
      clearTimeout(latest.current.timer);
      latest.current.timer = window.setTimeout(() => latest.current.ops.save(latest.current.draft), delay);
    },
    send: (): string | null => {
      clearTimeout(latest.current.timer);
      const error = latest.current.ops.send(latest.current.draft);
      if (!error) latest.current.sent = true;
      return error;
    },
  };
}
