import { BookOpen, Check, GraduationCap, Megaphone, MessagesSquare, Search, UserMinus, UserPlus, Users } from "lucide-react";
import { useState } from "react";
import { euro } from "../../../sim/00-core/money";
import { yearOf } from "../../../sim/00-core/time";
import {
  AD, COURSE_HOURS, COURSE_PRICE, fullyTrained, marketSalary, needsTraining, ROLES, staffPrice, TASKS, TRAINER_HOURS, trainerFor, visibleCandidates,
  type AdTier, type Assignment, type Candidate, type Employee, type Role, type Task,
} from "../../../sim/47-staff/staff";
import type { GameState } from "../../../sim/50-state";
import { answerRaise, assign, fire, hire, planTraining, postJobAd } from "../../../sim/90-actions/staff";
import { useStore } from "../../store";
import { formatDay } from "../billing/BillingApp";
import { initials } from "../support/labels";
import "../shop/shop.css";
import "./staff.css";

const ROLE: Record<Role, { one: string; many: string }> = {
  support: { one: "Support agent", many: "Support agents" },
  bookkeeper: { one: "Bookkeeper", many: "Bookkeepers" },
  accountant: { one: "Accountant", many: "Accountants" },
};
const TASK: Record<Task, string> = {
  howTo: "How-to", billing: "Billing", outage: "Outage", upgrade: "Upgrade", cancellation: "Cancellation", abuse: "Abuse", appeal: "Suspension appeal", notice: "Notices", legal: "Legal requests", refund: "Refunds",
  reminder: "Payment reminders", dunning: "Dunning notices", final: "Final notices",
};
const ASSIGN: Record<Assignment, string> = { queue: "Work queue", trainer: "Trainer", forum: "Forums" };
const TIERS: AdTier[] = ["standard", "premium"];
const days = (h: number) => `${Math.max(0, Math.ceil(h / 24))} ${Math.ceil(h / 24) === 1 ? "day" : "days"}`;

function status(e: Employee): { label: string; cls: string } {
  if (e.training) return { label: "Training", cls: "accent" };
  if (e.assignment === "trainer") return { label: "Training others", cls: "accent" };
  if (e.assignment === "forum") return { label: "Forums", cls: "" };
  return e.trained.length ? { label: "Working", cls: "" } : { label: "Untrained", cls: "" };
}

function SkillBar({ value }: { value: number }) {
  return <span className="st-bar"><i style={{ width: `${Math.round(value)}%` }} /></span>;
}

// One segment per task type of the role: filled when trained, partly filled while the course runs.
function TaskBars({ e, hour }: { e: Employee; hour: number }) {
  return (
    <span className="st-tasks">
      {TASKS[e.role].map((k) => {
        const t = e.training?.task === k ? e.training : null;
        const share = e.trained.includes(k) ? 1 : t ? (hour - t.startedAt) / (t.doneAt - t.startedAt) : 0;
        return <i key={k} title={TASK[k]} className={e.plan.includes(k) ? "planned" : ""}><b style={{ width: `${share * 100}%` }} /></i>;
      })}
    </span>
  );
}

export function StaffApp() {
  const game = useStore((s) => s.game);
  const [view, setView] = useState<"team" | "market">("team");
  const [sel, setSel] = useState<string | null>(null);
  const market = visibleCandidates(game);
  return (
    <div className="st">
      <aside className="sidebar st-side">
        <div className="side-h">Staff</div>
        <button className={`side-item${view === "team" ? " active" : ""}`} onClick={() => setView("team")}>
          <Users />Team<span className="side-count">{game.staff.length}</span>
        </button>
        <button className={`side-item${view === "market" ? " active" : ""}`} onClick={() => setView("market")}>
          <Search />Job market<span className="side-count">{market.length}</span>
        </button>
      </aside>
      {view === "team" ? <Team game={game} sel={sel} setSel={setSel} onMarket={() => setView("market")} /> : <Market game={game} onHired={(id) => { setSel(id); setView("team"); }} />}
    </div>
  );
}

