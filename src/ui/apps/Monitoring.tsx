import { ShieldCheck } from "lucide-react";
import { useState } from "react";
import { formatClock } from "../../sim/00-core/time";
import { APP_NAME, NOTIFY_BATCH, NOTIFY_MINUTES } from "../../sim/10-catalog/apps";
import { softwareById } from "../../sim/10-catalog/platforms";
import type { GameState } from "../../sim/50-state";
import { anchorOf } from "../../sim/60-infra/cluster";
import { appMonitoring, cleanSite, notifyCustomers, type AppRow } from "../../sim/60-infra/apps";
import { monitoring, type MonitorRow, type Severity } from "../../sim/60-infra/vulns";
import { updateDue, updateSoftware } from "../../sim/90-actions/software";
import { cleanUp } from "../../sim/90-actions/security";
import { menuOn, type MenuEntry } from "../desktop/ContextMenu";
import { useStore } from "../store";
import { devName } from "./hw";
import { TechButton, techItem } from "./locations/TechButton";
import { More } from "./More";

const TONE: Record<Severity, string> = { low: "accent", high: "warn", critical: "bad" };
const NAME: Record<Severity, string> = { low: "Low", high: "High", critical: "Critical" };

function Row({ game, m }: { game: GameState; m: MonitorRow }) {
  const act = useStore((s) => s.act);
  const c = m.cluster, at = anchorOf(game, c), d = game.devices.find((x) => x.id === at);
  const due = updateDue(game, c), hacked = game.security.hacked.includes(c.id);
  const menu = (): MenuEntry[] => [
    { label: "Update", disabled: !due, run: () => act(updateSoftware, c.id) },
    due && at ? techItem(game, at, "update", c.id) : undefined,
    hacked && { label: "Clean up", run: () => act(cleanUp, c.id) },
  ];
  return (
    <tr onContextMenu={menuOn(menu)}>
      <td>{softwareById(m.family).name}</td>
      <td className="num">{c.version}</td>
      <td>{m.worst ? <span className={`pill ${TONE[m.worst]}`}>{NAME[m.worst]}</span> : <span className="pill ok">None</span>}</td>
      <td className="r num">{m.worst ? `${m.days} d` : ""}</td>
      <td>{d ? devName(d) : c.name}</td>
      <td><span className={`pill ${hacked ? "bad" : "ok"}`}>{hacked ? "Compromised" : "Online"}</span></td>
      <td className="r">
        <span style={{ display: "inline-flex", gap: 6, justifyContent: "flex-end" }}>
          {hacked && <button className="btn" onClick={() => act(cleanUp, c.id)}>Clean up</button>}
          {due && <button className="btn" onClick={() => act(updateSoftware, c.id)}>Update</button>}
          {due && at && <TechButton game={game} deviceId={at} kind="update" componentId={c.id} />}
          <More label={c.name} entries={menu} />
        </span>
      </td>
    </tr>
  );
}

function AppRowView({ r }: { r: AppRow }) {
  const act = useStore((s) => s.act), minutes = Math.ceil(r.unnotified / NOTIFY_BATCH) * NOTIFY_MINUTES;
  const notify = () => r.vuln && act(notifyCustomers, r.app, r.vuln!.id);
  const menu = (): MenuEntry[] => [{ label: "Notify customers", disabled: !r.unnotified, run: notify }];
  return (
    <tr onContextMenu={menuOn(menu)}>
      <td>{APP_NAME[r.app]}</td>
      <td className="num">{r.vuln ? formatClock(r.vuln.patchedAt).split(" · ")[0] : ""}</td>
      <td>{r.vuln ? <span className={`pill ${TONE[r.vuln.severity]}`}>{NAME[r.vuln.severity]}</span> : <span className="pill ok">None</span>}</td>
      <td className="r num">{r.vuln ? `${r.days} d` : ""}</td>
      <td className="r num">{r.sites}</td>
      <td className="r num">{r.vuln ? r.unnotified : ""}</td>
      <td className="r">
        {r.vuln && (
          <span style={{ display: "inline-flex", gap: 6, justifyContent: "flex-end" }}>
            <button className="btn" disabled={!r.unnotified} onClick={notify}>Notify customers{!!r.unnotified && <span className="num">({minutes} min)</span>}</button>
            <More label={APP_NAME[r.app]} entries={menu} />
          </span>
        )}
      </td>
    </tr>
  );
}

function DefacedRow({ game, id }: { game: GameState; id: string }) {
  const act = useStore((s) => s.act), v = game.services.find((x) => x.id === id), c = v && game.customers.find((x) => x.id === v.customerId);
  if (!v || !c) return null;
  return (
    <tr onContextMenu={menuOn(() => [{ label: "Clean up", run: () => act(cleanSite, id) }])}>
      <td>{v.label}</td>
      <td>{c.name}</td>
      <td>{APP_NAME[v.spec.app!]}</td>
      <td><span className="pill bad">Defaced</span></td>
      <td className="r"><button className="btn" onClick={() => act(cleanSite, id)}>Clean up</button></td>
    </tr>
  );
}

// Customer sites by app and vulnerability, with the defaced ones to clean up.
function CustomerSites({ game }: { game: GameState }) {
  const rows = appMonitoring(game), defaced = game.sites.defaced;
  if (!rows.length && !defaced.length) return <div className="fin-empty"><ShieldCheck />No customer sites</div>;
  return (
    <>
      {rows.length > 0 && (
        <table className="table">
          <thead><tr><th>Customer software</th><th>Patched</th><th>Worst</th><th className="r">Exposed</th><th className="r">Sites</th><th className="r">Not notified</th><th /></tr></thead>
          <tbody>{rows.map((r) => <AppRowView key={`${r.app}-${r.vuln?.id ?? ""}`} r={r} />)}</tbody>
        </table>
      )}
      {defaced.length > 0 && (
        <table className="table">
          <thead><tr><th>Site</th><th>Customer</th><th>Software</th><th>State</th><th /></tr></thead>
          <tbody>{defaced.map((id) => <DefacedRow key={id} game={game} id={id} />)}</tbody>
        </table>
      )}
    </>
  );
}

// Every installed software with its version and worst open vulnerability, most exposed first, and the customers' sites; the
// chips pick which of the two are listed.
export function MonitoringTab({ game }: { game: GameState }) {
  const [show, setShow] = useState({ own: true, sites: true });
  const rows = monitoring(game);
  const flip = (k: keyof typeof show) => setShow((x) => ({ ...x, [k]: !x[k] }));
  return (
    <>
      <div className="vm-tools">
        <div className="seg" role="group" aria-label="Show">
          <button aria-pressed={show.own} onClick={() => flip("own")}>Own software</button>
          <button aria-pressed={show.sites} onClick={() => flip("sites")}>Customer sites</button>
        </div>
      </div>
      {show.own && (rows.length ? (
        <table className="table">
          <thead><tr><th>Software</th><th>Version</th><th>Worst</th><th className="r">Exposed</th><th>Host</th><th>State</th><th /></tr></thead>
          <tbody>{rows.map((m) => <Row key={m.cluster.id} game={game} m={m} />)}</tbody>
        </table>
      ) : !show.sites && <div className="fin-empty"><ShieldCheck />No installed software</div>)}
      {show.sites && <CustomerSites game={game} />}
    </>
  );
}
