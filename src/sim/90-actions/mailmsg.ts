// Folder and message actions (docs/design/plans/mail-core.md, Folders, messages and actions). Each takes the mailbox id
// first and a batch of message ids, so a client changes a selection with one action.
import { nowMinutes, yearOf } from "../00-core/time";
import { capsOf } from "../42-mail/caps";
import { deliver, drop, kbOf, store } from "../42-mail/deliver";
import { ownsAddress, SYS_FOLDERS, tenantOf } from "../42-mail/model";
import type { Attachment, Folder, MailAccount, Message } from "../42-mail/types";
import type { GameState } from "../50-state";
import { freeSpot } from "./docs";
import type { ActionResult } from "./hardware";
import { respond, RESPONDERS } from "./paperwork";

const fail = (error: string): ActionResult => ({ ok: false, error });
const ok: ActionResult = { ok: true };
const box = (s: GameState, id: string): MailAccount | undefined => s.mail.accounts.find((a) => a.id === id && a.closedAt === null);
const msgsOf = (s: GameState, id: string): Message[] => s.mail.msgs[id] ?? [];
const setBox = (s: GameState, id: string, msgs: Message[]): void => { s.mail = { ...s.mail, msgs: { ...s.mail.msgs, [id]: msgs } }; };
const patchAccount = (s: GameState, id: string, p: Partial<MailAccount>): void => {
  s.mail = { ...s.mail, accounts: s.mail.accounts.map((a) => (a.id === id ? { ...a, ...p } : a)) };
};
const edit = (s: GameState, id: string, ids: string[], fn: (m: Message) => Message): void => {
  const want = new Set(ids);
  setBox(s, id, msgsOf(s, id).map((m) => (want.has(m.id) ? fn(m) : m)));
};
const customOf = (s: GameState, account: string, id: string): Folder | undefined => s.mail.folders.find((f) => f.id === id && f.accountId === account);
const isFolder = (s: GameState, account: string, id: string): boolean => (SYS_FOLDERS as string[]).includes(id) || !!customOf(s, account, id);
const toTrash = (m: Message): Message => (m.folder === "trash" ? m : { ...m, folder: "trash", prev: m.folder });

const MAX_TEXT = 2000, FOLDER_DEPTH = 3, SNOOZE_MAX = 50;

// Moving to a label on a label host adds the label and takes the message out of the Inbox.
export function moveMessages(s: GameState, account: string, ids: string[], folder: string): ActionResult {
  const a = box(s, account);
  if (!a) return fail("error.mailUnknown");
  if (!isFolder(s, account, folder)) return fail("error.mailNoFolder");
  const label = customOf(s, account, folder)?.label;
  edit(s, account, ids, (m) => label
    ? { ...m, labels: [...new Set([...(m.labels ?? []), folder])], folder: m.folder === "inbox" ? "archive" : m.folder }
    : folder === "trash" ? toTrash(m) : { ...m, folder });
  if (folder === "junk") patchAccount(s, account, { trained: a.trained + ids.length });
  return ok;
}

// Outside Trash a delete moves to Trash; in Trash it removes for good. An IMAP client's delete follows prefs.imapDelete:
// flag keeps the message where it is and marks it read.
export function deleteMessages(s: GameState, account: string, ids: string[], via?: "imap"): ActionResult {
  const a = box(s, account);
  if (!a) return fail("error.mailUnknown");
  const mode = via === "imap" ? a.prefs?.imapDelete ?? "trash" : "trash";
  if (mode === "expunge") return expungeMessages(s, account, ids);
  if (mode === "flag") { edit(s, account, ids, (m) => ({ ...m, read: true })); return ok; }
  const want = new Set(ids);
  drop(s, account, new Set(msgsOf(s, account).filter((m) => want.has(m.id) && m.folder === "trash").map((m) => m.id)));
  edit(s, account, ids, toTrash);
  return ok;
}

export function restoreMessages(s: GameState, account: string, ids: string[]): ActionResult {
  if (!box(s, account)) return fail("error.mailUnknown");
  edit(s, account, ids, ({ prev, ...m }) => (m.folder === "trash" || m.folder === "junk" ? { ...m, folder: prev && prev !== "trash" && isFolder(s, account, prev) ? prev : "inbox" } : m));
  return ok;
}

export function expungeMessages(s: GameState, account: string, ids: string[]): ActionResult {
  if (!box(s, account)) return fail("error.mailUnknown");
  drop(s, account, new Set(ids));
  return ok;
}