function Team({ game, sel, setSel, onMarket }: { game: GameState; sel: string | null; setSel: (id: string) => void; onMarket: () => void }) {
  if (!game.staff.length) {
    return (
      <div className="st-empty">
        <p>Hire your first employee from the job market.</p>
        <button className="btn primary" onClick={onMarket}><Search />Job market</button>
      </div>
    );
  }
  const current = game.staff.find((e) => e.id === sel) ?? game.staff[0];
  const payroll = game.staff.reduce((sum, e) => sum + e.salary, 0);
  return (
    <>
      <div className="st-list" role="list">
        <div className="st-list-h"><h2>Team</h2><span className="st-payroll"><span className="num">{euro(payroll)}</span> a month</span></div>
        {game.staff.map((e) => {
          const st = status(e);
          return (
            <button key={e.id} role="listitem" className={`st-row${e.id === current.id ? " active" : ""}`} onClick={() => setSel(e.id)}>
              <span className="logo">{initials(e.name)}</span>
              <span className="who">
                <span className="name">{e.name}</span>
                <span className="sub">{ROLE[e.role].one} · <span className="num">{euro(e.salary)}</span></span>
              </span>
              <span className="side">
                <span className="num st-skill">{Math.round(e.skill)}</span>
                {e.raise ? <span className="pill warn">Raise</span> : <span className={`pill ${st.cls}`}>{st.label}</span>}
              </span>
              <TaskBars e={e} hour={game.hour} />
            </button>
          );
        })}
      </div>
      <Detail game={game} e={current} />
    </>
  );
}

