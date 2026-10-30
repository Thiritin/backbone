import { ShieldCheck } from "lucide-react";
import { useRef, useState } from "react";
import { euro } from "../../sim/00-core/money";
import { formatClock } from "../../sim/00-core/time";
import { t } from "../../i18n/en";
import type { GameState } from "../../sim/50-state";
import type { Breach } from "../../sim/60-infra/breach";
import { anchorOf, type Cluster } from "../../sim/60-infra/cluster";
import { advisoryNodes, ADVISORY_KEYS, MONITORING, patchOut, STAGE_HOURS, vulnById, vulnerable, webOn } from "../../sim/60-infra/security";
import { phpDue, upgradePhp } from "../../sim/90-actions/clusters";
import { urgentSoftware, type Severity } from "../../sim/60-infra/vulns";
import { cleanUp, setSitesOffline } from "../../sim/90-actions/security";
import { updateSoftware } from "../../sim/90-actions/software";
import { updateFirmware } from "../../sim/90-actions/remote";
import { exposedDevices, firmwareDue, firmwareVulns } from "../../sim/60-infra/oob";
import { modelById } from "../../sim/10-catalog/hardware";
import { menuOn, type MenuEntry } from "../desktop/ContextMenu";
import { useFocus, useStore } from "../store";
import { devName } from "./hw";
import { TechButton } from "./locations/TechButton";
import { MonitoringTab } from "./Monitoring";
import { More } from "./More";
import { IncidentReports } from "./products/parts";

// The advisory's current stage title, and the hour its patch is due.
export const advisoryOf = (game: GameState) => {
  const v = vulnById(game.security.vuln);
  return v && { title: t(`${ADVISORY_KEYS[game.security.stage]}.title`), patchAt: formatClock(v.at + STAGE_HOURS[3]), versions: v.versions.join(", ") };
};

// Taking a panel host's sites offline, back online, or cleaning them up after a breach.
export function sitesMenu(game: GameState, host: Cluster): MenuEntry[] {
  const act = useStore.getState().act, sec = game.security;
  if (sec.hacked.includes(host.id)) return [{ label: "Clean up sites", run: () => act(cleanUp, host.id) }];
  const off = sec.offline.includes(host.id);
  return [{ label: off ? "Bring sites online" : "Take sites offline", run: () => act(setSitesOffline, host.id, !off) }];
}

function NodeRow({ game, n }: { game: GameState; n: Cluster }) {
  const act = useStore((s) => s.act);
  const at = anchorOf(game, n), d = game.devices.find((x) => x.id === at), sec = game.security;
  const hacked = sec.hacked.includes(n.id), offline = sec.offline.includes(n.id);
  const open = vulnerable(game, n);
  const patch = open && patchOut(game) && phpDue(game, n);
  const menu = (): MenuEntry[] => [...sitesMenu(game, n), patch && { label: "Patch PHP", run: () => act(upgradePhp, n.id) }];
  const [state, tone] = hacked ? ["Compromised", "bad"] : offline ? ["Offline", "warn"] : open ? ["Online", "accent"] : ["Online", "ok"];
  return (
    <tr onContextMenu={menuOn(menu)}>
      <td>{n.name}</td>
      <td>{d && devName(d)}</td>
      <td className="num">{n.php}</td>
      <td className="r num">{webOn(game, n.id).length}</td>
      <td><span className={`pill ${tone}`}>{state}</span></td>
      <td><span className={`pill ${open ? "warn" : "ok"}`}>{open ? "Unpatched" : "Patched"}</span></td>
      <td className="r">
        <span style={{ display: "inline-flex", gap: 6, justifyContent: "flex-end" }}>
          {hacked && <button className="btn" onClick={() => act(cleanUp, n.id)}>Clean up</button>}
          {open && <button className="btn" disabled={!patchOut(game) || !phpDue(game, n)} onClick={() => act(upgradePhp, n.id)}>Patch</button>}
          {open && patchOut(game) && at && <TechButton game={game} deviceId={at} kind="php" />}
          <More label={n.name} entries={menu} />
        </span>
      </td>
    </tr>
  );
}

// Hacked clusters the panel host table does not list (hypervisors, game panels, mail), each with its clean-up.
function Compromised({ game, skip }: { game: GameState; skip: Cluster[] }) {
  const act = useStore((s) => s.act);
  const hosts = game.clusters.filter((c) => game.security.hacked.includes(c.id) && !skip.includes(c));
  if (!hosts.length) return null;
  return (
    <table className="table">
      <thead><tr><th>Compromised host</th><th>Server</th><th /></tr></thead>
      <tbody>{hosts.map((c) => {
        const d = game.devices.find((x) => x.id === anchorOf(game, c));
        return (
          <tr key={c.id} onContextMenu={menuOn(() => [{ label: "Clean up", run: () => act(cleanUp, c.id) }])}>
            <td>{c.name}</td>
            <td>{d && devName(d)}</td>
            <td className="r"><button className="btn" onClick={() => act(cleanUp, c.id)}>Clean up</button></td>
          </tr>
        );
      })}</tbody>
    </table>
  );
}

const outcomeOf = (b: Breach): string =>
  b.decision === null ? "Open" : !b.sold ? "Data kept" : b.fine === null ? "Sold, fine pending" : b.fine === 0 ? "Sold, no fine" : `Sold, fined ${euro(b.fine)}`;

