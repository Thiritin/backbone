import { MapPin } from "lucide-react";
import type { Employee } from "../../../sim/47-staff/staff";
import { opLocation, type TechRules } from "../../../sim/47-staff/technicians";
import type { GameState } from "../../../sim/50-state";
import { cancelOperation, setTechLocation, setTechRules } from "../../../sim/90-actions/staff";
import { useStore } from "../../store";
import { devName } from "../hw";
import { opLabel } from "../locations/TechButton";

const RULES: [keyof TechRules, string][] = [["failed", "Replace failed parts"], ["worn", "Replace worn parts"]];

// A technician's location, the operations queued there and the repair rules all technicians follow.
export function TechPanel({ game, e }: { game: GameState; e: Employee }) {
  const act = useStore((s) => s.act);
  const queue = game.techOps.filter((o) => opLocation(game, o) === e.location);
  return (
    <>
      <h3>Location</h3>
      <div className="seg" role="group" aria-label="Location">
        {game.locations.map((l) => (
          <button key={l.id} aria-pressed={e.location === l.id} onClick={() => act((s) => setTechLocation(s, e.id, l.id))}><MapPin />{l.name}</button>
        ))}
      </div>
      <h3>Queue</h3>
      <div className="st-ops">
        {!queue.length && <div className="st-op st-none">The queue is empty.</div>}
        {queue.map((o) => {
          const d = game.devices.find((x) => x.id === o.deviceId);
          return (
            <div key={o.id} className="st-op">
              <span>{opLabel(game, o)}</span>
              <span className="st-cost">{d ? devName(d) : ""}</span>
              {o.auto && <span className="pill">Rule</span>}
              <span className="grow" />
              <button className="btn" onClick={() => act((s) => cancelOperation(s, o.id))}>Cancel</button>
            </div>
          );
        })}
      </div>
      <h3>Rules</h3>
      <div className="st-ops">
        {RULES.map(([k, label]) => (
          <div key={k} className="st-op">
            <span>{label}</span>
            <span className="grow" />
            <input type="checkbox" role="switch" className="switch" aria-label={label} checked={game.techRules[k]}
              onChange={(ev) => act((s) => setTechRules(s, { [k]: ev.target.checked }))} />
          </div>
        ))}
      </div>
    </>
  );
}
