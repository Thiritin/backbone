// Pear Mail's menu bar menus, row and mailbox context menus and keyboard shortcuts, all from one command table so a
// menu shows the key that runs the same thing (docs/design/plans/mail-client.md, Toolbar and menus; Context menus and shortcuts).
import { t } from "../../../i18n/en";
import { isRead } from "../../../sim/42-mail/model";
import { MY_PEAR, type ClientAccount } from "../../../sim/43-pear-mail/state";
import type { Row, SortKey } from "../../../sim/43-pear-mail/view";
import type { GameState } from "../../../sim/50-state";
import { getMail } from "../../../sim/90-actions/pear-mail";
import type { AppMenu, MenuEntry, MenuItem } from "../../desktop/menu";
import type { useStore } from "../../store";
import { customBox, deleteRows, junkRows, markRows, targets, transferRows, type Box } from "./commands";

type Act = ReturnType<typeof useStore.getState>["act"];
export type Sheet = { k: "new" } | { k: "rename"; b: Box } | { k: "delete"; b: Box } | { k: "info"; c: string } | { k: "erase"; folder: "trash" | "junk"; c?: string };
export interface Sort { key: SortKey; asc: boolean }

// What the front Pear Mail window offers the menu bar and the shortcuts, refreshed on every render of the window.
export interface PearCtx {
  game: GameState; act: Act; box: Box; picked: Row[]; home?: ClientAccount;
  sort: Sort; setSort: (s: Sort) => void; threads: boolean; setThreads: (on: boolean) => void;
  reply: (mode: "reply" | "all" | "forward", row?: Row) => void; newMessage: () => void; addAccount: () => void; sheet: (s: Sheet) => void;
  activity: boolean; setActivity: (on: boolean) => void; search: () => void; close: () => void;
}
let live: PearCtx | null = null;
export const setPearCtx = (x: PearCtx | null): void => { live = x; };

const MAC = typeof navigator !== "undefined" && /Mac|iP(hone|ad)/.test(navigator.platform);
const GLYPH: Record<string, string> = { cmd: "⌘", alt: "⌥", shift: "⇧", backspace: "⌫" };
// "cmd+shift+r" as the menu shows it: glyphs on a Mac, Ctrl and words elsewhere, where Control stands in for Command.
export function hint(spec: string): string {
  const parts = spec.split("+"), key = parts.pop()!, mods = ["alt", "shift", "cmd"].filter((m) => parts.includes(m));
  if (MAC) return [...mods.map((m) => GLYPH[m]), GLYPH[key] ?? key.toUpperCase()].join("");
  const word: Record<string, string> = { cmd: "Ctrl", alt: "Alt", shift: "Shift", backspace: "Del" };
  return [...["cmd", "alt", "shift"].filter((m) => parts.includes(m)).map((m) => word[m]), word[key] ?? key.toUpperCase()].join("+");
}
export function pressed(e: KeyboardEvent, spec: string): boolean {
  const parts = spec.split("+"), key = parts.pop()!;
  const cmd = MAC ? e.metaKey : e.ctrlKey;
  if (cmd !== parts.includes("cmd") || e.altKey !== parts.includes("alt") || e.shiftKey !== parts.includes("shift")) return false;
  if (key === "backspace") return e.code === "Backspace" || e.code === "Delete";
  return e.code === (/\d/.test(key) ? `Digit${key}` : `Key${key.toUpperCase()}`);
}

interface Cmd { label: string; key?: string; run: () => void; disabled?: boolean; checked?: boolean }
const item = (c: Cmd): MenuItem => ({ label: c.label, run: c.run, disabled: c.disabled, checked: c.checked, key: c.key && hint(c.key) });

// One account's rows, or nothing when a selection spans accounts.
const oneAccount = (rows: Row[]): ClientAccount | undefined => (rows.length && rows.every((r) => r.c.id === rows[0].c.id) ? rows[0].c : undefined);

