import { ShieldCheck } from "lucide-react";
import { useRef, useState } from "react";
import { euro, euroCents } from "../../sim/00-core/money";
import { formatClock } from "../../sim/00-core/time";
import { t } from "../../i18n/en";
import type { GameState } from "../../sim/50-state";
import type { Breach } from "../../sim/60-infra/breach";
import { anchorOf, type Cluster } from "../../sim/60-infra/cluster";
import { advisoryNodes, ADVISORY_KEYS, MONITORING, patchOut, STAGE_HOURS, vulnById, vulnerable, webOn } from "../../sim/60-infra/security";
import { phpDue, upgradePhp } from "../../sim/90-actions/clusters";
import { urgentSoftware, type Severity } from "../../sim/60-infra/vulns";
import { cleanSite, cleanUp, offerCleanup, remindCustomer, setSitesOffline } from "../../sim/90-actions/security";
import { cleanupPrice, hasBackup } from "../../sim/60-infra/apps";
import { suspendService } from "../../sim/90-actions/holds";
import { APP_NAME } from "../../sim/10-catalog/apps";
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
  if (sec.hacked.includes(host.id)) return [{ label: t("apps.security.sitesCleanUp"), run: () => act(cleanUp, host.id) }];
  const off = sec.offline.includes(host.id);
  return [{ label: off ? t("apps.security.sitesOnline") : t("apps.security.sitesOffline"), run: () => act(setSitesOffline, host.id, !off) }];
}

function NodeRow({ game, n }: { game: GameState; n: Cluster }) {
  const act = useStore((s) => s.act);
  const at = anchorOf(game, n), d = game.devices.find((x) => x.id === at), sec = game.security;
  const hacked = sec.hacked.includes(n.id), offline = sec.offline.includes(n.id);
  const open = vulnerable(game, n);
  const patch = open && patchOut(game) && phpDue(game, n);
  const menu = (): MenuEntry[] => [...sitesMenu(game, n), patch && { label: t("apps.security.patchPhp"), run: () => act(upgradePhp, n.id) }];
  const [state, tone] = hacked ? [t("apps.compromised"), "bad"] : offline ? [t("apps.offline"), "warn"] : open ? [t("apps.online"), "accent"] : [t("apps.online"), "ok"];
  return (
    <tr onContextMenu={menuOn(menu)}>
      <td>{n.name}</td>
      <td>{d && devName(d)}</td>
      <td className="num">{n.php}</td>
      <td className="r num">{webOn(game, n.id).length}</td>
      <td><span className={`pill ${tone}`}>{state}</span></td>
      <td><span className={`pill ${open ? "warn" : "ok"}`}>{open ? t("apps.unpatched") : t("apps.patched")}</span></td>
      <td className="r">
        <span style={{ display: "inline-flex", gap: 6, justifyContent: "flex-end" }}>
          {hacked && <button className="btn" onClick={() => act(cleanUp, n.id)}>{t("apps.cleanUp")}</button>}
          {open && <button className="btn" disabled={!patchOut(game) || !phpDue(game, n)} onClick={() => act(upgradePhp, n.id)}>{t("apps.patch")}</button>}
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
      <thead><tr><th>{t("apps.security.compromisedHost")}</th><th>{t("apps.server")}</th><th /></tr></thead>
      <tbody>{hosts.map((c) => {
        const d = game.devices.find((x) => x.id === anchorOf(game, c));
        return (
          <tr key={c.id} onContextMenu={menuOn(() => [{ label: t("apps.cleanUp"), run: () => act(cleanUp, c.id) }])}>
            <td>{c.name}</td>
            <td>{d && devName(d)}</td>
            <td className="r"><button className="btn" onClick={() => act(cleanUp, c.id)}>{t("apps.cleanUp")}</button></td>
          </tr>
        );
      })}</tbody>
    </table>
  );
}

