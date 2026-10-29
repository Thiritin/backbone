import { Power } from "lucide-react";
import type { Device, GameState } from "../../../sim/50-state";
import { workloadsOn } from "../../../sim/60-infra/cluster";
import { recover, restoreWorkload } from "../../../sim/90-actions/vms";
import { useStore } from "../../store";
import { TechButton } from "./TechButton";
import { powerOptions, type PowerOp } from "./power";

const HANDS: Record<"pull" | "bmcreset", string> = { pull: "Pulling power", bmcreset: "Resetting controller" };

// The power actions of a mounted server, the pending hand task, and the workloads a pulled plug corrupted.
export function PowerCard({ game, device, onOp }: { game: GameState; device: Device; onOp: (op: PowerOp) => void }) {
  const act = useStore((s) => s.act);
  const { via: bmc, pdu, options } = powerOptions(game, device), via = bmc ?? (pdu ? "PDU" : null);
  const bad = workloadsOn(game, device.id).filter((w) => w.corrupted);
  return (
    <div className="loc-card">
      <div className="loc-card-h">
        <h3><Power />Power{via && <span className="loc-muted"> via {via}</span>}</h3>
        {device.hands && <span className="pill accent">{HANDS[device.hands.kind]}</span>}
      </div>
      <div className="loc-row insp-power-row">
        {options.map((o) => <button key={o.op} className="btn" disabled={o.disabled} onClick={() => onOp(o.op)}>{o.label}</button>)}
        {device.hung && <TechButton game={game} deviceId={device.id} kind="reset" />}
        {device.bmcHung && !device.hands && <TechButton game={game} deviceId={device.id} kind="bmcreset" />}
      </div>
      {bad.length > 0 && (
        <table className="table loc-parts">
          <tbody>
            {bad.map((w) => (
              <tr key={w.id}>
                <td>{w.hostname ?? w.id}</td>
                <td className="loc-muted">{w.recoverDoneAt !== undefined ? "Recovering" : w.recoverFailed ? "Needs restore" : "Corrupted"}</td>
                <td className="insp-power-acts">
                  {w.recoverFailed
                    ? <button className="btn" onClick={() => act((g) => restoreWorkload(g, w.id))}>Restore</button>
                    : w.recoverDoneAt === undefined && <>
                      <button className="btn" onClick={() => act((g) => recover(g, w.id))}>Recover</button>
                      <TechButton game={game} deviceId={device.id} kind="recover" componentId={w.id} />
                    </>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
