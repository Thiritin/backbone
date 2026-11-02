// What the toolbar does with the selected rows: server verbs for IMAP accounts, the local ones for POP downloads.
import { t } from "../../../i18n/en";
import { addressesOf, view } from "../../../sim/42-mail/model";
import type { Row } from "../../../sim/43-pear-mail/view";
import type { GameState } from "../../../sim/50-state";
import { deleteMessages, moveMessages, reportJunk } from "../../../sim/90-actions/mailmsg";
import { deletePearMessages, movePearMessages, savePearDraft } from "../../../sim/90-actions/pear-mail";
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
export const moveRows = (act: Act, rows: Row[], folder: string) => each(rows, (ids) => act(movePearMessages, ids, folder), (a, ids) => act(moveMessages, a, ids, folder));

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