export function emptyFolder(s: GameState, account: string, folder: "trash" | "junk"): ActionResult {
  if (!box(s, account)) return fail("error.mailUnknown");
  drop(s, account, new Set(msgsOf(s, account).filter((m) => m.folder === folder).map((m) => m.id)));
  return ok;
}

// A ticket thread's read state is the ticket's, so marking it read in a mailbox reads it on the desk too.
export function markMessages(s: GameState, account: string, ids: string[], f: { read?: boolean; star?: boolean; ans?: boolean; flag?: number | null }): ActionResult {
  if (!box(s, account)) return fail("error.mailUnknown");
  const set = (m: Message, k: "read" | "star" | "ans", v: boolean | undefined): Message => {
    if (v === undefined) return m;
    const { [k]: _old, ...rest } = m;
    return v ? { ...rest, [k]: true } : rest;
  };
  edit(s, account, ids, (m) => {
    let n = set(set(set(m, "read", f.read), "star", f.star), "ans", f.ans);
    if (f.flag !== undefined) { const { flag: _f, ...rest } = n; n = f.flag ? { ...rest, flag: f.flag } : rest; }
    return n;
  });
  if (f.read !== undefined) {
    const want = new Set(ids), tickets = new Set(msgsOf(s, account).filter((m) => want.has(m.id) && m.ticket).map((m) => m.ticket!));
    if (tickets.size) s.tickets = s.tickets.map((t) => (tickets.has(t.id) ? { ...t, unread: !f.read } : t));
  }
  return ok;
}

export function labelMessages(s: GameState, account: string, ids: string[], add: string[], remove: string[]): ActionResult {
  const a = box(s, account);
  if (!a) return fail("error.mailUnknown");
  if (!capsOf(s, a).labels) return fail("error.mailNoLabels");
  if (![...add, ...remove].every((id) => customOf(s, account, id)?.label)) return fail("error.mailNoFolder");
  edit(s, account, ids, (m) => {
    const labels = [...new Set([...(m.labels ?? []), ...add])].filter((l) => !remove.includes(l));
    const { labels: _l, ...rest } = m;
    return labels.length ? { ...rest, labels } : rest;
  });
  return ok;
}

export function setFolderStyle(s: GameState, account: string, id: string, style: { colour?: number; hidden?: boolean }): ActionResult {
  if (!customOf(s, account, id)) return fail("error.mailNoFolder");
  s.mail = { ...s.mail, folders: s.mail.folders.map((f) => {
    if (f.id !== id) return f;
    const { colour: _c, hidden: _h, ...rest } = f;
    const colour = style.colour ?? f.colour, hidden = style.hidden ?? !!f.hidden;
    return { ...rest, ...(colour !== undefined && { colour }), ...(hidden && { hidden: true as const }) };
  }) };
  return ok;
}

// A snoozed message leaves its list until the hour, then returns to the top of the Inbox as unread.
export function snoozeMessages(s: GameState, account: string, ids: string[], until: number | null): ActionResult {
  if (!box(s, account)) return fail("error.mailUnknown");
  const mine = new Set(msgsOf(s, account).map((m) => m.id)), pick = ids.filter((id) => mine.has(id));
  const rest = s.mail.snoozed.filter((x) => !(x.account === account && pick.includes(x.id)));
  if (until === null) {
    s.mail = { ...s.mail, snoozed: rest };
    edit(s, account, pick, ({ snooze: _s, ...m }) => m);
    return ok;
  }
  if (until <= s.hour) return fail("error.mailSnooze");
  if (rest.filter((x) => x.account === account).length + pick.length > SNOOZE_MAX) return fail("error.mailSnoozeMax");
  s.mail = { ...s.mail, snoozed: [...rest, ...pick.map((id) => ({ account, id, until }))] };
  edit(s, account, pick, (m) => ({ ...m, snooze: until }));
  return ok;
}

const depthOf = (s: GameState, id: string | null): number => {
  let n = 0;
  for (let f = id ? s.mail.folders.find((x) => x.id === id) : undefined; f; f = f.parent ? s.mail.folders.find((x) => x.id === f!.parent) : undefined) n++;
  return n;
};
const subtree = (s: GameState, id: string): string[] => [id, ...s.mail.folders.filter((f) => f.parent === id).flatMap((f) => subtree(s, f.id))];
const height = (s: GameState, id: string): number => 1 + Math.max(0, ...s.mail.folders.filter((f) => f.parent === id).map((f) => height(s, f.id)));
const nameTaken = (s: GameState, account: string, parent: string | null, name: string, except?: string): boolean =>
  (parent === null && SYS_FOLDERS.some((x) => x === name.toLowerCase())) ||
  s.mail.folders.some((f) => f.accountId === account && f.parent === parent && f.id !== except && f.name.toLowerCase() === name.toLowerCase());

