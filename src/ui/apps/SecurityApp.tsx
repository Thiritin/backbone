import { ShieldCheck } from "lucide-react";
import { useState } from "react";
import { formatClock } from "../../sim/00-core/time";
import { t } from "../../i18n/en";
import type { GameState } from "../../sim/50-state";
import { anchorOf, type Cluster } from "../../sim/60-infra/cluster";
import { advisoryNodes, ADVISORY_KEYS, MONITORING, patchOut, STAGE_HOURS, vulnById, vulnerable, webOn } from "../../sim/60-infra/security";
import { phpDue, upgradePhp } from "../../sim/90-actions/clusters";
import { cleanUp } from "../../sim/90-actions/security";
import { menuOn, type MenuEntry } from "../desktop/ContextMenu";
import { useFocus, useStore } from "../store";
import { devName } from "./hw";
import { TechButton } from "./locations/TechButton";
import { MonitoringTab } from "./Monitoring";
import { More } from "./More";
import { sitesMenu } from "./products/PanelHosts";

// The advisory's current stage title, and the hour its patch is due.
export const advisoryOf = (game: GameState) => {
  const v = vulnById(game.security.vuln);
  return v && { title: t(`${ADVISORY_KEYS[game.security.stage]}.title`), patchAt: formatClock(v.at + STAGE_HOURS[3]), versions: v.versions.join(", ") };
};

function NodeRow({ game, n }: { game: GameState; n: Cluster }) {
  const act = useStore((s) => s.act);
  const at = anchorOf(game, n), d = game.devices.find((x) => x.id === at), sec = game.security;
  const hacked = sec.hacked.includes(n.id), offline = sec.offline.includes(n.id);
  const open = vulnerable(game, n);
  const patch = open && patchOut(game) && phpDue(game, n);
  const menu = (): MenuEntry[] => [...sitesMenu(game, n), patch && { label: "Patch PHP", run: () => act((g) => upgradePhp(g, n.id)) }];
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
          {hacked && <button className="btn" onClick={() => act((g) => cleanUp(g, n.id))}>Clean up</button>}
          {open && <button className="btn" disabled={!patchOut(game) || !phpDue(game, n)} onClick={() => act((g) => upgradePhp(g, n.id))}>Patch</button>}
          {open && patchOut(game) && at && <TechButton game={game} deviceId={at} kind="php" />}
          <More label={n.name} entries={menu} />
        </span>
      </td>
    </tr>
  );
}

export function SecurityApp() {
  const game = useStore((s) => s.game);
  const a = advisoryOf(game), nodes = advisoryNodes(game);
  const [tab, setTab] = useState<"advisories" | "monitoring">("advisories");
  const monitored = game.installed.includes(MONITORING), view = monitored ? tab : "advisories";
  useFocus("Security", (f) => { if (f.kind === "tab" && f.id === "monitoring") setTab("monitoring"); });
  return (
    <div className="fin">
      <div className="fin-main">
        {monitored && (
          <div className="vm-tools">
            <div className="seg" role="group" aria-label="View">
              <button aria-pressed={view === "advisories"} onClick={() => setTab("advisories")}>Advisories</button>
              <button aria-pressed={view === "monitoring"} onClick={() => setTab("monitoring")}>Monitoring</button>
            </div>
          </div>
        )}
        {view === "monitoring" && <div className="fin-scroll"><MonitoringTab game={game} /></div>}
        {view === "advisories" && a && (
          <div className="vm-tools">
            <b>{a.title}</b>
            <span className="pill">PHP <span className="num">{a.versions}</span></span>
            <span className="grow" />
            <span>Patch <span className="num">{a.patchAt}</span></span>
          </div>
        )}
        {view === "advisories" && <div className="fin-scroll">
          {nodes.length === 0 ? <div className="fin-empty"><ShieldCheck />No affected panel hosts</div> : (
            <table className="table">
              <thead><tr><th>Panel host</th><th>Server</th><th>PHP</th><th className="r">Sites</th><th>Sites state</th><th>Patch</th><th /></tr></thead>
              <tbody>{nodes.map((n) => <NodeRow key={n.id} game={game} n={n} />)}</tbody>
            </table>
          )}
        </div>}
      </div>
    </div>
  );
}
