import type { ReactNode } from "react";
import { Hand, Power, PowerOff } from "lucide-react";
import type { Device, GameState } from "../../../sim/50-state";
import { workloadsOn } from "../../../sim/60-infra/cluster";
import { recover, restoreWorkload } from "../../../sim/90-actions/vms";
import { useStore } from "../../store";
import { TechButton } from "./TechButton";
import { ActionTile } from "../software/Software";
import { FRONT_BUSY, frontOptions, handsLabel, POWER_ICON, powerOptions, type PowerOp } from "./power";
import type { FrontOp } from "../../../sim/60-infra/power";

// The power actions of a mounted server from afar and at the machine, extra action groups, the pending hand task, and the workloads a pulled plug corrupted.
export function PowerCard({ game, device, onOp, onFront, children }: { game: GameState; device: Device; onOp: (op: PowerOp) => void; onFront: (op: FrontOp) => void; children?: ReactNode }) {
  const act = useStore((s) => s.act);
  const { via: bmc, pdu, options } = powerOptions(game, device), via = bmc ?? (pdu ? "PDU" : null);
  const bad = workloadsOn(game, device.id).filter((w) => w.corrupted);
  return (
    <div className="loc-card">
      <div className="act-groups">
        {options.length > 0 && (
          <div>
            <div className="loc-card-h">
              <h3><Power />Power{via && <span className="loc-muted"> via {via}</span>}</h3>
              {device.hands && <span className="pill accent">{FRONT_BUSY[device.hands.kind]}</span>}
            </div>
            <div className="act-tiles">
              {options.map((o) => <ActionTile key={o.op} icon={POWER_ICON[o.op]} label={o.label} disabled={o.disabled} onClick={() => onOp(o.op)} />)}
            </div>
          </div>
        )}
        <div>
          <div className="loc-card-h">
            <h3><Hand />{handsLabel(game, device)}</h3>
            {!options.length && device.hands && <span className="pill accent">{FRONT_BUSY[device.hands.kind]}</span>}
          </div>
          <div className="act-tiles">
            {frontOptions(game, device).map((o) => <ActionTile key={o.op} icon={device.on ? Power : PowerOff} label={o.label} disabled={o.disabled} onClick={() => onFront(o.op)} />)}
          </div>
        </div>
        {children}
      </div>
      {(device.hung || (device.bmcHung && !device.hands)) && (
        <div className="loc-row insp-power-row">
          {device.hung && <TechButton game={game} deviceId={device.id} kind="reset" />}
          {device.bmcHung && !device.hands && <TechButton game={game} deviceId={device.id} kind="bmcreset" />}
        </div>
      )}
      {bad.length > 0 && (
        <table className="table loc-parts">
          <tbody>
            {bad.map((w) => (
              <tr key={w.id}>
                <td>{w.hostname ?? w.id}</td>
                <td className="loc-muted">{w.recoverDoneAt !== undefined ? "Recovering" : w.recoverFailed ? "Needs restore" : "Corrupted"}</td>
                <td className="insp-power-acts">
                  {w.recoverFailed
                    ? <button className="btn" onClick={() => act(restoreWorkload, w.id)}>Restore</button>
                    : w.recoverDoneAt === undefined && <>
                      <button className="btn" onClick={() => act(recover, w.id)}>Recover</button>
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
