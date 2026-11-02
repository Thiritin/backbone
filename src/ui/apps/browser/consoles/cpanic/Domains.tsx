import { Clock, Cog, Globe, Link2, Lock, Network, Waypoints, type LucideIcon } from "lucide-react";
import { useState } from "react";
import { useT } from "../look";
import { formatClock, yearOf } from "../../../../../sim/00-core/time";
import type { GameState } from "../../../../../sim/50-state";
import type { Cluster } from "../../../../../sim/60-infra/cluster";
import { AUTOSSL_FROM, phpInstalled } from "../../../../../sim/60-infra/webpanel";
import { MULTI_PHP_YEAR, webspaceOf, type DomainKind, type Webspace } from "../../../../../sim/60-infra/webspace";
import { domainCert } from "../../../../../sim/60-infra/webzone";
import { createAddonDomain, createParkedDomain, createSubdomain, deleteDomain, setDomainPhp } from "../../../../../sim/90-actions/webspace";
import { usePageAct } from "../../pageAct";
import { CronJobs, ZoneEditor } from "./ZoneCron";

export type DomainPageId = "addon" | "sub" | "parked" | "zone" | "ssl" | "php" | "cron";
export const SIMPLE_ZONE_UNTIL = 2012, ALIASES_FROM = 2018;

// The icons cPanel shows for these tools, named as the release of the year names them.
export const domainTiles = (year: number): [DomainPageId, string, LucideIcon][] => [
  ["addon", "cpd.addon", Globe], ["sub", "cpd.sub", Network], ["parked", year < ALIASES_FROM ? "cpd.parked" : "cpd.aliases", Link2],
  ["zone", year < SIMPLE_ZONE_UNTIL ? "cpd.zoneSimple" : "cpd.zone", Waypoints], ["ssl", year < AUTOSSL_FROM ? "cpd.sslManager" : "cpd.sslStatus", Lock],
  ["php", year < MULTI_PHP_YEAR ? "cpd.phpConfig" : "cpd.php", Cog], ["cron", "cpd.cron", Clock],
];

const folderArg = (v: string) => v.trim().replace(/^\/+/, "") || undefined;

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="cx-field"><span>{label}</span>{children}</label>;
}

// Addon Domains, Subdomains and Parked Domains (Aliases): the form to add one and the list with Remove.
function DomainList({ ws, kind, year }: { ws: Webspace; kind: DomainKind; year: number }) {
  const t = useT();
  const act = usePageAct(), [name, setName] = useState(""), [label, setLabel] = useState(""), [folder, setFolder] = useState("");
  const parents = Object.values(ws.domains).filter((d) => d.kind === "main" || d.kind === "addon").map((d) => d.name);
  const [parent, setParent] = useState(ws.domain);
  const rows = Object.values(ws.domains).filter((d) => d.kind === kind);
  const submit = () => {
    const r = kind === "sub" ? act(createSubdomain, ws.workloadId, label.trim().toLowerCase(), parent, folderArg(folder))
      : kind === "addon" ? act(createAddonDomain, ws.workloadId, name.trim().toLowerCase(), folderArg(folder)) : act(createParkedDomain, ws.workloadId, name.trim().toLowerCase());
    if (r.ok) { setName(""); setLabel(""); setFolder(""); }
  };
  return (
    <>
      <form className="cx-form" onSubmit={(e) => { e.preventDefault(); submit(); }}>
        {kind === "sub" ? (
          <>
            <Field label={t("cpd.subdomain")}><input value={label} onChange={(e) => setLabel(e.target.value)} /></Field>
            <Field label={t("cpd.domain")}><select value={parent} onChange={(e) => setParent(e.target.value)}>{parents.map((d) => <option key={d}>{d}</option>)}</select></Field>
          </>
        ) : <Field label={t(kind === "addon" ? "cpd.newDomain" : "cpd.domain")}><input value={name} onChange={(e) => setName(e.target.value)} /></Field>}
        {kind !== "parked" && <Field label={t("cpd.root")}><input value={folder} placeholder={`${ws.webroot}/${kind === "sub" ? label : name}`} onChange={(e) => setFolder(e.target.value)} /></Field>}
        <button type="submit" className="cx-btn primary">{t(kind === "sub" ? "cpd.create" : kind === "addon" || year >= ALIASES_FROM ? "cpd.addDomain" : "cpd.create")}</button>
      </form>
      <table className="cx-table">
        <thead><tr><th>{t("cpd.domains")}</th><th>{t("cpd.root")}</th><th /></tr></thead>
        <tbody>
          {rows.length === 0 && <tr><td colSpan={3} className="cx-empty">{t("cpd.none")}</td></tr>}
          {rows.map((d) => <tr key={d.name}><td>{d.name}</td><td>/{d.folder}</td><td><button className="cx-btn" onClick={() => act(deleteDomain, ws.workloadId, d.name)}>{t("cpd.remove")}</button></td></tr>)}
        </tbody>
      </table>
    </>
  );
}

