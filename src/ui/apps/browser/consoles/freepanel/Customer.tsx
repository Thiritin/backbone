import { ChevronRight, Folder, Globe } from "lucide-react";
import { useState, type ReactNode } from "react";
import { t } from "../../../../../i18n/en";
import { LOCALE } from "../../../../../i18n/lang";
import type { GameState } from "../../../../../sim/50-state";
import type { Cluster } from "../../../../../sim/60-infra/cluster";
import { yearOf } from "../../../../../sim/00-core/time";
import { webspaceOf } from "../../../../../sim/60-infra/webspace";
import { disk } from "../../../hw";
import { Bar } from "../PanelBase";
import { LookContext, lookT } from "../look";
import { domainTiles } from "../cpanic/Domains";
import { WebTool, type ToolId } from "../WebTool";

export type FpPage = "summary" | "postfix" | "mysql" | ToolId;
const ft = lookT("freepanel");
const MAIL: [ToolId, string][] = [["emailAccounts", "cust-fp.mailboxes"], ["forwarders", "cust-fp.mailAliases"], ["autoresponders", "cust-fp.autoreply"], ["spam", "cust-fp.spam"]];

// Virtualmin's frame for one virtual server: its own menu, then the Webmin modules that hold the same data.
export function Customer({ game, c, workloadId, openPma, era, back, initial = "summary" }: { game: GameState; c: Cluster; workloadId: string; openPma?: () => void; era: string; back?: ReactNode; initial?: FpPage }) {
  const [page, setPage] = useState<FpPage>(initial), [mail, setMail] = useState<ToolId>("emailAccounts");
  const ws = webspaceOf(game, workloadId);
  if (!ws) return null;
  const offline = game.security.offline.includes(c.id), year = yearOf(game.hour);
  // Domain tool titles follow the year as on cPanic, worded by the @freepanel overrides.
  const title = (id: ToolId) => ft(domainTiles(year).find(([x]) => x === id)?.[1] ?? "");
  const tree: [string | null, [FpPage, string][]][] = [
    [null, [["summary", t("cust-fp.editServer")], ["emailAccounts", ft("cpmail.accounts")], ["forwarders", ft("cpmail.forwarders")], ["db", ft("webdb.title")], ["addon", title("addon")], ["sub", title("sub")], ["parked", title("parked")]]],
    [t("cust-fp.serverConfig"), [["php", title("php")], ["ssl", title("ssl")], ["zone", title("zone")]]],
    [t("cust-fp.logs"), [["access", t("cust-fp.accessLog")], ["errors", t("cust-fp.errorLog")]]],
    [t("cust-fp.webmin"), [["files", t("cust-fp.files")], ["mysql", t("cust-fp.mysql")], ["postfix", t("cust-fp.postfix")], ["ftpAccounts", t("cust-fp.proftpd")], ["cron", ft("cpd.cron")]]],
  ];
  const tool = (id: ToolId) => <WebTool game={game} c={c} workloadId={workloadId} page={id} />;
  const u = ws.usage, gb = (mb: number) => disk(+(mb / 1024).toFixed(3)), n = (x: number) => x.toLocaleString(LOCALE);
  const rows: [string, ReactNode][] = [
    [t("cust-fp.domain"), ws.domain], [t("cust-fp.home"), `/home/${ws.account}`], [t("cust-fp.user"), ws.account],
    [t("cust-fp.disk"), Number.isFinite(u.quotaMb) ? <><Bar use={[u.diskMb / 1024, u.quotaMb / 1024]} /> {gb(u.diskMb)} / {gb(u.quotaMb)}</> : gb(u.diskMb)],
    [t("cust-fp.users"), n(u.mailboxes)], [t("cust-fp.aliases"), n(u.forwarders)], [t("cust-fp.databases"), n(u.databases)],
    [t("cust-fp.subServers"), n(u.addonDomains + u.subdomains)],
  ];
  const body = (): ReactNode => {
    if (offline) return <p className="cx-empty">{t("readouts.cp.offline")}</p>;
    if (page === "summary") return <><h1>{t("cust-fp.editServer")}</h1><table className="cx-table cx-facts"><tbody>{rows.map(([k, v]) => <tr key={k}><th>{k}</th><td>{v}</td></tr>)}</tbody></table></>;
    if (page === "mysql") return <>{openPma && <button className="cx-btn" onClick={openPma}>{t("webdb.pma.app")}</button>}{tool("db")}</>;
    if (page === "postfix") return (
      <>
        <nav className="fp-tabs">{MAIL.map(([id, key]) => <button key={id} aria-pressed={mail === id} onClick={() => setMail(id)}>{t(key)}</button>)}</nav>
        {tool(mail)}
      </>
    );
    return tool(page);
  };
  return (
    <LookContext.Provider value="freepanel">
      <aside className="fp-tree">
        {era === "authentic" && <div className="fp-switch"><span>{t("readouts.fp.virtualmin")}</span><span>{t("cust-fp.webminTab")}</span></div>}
        <div className="fp-server"><Globe size={13} aria-hidden />{ws.domain}</div>
        {tree.map(([cat, items]) => (
          <section key={cat ?? "-"}>
            {cat && <h3><Folder size={13} aria-hidden />{cat}</h3>}
            {items.map(([id, label]) => <button key={id} aria-pressed={page === id} onClick={() => setPage(id)}><ChevronRight size={12} aria-hidden />{label}</button>)}
          </section>
        ))}
        {back}
      </aside>
      <main className="fp-main">{body()}</main>
    </LookContext.Provider>
  );
}
