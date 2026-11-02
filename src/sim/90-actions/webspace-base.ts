// The overlay writes and checks every web space action shares (docs/design/web-hosting.md, section 2.1).
import type { GameState } from "../50-state";
import { deriveWebspace, hostOf, webspaceOf, type PartName, type WebParts, type Webspace } from "../60-infra/webspace";
import type { ActionResult } from "./hardware";

export const fail = (error: string, params?: Record<string, string>): ActionResult => ({ ok: false, error, ...(params && { params }) });
export const FILE_NAME = /^[^/\0]{1,255}$/;
// Writes one entry to the overlay; removing an entry the derivation lacks just drops the stored one.
export function put<K extends PartName>(s: GameState, id: string, part: K, key: string, value: WebParts[K][string] | false): void {
  const o = (s.webspaces[id] ??= {}), m = (o[part] ??= {}) as Record<string, WebParts[K][string] | false>;
  if (value === false && !(key in (deriveWebspace(s, id)?.[part] ?? {}))) delete m[key];
  else m[key] = value;
  if (!Object.keys(m).length) delete o[part];
  if (!Object.keys(o).length) delete s.webspaces[id];
}

// The web space, or the error for an unknown one or a host that is offline.
export function open(s: GameState, id: string): Webspace | ActionResult {
  const ws = webspaceOf(s, id);
  if (!ws) return fail("error.unknownWorkload");
  return s.security.offline.includes(hostOf(s, id)!.c.id) ? fail("webspace.error.offline") : ws;
}
export const isFail = (x: Webspace | ActionResult): x is ActionResult => "ok" in x;
// "" is the home folder.
export const folderOk = (ws: Webspace, folder: string): boolean => folder === "" || !!ws.files[folder]?.dir;
export const join = (folder: string, name: string): string => (folder ? `${folder}/${name}` : name);
export const under = (ws: Webspace, p: string) => Object.keys(ws.files).filter((k) => k === p || k.startsWith(`${p}/`));
// The four top folders the panel keeps; the player can work inside them but not remove them.
export const fixed = (ws: Webspace, p: string) => [ws.webroot, "logs", "tmp", "mail"].includes(p);
