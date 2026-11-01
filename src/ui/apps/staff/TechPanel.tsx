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
import { LOCALE } from "../../../i18n/lang";
import { t } from "../../../i18n/en";

const RULES: [keyof TechRules, string][] = [["failed", t("misc.ruleFailed")], ["worn", t("misc.ruleWorn")], ["blackhole", t("misc.ruleBlackhole")], ["updates", t("misc.ruleUpdates")], ["recover", t("misc.ruleRecover")]];
const WEEK_OF = new Intl.DateTimeFormat(LOCALE, { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" });

// A technician's location, the operations queued there, the location's on-call rotation and the rules all technicians follow.
export function TechPanel({ game, e }: { game: GameState; e: Employee }) {
  const act = useStore((s) => s.act);
  const queue = game.techOps.filter((o) => opLocation(game, o) === e.location);
  const crew = e.location ? techsAt(game, e.location, "hardware") : [];
  const now = e.location ? onCallAt(game, e.location, game.hour) : undefined;
  return (
    <>
      <h3>{t("misc.location")}</h3>
      <div className="seg" role="group" aria-label={t("misc.location")}>
        {game.locations.map((l) => (
          <button key={l.id} aria-pressed={e.location === l.id} onClick={() => act(setTechLocation, e.id, l.id)}><MapPin />{l.name}</button>
        ))}
      </div>
      <h3>{t("misc.queue")}</h3>
      <div className="st-ops">
        {!queue.length && <div className="st-op st-none">{t("misc.queueEmpty")}</div>}
        {queue.map((o) => {
          const d = game.devices.find((x) => x.id === o.deviceId);
          return (
            <div key={o.id} className="st-op">
              <span>{opLabel(game, o)}</span>
              <span className="st-cost">{o.count ? `${o.count} × ` : ""}{d ? devName(d) : ""}</span>
              {o.auto && <span className="pill">{t("misc.rule")}</span>}
              <span className="grow" />
              <button className="btn" onClick={() => act(cancelOperation, o.id)}>{t("misc.cancel")}</button>
            </div>
          );
        })}
      </div>
      <h3>{t("misc.onCall")}</h3>
      <div className="st-ops">
        {!crew.length && <div className="st-op st-none">{t("misc.noTechTrained")}</div>}
        {crew.map((x) => {
          const p = game.onCall.month[x.id], calls = p?.callOuts ?? 0;
          return (
            <div key={x.id} className="st-op">
              <span>{x.name}</span>
              {now?.id === x.id && <span className="pill accent">{t("misc.onCall")}</span>}
              <span className="grow" />
              <span className="st-cost num">{t("misc.nCallOuts", { n: calls })}</span>
              <span className="st-cost num">{euroCents((p?.allowance ?? 0) + (p?.callPay ?? 0))}</span>
              <input type="checkbox" role="switch" className="switch" aria-label={t("misc.nameOnCall", { name: x.name })} checked={game.onCall.roster.includes(x.id)}
                onChange={(ev) => act(setOnCall, x.id, ev.target.checked)} />
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
                <span>{k ? WEEK_OF.format(dateOf(at)) : t("misc.thisWeek")}</span>
                <span className="grow" />
                <span>{onCallAt(game, e.location!, at)?.name}</span>
              </div>
            );
          })}
        </div>
      )}
      <h3>{t("misc.rules")}</h3>
      <div className="st-ops">
        {RULES.map(([k, label]) => (
          <div key={k} className="st-op">
            <span>{label}</span>
            <span className="grow" />
            <input type="checkbox" role="switch" className="switch" aria-label={label} checked={game.techRules[k]}
              onChange={(ev) => act(setTechRules, { [k]: ev.target.checked })} />
          </div>
        ))}
      </div>
    </>
  );
}