function Breaches({ game }: { game: GameState }) {
  return (
    <section className="fin-card" style={{ margin: 14 }}>
      <h3 className="fin-card-h">Breaches</h3>
      <table className="table">
        <thead><tr><th>Date</th><th>Host</th><th className="r">Ransom</th><th>Decision</th><th>Outcome</th></tr></thead>
        <tbody>
          {[...game.breaches].reverse().map((b) => (
            <tr key={b.ticketId}>
              <td className="num">{formatClock(b.hour)}</td>
              <td>{game.clusters.find((c) => c.id === b.hostId)?.name ?? b.hostId}</td>
              <td className="r num">{euro(b.ransom)}</td>
              <td>{b.decision === null ? "Undecided" : b.decision === "pay" ? "Paid" : "Refused"}</td>
              <td>{outcomeOf(b)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

// The software with an open high or critical vulnerability and its update, shown without Monitoring.
const SEVERITY: Record<Severity, [tone: string, name: string]> = { low: ["accent", "Low"], high: ["warn", "High"], critical: ["bad", "Critical"] };

const SoftwareCard = ({ game, cardRef }: { game: GameState; cardRef: React.RefObject<HTMLElement | null> }) => {
  const act = useStore((s) => s.act), rows = urgentSoftware(game);
  return (
    <section ref={cardRef} className="fin-card" style={{ margin: 14 }}>
      <h3 className="fin-card-h">Software</h3>
      {rows.length === 0 ? <div className="fin-card-b">No open vulnerabilities</div> : (
        <table className="table">
          <thead><tr><th>Software</th><th>Host</th><th>Severity</th><th className="r">Exposed</th><th /></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.clusterId}>
                <td>{r.software}</td>
                <td>{r.host}</td>
                <td><span className={`pill ${SEVERITY[r.worst][0]}`}>{SEVERITY[r.worst][1]}</span></td>
                <td className="r num">{r.days} d</td>
                <td className="r"><button className="btn" onClick={() => act(updateSoftware, r.clusterId)}>Update</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
};

// KVMs, console servers and OOB switches open to the internet, with their firmware's worst open vulnerability.
function ManagementCard({ game }: { game: GameState }) {
  const act = useStore((s) => s.act), rows = exposedDevices(game);
  if (!rows.length) return null;
  return (
    <section className="fin-card" style={{ margin: 14 }}>
      <h3 className="fin-card-h">Management access</h3>
      <table className="table">
        <thead><tr><th>Device</th><th>Model</th><th>Firmware</th><th>Severity</th><th className="r">Exposed</th><th /></tr></thead>
        <tbody>
          {rows.map((d) => {
            const top = firmwareVulns(game, d)[0];
            return (
              <tr key={d.id}>
                <td>{devName(d)}</td>
                <td>{modelById(d.model).name}</td>
                <td className="num">{d.fw?.version}</td>
                <td>{top ? <span className={`pill ${SEVERITY[top.severity][0]}`}>{SEVERITY[top.severity][1]}</span> : <span className="pill ok">Patched</span>}</td>
                <td className="r num">{top ? `${top.days} d` : ""}</td>
                <td className="r"><button className="btn" disabled={!firmwareDue(game, d)} onClick={() => act(updateFirmware, d.id)}>Update firmware</button></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}

export function SecurityApp() {
  const game = useStore((s) => s.game);
  const a = advisoryOf(game), nodes = advisoryNodes(game);
  const [tab, setTab] = useState<"advisories" | "incidents" | "monitoring">("advisories");
  const card = useRef<HTMLElement>(null);
  const monitored = game.installed.includes(MONITORING), view = monitored || tab !== "monitoring" ? tab : "advisories";
  const open = game.lossReports.filter((r) => r.items.some((i) => !i.restored)).length;
  useFocus("Security", (f) => {
    if (f.kind === "tab" && (f.id === "monitoring" || f.id === "incidents")) setTab(f.id);
    if (f.kind === "card" && f.id === "software") { setTab("advisories"); requestAnimationFrame(() => card.current?.scrollIntoView({ block: "start" })); }
  });
  return (
    <div className="fin">
      <div className="fin-main">
        <div className="vm-tools">
          <div className="seg" role="group" aria-label="View">
            <button aria-pressed={view === "advisories"} onClick={() => setTab("advisories")}>Advisories</button>
            <button aria-pressed={view === "incidents"} onClick={() => setTab("incidents")}>Incidents{open > 0 && <> <span className="num">{open}</span></>}</button>
            {monitored && <button aria-pressed={view === "monitoring"} onClick={() => setTab("monitoring")}>Monitoring</button>}
          </div>
        </div>
        {view === "monitoring" && <div className="fin-scroll"><MonitoringTab game={game} /></div>}
        {view === "incidents" && <div className="fin-scroll"><IncidentReports game={game} /></div>}
        {view === "advisories" && a && (
          <div className="vm-tools">
            <b>{a.title}</b>
            <span className="pill">PHP <span className="num">{a.versions}</span></span>
            <span className="grow" />
            <span>Patch <span className="num">{a.patchAt}</span></span>
          </div>
        )}
        {view === "advisories" && <div className="fin-scroll">
          <Compromised game={game} skip={nodes} />
          <SoftwareCard game={game} cardRef={card} />
          <ManagementCard game={game} />
          {nodes.length === 0 ? !game.breaches.length && <div className="fin-empty"><ShieldCheck />No affected panel hosts</div> : (
            <table className="table">
              <thead><tr><th>Panel host</th><th>Server</th><th>PHP</th><th className="r">Sites</th><th>Sites state</th><th>Patch</th><th /></tr></thead>
              <tbody>{nodes.map((n) => <NodeRow key={n.id} game={game} n={n} />)}</tbody>
            </table>
          )}
          {game.breaches.length > 0 && <Breaches game={game} />}
        </div>}
      </div>
    </div>
  );
}
