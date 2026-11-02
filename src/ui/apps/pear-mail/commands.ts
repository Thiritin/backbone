// What the toolbar does with the selected rows: server verbs for IMAP accounts, the local ones for POP downloads.
import { t } from "../../../i18n/en";
import { addressesOf, view } from "../../../sim/42-mail/model";
import type { Folder } from "../../../sim/42-mail/types";
import { MY_PEAR, type ClientAccount } from "../../../sim/43-pear-mail/state";
import { clientFolders, myFolders, type Row } from "../../../sim/43-pear-mail/view";
import type { GameState } from "../../../sim/50-state";
import type { ActionResult } from "../../../sim/90-actions/hardware";
import { createMailFolder, deleteMailFolder, deleteMessages, markMessages, moveMailFolder, renameMailFolder, reportJunk } from "../../../sim/90-actions/mailmsg";
import {
  createPearFolder, deletePearFolder, deletePearMessages, markPearMessages, movePearFolder, movePearMessages, renamePearFolder, savePearDraft, transferMessages,
} from "../../../sim/90-actions/pear-mail";
import { useStore } from "../../store";
import { mailDate } from "./List";

type Act = ReturnType<typeof useStore.getState>["act"];

function each(rows: Row[], pop: (ids: string[]) => void, imap: (accountId: string, ids: string[]) => void): void {
  const local = rows.filter((r) => r.c.protocol === "pop").map((r) => r.m.id);
  if (local.length) pop(local);
  for (const c of new Set(rows.filter((r) => r.c.protocol === "imap").map((r) => r.c))) imap(c.accountId, rows.filter((r) => r.c === c).map((r) => r.m.id));
}

export const deleteRows = (act: Act, rows: Row[]) => each(rows, (ids) => act(deletePearMessages, ids), (a, ids) => act(deleteMessages, a, ids, "imap"));
export const junkRows = (act: Act, rows: Row[], junk: boolean) =>
  each(rows, (ids) => act(movePearMessages, ids, junk ? "junk" : "inbox"), (a, ids) => act(reportJunk, a, ids, junk));
export const markRows = (act: Act, rows: Row[], f: { read?: boolean; star?: boolean }) => each(rows, (ids) => act(markPearMessages, ids, f), (a, ids) => act(markMessages, a, ids, f));

// The sidebar's Smart Mailboxes: Box c for a Smart Mailbox, whose f is its id.
export const SMART = "smart";
// A mailbox in the sidebar: c null is the unified mailbox over every enabled account.
export interface Box { c: string | null; f: string }
// Moves or copies each account's rows into a mailbox; a unified target means the same mailbox of each row's own account.
export function transferRows(act: Act, rows: Row[], to: Box, copy = false): void {
  for (const c of new Set(rows.map((r) => r.c.id))) act(transferMessages, c, rows.filter((r) => r.c.id === c).map((r) => r.m.id), to.c ?? c, to.f, copy);
}

// Where a message of c can go: its own account's mailboxes and On My Pear; On My Pear mail can go to any account.
export function targets(s: GameState, c: ClientAccount): { c: string; label: string; folders: Folder[] }[] {
  const of = (x: ClientAccount) => ({ c: x.id, label: x.description, folders: clientFolders(s, x) });
  const mine = { c: MY_PEAR, label: t("pearMail.onMyPear"), folders: myFolders(s) };
  return c.id === MY_PEAR ? [...s.pearMail.accounts.filter((x) => x.enabled).map(of), mine] : [of(c), ...(mine.folders.length ? [mine] : [])];
}

// A mailbox the player made: a server folder of an IMAP account or an On My Pear one.
export function customBox(s: GameState, b: Box): Folder | undefined {
  if (b.c === MY_PEAR) return myFolders(s).find((f) => f.id === b.f);
  const a = b.c ? accountOf(s, b.c) : "";
  return a ? s.mail.folders.find((f) => f.id === b.f && f.accountId === a) : undefined;
}
export const accountOf = (s: GameState, clientId: string): string => s.pearMail.accounts.find((c) => c.id === clientId)?.accountId ?? "";

// Folder verbs on the server for an IMAP account, locally for On My Pear; run is the store's act or attempt.
export function mailboxOps(s: GameState, run: Act, c: string) {
  const a = accountOf(s, c), mine = c === MY_PEAR;
  return {
    create: (name: string, parent: string | null): ActionResult => (mine ? run(createPearFolder, name, parent) : run(createMailFolder, a, name, parent)),
    rename: (id: string, name: string): ActionResult => (mine ? run(renamePearFolder, id, name) : run(renameMailFolder, a, id, name)),
    nest: (id: string, parent: string | null): ActionResult => (mine ? run(movePearFolder, id, parent) : run(moveMailFolder, a, id, parent)),
    remove: (id: string): ActionResult => (mine ? run(deletePearFolder, id) : run(deleteMailFolder, a, id)),
  };
}

const prefixed = (key: string, subject: string, tag: RegExp) => (tag.test(subject) ? subject : t(key, { subject }));

// Opens a compose window on a new draft: empty, or a reply or forward of one message.
export function compose(s: GameState, act: Act, clientId: string, row?: Row, mode?: "reply" | "all" | "forward"): void {
  let d = { to: [] as string[], cc: [] as string[], subject: "", text: "", att: row?.m.att, re: undefined as string | undefined };
  if (row && mode) {
    const v = view(s, row.m), box = s.mail.accounts.find((a) => a.id === row.c.accountId), own = new Set(box ? addressesOf(box) : []);
    if (mode === "forward") {
      const head = [t("pearMail.forwarded"), `${t("pearMail.field.from")} ${v.fromName} <${v.fromAddress}>`, `${t("pearMail.field.subject")} ${v.subject}`, `${t("pearMail.field.date")} ${mailDate(row.m.at)}`, `${t("pearMail.field.to")} ${v.to}`];
      d = { ...d, subject: prefixed("pearMail.fwdSubject", v.subject, /^fwd?:/i), text: `\n\n${head.join("\n")}\n\n${v.text}` };
    } else {
      const others = mode === "all" ? [v.to, ...v.cc].flatMap((x) => x.split(",")).map((x) => x.trim().toLowerCase()).filter((x) => x && !own.has(x) && x !== v.fromAddress) : [];
      const quote = v.text.split("\n").map((l) => `> ${l}`).join("\n");
      d = { ...d, to: [v.fromAddress], cc: others, att: undefined, re: row.m.id, subject: prefixed("pearMail.reSubject", v.subject, /^re:/i), text: `\n\n${t("pearMail.quote", { date: mailDate(row.m.at), name: v.fromName })}\n${quote}` };
    }
  }
  const r = act(savePearDraft, clientId, d);
  if (r.ok && r.id) useStore.getState().openCompose(r.id);
}
