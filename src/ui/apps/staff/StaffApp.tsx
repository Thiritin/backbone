import { BookOpen, Bot, CalendarClock, Check, GraduationCap, Megaphone, MessagesSquare, Search, UserPlus, Users } from "lucide-react";
import { useState } from "react";
import { useSessionState } from "../../session";
import { runwayMonths } from "../../../sim/46-finance/finance";
import { euro, euroCents } from "../../../sim/00-core/money";
import { yearOf } from "../../../sim/00-core/time";
import {
  activeBots, AD, hourlyWage, atFair, BOT_RIGHT, BOT_SPEED, COURSE_HOURS, COURSE_PRICE, fullyTrained, marketSalary, monthlyPay, needsTraining, payOf, ROLES, salaryUpToNow, staffPrice, TASKS, TRAINER_HOURS, teamOf, trainerFor, visibleCandidates, weekHours,
  type AdTier, type Assignment, type Candidate, type Employee, type Role, type Task,
} from "../../../sim/47-staff/staff";
import { storeItem, subscriptionPrice } from "../../../sim/10-catalog/store";
import { pricePerMTokens } from "../../../sim/47-staff/chad";
import type { GameState } from "../../../sim/50-state";
import { cancel } from "../../../sim/90-actions/store";
import { answerRaise, assign, fire, hire, planTraining, postJobAd, setOnCall, setTeam, setTechLocation } from "../../../sim/90-actions/staff";
import { Confirm } from "../../desktop/Confirm";
import { menuOn, type MenuEntry } from "../../desktop/ContextMenu";
import { More } from "../More";
import { useFocus, useStore } from "../../store";
import { runwayLabel } from "../finance/FinanceApp";
import { Facts, Sheet } from "../locations/ui";
import { TechPanel } from "./TechPanel";
import { Shifts } from "./Shifts";
import { formatDay } from "../billing/BillingApp";
import { initials } from "../support/labels";
import "../shop/shop.css";
import "./staff.css";
import { LOCALE } from "../../../i18n/lang";

const ROLE: Record<Role, { one: string; many: string }> = {
  support: { one: "Support agent", many: "Support agents" },
  bookkeeper: { one: "Bookkeeper", many: "Bookkeepers" },
  accountant: { one: "Accountant", many: "Accountants" },
  marketing: { one: "Marketing manager", many: "Marketing managers" },
  technician: { one: "Technician", many: "Technicians" },
};
const TASK: Record<Task, string> = {
  howTo: "How-to", billing: "Billing", outage: "Outage", upgrade: "Upgrade", cancellation: "Cancellation", abuse: "Abuse", appeal: "Suspension appeal", order: "Orders", notice: "Notices", legal: "Legal requests", refund: "Refunds", extortion: "Ransom demands", migration: "Migration offers", maintenance: "Maintenance",
  sponsor: "Sponsoring", reminder: "Payment reminders", dunning: "Dunning notices", final: "Final notices", suspend: "Suspensions",
  campaigns: "Campaigns", reviews: "Review platforms", fairs: "Trade fairs",
  hardware: "Parts and power", servers: "Draining servers", panels: "PHP upgrades",
};
const ASSIGN: Record<Assignment, string> = { queue: "Work queue", trainer: "Trainer", forum: "Forums" };
const TIERS: AdTier[] = ["standard", "premium"];
const days = (h: number) => `${Math.max(0, Math.ceil(h / 24))} ${Math.ceil(h / 24) === 1 ? "day" : "days"}`;

function status(game: GameState, e: Employee): { label: string; cls: string } {
  if (atFair(game, e)) return { label: "At a fair", cls: "accent" };
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
  const [view, setView] = useSessionState<"team" | "shifts" | "market">("staff.tab", "team");
  const [sel, setSel] = useSessionState<string | null>("staff.sel", null);
  const [role, setRole] = useState<Role>("support");
  const market = visibleCandidates(game);
  useFocus("Staff", (f) => { if (f.kind === "market" && ROLES.includes(f.id as Role)) { setRole(f.id as Role); setView("market"); } });
  return (
    <div className="st">
      <aside className="sidebar st-side">
        <div className="side-h">Staff</div>
        <button className={`side-item${view === "team" ? " active" : ""}`} onClick={() => setView("team")}>
          <Users />Team<span className="side-count">{game.staff.length + activeBots(game).length}</span>
        </button>
        <button className={`side-item${view === "market" ? " active" : ""}`} onClick={() => setView("market")}>
          <Search />Job market<span className="side-count">{market.length}</span>
        </button>
        <button className={`side-item${view === "shifts" ? " active" : ""}`} onClick={() => setView("shifts")}>
          <CalendarClock />Shifts<span className="side-count">{game.teams.length}</span>
        </button>
      </aside>
      {view === "team" ? <Team game={game} sel={sel} setSel={setSel} onMarket={() => setView("market")} /> : view === "shifts" ? <Shifts game={game} /> : <Market game={game} role={role} setRole={setRole} onHired={(id) => { setSel(id); setView("team"); }} />}
    </div>
  );
}