// Custom folders nest three deep; on a label host they are labels.
export function createFolder(s: GameState, account: string, name: string, parent: string | null = null): ActionResult {
  const a = box(s, account), n = name.trim();
  if (!a) return fail("error.mailUnknown");
  if (parent !== null && !customOf(s, account, parent)) return fail("error.mailNoFolder");
  if (!n || n.length > 40 || nameTaken(s, account, parent, n)) return fail("error.mailFolderName");
  if (depthOf(s, parent) + 1 > FOLDER_DEPTH) return fail("error.mailFolderDepth");
  const caps = capsOf(s, a);
  if (s.mail.folders.filter((f) => f.accountId === account).length >= caps.folderMax) return fail("error.mailFolder");
  const f: Folder = { id: `fd${s.nextId++}`, accountId: account, name: n, parent, ...(caps.labels && { label: true as const }) };
  s.mail = { ...s.mail, folders: [...s.mail.folders, f] };
  return { ok: true, id: f.id };
}

export function renameFolder(s: GameState, account: string, id: string, name: string): ActionResult {
  const f = customOf(s, account, id), n = name.trim();
  if (!f) return fail("error.mailNoFolder");
  if (!n || n.length > 40 || nameTaken(s, account, f.parent, n, id)) return fail("error.mailFolderName");
  s.mail = { ...s.mail, folders: s.mail.folders.map((x) => (x.id === id ? { ...x, name: n } : x)) };
  return ok;
}

export function moveFolder(s: GameState, account: string, id: string, parent: string | null): ActionResult {
  const f = customOf(s, account, id);
  if (!f || (parent !== null && !customOf(s, account, parent)) || (parent && subtree(s, id).includes(parent))) return fail("error.mailNoFolder");
  if (nameTaken(s, account, parent, f.name, id)) return fail("error.mailFolderName");
  if (depthOf(s, parent) + height(s, id) > FOLDER_DEPTH) return fail("error.mailFolderDepth");
  s.mail = { ...s.mail, folders: s.mail.folders.map((x) => (x.id === id ? { ...x, parent } : x)) };
  return ok;
}

// On a folder host the folder's mail goes to Trash; on a label host only the label goes.
export function deleteFolder(s: GameState, account: string, id: string): ActionResult {
  if (!customOf(s, account, id)) return fail("error.mailNoFolder");
  const gone = new Set(subtree(s, id));
  setBox(s, account, msgsOf(s, account).map((m) => {
    const labels = m.labels?.filter((l) => !gone.has(l));
    const { labels: _l, ...rest } = m, n: Message = labels?.length ? { ...rest, labels } : rest;
    return gone.has(n.folder) ? { ...n, folder: "trash" } : gone.has(n.prev ?? "") ? { ...n, prev: "inbox" } : n;
  }));
  s.mail = { ...s.mail, folders: s.mail.folders.filter((f) => !gone.has(f.id)) };
  return ok;
}

export interface Draft { to: string[]; cc?: string[]; bcc?: string[]; subject: string; text: string; att?: Attachment[]; re?: string }
const own = (d: { subject: string; text: string }) => ({ subject: d.subject.trim().slice(0, 200), text: d.text.slice(0, MAX_TEXT) });
const list = (xs: string[] | undefined): string[] => (xs ?? []).flatMap((x) => x.split(",")).map((x) => x.trim().toLowerCase()).filter(Boolean);

export function saveDraft(s: GameState, account: string, d: Draft & { id?: string }): ActionResult {
  const a = box(s, account);
  if (!a) return fail("error.mailUnknown");
  const old = d.id ? msgsOf(s, account).find((m) => m.id === d.id && m.draft) : undefined;
  if (old) drop(s, account, new Set([old.id]));
  const id = old?.id ?? `msg${s.nextId++}`, cc = list(d.cc), bcc = list(d.bcc);
  store(s, box(s, account)!, {
    id, thread: id, folder: "drafts", from: `acct:${account}`, to: list(d.to).join(", "), ...(cc.length && { cc }), ...(bcc.length && { bcc }),
    kind: "reply", topic: "", own: own(d), ...(d.att?.length && { att: d.att }), ...(d.re && { re: d.re }), draft: true, read: true,
    at: nowMinutes(s), kb: kbOf("reply", yearOf(s.hour), d.att, true),
  });
  return { ok: true, id };
}

export function discardDraft(s: GameState, account: string, id: string): ActionResult {
  if (!msgsOf(s, account).some((m) => m.id === id && m.draft)) return fail("error.mailUnknown");
  drop(s, account, new Set([id]));
  return ok;
}