function messageCmds(x: PearCtx, rows: Row[]) {
  const { act } = x, one = rows.length === 1 ? rows[0] : undefined, read = rows.length > 0 && rows.every((r) => isRead(x.game, r.m));
  const flagged = rows.length > 0 && rows.every((r) => r.m.star), junk = x.box.f === "junk";
  return {
    reply: { label: t("pearMail.reply"), key: "cmd+r", run: () => x.reply("reply", one), disabled: !one },
    replyAll: { label: t("pearMail.replyAll"), key: "cmd+shift+r", run: () => x.reply("all", one), disabled: !one },
    forward: { label: t("pearMail.forward"), key: "cmd+shift+f", run: () => x.reply("forward", one), disabled: !one },
    remove: { label: t("pearMail.delete"), key: "backspace", run: () => deleteRows(act, rows), disabled: !rows.length },
    junk: { label: t(junk ? "pearMail.notJunk" : "pearMail.junk"), key: "cmd+shift+j", run: () => junkRows(act, rows, !junk), disabled: !rows.length },
    read: { label: t(read ? "pearMail.mark.unread" : "pearMail.mark.read"), key: "cmd+shift+u", run: () => markRows(act, rows, { read: !read }), disabled: !rows.length },
    flag: { label: t(flagged ? "pearMail.mark.unflagged" : "pearMail.mark.flagged"), key: "cmd+shift+l", run: () => markRows(act, rows, { star: !flagged }), disabled: !rows.length },
  } satisfies Record<string, Cmd>;
}

function appCmds(x: PearCtx) {
  const { act, game, box } = x, mine = customBox(game, box);
  const imap = box.c && box.c !== MY_PEAR ? game.pearMail.accounts.find((c) => c.id === box.c && c.protocol === "imap") : undefined;
  const info = imap ?? game.pearMail.accounts.find((c) => c.protocol === "imap");
  return {
    newMessage: { label: t("pearMail.newMessage"), key: "cmd+alt+n", run: x.newMessage, disabled: !x.home },
    newMailbox: { label: t("pearMail.box.new"), run: () => x.sheet({ k: "new" }) },
    addAccount: { label: t("pearMail.add.menu"), run: x.addAccount },
    close: { label: t("desktop.close"), key: "cmd+alt+w", run: x.close },
    getMail: { label: t("pearMail.getAllMail"), key: "cmd+shift+g", run: () => act(getMail), disabled: !game.pearMail.accounts.length },
    eraseTrash: { label: t("pearMail.erase.trash"), key: "cmd+shift+backspace", run: () => x.sheet({ k: "erase", folder: "trash" }) },
    eraseJunk: { label: t("pearMail.erase.junk"), key: "cmd+alt+j", run: () => x.sheet({ k: "erase", folder: "junk" }) },
    rename: { label: t("pearMail.box.rename"), run: () => x.sheet({ k: "rename", b: box }), disabled: !mine },
    remove: { label: t("pearMail.box.delete"), run: () => x.sheet({ k: "delete", b: box }), disabled: !mine },
    info: { label: t("pearMail.info"), run: () => info && x.sheet({ k: "info", c: info.id }), disabled: !info },
    search: { label: t("pearMail.search"), key: "cmd+alt+f", run: x.search },
    activity: { label: t("pearMail.activity"), key: "cmd+alt+0", run: () => x.setActivity(!x.activity), checked: x.activity },
  } satisfies Record<string, Cmd>;
}

// Move To and Copy To: each place a message of the selection may go, by account.
function fileItems(x: PearCtx, rows: Row[], copy: boolean): MenuEntry[] {
  const c = oneAccount(rows);
  if (!c) return [];
  const depth = (id: string | null, all: { id: string; parent: string | null }[]): number => (id ? 1 + depth(all.find((f) => f.id === id)?.parent ?? null, all) : 0);
  return targets(x.game, c).map((g) => ({
    label: g.label,
    items: g.folders.map((f) => ({ label: `${" ".repeat(depth(f.parent, g.folders))}${f.name}`, run: () => transferRows(x.act, rows, { c: g.c, f: f.id }, copy), disabled: !copy && g.c === c.id && x.box.f === f.id })),
  }));
}