// Team, assignment, training, raise and leaving for an employee; a bot only cancels.
function staffMenu(game: GameState, e: Employee, onLeave: (e: Employee) => void): MenuEntry[] {
  const act = useStore.getState().act;
  if (e.bot) return [{ label: "Cancel subscription", run: () => onLeave(e) }];
  const open = TASKS[e.role].filter((k) => !e.trained.includes(k) && e.training?.task !== k && !e.plan.includes(k));
  const tech = e.role === "technician", onCall = game.onCall.roster.includes(e.id);
  return [
    e.raise && { label: "Accept raise", run: () => act(answerRaise, e.id, true) },
    e.raise && { label: "Refuse raise", run: () => act(answerRaise, e.id, false) },
    null,
    { label: "Team", items: game.teams.map((t) => ({ label: t.name, checked: e.team === t.id, run: () => act(setTeam, e.id, t.id) })) },
    { label: "Assignment", items: (["queue", "trainer", "forum"] as const).map((a) => ({ label: ASSIGN[a], checked: e.assignment === a, run: () => act(assign, e.id, a) })) },
    tech && { label: "Location", items: game.locations.map((l) => ({ label: l.name, checked: e.location === l.id, run: () => act(setTechLocation, e.id, l.id) })) },
    tech && { label: "On call", checked: onCall, run: () => act(setOnCall, e.id, !onCall) },
    open.length > 0 && { label: "Train all", run: () => act(planTraining, e.id, [...e.plan, ...open]) },
    null,
    { label: "Let go...", run: () => onLeave(e) },
  ];
}

function Team({ game, sel, setSel, onMarket }: { game: GameState; sel: string | null; setSel: (id: string) => void; onMarket: () => void }) {
  const bots = activeBots(game);
  const [leaving, setLeaving] = useState<Employee | null>(null);
  if (!game.staff.length && !bots.length) {
    return (
      <div className="st-empty">
        <p>Hire your first employee from the job market.</p>
        <button className="btn primary" onClick={onMarket}><Search />Job market</button>
      </div>
    );
  }
  const current = [...game.staff, ...bots].find((e) => e.id === sel) ?? game.staff[0] ?? bots[0];
  const menu = (e: Employee) => () => staffMenu(game, e, setLeaving);
  const payroll = game.staff.reduce((sum, e) => sum + payOf(game, e), 0);
  return (
    <>
      <div className="st-list" role="list">
        <div className="st-list-h"><h2>Team</h2><span className="st-payroll"><span className="num">{euro(payroll)}</span> a month</span></div>
        {game.staff.map((e) => {
          const st = status(game, e);
          return (
            <button key={e.id} role="listitem" className={`st-row${e.id === current.id ? " active" : ""}`} onClick={() => setSel(e.id)} onContextMenu={menuOn(menu(e))}>
              <span className="logo">{initials(e.name)}</span>
              <span className="who">
                <span className="name">{e.name}</span>
                <span className="sub">{ROLE[e.role].one} · {teamOf(game, e)?.name} · <span className="num">{euro(payOf(game, e))}</span></span>
              </span>
              <span className="side">
                <span className="num st-skill">{Math.round(e.skill)}</span>
                {e.raise ? <span className="pill warn">Raise</span> : <span className={`pill ${st.cls}`}>{st.label}</span>}
              </span>
              <TaskBars e={e} hour={game.hour} />
            </button>
          );
        })}
        {bots.map((b) => (
          <button key={b.id} role="listitem" className={`st-row${b.id === current.id ? " active" : ""}`} onClick={() => setSel(b.id)} onContextMenu={menuOn(menu(b))}>
            <span className="logo"><Bot /></span>
            <span className="who">
              <span className="name">{b.name}</span>
              <span className="sub">{b.trained.map((k) => TASK[k]).join(", ")} · <span className="num">{euro(botPrice(game, b))}</span></span>
            </span>
            <span className="side"><span className="pill accent">Bot</span></span>
          </button>
        ))}
      </div>
      {current.bot ? <BotDetail game={game} b={current} menu={menu(current)} /> : <Detail game={game} e={current} menu={menu(current)} />}
      {leaving && <LetGo game={game} e={leaving} onClose={() => setLeaving(null)} />}
    </>
  );
}

const botPrice = (game: GameState, b: Employee) => subscriptionPrice(storeItem(b.id)!, yearOf(game.hour));

