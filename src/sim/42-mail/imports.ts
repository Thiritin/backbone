// importMailPair (docs/design/plans/mail-core.md, Tenants and provider lifecycle): one mailbox's mail, custom folders and
// server filters copied into another, after a run that grows with the stored kilobytes. The source is left as it was.
import type { GameState } from "../50-state";
import { capsOf } from "./caps";
import { store } from "./deliver";
import { SYS_FOLDERS } from "./model";
import type { Folder, MailAct, MailImport, Message, SysFolder } from "./types";

export const IMPORT_KB_HOUR = 10240;
export const importHours = (kb: number): number => Math.max(2, Math.ceil(kb / IMPORT_KB_HOUR));
const num = (id: string): number => Number(id.replace(/\D/g, "")) || 0;
const isSys = (f: string): f is SysFolder => (SYS_FOLDERS as string[]).includes(f);
const copied = (m: Message): boolean => m.folder !== "trash" && m.folder !== "junk" && !m.draft;

// Queues the run; mail numbered below the current id is what it copies, past what an earlier run of the pair took.
export function queueImport(s: GameState, from: string, to: string): MailImport {
  const since = Math.max(0, ...s.mail.imports.filter((x) => x.from === from && x.to === to).map((x) => x.upTo));
  const kb = (s.mail.msgs[from] ?? []).filter((m) => copied(m) && num(m.id) >= since).reduce((n, m) => n + m.kb, 0);
  const job: MailImport = { id: `imp${s.nextId++}`, from, to, since, upTo: s.nextId, doneAt: s.hour + importHours(kb), n: null };
  s.mail = { ...s.mail, imports: [...s.mail.imports, job] };
  return job;
}

// Folders by source id, created at the target under the same name and parent where the target has room.
function mapFolders(s: GameState, from: string, to: string): Map<string, string> {
  const ids = new Map<string, string>(), label = capsOf(s, s.mail.accounts.find((a) => a.id === to)!).labels;
  for (const f of s.mail.folders.filter((x) => x.accountId === from)) {
    const parent = f.parent === null ? null : ids.get(f.parent) ?? null;
    const same = s.mail.folders.find((x) => x.accountId === to && x.parent === parent && x.name.toLowerCase() === f.name.toLowerCase());
    if (same) { ids.set(f.id, same.id); continue; }
    const target = s.mail.accounts.find((a) => a.id === to)!;
    if (s.mail.folders.filter((x) => x.accountId === to).length >= capsOf(s, target).folderMax) continue;
    const made: Folder = { id: `fd${s.nextId++}`, accountId: to, name: f.name, parent, ...(label && { label: true as const }), ...(f.colour !== undefined && { colour: f.colour }) };
    s.mail = { ...s.mail, folders: [...s.mail.folders, made] };
    ids.set(f.id, made.id);
  }
  return ids;
}

// A label host files custom folders as labels on archived mail; a folder host takes a message's first label as its folder.
function place(m: Message, ids: Map<string, string>, labels: boolean): Pick<Message, "folder" | "labels"> {
  const tags = [...(isSys(m.folder) ? [] : [m.folder]), ...(m.labels ?? [])].map((x) => ids.get(x)).filter((x): x is string => !!x);
  const sys = isSys(m.folder) ? m.folder : "archive";
  if (labels) return { folder: sys, ...(tags.length && { labels: tags }) };
  return { folder: sys === "archive" && tags.length ? tags[0] : sys };
}

function finish(s: GameState, job: MailImport): void {
  const src = s.mail.accounts.find((a) => a.id === job.from), dst = s.mail.accounts.find((a) => a.id === job.to && a.closedAt === null);
  let n = 0;
  if (src && dst) {
    const ids = mapFolders(s, src.id, dst.id), labels = capsOf(s, dst).labels;
    for (const m of (s.mail.msgs[src.id] ?? []).filter((x) => copied(x) && num(x.id) >= job.since && num(x.id) < job.upTo)) {
      const { labels: _l, prev: _p, ...rest } = m;
      store(s, s.mail.accounts.find((a) => a.id === dst.id)!, { ...rest, id: `msg${s.nextId++}`, ...place(m, ids, labels) });
      n++;
    }
    const room = capsOf(s, dst).filterMax - s.mail.filters.filter((f) => f.accountId === dst.id).length;
    const acts = (xs: MailAct[]): MailAct[] => xs.flatMap((a): MailAct[] => a.do === "move" ? (isSys(a.folder) ? [a] : ids.has(a.folder) ? [{ ...a, folder: ids.get(a.folder)! }] : [])
      : a.do === "label" ? (ids.has(a.label) ? [{ ...a, label: ids.get(a.label)! }] : []) : [a]);
    const filters = s.mail.filters.filter((f) => f.accountId === src.id).slice(0, Math.max(0, room)).map((f) => ({ ...f, id: `flt${s.nextId++}`, accountId: dst.id, acts: acts(f.acts) }));
    const roles = src.roles;
    s.mail = {
      ...s.mail, filters: [...s.mail.filters, ...filters],
      accounts: s.mail.accounts.map((a) => (a.id === src.id ? { ...a, roles: [] } : a.id === dst.id ? { ...a, roles: [...new Set([...a.roles, ...roles])] } : a)),
    };
  }
  s.mail = { ...s.mail, imports: s.mail.imports.map((x) => (x.id === job.id ? { ...x, n } : x)) };
}

// Hourly: runs that are due copy their mail.
export function importTick(s: GameState): void {
  for (const job of s.mail.imports) if (job.n === null && job.doneAt <= s.hour) finish(s, job);
}