// Defaced customer sites that send spam: restored from a backup, their owner offered paid clean-up or reminded, or suspended
// with a notice that names the hack.
function DefacedSites({ game }: { game: GameState }) {
  const act = useStore((s) => s.act);
  const sites = game.sites.defaced.flatMap((id) => {
    const v = game.services.find((x) => x.id === id && x.endedAt === null), c = v && game.customers.find((x) => x.id === v.customerId);
    return v && c ? [{ v, c }] : [];
  });
  if (!sites.length) return null;
  return (
    <table className="table">
      <thead><tr><th>{t("apps.security.defacedSite")}</th><th>{t("apps.monitoring.customer")}</th><th>{t("apps.software")}</th><th>{t("apps.state")}</th><th /></tr></thead>
      <tbody>{sites.map(({ v, c }) => {
        const held = !!game.heldServices[v.id], offered = game.sites.notified.includes(`${v.id}|offer`), reminded = game.sites.notified.includes(`${v.id}|remind`);
        const price = euroCents(cleanupPrice(game, c));
        const menu = (): MenuEntry[] => [
          hasBackup(game, v.id) && { label: t("apps.security.restore"), run: () => act(cleanSite, v.id) },
          !offered && { label: t("apps.security.offerCleanupFor", { price }), run: () => act(offerCleanup, v.id) },
          !reminded && { label: t("apps.security.remind"), run: () => act(remindCustomer, v.id) },
          !held && { label: t("apps.security.suspendAbuse"), run: () => act(suspendService, v.id, "abuse") },
        ];
        return (
          <tr key={v.id} id={`site-${v.id}`} onContextMenu={menuOn(menu)}>
            <td>{v.label}</td>
            <td>{c.name}</td>
            <td>{APP_NAME[v.spec.app!]}</td>
            <td>
              <span className="pill bad">{t("apps.defaced")}</span>
              {held && <> <span className="pill warn">{t("apps.security.suspended")}</span></>}
              {offered && <> <span className="pill">{t("apps.security.offerDeclined")}</span></>}
              {reminded && <> <span className="pill">{t("apps.security.reminded")}</span></>}
            </td>
            <td className="r">
              <span style={{ display: "inline-flex", gap: 6, justifyContent: "flex-end" }}>
                <button className="btn" disabled={!hasBackup(game, v.id)} onClick={() => act(cleanSite, v.id)}>{t("apps.security.restore")}</button>
                <button className="btn" disabled={offered} onClick={() => act(offerCleanup, v.id)}>{t("apps.security.offerCleanup")} <span className="num">{price}</span></button>
                <button className="btn" disabled={reminded} onClick={() => act(remindCustomer, v.id)}>{t("apps.security.remind")}</button>
                <button className="btn" disabled={held} onClick={() => act(suspendService, v.id, "abuse")}>{t("apps.security.suspendAbuse")}</button>
              </span>
            </td>
          </tr>
        );
      })}</tbody>
    </table>
  );
}

const outcomeOf = (b: Breach): string =>
  b.decision === null ? t("apps.security.outcomeOpen") : !b.sold ? t("apps.security.outcomeKept") : b.fine === null ? t("apps.security.outcomePending") : b.fine === 0 ? t("apps.security.outcomeNoFine") : t("apps.security.outcomeFined", { amount: euro(b.fine) });