// The message context menu and the Message menu share these entries.
export function messageMenu(x: PearCtx, rows: Row[]): MenuEntry[] {
  const m = messageCmds(x, rows);
  return [
    item(m.reply), item(m.replyAll), item(m.forward), null,
    { label: t("pearMail.mark"), disabled: !rows.length, items: [item(m.read), item(m.flag)] },
    { label: t("pearMail.moveTo"), disabled: !oneAccount(rows), items: fileItems(x, rows, false) },
    { label: t("pearMail.copyTo"), disabled: !oneAccount(rows), items: fileItems(x, rows, true) },
    null, item(m.remove), item(m.junk),
  ];
}

// The context menu of a mailbox row or an account header (f null).
export function mailboxMenu(x: PearCtx, c: string | null, f: string | null): MenuEntry[] {
  const b: Box = { c, f: f ?? "" }, mine = f ? customBox(x.game, b) : undefined;
  const imap = c ? x.game.pearMail.accounts.find((a) => a.id === c && a.protocol === "imap") : undefined;
  return [
    imap && { label: t("pearMail.info"), run: () => x.sheet({ k: "info", c: imap.id }) },
    (imap || c === MY_PEAR) && { label: t("pearMail.box.new"), run: () => x.sheet({ k: "new" }) },
    mine && { label: t("pearMail.box.rename"), run: () => x.sheet({ k: "rename", b }) },
    mine && { label: t("pearMail.box.delete"), run: () => x.sheet({ k: "delete", b }) },
    null,
    f === "trash" && { label: t("pearMail.erase.trash"), run: () => x.sheet({ k: "erase", folder: "trash", c: c ?? undefined }) },
    f === "junk" && { label: t("pearMail.erase.junk"), run: () => x.sheet({ k: "erase", folder: "junk", c: c ?? undefined }) },
  ];
}

// The titles stand before the window has rendered once, so the menu bar draws them with the window.
const TITLES = ["file", "view", "mailbox", "message"] as const;
export function pearMenus(): AppMenu[] {
  const x = live;
  if (!x) return TITLES.map((id) => ({ id, title: t(id === "message" ? "pearMail.message" : `pearMail.menu.${id}`), items: [] }));
  const a = appCmds(x), sortBy = (k: SortKey): MenuItem => ({ label: t(k === "from" && (x.box.f === "sent" || x.box.f === "drafts") ? "pearMail.col.to" : `pearMail.col.${k}`), checked: x.sort.key === k, run: () => x.setSort({ key: k, asc: k !== "date" }) });
  return [
    { id: "file", title: t("pearMail.menu.file"), items: [item(a.newMessage), item(a.newMailbox), item(a.addAccount), null, item(a.close)] },
    { id: "view", title: t("pearMail.menu.view"), items: [
      { label: t("pearMail.sortBy"), items: (["from", "subject", "date"] as SortKey[]).map(sortBy) },
      { label: t("pearMail.organize"), checked: x.threads, run: () => x.setThreads(!x.threads) },
    ] },
    { id: "mailbox", title: t("pearMail.menu.mailbox"), items: [
      item(a.getMail), null, item(a.eraseTrash), item(a.eraseJunk), null, item(a.newMailbox), item(a.rename), item(a.remove), null, item(a.info),
    ] },
    { id: "message", title: t("pearMail.message"), items: messageMenu(x, x.picked) },
    { id: "window", title: "", items: [item(a.activity)] },
  ];
}

// Runs the command whose key was pressed. Keys without Command wait while a field has focus.
export function runShortcut(e: KeyboardEvent): boolean {
  const x = live;
  if (!x) return false;
  const typing = !!(e.target as Element | null)?.closest?.("input, textarea, select, [contenteditable]");
  const all: Cmd[] = [...Object.values(appCmds(x)), ...Object.values(messageCmds(x, x.picked))];
  const c = all.find((k) => k.key && pressed(e, k.key) && !(typing && !k.key.includes("cmd")));
  if (!c || c.disabled) return false;
  e.preventDefault();
  c.run();
  return true;
}
