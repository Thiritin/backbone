import { MapPin } from "lucide-react";
import { euroCents } from "../../../sim/00-core/money";
import { dateOf } from "../../../sim/00-core/time";
import { handover, onCallAt } from "../../../sim/47-staff/oncall";
import type { Employee } from "../../../sim/47-staff/staff";
import { opLocation, techsAt, type TechRules } from "../../../sim/47-staff/technicians";
import type { GameState } from "../../../sim/50-state";
import { cancelOperation, setOnCall, setTechLocation, setTechRules } from "../../../sim/90-actions/staff";
import { useStore } from "../../store";
import { devName } from "../hw";
import { opLabel } from "../locations/TechButton";

const RULES: [keyof TechRules, string][] = [["failed", "Replace failed parts"], ["worn", "Replace worn parts"], ["blackhole", "Blackhole attacks"], ["updates", "Update vulnerable software"]];
const WEEK_OF = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" });

// A technician's location, the operations queued there, the location's on-call rotation and the rules all technicians follow.
export function TechPanel({ game, e }: { game: GameState; e: Employee }) {
  const act = useStore((s) => s.act);
  const queue = game.techOps.filter((o) => opLocation(game, o) === e.location);
  const crew = e.location ? techsAt(game, e.location, "hardware") : [];
  const now = e.location ? onCallAt(game, e.location, game.hour) : undefined;
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
      <h3>On call</h3>
      <div className="st-ops">
        {!crew.length && <div className="st-op st-none">No technician here is trained on part swaps.</div>}
        {crew.map((x) => {
          const p = game.onCall.month[x.id], calls = p?.callOuts ?? 0;
          return (
            <div key={x.id} className="st-op">
              <span>{x.name}</span>
              {now?.id === x.id && <span className="pill accent">On call</span>}
              <span className="grow" />
              <span className="st-cost num">{calls} {calls === 1 ? "call-out" : "call-outs"}</span>
              <span className="st-cost num">{euroCents((p?.allowance ?? 0) + (p?.callPay ?? 0))}</span>
              <input type="checkbox" role="switch" className="switch" aria-label={`${x.name} on call`} checked={game.onCall.roster.includes(x.id)}
                onChange={(ev) => act((s) => setOnCall(s, x.id, ev.target.checked))} />
            </div>
          );
        })}
      </div>
      {now && (
        <div className="st-ops">
          {[0, 1, 2, 3].map((k) => {
            const at = handover(game.hour, k);
            return (
              <div key={k} className="st-op">
                <span>{k ? WEEK_OF.format(dateOf(at)) : "This week"}</span>
                <span className="grow" />
                <span>{onCallAt(game, e.location!, at)?.name}</span>
              </div>
            );
          })}
        </div>
      )}
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
