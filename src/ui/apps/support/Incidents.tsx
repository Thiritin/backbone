import { useState } from "react";
import type { Incident, IncidentCause } from "../../../sim/60-infra/ops";
import { duration } from "../../../i18n/en-ops";
import { useStore } from "../../store";
import { CustomerLink } from "../customers/CustomersApp";
import { day } from "../hw";
import { stamp } from "./labels";

const CAUSE: Record<IncidentCause, string> = { grid: "Grid outage", generator: "Generator failure", seizure: "Server seized" };

const impact = (i: Incident) => (i.cause === "seizure" ? `Until ${day(i.returnAt!)}` : i.dark ? `${duration(i.dark)} dark` : "No downtime");

export function Incidents() {
  const game = useStore((s) => s.game);
  const list = [...game.ops.incidents].sort((a, b) => b.hour - a.hour);
  const [sel, setSel] = useState<string | null>(list[0]?.id ?? null);
  const current = list.find((i) => i.id === sel);
  const where = (i: Incident) => game.locations.find((l) => l.id === i.locationId)?.name ?? "";

  return (
    <>
      <div className="sup-list" role="list">
        <div className="sup-list-h"><h2>Incidents</h2></div>
        {list.map((i) => (
          <button key={i.id} role="listitem" className={`tk${i.id === sel ? " active" : ""}`} onClick={() => setSel(i.id)}>
            <span className="who"><span>{CAUSE[i.cause]}</span></span>
            <span className="sla num">{stamp(i.hour)}</span>
            <span className="subj">{where(i)} · {impact(i)}</span>
          </button>
        ))}
        {!list.length && <div className="sup-none">No incidents</div>}
      </div>

      {current ? (
        <div className="sup-detail">
          <div className="d-head">
            <div className="top"><h2>{CAUSE[current.cause]} · {where(current)}</h2><span className="id num">#{current.id.slice(3)}</span></div>
            <div className="facts"><span>Started <span className="num">{stamp(current.hour)}</span></span></div>
          </div>
          <dl className="inc-facts">
            {current.cause === "seizure" ? (
              <>
                <dt>Agency</dt><dd>{current.agency}</dd>
                <dt>Returns</dt><dd className="num">{day(current.returnAt!)}</dd>
              </>
            ) : (
              <>
                <dt>Grid down</dt><dd className="num">{duration(current.minutes)}</dd>
                <dt>Servers without power</dt><dd className="num">{current.dark ? duration(current.dark) : "None"}</dd>
              </>
            )}
            <dt>Devices</dt><dd>{current.devices.join(", ") || "None"}</dd>
            <dt>Customers</dt>
            <dd className="inc-customers">
              {current.customers.map((id) => {
                const c = game.customers.find((x) => x.id === id);
                return c && <CustomerLink key={id} id={id} name={c.name} />;
              })}
              {!current.customers.length && "None"}
            </dd>
          </dl>
        </div>
      ) : <div className="sup-detail sup-none">No incident selected</div>}
    </>
  );
}
