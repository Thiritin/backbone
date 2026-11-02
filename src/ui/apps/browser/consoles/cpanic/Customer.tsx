import { Database, FileText, Folder, Mail, ScrollText, TriangleAlert, type LucideIcon } from "lucide-react";
import { useState } from "react";
import { t } from "../../../../../i18n/en";
import { APP_NAME } from "../../../../../sim/10-catalog/apps";
import type { GameState } from "../../../../../sim/50-state";
import type { Cluster } from "../../../../../sim/60-infra/cluster";
import { yearOf } from "../../../../../sim/00-core/time";
import { accountUse } from "../../../../../sim/80-business/readouts";
import { webspaceOf } from "../../../../../sim/60-infra/webspace";
import { disk } from "../../../hw";
import { Bar } from "../PanelBase";
import { LogPage } from "../Readouts";
import { DomainPage, domainTiles, type DomainPageId } from "./Domains";

type Page = "files" | "mail" | "db" | "access" | "errors" | DomainPageId;
const ICONS: [Page, string, LucideIcon][] = [
  ["files", "readouts.cp.files", Folder], ["mail", "readouts.cp.mail", Mail],
  ["db", "readouts.cp.db", Database], ["access", "readouts.cp.access", ScrollText], ["errors", "readouts.cp.errors", TriangleAlert],
];

// The customer side of a cPanic account: read-only pages built from the account's own numbers.
export function Customer({ game, c, workloadId }: { game: GameState; c: Cluster; workloadId: string }) {
  const [page, setPage] = useState<Page | null>(null);
  const w = game.workloads.find((x) => x.id === workloadId), v = game.services.find((x) => x.id === w?.serviceId), ws = webspaceOf(game, workloadId);
  if (!w || !v || !ws) return null;
  const u = accountUse(game, w), domain = v.domain ?? v.label, app = v.spec.app ?? "static", offline = game.security.offline.includes(c.id);
  const top = Object.entries(ws.files).filter(([p]) => p.startsWith(`${ws.webroot}/`) && !p.slice(ws.webroot.length + 1).includes("/"));
  const body = () => {
    if (offline) return <p className="cx-empty">{t("readouts.cp.offline")}</p>;
    if (page === "files") return (
      <table className="cx-table">
        <thead><tr><th>{t("readouts.cp.name")}</th><th>{t("readouts.cp.size")}</th></tr></thead>
        <tbody>{top.map(([p, f]) => <tr key={p}><td><FileText size={13} aria-hidden /> {p.slice(ws.webroot.length + 1)}</td><td className="num">{disk(+(f.mb / 1024).toFixed(3))}</td></tr>)}</tbody>
      </table>
    );
    if (page === "mail") return (
      <table className="cx-table">
        <thead><tr><th>{t("readouts.cp.address")}</th><th>{t("readouts.cp.quota")}</th></tr></thead>
        <tbody>{Object.values(ws.mailboxes).map((m) => <tr key={m.address}><td>{m.address}</td><td><Bar use={[m.usedMb, m.quotaMb]} /></td></tr>)}</tbody>
      </table>
    );
    if (page === "db") return (
      <table className="cx-table">
        <thead><tr><th>{t("readouts.cp.database")}</th><th>{t("readouts.cp.size")}</th></tr></thead>
        <tbody>{Object.values(ws.databases).length ? Object.values(ws.databases).map((d) => <tr key={d.name}><td>{d.name}</td><td className="num">{disk(+(d.mb / 1024).toFixed(3))}</td></tr>) : <tr><td colSpan={2} className="cx-empty">{t("readouts.cp.noDatabases")}</td></tr>}</tbody>
      </table>
    );
    if (page === "access" || page === "errors") return <LogPage game={game} c={c} only={page === "errors" ? "error" : "access"} />;
    if (page) return <DomainPage game={game} c={c} workloadId={workloadId} page={page} />;
    return (
      <div className="cp-icons">
        {[...ICONS, ...domainTiles(yearOf(game.hour))].map(([id, key, Icon]) => <button key={id} className="cx-tile" onClick={() => setPage(id)}><Icon size={28} aria-hidden /><span>{t(key)}</span></button>)}
      </div>
    );
  };
  return (
    <div className="cp-customer">
      <aside className="cp-stats">
        <h2>{t("readouts.cp.stats")}</h2>
        <div><span>{t("readouts.cp.disk")}</span><Bar use={u.disk} /></div>
        {u.traffic[1] > 0 && <div><span>{t("readouts.cp.bandwidth")}</span><Bar use={u.traffic} /></div>}
        <div><span>{t("readouts.cp.mail")}</span><b className="num">{u.mailboxes}</b></div>
        <div><span>{APP_NAME[app]}</span><b>{domain}</b></div>
      </aside>
      <section className="cp-cust-main">
        {page && !offline && <button className="cx-btn" onClick={() => setPage(null)}>{t("readouts.cp.back")}</button>}
        {body()}
      </section>
    </div>
  );
}
