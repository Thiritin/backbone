import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { euro } from "../../../sim/00-core/money";
import { dateOf } from "../../../sim/00-core/time";
import { MAX_SHIFT, payOf, shiftEndAt, weekHours, type Team } from "../../../sim/47-staff/staff";
import type { GameState } from "../../../sim/50-state";
import { addTeam, removeTeam, setShift } from "../../../sim/90-actions/staff";
import { useStore } from "../../store";

// Monday first; values are getUTCDay indexes.
const DAYS: [number, string][] = [[1, "Mon"], [2, "Tue"], [3, "Wed"], [4, "Thu"], [5, "Fri"], [6, "Sat"], [0, "Sun"]];
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
        <h3>Coverage</h3>
        <div className="st-cover" role="table" aria-label="Coverage">
          <span />
          {HOURS.map((h) => <span key={h} className="h">{h % 6 === 0 ? clock(h) : ""}</span>)}
          {DAYS.map(([day, label]) => [
            <span key={label} className="d">{label}</span>,
            ...cover[day].map((n, h) => <i key={`${label}${h}`} className={n ? "on" : ""} title={`${label} ${clock(h)}: ${n}`}>{n || ""}</i>),
          ])}
        </div>
      </section>
      {game.teams.map((t) => <TeamCard key={t.id} game={game} t={t} />)}
      <form className="st-add" onSubmit={(ev) => { ev.preventDefault(); if (act(addTeam, name).ok) setName(""); }}>
        <input className="field" aria-label="Team name" placeholder="Team name" value={name} maxLength={30} onChange={(ev) => setName(ev.target.value)} />
        <button className="btn" disabled={!name.trim()}><Plus />Add team</button>
      </form>
    </div>
  );
}

function TeamCard({ game, t }: { game: GameState; t: Team }) {
  const act = useStore((s) => s.act);
  const members = game.staff.filter((e) => e.team === t.id);
  return (
    <section className="st-team">
      <div className="st-team-h">
        <h3>{t.name}</h3>
        <span className="sub">{members.length} {members.length === 1 ? "person" : "people"} · <span className="num">{weekHours(t)}</span> h a week · <span className="num">{euro(members.reduce((n, e) => n + payOf(game, e), 0))}</span> a month</span>
        <span className="grow" />
        <button className="btn" disabled={members.length > 0} onClick={() => act(removeTeam, t.id)}><Trash2 />Remove</button>
      </div>
      <div className="st-days">
        {DAYS.map(([day, label]) => {
          const s = t.days[day];
          const set = (start: number, hours: number) => act(setShift, t.id, day, { start, hours });
          return (
            <div key={day} className="st-day">
              <span>{label}</span>
              <input type="checkbox" role="switch" className="switch" aria-label={`${t.name} works ${label}`} checked={!!s}
                onChange={() => act(setShift, t.id, day, s ? null : { start: 9, hours: 8 })} />
              {s && <>
                <select aria-label={`${label} start`} value={s.start} onChange={(ev) => set(Number(ev.target.value), s.hours)}>
                  {HOURS.map((h) => <option key={h} value={h}>{clock(h)}</option>)}
                </select>
                <select aria-label={`${label} hours`} value={s.hours} onChange={(ev) => set(s.start, Number(ev.target.value))}>
                  {Array.from({ length: MAX_SHIFT }, (_, i) => i + 1).map((h) => <option key={h} value={h}>{h} h</option>)}
                </select>
                <span className="num sub">to {clock(s.start + s.hours)}{s.start + s.hours > 24 ? " next day" : ""}</span>
              </>}
            </div>
          );
        })}
      </div>
    </section>
  );
}
