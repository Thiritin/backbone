import { Database, FileText, Folder, Globe, Mail, ScrollText, TriangleAlert, type LucideIcon } from "lucide-react";
import { useState } from "react";
import { t } from "../../../../../i18n/en";
import { APP_NAME } from "../../../../../sim/10-catalog/apps";
import type { GameState } from "../../../../../sim/50-state";
import type { Cluster } from "../../../../../sim/60-infra/cluster";
import { accountUse } from "../../../../../sim/80-business/readouts";
import { disk } from "../../../hw";
import { Bar } from "../PanelBase";
import { hash } from "../services";
import { LogPage } from "../Readouts";

type Page = "files" | "mail" | "zone" | "db" | "access" | "errors";
const ICONS: [Page, string, LucideIcon][] = [
  ["files", "readouts.cp.files", Folder], ["mail", "readouts.cp.mail", Mail], ["zone", "readouts.cp.zone", Globe],
  ["db", "readouts.cp.db", Database], ["access", "readouts.cp.access", ScrollText], ["errors", "readouts.cp.errors", TriangleAlert],
];

// The files an app ships with, in share of the disk used.
const FILES: Record<string, [string, number][]> = {
  wordpass: [["wp-admin", 30], ["wp-content", 55], ["wp-includes", 12], ["index.php", 1], ["wp-config.php", 1], [".htaccess", 1]],
  joomlah: [["administrator", 25], ["components", 30], ["media", 35], ["templates", 8], ["index.php", 1], ["configuration.php", 1]],
  drupel: [["core", 40], ["modules", 20], ["sites", 35], ["themes", 3], ["index.php", 1], ["settings.php", 1]],
  static: [["images", 80], ["css", 5], ["index.html", 5], ["about.html", 5], ["contact.html", 5]],
};

// The customer side of a cPanic account: read-only pages built from the account's own numbers.
export function Customer({ game, c, workloadId }: { game: GameState; c: Cluster; workloadId: string }) {
  const [page, setPage] = useState<Page | null>(null);
  const w = game.workloads.find((x) => x.id === workloadId), v = game.services.find((x) => x.id === w?.serviceId);
  if (!w || !v) return null;
  const u = accountUse(game, w), domain = v.domain ?? v.label, app = v.spec.app ?? "static", offline = game.security.offline.includes(c.id);
  const usedGb = u.disk[0];
  const body = () => {
    if (offline) return <p className="cx-empty">{t("readouts.cp.offline")}</p>;
    if (page === "files") return (
      <table className="cx-table">
        <thead><tr><th>{t("readouts.cp.name")}</th><th>{t("readouts.cp.size")}</th></tr></thead>
        <tbody>{[...FILES[app]].map(([n, share]) => <tr key={n}><td><FileText size={13} aria-hidden /> {n}</td><td className="num">{disk(+(usedGb * share / 100).toFixed(3))}</td></tr>)}</tbody>
      </table>
    );
    if (page === "mail") return (
      <table className="cx-table">
        <thead><tr><th>{t("readouts.cp.address")}</th><th>{t("readouts.cp.quota")}</th></tr></thead>
        <tbody>{Array.from({ length: Math.min(v.spec.mailboxes, 8) }, (_, i) => {
          const name = i === 0 ? "info" : `user${i}`, used = (hash(`${w.id}${name}`) % 80) / 100;
          return <tr key={name}><td>{name}@{domain}</td><td><Bar use={[used, 1]} /></td></tr>;
        })}</tbody>
      </table>
    );
    if (page === "zone") return (
      <table className="cx-table">
        <thead><tr><th>{t("readouts.cp.name")}</th><th>{t("readouts.cp.type")}</th><th>{t("readouts.cp.value")}</th></tr></thead>
        <tbody>
          <tr><td>{domain}.</td><td>A</td><td>{`192.0.2.${(hash(w.id) % 250) + 1}`}</td></tr>
          <tr><td>www.{domain}.</td><td>CNAME</td><td>{domain}.</td></tr>
          <tr><td>{domain}.</td><td>MX</td><td>10 mail.{domain}.</td></tr>
          <tr><td>{domain}.</td><td>TXT</td><td>v=spf1 a mx ~all</td></tr>
        </tbody>
      </table>
    );
    if (page === "db") return (
      <table className="cx-table">
        <thead><tr><th>{t("readouts.cp.database")}</th><th>{t("readouts.cp.size")}</th></tr></thead>
        <tbody>{app === "static" ? <tr><td colSpan={2} className="cx-empty">{t("readouts.cp.noDatabases")}</td></tr> : <tr><td>{`${domain.split(".")[0]}_${app}`}</td><td className="num">{disk(+(usedGb * 0.2).toFixed(3))}</td></tr>}</tbody>
      </table>
    );
    if (page === "access" || page === "errors") return <LogPage game={game} c={c} only={page === "errors" ? "error" : "access"} />;
    return (
      <div className="cp-icons">
        {ICONS.map(([id, key, Icon]) => <button key={id} className="cx-tile" onClick={() => setPage(id)}><Icon size={28} aria-hidden /><span>{t(key)}</span></button>)}
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
