import { ShieldCheck } from "lucide-react";
import { softwareById } from "../../sim/10-catalog/platforms";
import type { GameState } from "../../sim/50-state";
import { anchorOf } from "../../sim/60-infra/cluster";
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
    { label: "Update", disabled: !due, run: () => act((g) => updateSoftware(g, c.id)) },
    due && at ? techItem(game, at, "update", c.id) : undefined,
    hacked && { label: "Clean up", run: () => act((g) => cleanUp(g, c.id)) },
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
          {hacked && <button className="btn" onClick={() => act((g) => cleanUp(g, c.id))}>Clean up</button>}
          {due && <button className="btn" onClick={() => act((g) => updateSoftware(g, c.id))}>Update</button>}
          {due && at && <TechButton game={game} deviceId={at} kind="update" componentId={c.id} />}
          <More label={c.name} entries={menu} />
        </span>
      </td>
    </tr>
  );
}

// Every installed software with its version and worst open vulnerability, most exposed first.
export function MonitoringTab({ game }: { game: GameState }) {
  const rows = monitoring(game);
  if (!rows.length) return <div className="fin-empty"><ShieldCheck />No installed software</div>;
  return (
    <table className="table">
      <thead><tr><th>Software</th><th>Version</th><th>Worst</th><th className="r">Exposed</th><th>Host</th><th>State</th><th /></tr></thead>
      <tbody>{rows.map((m) => <Row key={m.cluster.id} game={game} m={m} />)}</tbody>
    </table>
  );
}
