// docs/design/web-hosting.md 4.3 and 4.4: autoresponders, the spam filter and FTP uploads of a web space.
import type { GameState } from "../50-state";
import type { SpamFilter } from "../60-infra/webspace";
import type { ActionResult } from "./hardware";
import { downloadedFiles } from "./media";
import { fail, isFail, open, put } from "./webspace-base";
import { uploadFile } from "./webspace-files";

const LOCAL = /^[a-z0-9]([a-z0-9._-]{0,62}[a-z0-9])?$/;

export function createAutoresponder(s: GameState, workloadId: string, local: string, domain: string, from: string, subject: string, body: string, intervalHours: number): ActionResult {
  const ws = open(s, workloadId);
  if (isFail(ws)) return ws;
  const address = `${local}@${domain}`;
  if (!LOCAL.test(local) || !ws.domains[domain]) return fail("webspace.error.address");
  if (!subject.trim()) return fail("webspace.error.subject");
  if (!Number.isInteger(intervalHours) || intervalHours < 0) return fail("webspace.error.interval");
  put(s, workloadId, "autoresponders", address, { address, from: from.trim(), subject: subject.trim(), body, intervalHours });
  return { ok: true, id: address };
}

export function deleteAutoresponder(s: GameState, workloadId: string, address: string): ActionResult {
  const ws = open(s, workloadId);
  if (isFail(ws)) return ws;
  if (!ws.autoresponders[address]) return fail("webspace.error.noAutoresponder");
  put(s, workloadId, "autoresponders", address, false);
  return { ok: true, id: address };
}

// SpamAssassin's required score runs from 1 (everything is spam) to 10.
export function setSpamFilter(s: GameState, workloadId: string, spam: SpamFilter): ActionResult {
  const ws = open(s, workloadId);
  if (isFail(ws)) return ws;
  if (!Number.isInteger(spam.score) || spam.score < 1 || spam.score > 10) return fail("webspace.error.spamScore");
  const o = (s.webspaces[workloadId] ??= {});
  o.spam = { on: spam.on, spamBox: spam.on && spam.spamBox, autoDelete: spam.on && spam.autoDelete, score: spam.score };
  return { ok: true };
}

// The File Manager's upload, confined to the FTP account's home folder and quota; FTP overwrites an existing file.
export function ftpUpload(s: GameState, workloadId: string, user: string, dir: string, file: string): ActionResult {
  const ws = open(s, workloadId);
  if (isFail(ws)) return ws;
  const a = ws.ftp[user], d = downloadedFiles(s).find((x) => x.id === file);
  if (!a) return fail("webspace.error.noFtp");
  if (dir !== a.folder && !dir.startsWith(`${a.folder}/`)) return fail("webspace.error.noFolder");
  if (!d) return fail("webspace.error.noDownload");
  const target = `${dir}/${d.name}`;
  const inHome = Object.entries(ws.files).filter(([k]) => k.startsWith(`${a.folder}/`) && k !== target).reduce((n, [, f]) => n + f.mb, 0);
  if (a.quotaMb > 0 && inHome + d.mb > a.quotaMb) return fail("webspace.error.ftpQuota");
  return uploadFile(s, workloadId, dir, file, true);
}