function ChadUsageFacts({ game }: { game: GameState }) {
  const u = game.chadUsage, year = yearOf(game.hour);
  return (
    <>
      <h3>Usage this month</h3>
      <dl className="st-facts">
        <div><dt>Price</dt><dd className="num">{euroCents(pricePerMTokens(year))} / 1M tokens</dd></div>
        <div><dt>Replies</dt><dd className="num">{u.attempts.toLocaleString(LOCALE)}</dd></div>
        <div><dt>Tokens</dt><dd className="num">{(u.tokens / 1e6).toFixed(1)}M</dd></div>
        <div><dt>Cost</dt><dd className="num">{euro(u.cost)}</dd></div>
        <div><dt>Per solved ticket</dt><dd className="num">{u.solved ? euroCents(u.cost / u.solved) : "None"}</dd></div>
        <div><dt>Right on how-to</dt><dd className="num">{Math.round(BOT_RIGHT.howTo * 100)}%</dd></div>
        <div><dt>Right on billing</dt><dd className="num">{Math.round(BOT_RIGHT.billing * 100)}%</dd></div>
      </dl>
    </>
  );
}

function LetGo({ game, e, onClose }: { game: GameState; e: Employee; onClose: () => void }) {
  const act = useStore((s) => s.act);
  const owed = salaryUpToNow(game, e);
  if (e.bot) return (
    <Confirm title={`Cancel ${e.name}?`} action="Cancel subscription" onCancel={onClose} onConfirm={() => { onClose(); act(cancel, e.id); }}
      text={`The subscription for ${e.name} ends today.`} />
  );
  return (
    <Confirm title={`Let ${e.name} go?`} action="Let go" onCancel={onClose} onConfirm={() => { onClose(); act(fire, e.id); }}
      text={`This saves ${euro(payOf(game, e))} a month. ${e.name.split(" ")[0]} leaves today${owed > 0 ? ` and is paid ${euro(owed)} for the days worked this month` : ""}.`} />
  );
}

function BotDetail({ game, b, menu }: { game: GameState; b: Employee; menu: () => MenuEntry[] }) {
  return (
    <section className="st-detail">
      <header className="d-head">
        <div className="top">
          <span className="logo big"><Bot /></span>
          <div>
            <h2>{b.name}</h2>
            <div className="sub">Pear One subscription</div>
          </div>
          <span className="grow" />
          <More label={b.name} entries={menu} />
        </div>
        <dl className="st-facts">
          <div><dt>Subscription</dt><dd className="num">{euro(botPrice(game, b))}</dd></div>
          <div><dt>Hours</dt><dd>Around the clock</dd></div>
          <div><dt>Speed</dt><dd className="num">{BOT_SPEED}×</dd></div>
        </dl>
      </header>
      <div className="st-body">
        {b.id === "chadGpt" && <ChadUsageFacts game={game} />}
        <h3>Handles</h3>
        <div className="st-cards">
          {b.trained.map((k) => <div key={k} className="st-card done"><span className="t">{TASK[k]}</span><span className="p"><Check />Built in</span></div>)}
        </div>
      </div>
    </section>
  );
}