function Ssl({ game, ws }: { game: GameState; ws: Webspace }) {
  const t = useT();
  return (
    <table className="cx-table">
      <thead><tr><th>{t("cpd.domain")}</th><th>{t("cpd.ssl.cert")}</th><th>{t("cpd.ssl.expires")}</th><th>{t("cpd.ssl.status")}</th></tr></thead>
      <tbody>
        {Object.values(ws.domains).map((d) => {
          const c = domainCert(game, ws, d.name);
          return (
            <tr key={d.name}>
              <td>{d.name}</td><td>{t(`cpd.ssl.${c.kind}`)}</td><td className="num">{c.expires === null ? "" : formatClock(c.expires)}</td>
              <td>{c.status && <span className={`cx-state ${c.status === "expired" ? "bad" : c.status === "renewing" ? "accent" : "ok"}`}>{t(`cpd.ssl.${c.status}`)}</span>}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

// MultiPHP Manager picks a version per domain; before it the host runs one version for every domain.
function Php({ game, c, ws }: { game: GameState; c: Cluster; ws: Webspace }) {
  const t = useT();
  const act = usePageAct(), multi = yearOf(game.hour) >= MULTI_PHP_YEAR, versions = phpInstalled(game, c);
  return (
    <table className="cx-table">
      <thead><tr><th>{t("cpd.domain")}</th><th>{t("cpd.php.version")}</th></tr></thead>
      <tbody>
        {Object.values(ws.domains).map((d) => (
          <tr key={d.name}>
            <td>{d.name}</td>
            <td>{multi
              ? <select aria-label={t("cpd.php.version")} value={d.php} onChange={(e) => act(setDomainPhp, ws.workloadId, d.name, e.target.value)}>{[...new Set([...versions, d.php])].map((v) => <option key={v}>{v}</option>)}</select>
              : c.php}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// The customer pages for domains, DNS, SSL, PHP and cron (docs/design/web-hosting.md, 4.5).
export function DomainPage({ game, c, workloadId, page }: { game: GameState; c: Cluster; workloadId: string; page: DomainPageId }) {
  const t = useT();
  const ws = webspaceOf(game, workloadId), year = yearOf(game.hour);
  if (!ws) return null;
  const title = domainTiles(year).find(([id]) => id === page)![1];
  return (
    <>
      <h2>{t(title)}</h2>
      {page === "addon" && <DomainList ws={ws} kind="addon" year={year} />}
      {page === "sub" && <DomainList ws={ws} kind="sub" year={year} />}
      {page === "parked" && <DomainList ws={ws} kind="parked" year={year} />}
      {page === "zone" && <ZoneEditor game={game} ws={ws} simple={year < SIMPLE_ZONE_UNTIL} />}
      {page === "ssl" && <Ssl game={game} ws={ws} />}
      {page === "php" && <Php game={game} c={c} ws={ws} />}
      {page === "cron" && <CronJobs ws={ws} />}
    </>
  );
}
