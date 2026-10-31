import { useState } from "react";
import type { Incident, IncidentCause } from "../../../sim/60-infra/ops";
import { t } from "../../../i18n/en";
import { duration } from "../../../i18n/en-ops";
import { useStore } from "../../store";
import { CustomerLink } from "../customers/CustomersApp";
import { day } from "../hw";
import { stamp } from "./labels";

const CAUSE: Record<IncidentCause, string> = { grid: t("support.cause.grid"), generator: t("support.cause.generator"), feed: t("support.cause.feed"), seizure: t("support.cause.seizure") };

const impact = (i: Incident) => (i.cause === "seizure" ? t("support.until", { day: day(i.returnAt!) }) : i.dark ? t("support.dark", { d: duration(i.dark) }) : t("support.noDowntime"));

export function Incidents() {
  const game = useStore((s) => s.game);
  const list = [...game.ops.incidents].sort((a, b) => b.hour - a.hour);
  const [sel, setSel] = useState<string | null>(list[0]?.id ?? null);
  const current = list.find((i) => i.id === sel);
  const where = (i: Incident) => game.locations.find((l) => l.id === i.locationId)?.name ?? "";

  return (
    <>
      <div className="sup-list" role="list">
        <div className="sup-list-h"><h2>{t("support.incidents")}</h2></div>
        {list.map((i) => (
          <button key={i.id} role="listitem" className={`tk${i.id === sel ? " active" : ""}`} onClick={() => setSel(i.id)}>
            <span className="who"><span>{CAUSE[i.cause]}</span></span>
            <span className="sla num">{stamp(i.hour)}</span>
            <span className="subj">{where(i)} · {impact(i)}</span>
          </button>
        ))}
        {!list.length && <div className="sup-none">{t("support.noIncidents")}</div>}
      </div>

      {current ? (
        <div className="sup-detail">
          <div className="d-head">
            <div className="top"><h2>{CAUSE[current.cause]} · {where(current)}</h2><span className="id num">#{current.id.slice(3)}</span></div>
            <div className="facts"><span>{t("support.started", { time: stamp(current.hour) })}</span></div>
          </div>
          <dl className="inc-facts">
            {current.cause === "seizure" ? (
              <>
                <dt>{t("support.agency")}</dt><dd>{current.agency}</dd>
                <dt>{t("support.returns")}</dt><dd className="num">{day(current.returnAt!)}</dd>
              </>
            ) : (
              <>
                <dt>{t("support.gridDown")}</dt><dd className="num">{duration(current.minutes)}</dd>
                <dt>{t("support.noPower")}</dt><dd className="num">{current.dark ? duration(current.dark) : t("support.none")}</dd>
              </>
            )}
            <dt>{t("support.devices")}</dt><dd>{current.devices.join(", ") || t("support.none")}</dd>
            <dt>{t("support.customers")}</dt>
            <dd className="inc-customers">
              {current.customers.map((id) => {
                const c = game.customers.find((x) => x.id === id);
                return c && <CustomerLink key={id} id={id} name={c.name} />;
              })}
              {!current.customers.length && t("support.none")}
            </dd>
          </dl>
        </div>
      ) : <div className="sup-detail sup-none">{t("support.noIncidentSelected")}</div>}
    </>
  );
}