function Detail({ game, e, menu }: { game: GameState; e: Employee; menu: () => MenuEntry[] }) {
  const act = useStore((s) => s.act);
  const trainer = trainerFor(game, e);
  const fee = staffPrice(COURSE_PRICE, yearOf(game.hour));
  const canTrain = fullyTrained(e) && game.staff.some((x) => x.id !== e.id && x.role === e.role && needsTraining(x));
  const open = TASKS[e.role].filter((k) => !e.trained.includes(k) && e.training?.task !== k);
  const week = weekHours(teamOf(game, e));
  const toggle = (k: Task) => act(planTraining, e.id, e.plan.includes(k) ? e.plan.filter((x) => x !== k) : [...e.plan, k]);
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
          <More label={e.name} entries={menu} />
        </div>
        <dl className="st-facts">
          <div><dt>Skill</dt><dd><span className="num">{Math.round(e.skill)}</span><SkillBar value={e.skill} /></dd></div>
          <div><dt>Salary</dt><dd className="num">{euro(payOf(game, e))}</dd></div>
          <div><dt>Market salary</dt><dd className="num">{euro(monthlyPay(marketSalary(e, game.hour), week))}</dd></div>
          <div><dt>Next raise talk</dt><dd className="num">{formatDay(e.nextRaiseAt)}</dd></div>
        </dl>
      </header>
      <div className="st-body">
        {e.raise && (
          <div className="st-raise">
            <div>
              <strong>{e.name.split(" ")[0]} asks for a raise</strong>
              <span><span className="num">{euro(payOf(game, e))}</span> to <span className="num">{euro(monthlyPay(e.raise.ask, week))}</span> a month</span>
            </div>
            <span className="grow" />
            <button className="btn" onClick={() => act(answerRaise, e.id, false)}>Refuse</button>
            <button className="btn primary" onClick={() => act(answerRaise, e.id, true)}><Check />Accept</button>
          </div>
        )}
        <h3>Assignment</h3>
        <div className="seg" role="group" aria-label="Assignment">
          {(["queue", "trainer", "forum"] as const).map((a) => (
            <button key={a} aria-pressed={e.assignment === a} disabled={a === "trainer" && e.assignment !== "trainer" && !canTrain}
              onClick={() => act(assign, e.id, a)}>
              {a === "queue" ? <BookOpen /> : a === "trainer" ? <GraduationCap /> : <MessagesSquare />}{ASSIGN[a]}
            </button>
          ))}
        </div>
        <h3>Team</h3>
        <div className="seg" role="group" aria-label="Team">
          {game.teams.map((t) => <button key={t.id} aria-pressed={e.team === t.id} onClick={() => act(setTeam, e.id, t.id)}>{t.name} · {weekHours(t)} h</button>)}
        </div>
        {e.role === "technician" && <TechPanel game={game} e={e} />}
        <div className="st-train-h">
          <h3>Training</h3>
          <span className="grow" />
          <span className="st-cost">{trainer ? <>Trainer {trainer.name} · Free · {days(TRAINER_HOURS)}</> : <><span className="num">{euro(fee)}</span> · {days(COURSE_HOURS)} per course</>}</span>
          <button className="btn" disabled={!open.length || open.every((k) => e.plan.includes(k))} onClick={() => act(planTraining, e.id, open)}>Train all</button>
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

function Market({ game, role, setRole, onHired }: { game: GameState; role: Role; setRole: (r: Role) => void; onHired: (id: string) => void }) {
  const act = useStore((s) => s.act);
  const [hiring, setHiring] = useState<Candidate | null>(null);
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
          <button key={tier} className="btn" disabled={game.cash < staffPrice(AD[tier].price, year)} onClick={() => act(postJobAd, role, tier)}>
            <Megaphone />{tier === "standard" ? "Standard ad" : "Premium ad"} <span className="num">{euro(staffPrice(AD[tier].price, year))}</span>
          </button>
        ))}
      </div>
      <div className="shop-grid">
        {list.map((c) => <CandidateCard key={c.id} c={c} onHire={() => setHiring(c)} />)}
        {!list.length && <div className="shop-none">No {ROLE[role].many.toLowerCase()} are looking for work right now.</div>}
      </div>
      {hiring && <HireSheet game={game} c={hiring} onClose={() => setHiring(null)} onHire={(team) => {
        setHiring(null);
        const r = act(hire, hiring.id, team);
        if (r.ok && r.id) onHired(r.id);
      }} />}
    </div>
  );
}

// The first hire defaults to the team with the fewest hours, the cheapest way to start.
function HireSheet({ game, c, onClose, onHire }: { game: GameState; c: Candidate; onClose: () => void; onHire: (team: string) => void }) {
  const cheapest = [...game.teams].sort((a, b) => weekHours(a) - weekHours(b))[0];
  const [team, setTeam] = useState(game.staff.length ? game.teams[0].id : cheapest.id);
  const pay = monthlyPay(c.salary, weekHours(game.teams.find((t) => t.id === team)));
  return (
    <Sheet title={`Hire ${c.name}`} onClose={onClose}>
      <div className="loc-form">
        <div className="seg" role="group" aria-label="Team">
          {game.teams.map((t) => <button key={t.id} aria-pressed={team === t.id} onClick={() => setTeam(t.id)}>{t.name} · {weekHours(t)} h a week</button>)}
        </div>
        <Facts rows={[
          ["Monthly cost", <span className="num">{euro(pay)}</span>],
          ["Runway now", <span className="num">{runwayLabel(runwayMonths(game))}</span>],
          ["Runway after", <span className="num">{runwayLabel(runwayMonths(game, pay))}</span>],
        ]} />
      </div>
      <div className="loc-sheet-foot">
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn primary" onClick={() => onHire(team)}><UserPlus />Hire for {euro(pay)} a month</button>
      </div>
    </Sheet>
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
        <div><dt>40 h a week</dt><dd className="num">{euro(c.salary)}</dd></div>
        <div><dt>Per hour</dt><dd className="num">{euroCents(hourlyWage(c))}</dd></div>
        <div><dt>Available until</dt><dd className="num">{formatDay(c.leaveAt)}</dd></div>
      </dl>
      <div className="shop-buy">
        <span className="grow" />
        <button className="btn primary" onClick={onHire}><UserPlus />Hire</button>
      </div>
    </div>
  );
}
