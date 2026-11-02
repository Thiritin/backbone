import { AppWindow, Blocks, Clock, Cog, Database, ExternalLink, Folder, FolderUp, Globe, Link2, Lock, Mail, MailPlus, Network, Reply, ScrollText, ShieldCheck, Waypoints, type LucideIcon } from "lucide-react";
import { useState } from "react";
import { APP_NAME } from "../../../../../sim/10-catalog/apps";
import type { GameState } from "../../../../../sim/50-state";
import type { Cluster } from "../../../../../sim/60-infra/cluster";
import { webspaceOf } from "../../../../../sim/60-infra/webspace";
import { useStore } from "../../../../store";
import { LookContext, lookT } from "../look";
import { WebTool, type ToolId } from "../WebTool";
import { Toolkit } from "./Toolkit";

export type CustTab = "web" | "mail" | "apps" | "files" | "db" | "share";
export type CustPage = ToolId | "toolkit";
type Link = [CustPage | "pma", string, LucideIcon];

const t = lookT("pleskit");
const TABS: [CustTab, string, Link[]][] = [
  ["web", "pkc.tab.web", [
    ["addon", "pkc.addDomain", Globe], ["sub", "pkc.addSub", Network], ["parked", "pkc.addAlias", Link2], ["zone", "cpd.zone", Waypoints],
    ["ssl", "cpd.sslStatus", Lock], ["php", "cpd.php", Cog], ["cron", "cpd.cron", Clock], ["ftpAccounts", "cpmail.ftp", FolderUp],
    ["files", "filemanager.title", Folder], ["access", "pkc.logs", ScrollText], ["toolkit", "web.tk.menu", Blocks],
  ]],
  ["mail", "pkc.tab.mail", [["emailAccounts", "cpmail.accounts", Mail], ["forwarders", "cpmail.forwarders", MailPlus], ["autoresponders", "cpmail.autoresponders", Reply], ["spam", "cpmail.spamFilters", ShieldCheck]]],
  ["apps", "pkc.tab.apps", [["toolkit", "web.tk.menu", Blocks]]],
  ["files", "pkc.tab.files", [["files", "filemanager.title", Folder]]],
  ["db", "pkc.tab.db", [["db", "webdb.title", Database], ["pma", "webdb.pma.app", Database]]],
  ["share", "pkc.tab.share", [["ftpAccounts", "cpmail.ftp", FolderUp]]],
];

// A Pleskit subscription seen by its customer: Plesk 8 lists every tool as icons, 10 and 12 put them on tabs, Onyx on moves the tabs to the left.
export function Customer({ game, c, workloadId, era, openPma, initialTab = "web", initialPage = null }: {
  game: GameState; c: Cluster; workloadId: string; era: string; openPma?: () => void; initialTab?: CustTab; initialPage?: CustPage | null;
}) {
  const [tab, setTab] = useState<CustTab>(initialTab), [page, setPage] = useState<CustPage | null>(initialPage);
  const openApp = useStore((s) => s.openApp), ws = webspaceOf(game, workloadId);
  if (!ws) return null;
  const offline = game.security.offline.includes(c.id), late = era === "onyx" || era === "obsidian";
  const go = (id: CustPage | "pma") => (id === "pma" ? openPma?.() : setPage(id));
  const links = (items: Link[]) => (
    <div className="pk-tools">{items.map(([id, key, Icon]) => <button key={id + key} className="cx-tile" onClick={() => go(id)}><Icon size={era === "reload" ? 28 : 18} aria-hidden /><span>{t(key)}</span></button>)}</div>
  );
  const domains = (
    <table className="cx-table">
      <tbody>
        {Object.values(ws.domains).map((d) => (
          <tr key={d.name}>
            <td><b>{d.name}</b><span className="cx-sub">{t(`pkc.kind.${d.kind}`)}</span></td>
            <td>{d.kind !== "parked" && <>{t("pkc.docRoot")}: <code>{d.folder}</code></>}</td>
            <td><button className="cx-btn" onClick={() => openApp("Browser", { kind: "url", id: `${d.name}/` })}><ExternalLink size={13} aria-hidden /> {t("pkc.openWeb")}</button></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
  const content = (id: CustTab, items: Link[]) => {
    if (id === "web") return <>{domains}{links(items)}</>;
    if (id === "mail") return <><WebTool game={game} c={c} workloadId={workloadId} page="emailAccounts" />{links(items.slice(1))}</>;
    if (id === "apps") return <>{ws.app && <p><AppWindow size={14} aria-hidden /> <b>{APP_NAME[ws.app.id]}</b> <code>{ws.app.folder}</code></p>}{links(items)}</>;
    if (id === "files") return <WebTool game={game} c={c} workloadId={workloadId} page="files" />;
    if (id === "share") return <WebTool game={game} c={c} workloadId={workloadId} page="ftpAccounts" />;
    return <>{links(items.slice(1))}<WebTool game={game} c={c} workloadId={workloadId} page="db" /></>;
  };
  const body = () => {
    if (offline) return <p className="cx-empty">{t("readouts.cp.offline")}</p>;
    if (page === "toolkit") return <Toolkit game={game} c={c} late={late} />;
    if (page) return <WebTool game={game} c={c} workloadId={workloadId} page={page} />;
    if (era === "reload") return <>{domains}{TABS.map(([id, key, items]) => <section key={id} className="pk-box"><h2>{t(key)}</h2>{links(items)}</section>)}</>;
    return content(tab, TABS.find(([id]) => id === tab)![2]);
  };
  const nav = era !== "reload" && (
    <nav className={late ? "pk-side" : "pk-tabs"}>
      {TABS.map(([id, key]) => <button key={id} aria-pressed={tab === id && !page} onClick={() => { setTab(id); setPage(null); }}>{t(key)}</button>)}
    </nav>
  );
  const main = (
    <main className="pk-main">
      <h1>{ws.domain}</h1>
      {!late && nav}
      {page && !offline && <button className="cx-btn" onClick={() => setPage(null)}>{t("readouts.cp.back")}</button>}
      {body()}
    </main>
  );
  return <LookContext.Provider value="pleskit"><div className="pk-body pk-cust">{late && nav}{main}</div></LookContext.Provider>;
}
