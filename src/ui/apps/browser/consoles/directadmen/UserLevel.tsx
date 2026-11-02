import { useState, type ReactNode } from "react";
import { t } from "../../../../../i18n/en";
import type { GameState } from "../../../../../sim/50-state";
import type { Cluster } from "../../../../../sim/60-infra/cluster";
import { hasBackup } from "../../../../../sim/60-infra/apps";
import { phpInstalled, phpRunning, sslStatus } from "../../../../../sim/60-infra/webpanel";
import { webspaceOf } from "../../../../../sim/60-infra/webspace";
import { yearOf } from "../../../../../sim/00-core/time";
import { setAccountPhp } from "../../../../../sim/90-actions/webpanel";
import { useStore } from "../../../../store";
import { Bar, type Row } from "../PanelBase";
import { usePageAct } from "../../pageAct";
import { LookContext, lookT } from "../look";
import { WebTool, type ToolId } from "../WebTool";
import { domainTiles } from "../cpanic/Domains";
import { mailFtpIcons } from "../cpanic/MailFtp";

export type UserPage = ToolId | "logs";
type Link = UserPage | "pma" | "webmail";

const ownerOf = (game: GameState, workloadId: string) => {
  const w = game.workloads.find((x) => x.id === workloadId);
  return game.customers.find((x) => x.id === game.services.find((v) => v.id === w?.serviceId)?.customerId)?.name;
};

// The login page's User level: the host's users; picking one opens their User Level.
export function UserLevel({ game, rows, onPick }: { game: GameState; c: Cluster; rows: Row[]; onPick?: (workloadId: string) => void }) {
  return (
    <table className="cx-readout">
      <thead><tr><th>{t("web.da.customers")}</th><th>{t("browser-consoles-2.domain")}</th></tr></thead>
      <tbody>
        {rows.length === 0 && <tr><td colSpan={2} className="cx-empty">{t("browser-consoles-2.nothingHere")}</td></tr>}
        {rows.map((r) => <tr key={r.id}><td><button className="da-link" onClick={() => onPick?.(r.id)}>{ownerOf(game, r.id) ?? r.name}</button></td><td>{r.name}</td></tr>)}
      </tbody>
    </table>
  );
}

// One web space's User Level after "Login as": DirectAdmin's link sections, and a tool page per link.
export function UserHome({ game, c, workloadId, rows, openPma, initial = null, up }: { game: GameState; c: Cluster; workloadId: string; rows: Row[]; openPma?: () => void; initial?: UserPage | null; up?: ReactNode }) {
  const act = usePageAct(), openApp = useStore((s) => s.openApp), [page, setPage] = useState<UserPage | null>(initial);
  const ws = webspaceOf(game, workloadId);
  if (!ws) return null;
  const tt = lookT("directadmen"), year = yearOf(game.hour), sid = game.workloads.find((x) => x.id === workloadId)?.serviceId, row = rows.find((r) => r.id === workloadId);
  const keys: Record<string, string> = {
    ...Object.fromEntries([...domainTiles(year), ...mailFtpIcons(year)].map(([id, key]) => [id, key])),
    files: "filemanager.title", db: "webdb.title", pma: "webdb.pma.app", webmail: "dacust.webmail", logs: "dacust.logs", access: "dacust.accessLog", errors: "dacust.errorLog",
  };
  const sections: [string, Link[]][] = [
    ["dacust.account", ["addon", "sub", "parked", "zone", "ssl", "php", "db", "pma", "ftpAccounts"]],
    ["dacust.email", ["emailAccounts", "forwarders", "autoresponders", "spam", "webmail"]],
    ["dacust.advanced", ["cron", "logs"]],
    ["dacust.system", ["files"]],
  ];
  const go = (id: Link) => (id === "pma" ? openPma?.() : id === "webmail" ? openApp("Browser", { kind: "url", id: `webmail.${ws.domain}/` }) : setPage(id));
  const link = (id: Link) => <button key={id} className="da-link" onClick={() => go(id)}>{tt(keys[id])}</button>;
  const crumb = <nav className="da-crumb">{up && <>{up} » </>}<button className="da-link" onClick={() => setPage(null)}>{ownerOf(game, workloadId) ?? ws.account}</button>{page && <> » {tt(keys[page])}</>}</nav>;
  if (game.security.offline.includes(c.id)) return <>{crumb}<p className="cx-empty">{t("readouts.cp.offline")}</p></>;
  if (page === "logs") return <>{crumb}<p className="da-ul-logs">{ws.domain}: {link("access")} | {link("errors")}</p></>;
  if (page) return <LookContext.Provider value="directadmen">{crumb}<WebTool game={game} c={c} workloadId={workloadId} page={page} /></LookContext.Provider>;
  const uses: [string, [number, number]][] = row ? [["web.da.cpu", row.cpu], ["web.da.ram", row.ram], ["web.da.disk", row.disk]] : Number.isFinite(ws.usage.quotaMb) ? [["web.da.disk", [ws.usage.diskMb / 1024, ws.usage.quotaMb / 1024]]] : [];
  return (
    <>
      {crumb}
      <div className="da-ul">
        {sections.map(([head, ids]) => (
          <table key={head} className="da-ul-sec">
            <thead><tr><th>{t(head)}</th></tr></thead>
            <tbody>
              {ids.map((id) => <tr key={id}><td>{link(id)}</td></tr>)}
              {head === "dacust.system" && (
                <tr><td>
                  <dl className="da-facts">
                    {uses.map(([k, use]) => <div key={k}><dt>{t(k)}</dt><dd><Bar use={use} /></dd></div>)}
                    <div><dt>{t("web.da.domains")}</dt><dd>{ws.domain}</dd></div>
                    {sid && c.kind === "panel" && (
                      <div><dt>PHP</dt><dd>
                        <select aria-label="PHP" value={phpRunning(game, c, sid)} onChange={(e) => act(setAccountPhp, sid, e.target.value)}>
                          {phpInstalled(game, c).map((v) => <option key={v} value={v}>{v}</option>)}
                        </select>
                      </dd></div>
                    )}
                    {sid && (sslStatus(game, sid) !== "valid" || game.webpanel.ssl.expires[sid] !== undefined) && <div><dt>SSL</dt><dd>{t(`web.ssl.${sslStatus(game, sid)}`)}</dd></div>}
                    {sid && <div><dt>{t("web.da.backup")}</dt><dd>{hasBackup(game, sid) ? t("web.da.yes") : t("web.da.no")}</dd></div>}
                  </dl>
                </td></tr>
              )}
            </tbody>
          </table>
        ))}
      </div>
    </>
  );
}