// Every recipient, bcc included, goes through delivery; the delivered copies carry no bcc and the Sent copy keeps it.
export function sendMessage(s: GameState, account: string, m: Draft & { from: string; fwd?: string; draftId?: string; auto?: boolean }): ActionResult {
  const a = box(s, account), t = a && tenantOf(s, a);
  if (!a || !t || t.locked || (t.endsAt !== null && t.endsAt <= s.hour)) return fail("error.mailNoService");
  if (!ownsAddress(a, m.from)) return fail("error.mailFrom");
  const to = list(m.to), cc = list(m.cc), bcc = list(m.bcc), all = [...new Set([...to, ...cc, ...bcc])];
  if (!all.length) return fail("error.mailAddress");
  const caps = capsOf(s, a), att = m.att ?? [];
  if (att.some((x) => x.k === "file" && x.kb > caps.attachMb * 1024)) return fail("error.mailAttach");
  const body = own(m), doc = att.find((x) => x.k === "doc");
  for (const r of all.filter((x) => RESPONDERS.includes(x))) {
    const res = respond(s, r, body.subject, doc?.k === "doc" ? doc.id : null);
    if (!res.ok) return res;
  }
  const thread = m.re ? msgsOf(s, account).find((x) => x.id === m.re)?.thread : undefined;
  const foot = caps.footer ?? undefined, auto = m.auto ? (true as const) : undefined;
  // A malformed address or an unknown domain comes back from the daemon.
  const results = all.map((r) => deliver(s, { to: r, from: `acct:${account}`, kind: "reply", own: body, att, ...(cc.length && { cc }), re: m.re, thread, foot, auto }));
  if (m.draftId) drop(s, account, new Set(msgsOf(s, account).filter((x) => x.id === m.draftId && x.draft).map((x) => x.id)));
  if (m.re) edit(s, account, [m.re], (x) => ({ ...x, ans: true }));
  if (m.fwd) edit(s, account, [m.fwd], (x) => ({ ...x, fwd: true }));
  if (results.every((r) => r.result === "bounced")) return ok;
  const id = `msg${s.nextId++}`;
  store(s, box(s, account)!, {
    id, thread: thread ?? id, folder: "sent", from: `acct:${account}`, to: to.join(", "), ...(cc.length && { cc }), ...(bcc.length && { bcc }),
    kind: "reply", topic: "", own: body, ...(att.length && { att }), ...(m.re && { re: m.re }), ...(foot && { foot }), ...(auto && { auto }), read: true,
    at: nowMinutes(s), kb: kbOf("reply", yearOf(s.hour), att, true),
  });
  return { ok: true, id };
}

export function setVacation(s: GameState, account: string, v: { on: boolean; subject: string; text: string; until: number | null } | null): ActionResult {
  if (!box(s, account)) return fail("error.mailUnknown");
  if (v && v.until !== null && v.until <= s.hour) return fail("error.mailVacation");
  patchAccount(s, account, { vacation: v && { on: v.on, ...own(v), until: v.until } });
  return ok;
}

// Frees the mail the retention pass folded away.
export function purgeOlder(s: GameState, account: string): ActionResult {
  const a = box(s, account);
  if (!a) return fail("error.mailUnknown");
  patchAccount(s, account, { usedKb: Math.max(0, a.usedKb - a.older.kb), older: { n: 0, kb: 0 } });
  return ok;
}

// Junk reports train an own server's filter either way.
export function reportJunk(s: GameState, account: string, ids: string[], junk: boolean): ActionResult {
  const a = box(s, account);
  if (!a) return fail("error.mailUnknown");
  edit(s, account, ids, (m) => (junk ? { ...m, folder: "junk" } : m.folder === "junk" ? { ...m, folder: "inbox" } : m));
  patchAccount(s, account, { trained: a.trained + ids.length });
  return ok;
}

// A document attachment is copied to the desktop as a new document; a file becomes a note named after it.
export function saveAttachment(s: GameState, account: string, id: string, index: number): ActionResult {
  const att = msgsOf(s, account).find((m) => m.id === id)?.att?.[index];
  const src = att?.k === "doc" ? s.docs.find((d) => d.id === att.id) : undefined;
  if (!att || (att.k !== "doc" && att.k !== "file") || (att.k === "doc" && !src)) return fail("error.mailNoAttachment");
  const doc = { ...(src ?? { kind: "note" as const, title: att.k === "file" ? att.name : "", body: "" }), id: `doc${s.nextId++}`, ...freeSpot(s) };
  s.docs = [...s.docs, doc];
  return { ok: true, id: doc.id };
}
