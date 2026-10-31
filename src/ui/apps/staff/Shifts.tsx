import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { euro } from "../../../sim/00-core/money";
import { dateOf } from "../../../sim/00-core/time";
import { MAX_SHIFT, payOf, shiftEndAt, weekHours, type Team } from "../../../sim/47-staff/staff";
import type { GameState } from "../../../sim/50-state";
import { addTeam, removeTeam, setShift } from "../../../sim/90-actions/staff";
import { t } from "../../../i18n/en";
import { useStore } from "../../store";

// Monday first; values are getUTCDay indexes.
const DAYS: [number, string][] = [[1, t("misc.dayMon")], [2, t("misc.dayTue")], [3, t("misc.dayWed")], [4, t("misc.dayThu")], [5, t("misc.dayFri")], [6, t("misc.daySat")], [0, t("misc.daySun")]];
const HOURS = Array.from({ length: 24 }, (_, h) => h);
const clock = (h: number) => `${String(h % 24).padStart(2, "0")}:00`;

// People on shift in each hour of the current week, by weekday and hour.
function coverage(game: GameState): Record<number, number[]> {
  const now = dateOf(game.hour), monday = game.hour - now.getUTCHours() - ((now.getUTCDay() + 6) % 7) * 24;
  const out: Record<number, number[]> = {};
  DAYS.forEach(([day], i) => {
    out[day] = HOURS.map((h) => game.teams.reduce((n, t) =>
      n + (shiftEndAt(t, monday + i * 24 + h) !== null ? game.staff.filter((e) => e.team === t.id).length : 0), 0));
  });
  return out;
}

export function Shifts({ game }: { game: GameState }) {
  const act = useStore((s) => s.act);
  const [name, setName] = useState("");
  const cover = coverage(game);
  return (
    <div className="st-shifts">
      <section>
        <h3>{t("misc.coverage")}</h3>
        <div className="st-cover" role="table" aria-label={t("misc.coverage")}>
          <span />
          {HOURS.map((h) => <span key={h} className="h">{h % 6 === 0 ? clock(h) : ""}</span>)}
          {DAYS.map(([day, label]) => [
            <span key={label} className="d">{label}</span>,
            ...cover[day].map((n, h) => <i key={`${label}${h}`} className={n ? "on" : ""} title={`${label} ${clock(h)}: ${n}`}>{n || ""}</i>),
          ])}
        </div>
      </section>
      {game.teams.map((t) => <TeamCard key={t.id} game={game} team={t} />)}
      <form className="st-add" onSubmit={(ev) => { ev.preventDefault(); if (act(addTeam, name).ok) setName(""); }}>
        <input className="field" aria-label={t("misc.teamName")} placeholder={t("misc.teamName")} value={name} maxLength={30} onChange={(ev) => setName(ev.target.value)} />
        <button className="btn" disabled={!name.trim()}><Plus />{t("misc.addTeam")}</button>
      </form>
    </div>
  );
}

function TeamCard({ game, team }: { game: GameState; team: Team }) {
  const act = useStore((s) => s.act);
  const members = game.staff.filter((e) => e.team === team.id);
  return (
    <section className="st-team">
      <div className="st-team-h">
        <h3>{team.name}</h3>
        <span className="sub">{t("misc.teamSummary", { people: members.length, hours: weekHours(team), pay: euro(members.reduce((n, e) => n + payOf(game, e), 0)) })}</span>
        <span className="grow" />
        <button className="btn" disabled={members.length > 0} onClick={() => act(removeTeam, team.id)}><Trash2 />{t("misc.remove")}</button>
      </div>
      <div className="st-days">
        {DAYS.map(([day, label]) => {
          const s = team.days[day];
          const set = (start: number, hours: number) => act(setShift, team.id, day, { start, hours });
          return (
            <div key={day} className="st-day">
              <span>{label}</span>
              <input type="checkbox" role="switch" className="switch" aria-label={t("misc.worksDay", { team: team.name, day: label })} checked={!!s}
                onChange={() => act(setShift, team.id, day, s ? null : { start: 9, hours: 8 })} />
              {s && <>
                <select aria-label={t("misc.dayStart", { day: label })} value={s.start} onChange={(ev) => set(Number(ev.target.value), s.hours)}>
                  {HOURS.map((h) => <option key={h} value={h}>{clock(h)}</option>)}
                </select>
                <select aria-label={t("misc.dayHours", { day: label })} value={s.hours} onChange={(ev) => set(s.start, Number(ev.target.value))}>
                  {Array.from({ length: MAX_SHIFT }, (_, i) => i + 1).map((h) => <option key={h} value={h}>{h} h</option>)}
                </select>
                <span className="num sub">{t(s.start + s.hours > 24 ? "misc.toNextDay" : "misc.toClock", { time: clock(s.start + s.hours) })}</span>
              </>}
            </div>
          );
        })}
      </div>
    </section>
  );
}