function Breaches({ game }: { game: GameState }) {
  return (
    <section className="fin-card" style={{ margin: 14 }}>
      <h3 className="fin-card-h">{t("apps.security.breaches")}</h3>
      <table className="table">
        <thead><tr><th>{t("apps.date")}</th><th>{t("apps.host")}</th><th className="r">{t("apps.security.ransom")}</th><th>{t("apps.security.decision")}</th><th>{t("apps.security.outcome")}</th></tr></thead>
        <tbody>
          {[...game.breaches].reverse().map((b) => (
            <tr key={b.ticketId}>
              <td className="num">{formatClock(b.hour)}</td>
              <td>{game.clusters.find((c) => c.id === b.hostId)?.name ?? b.hostId}</td>
              <td className="r num">{euro(b.ransom)}</td>
              <td>{b.decision === null ? t("apps.security.undecided") : b.decision === "pay" ? t("apps.security.paid") : t("apps.security.refused")}</td>
              <td>{outcomeOf(b)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

// The software with an open high or critical vulnerability and its update, shown without Monitoring.
const SEVERITY: Record<Severity, [tone: string, name: string]> = { low: ["accent", t("apps.severity.low")], high: ["warn", t("apps.severity.high")], critical: ["bad", t("apps.severity.critical")] };

const SoftwareCard = ({ game, cardRef }: { game: GameState; cardRef: React.RefObject<HTMLElement | null> }) => {
  const act = useStore((s) => s.act), rows = urgentSoftware(game);
  return (
    <section ref={cardRef} className="fin-card" style={{ margin: 14 }}>
      <h3 className="fin-card-h">{t("apps.software")}</h3>
      {rows.length === 0 ? <div className="fin-card-b">{t("apps.security.noVulns")}</div> : (
        <table className="table">
          <thead><tr><th>{t("apps.software")}</th><th>{t("apps.host")}</th><th>{t("apps.severity")}</th><th className="r">{t("apps.exposed")}</th><th /></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.clusterId}>
                <td>{r.software}</td>
                <td>{r.host}</td>
                <td><span className={`pill ${SEVERITY[r.worst][0]}`}>{SEVERITY[r.worst][1]}</span></td>
                <td className="r num">{t("apps.days", { n: r.days })}</td>
                <td className="r"><button className="btn" onClick={() => act(updateSoftware, r.clusterId)}>{t("apps.update")}</button></td>
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
      <h3 className="fin-card-h">{t("apps.security.management")}</h3>
      <table className="table">
        <thead><tr><th>{t("apps.device")}</th><th>{t("apps.model")}</th><th>{t("apps.security.firmware")}</th><th>{t("apps.severity")}</th><th className="r">{t("apps.exposed")}</th><th /></tr></thead>
        <tbody>
          {rows.map((d) => {
            const top = firmwareVulns(game, d)[0];
            return (
              <tr key={d.id}>
                <td>{devName(d)}</td>
                <td>{modelById(d.model).name}</td>
                <td className="num">{d.fw?.version}</td>
                <td>{top ? <span className={`pill ${SEVERITY[top.severity][0]}`}>{SEVERITY[top.severity][1]}</span> : <span className="pill ok">{t("apps.patched")}</span>}</td>
                <td className="r num">{top ? t("apps.days", { n: top.days }) : ""}</td>
                <td className="r"><button className="btn" disabled={!firmwareDue(game, d)} onClick={() => act(updateFirmware, d.id)}>{t("apps.security.updateFirmware")}</button></td>
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
    if (f.kind === "site") { setTab("advisories"); requestAnimationFrame(() => document.getElementById(`site-${f.id}`)?.scrollIntoView({ block: "nearest" })); }
    if (f.kind === "card" && f.id === "software") { setTab("advisories"); requestAnimationFrame(() => card.current?.scrollIntoView({ block: "start" })); }
  });
  return (
    <div className="fin">
      <div className="fin-main">
        <div className="vm-tools">
          <div className="seg" role="group" aria-label={t("apps.security.view")}>
            <button aria-pressed={view === "advisories"} onClick={() => setTab("advisories")}>{t("apps.security.advisories")}</button>
            <button aria-pressed={view === "incidents"} onClick={() => setTab("incidents")}>{t("apps.security.incidents")}{open > 0 && <> <span className="num">{open}</span></>}</button>
            {monitored && <button aria-pressed={view === "monitoring"} onClick={() => setTab("monitoring")}>{t("apps.security.monitoring")}</button>}
          </div>
        </div>
        {view === "monitoring" && <div className="fin-scroll"><MonitoringTab game={game} /></div>}
        {view === "incidents" && <div className="fin-scroll"><IncidentReports game={game} /></div>}
        {view === "advisories" && a && (
          <div className="vm-tools">
            <b>{a.title}</b>
            <span className="pill">PHP <span className="num">{a.versions}</span></span>
            <span className="grow" />
            <span>{t("apps.security.patchAt")} <span className="num">{a.patchAt}</span></span>
          </div>
        )}
        {view === "advisories" && <div className="fin-scroll">
          <DefacedSites game={game} />
          <Compromised game={game} skip={nodes} />
          <SoftwareCard game={game} cardRef={card} />
          <ManagementCard game={game} />
          {nodes.length === 0 ? !game.breaches.length && !game.sites.defaced.length && <div className="fin-empty"><ShieldCheck />{t("apps.security.noHosts")}</div> : (
            <table className="table">
              <thead><tr><th>{t("apps.security.panelHost")}</th><th>{t("apps.server")}</th><th>PHP</th><th className="r">{t("apps.sites")}</th><th>{t("apps.security.sitesState")}</th><th>{t("apps.patch")}</th><th /></tr></thead>
              <tbody>{nodes.map((n) => <NodeRow key={n.id} game={game} n={n} />)}</tbody>
            </table>
          )}
          {game.breaches.length > 0 && <Breaches game={game} />}
        </div>}
      </div>
    </div>
  );
}
