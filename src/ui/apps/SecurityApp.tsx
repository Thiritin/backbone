import { ShieldCheck } from "lucide-react";
import { formatClock } from "../../sim/00-core/time";
import { t } from "../../i18n/en";
import type { GameState } from "../../sim/50-state";
import { clusterOf, type ClusterNode } from "../../sim/60-infra/cluster";
import { advisoryNodes, ADVISORY_KEYS, patchOut, STAGE_HOURS, vulnById, vulnerable, webOn } from "../../sim/60-infra/security";
import { phpDue, upgradeNodePhp } from "../../sim/90-actions/clusters";
import { cleanUp, setSitesOffline } from "../../sim/90-actions/security";
import { useStore } from "../store";
import { devName } from "./hw";
import { TechButton } from "./locations/TechButton";

// The advisory's current stage title, and the hour its patch is due.
export const advisoryOf = (game: GameState) => {
  const v = vulnById(game.security.vuln);
  return v && { title: t(`${ADVISORY_KEYS[game.security.stage]}.title`), patchAt: formatClock(v.at + STAGE_HOURS[3]), versions: v.versions.join(", ") };
};

function NodeRow({ game, n }: { game: GameState; n: ClusterNode }) {
  const act = useStore((s) => s.act);
  const d = game.devices.find((x) => x.id === n.deviceId), sec = game.security;
  const hacked = sec.hacked.includes(n.deviceId), offline = sec.offline.includes(n.deviceId);
  const open = vulnerable(game, n);
  const [state, tone] = hacked ? ["Compromised", "bad"] : offline ? ["Offline", "warn"] : open ? ["Online", "accent"] : ["Online", "ok"];
  return (
    <tr>
      <td>{d && devName(d)}</td>
      <td>{clusterOf(game, n.deviceId)?.name}</td>
      <td className="num">{n.php}</td>
      <td className="r num">{webOn(game, n.deviceId).length}</td>
      <td><span className={`pill ${tone}`}>{state}</span></td>
      <td><span className={`pill ${open ? "warn" : "ok"}`}>{open ? "Unpatched" : "Patched"}</span></td>
      <td className="r">
        <span style={{ display: "inline-flex", gap: 6, justifyContent: "flex-end" }}>
          {hacked && <button className="btn" onClick={() => act((g) => cleanUp(g, n.deviceId))}>Clean up</button>}
          {!hacked && (offline
            ? <button className="btn" onClick={() => act((g) => setSitesOffline(g, n.deviceId, false))}>Bring online</button>
            : <button className="btn" onClick={() => act((g) => setSitesOffline(g, n.deviceId, true))}>Take offline</button>)}
          {open && <button className="btn" disabled={!patchOut(game) || !phpDue(game, n)} onClick={() => act((g) => upgradeNodePhp(g, n.deviceId))}>Patch</button>}
          {open && patchOut(game) && <TechButton game={game} deviceId={n.deviceId} kind="php" />}
        </span>
      </td>
    </tr>
  );
}

export function SecurityApp() {
  const game = useStore((s) => s.game);
  const a = advisoryOf(game), nodes = advisoryNodes(game);
  return (
    <div className="fin">
      <div className="fin-main">
        {a && (
          <div className="vm-tools">
            <b>{a.title}</b>
            <span className="pill">PHP <span className="num">{a.versions}</span></span>
            <span className="grow" />
            <span>Patch <span className="num">{a.patchAt}</span></span>
          </div>
        )}
        <div className="fin-scroll">
          {nodes.length === 0 ? <div className="fin-empty"><ShieldCheck />No affected nodes</div> : (
            <table className="table">
              <thead><tr><th>Node</th><th>Cluster</th><th>PHP</th><th className="r">Sites</th><th>Sites state</th><th>Patch</th><th /></tr></thead>
              <tbody>{nodes.map((n) => <NodeRow key={n.deviceId} game={game} n={n} />)}</tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
