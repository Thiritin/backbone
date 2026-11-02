// docs/design/web-hosting.md 4.4: signing in to a web space over FTP, as the panel host's FTP server answers.
import { yearOf } from "../00-core/time";
import { fqdn } from "../30-customers/domains";
import type { GameState } from "../50-state";
import { machineAddress } from "./addresses";
import { machineOf } from "./cluster";
import { panelMachine } from "./licence";
import { stackOf } from "./panel-services";
import { webspaceOf } from "./webspace";

// cPanel opened SFTP to its accounts with jailed shells, and FileZilla 3 offered it in its connection settings.
export const SFTP_YEAR = 2008;
export const FTP_PORT = 21, SFTP_PORT = 22;

export type FtpLogin =
  | { ok: true; workloadId: string; folder: string; daemon: string; ip: string }
  | { ok: false; error: "resolve" | "timeout" | "login"; daemon?: string; ip?: string };

// The host is any domain of a web space on the server, its ftp. name, or the server's own name or address.
export function ftpLogin(s: GameState, host: string, user: string, password: string, port: number, sftp = false): FtpLogin {
  const name = host.trim().toLowerCase().replace(/^s?ftp:\/\//, "").replace(/\/.*$/, ""), bare = name.replace(/^(ftp|www)\./, "");
  const panels = s.clusters.filter((c) => c.kind === "panel" && c.panel);
  const machineNames = (id: string | null): string[] => {
    const m = id ? machineOf(s, id) : undefined, ip = id && machineAddress(s, id);
    return [...(m?.hostname ? [m.hostname, ...(s.company.domain ? [fqdn(s, m.hostname)] : [])] : []), ...(ip ? [ip] : [])];
  };
  const spaces = (clusterId: string) => s.workloads.filter((w) => w.clusterId === clusterId).flatMap((w) => webspaceOf(s, w.id) ?? []);
  const c = panels.find((x) => machineNames(panelMachine(x)).includes(name) || spaces(x.id).some((ws) => !!ws.domains[bare]));
  if (!c) return { ok: false, error: "resolve" };
  const ip = machineAddress(s, panelMachine(c) ?? "") ?? name, daemon = stackOf(s, c).ftp;
  if (s.security.offline.includes(c.id) || port !== (sftp ? SFTP_PORT : FTP_PORT) || (sftp && yearOf(s.hour) < SFTP_YEAR)) return { ok: false, error: "timeout", daemon, ip };
  for (const ws of spaces(c.id)) {
    const a = ws.ftp[user.trim()];
    if (a) return a.password === password ? { ok: true, workloadId: ws.workloadId, folder: a.folder, daemon, ip } : { ok: false, error: "login", daemon, ip };
  }
  return { ok: false, error: "login", daemon, ip };
}