function Detail({ game, e }: { game: GameState; e: Employee }) {
  const act = useStore((s) => s.act);
  const trainer = trainerFor(game, e);
  const fee = staffPrice(COURSE_PRICE, yearOf(game.hour));
  const canTrain = fullyTrained(e) && game.staff.some((x) => x.id !== e.id && x.role === e.role && needsTraining(x));
  const open = TASKS[e.role].filter((k) => !e.trained.includes(k) && e.training?.task !== k);
  const toggle = (k: Task) => act((s) => planTraining(s, e.id, e.plan.includes(k) ? e.plan.filter((x) => x !== k) : [...e.plan, k]));
  return (
    <section className="st-detail">
      <header className="d-head">
        <div className="top">
          <span className="logo big">{initials(e.name)}</span>
          <div>
            <h2>{e.name}</h2>
            <div className="sub">{ROLE[e.role].one} since {formatDay(e.hiredAt)}</div>
          </div>
          <span className="grow" />
          <button className="btn danger" onClick={() => act((s) => fire(s, e.id))}><UserMinus />Let go</button>
        </div>
        <dl className="st-facts">
          <div><dt>Skill</dt><dd><span className="num">{Math.round(e.skill)}</span><SkillBar value={e.skill} /></dd></div>
          <div><dt>Salary</dt><dd className="num">{euro(e.salary)}</dd></div>
          <div><dt>Market salary</dt><dd className="num">{euro(marketSalary(e, game.hour))}</dd></div>
          <div><dt>Next raise talk</dt><dd className="num">{formatDay(e.nextRaiseAt)}</dd></div>
        </dl>
      </header>
      <div className="st-body">
        {e.raise && (
          <div className="st-raise">
            <div>
              <strong>{e.name.split(" ")[0]} asks for a raise</strong>
              <span><span className="num">{euro(e.salary)}</span> to <span className="num">{euro(e.raise.ask)}</span> a month</span>
            </div>
            <span className="grow" />
            <button className="btn" onClick={() => act((s) => answerRaise(s, e.id, false))}>Refuse</button>
            <button className="btn primary" onClick={() => act((s) => answerRaise(s, e.id, true))}><Check />Accept</button>
          </div>
        )}
        <h3>Assignment</h3>
        <div className="seg" role="group" aria-label="Assignment">
          {(["queue", "trainer", "forum"] as const).map((a) => (
            <button key={a} aria-pressed={e.assignment === a} disabled={a === "trainer" && e.assignment !== "trainer" && !canTrain}
              onClick={() => act((s) => assign(s, e.id, a))}>
              {a === "queue" ? <BookOpen /> : a === "trainer" ? <GraduationCap /> : <MessagesSquare />}{ASSIGN[a]}
            </button>
          ))}
        </div>
        <div className="st-train-h">
          <h3>Training</h3>
          <span className="grow" />
          <span className="st-cost">{trainer ? <>Trainer {trainer.name} · Free · {days(TRAINER_HOURS)}</> : <><span className="num">{euro(fee)}</span> · {days(COURSE_HOURS)} per course</>}</span>
          <button className="btn" disabled={!open.length || open.every((k) => e.plan.includes(k))} onClick={() => act((s) => planTraining(s, e.id, open))}>Train all</button>
        </div>
        <div className="st-cards">
          {TASKS[e.role].map((k) => {
            const done = e.trained.includes(k), now = e.training?.task === k ? e.training : null, planned = e.plan.includes(k);
            const label = done ? "Trained" : now ? `${days(now.doneAt - game.hour)} left` : planned ? (e.plan.indexOf(k) === 0 ? "Next" : "Queued") : "Not trained";
            return (
              <button key={k} className={`st-card${done ? " done" : ""}${planned ? " planned" : ""}${now ? " now" : ""}`} disabled={done || !!now} aria-pressed={planned} onClick={() => toggle(k)}>
                <span className="t">{TASK[k]}</span>
                <span className="p">{done && <Check />}{label}</span>
                {now && <span className="st-bar"><i style={{ width: `${((game.hour - now.startedAt) / (now.doneAt - now.startedAt)) * 100}%` }} /></span>}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function Market({ game, onHired }: { game: GameState; onHired: (id: string) => void }) {
  const act = useStore((s) => s.act);
  const [role, setRole] = useState<Role>("support");
  const list = visibleCandidates(game).filter((c) => c.role === role).sort((a, b) => b.skill - a.skill);
  const coming = game.candidates.filter((c) => c.role === role && c.arriveAt > game.hour).length;
  const year = yearOf(game.hour);
  return (
    <div className="shop-main">
      <div className="shop-bar">
        <div className="seg" role="group" aria-label="Role">
          {ROLES.map((r) => <button key={r} aria-pressed={role === r} onClick={() => setRole(r)}>{ROLE[r].many}</button>)}
        </div>
        <span className="grow" />
        {coming > 0 && <span className="st-coming">Applicants on the way <span className="num">{coming}</span></span>}
        {TIERS.map((tier) => (
          <button key={tier} className="btn" disabled={game.cash < staffPrice(AD[tier].price, year)} onClick={() => act((s) => postJobAd(s, role, tier))}>
            <Megaphone />{tier === "standard" ? "Standard ad" : "Premium ad"} <span className="num">{euro(staffPrice(AD[tier].price, year))}</span>
          </button>
        ))}
      </div>
      <div className="shop-grid">
        {list.map((c) => <CandidateCard key={c.id} c={c} onHire={() => {
          const r = act((s) => hire(s, c.id));
          if (r.ok && r.id) onHired(r.id);
        }} />)}
        {!list.length && <div className="shop-none">No {ROLE[role].many.toLowerCase()} are looking for work right now.</div>}
      </div>
    </div>
  );
}

function CandidateCard({ c, onHire }: { c: Candidate; onHire: () => void }) {
  const level = c.skill < 35 ? "Junior" : c.skill < 65 ? "Mid-level" : "Senior";
  return (
    <div className="shop-card">
      <div className="st-cand">
        <span className="logo">{initials(c.name)}</span>
        <div className="shop-name"><strong>{c.name}</strong><span>{level} {ROLE[c.role].one.toLowerCase()}</span></div>
      </div>
      <dl className="shop-specs">
        <div><dt>Skill</dt><dd><span className="num">{c.skill}</span><SkillBar value={c.skill} /></dd></div>
        <div><dt>Salary ask</dt><dd className="num">{euro(c.salary)}</dd></div>
        <div><dt>Available until</dt><dd className="num">{formatDay(c.leaveAt)}</dd></div>
        <div><dt>Applied</dt><dd className="num">{formatDay(c.arriveAt)}</dd></div>
      </dl>
      <div className="shop-buy">
        <span className="grow" />
        <button className="btn primary" onClick={onHire}><UserPlus />Hire</button>
      </div>
    </div>
  );
}
