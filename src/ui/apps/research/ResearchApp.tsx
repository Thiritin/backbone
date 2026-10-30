import { BookOpen, Check, Hourglass, Lock, Play, Store } from "lucide-react";
import { useState, type ReactNode } from "react";
import { SKILLS, skillById, TRACKS, type Skill } from "../../../sim/10-catalog/research";
import { storeItem } from "../../../sim/10-catalog/store";
import type { GameState } from "../../../sim/50-state";
import { knowHowPerMonth } from "../../../sim/88-tick/tick";
import { research } from "../../../sim/90-actions/store";
import { useFocus, useStore } from "../../store";
import { Tile } from "../shop/Software";
import "./research.css";

const W = 210, H = 76, COL = 64, ROW = 18, PAD = 24, HEAD = 26, LANE = 110, GAP = 22;
const TIERS = [...new Set(SKILLS.map((k) => k.tier))].sort((a, b) => a - b);
const inCell = (track: string, tier: number) => SKILLS.filter((k) => k.track === track && k.tier === tier);
// Each track is a row as tall as its fullest tier; skills sit in their tier's column.
const LANES = TRACKS.map((t) => ({ ...t, rows: Math.max(1, ...TIERS.map((tier) => inCell(t.id, tier).length)) }));
const laneTop = (i: number) => PAD + HEAD + LANES.slice(0, i).reduce((n, l) => n + l.rows * (H + ROW) - ROW + GAP, 0);
const POS: Record<string, { x: number; y: number }> = Object.fromEntries(LANES.flatMap((l, i) => TIERS.flatMap((tier, c) =>
  inCell(l.id, tier).map((k, r) => [k.id, { x: PAD + LANE + c * (W + COL), y: laneTop(i) + r * (H + ROW) }]))));
const WIDTH = PAD * 2 + LANE + TIERS.length * W + (TIERS.length - 1) * COL;
const HEIGHT = laneTop(LANES.length) - GAP + PAD;

type State = "learned" | "training" | "open" | "locked";
const stateOf = (g: GameState, k: Skill): State =>
  g.unlocks.includes(k.id) ? "learned" : g.training?.id === k.id ? "training" : k.needs.every((n) => g.unlocks.includes(n)) ? "open" : "locked";
const daysLeft = (g: GameState) => Math.max(1, Math.ceil((g.training!.doneAt - g.hour) / 24));
const progress = (g: GameState) => 1 - (g.training!.doneAt - g.hour) / (skillById(g.training!.id)!.days * 24);
const ICON = { learned: Check, training: Hourglass, open: Play, locked: Lock };

function Node({ k, g, selected, onSelect }: { k: Skill; g: GameState; selected: boolean; onSelect: () => void }) {
  const state = stateOf(g, k);
  const Icon = ICON[state];
  const missing = k.needs.filter((n) => !g.unlocks.includes(n));
  return (
    <button className={`rs-node ${state}`} aria-pressed={selected} style={{ left: POS[k.id].x, top: POS[k.id].y, width: W, height: H }} onClick={onSelect}>
      <span className="rs-node-name"><span className="rs-mark"><Icon /></span>{k.name}</span>
      {state === "learned" && <span className="rs-node-sub">Learned</span>}
      {state === "training" && <>
        <span className="rs-node-sub"><span className="num">{daysLeft(g)}</span> days left</span>
        <span className="rs-bar"><i style={{ width: `${progress(g) * 100}%` }} /></span>
      </>}
      {state === "open" && <span className="rs-node-sub"><span className="num">{k.knowHow}</span> know-how, <span className="num">{k.days}</span> days</span>}
      {state === "locked" && <span className="rs-node-sub">Needs {missing.length > 1 ? `${missing.length} skills` : skillById(missing[0])!.name}</span>}
    </button>
  );
}

function Links({ g }: { g: GameState }) {
  return (
    <svg className="rs-links" width={WIDTH} height={HEIGHT} aria-hidden="true">
      {SKILLS.flatMap((k) => k.needs.map((n) => {
        const a = POS[n], b = POS[k.id];
        const x1 = a.x + W, y1 = a.y + H / 2, x2 = b.x, y2 = b.y + H / 2, m = COL / 2;
        return <path key={`${n}-${k.id}`} className={g.unlocks.includes(n) ? "on" : undefined} d={`M${x1} ${y1} C${x1 + m} ${y1} ${x2 - m} ${y2} ${x2} ${y2}`} />;
      }))}
    </svg>
  );
}

function Panel({ k, g }: { k: Skill; g: GameState }) {
  const { act, openApp, setExplain } = useStore();
  const state = stateOf(g, k);
  const next = SKILLS.filter((s) => s.needs.includes(k.id));
  const canStart = state === "open" && !g.training && g.knowHow >= k.knowHow;
  const facts: [string, ReactNode][] = [
    ["Cost", <><span className="num">{k.knowHow}</span> know-how</>],
    ["Training", <><span className="num">{k.days}</span> days</>],
    ["Needs", k.needs.map((n) => skillById(n)!.name).join(", ") || "None"],
  ];
  if (next.length) facts.push(["Leads to", next.map((s) => s.name).join(", ")]);
  return (
    <aside className="rs-panel">
      <h2>{k.name}</h2>
      <p>{k.about}</p>
      <dl className="rs-facts">{facts.map(([dt, dd]) => <div key={dt}><dt>{dt}</dt><dd>{dd}</dd></div>)}</dl>
      {(k.opens.length > 0 || k.grants) && (
        <section>
          <h3>Unlocks</h3>
          <ul className="rs-opens">
            {k.opens.map((id) => <li key={id}><Tile item={storeItem(id)!} size={24} />{storeItem(id)!.name}</li>)}
            {k.grants?.map((g) => <li key={g}><span className="rs-grant"><Check /></span>{g}</li>)}
          </ul>
        </section>
      )}
      {state === "training" && (
        <div className="rs-progress">
          <span className="rs-bar"><i style={{ width: `${progress(g) * 100}%` }} /></span>
          <span><span className="num">{daysLeft(g)}</span> days left</span>
        </div>
      )}
      <div className="rs-actions">
        {state === "learned" ? <>
          <button className="btn" onClick={() => setExplain(k.id)}><BookOpen />How it works</button>
          {k.opens.length > 0 && (g.installed.includes(k.opens[0])
            ? <button className="btn" onClick={() => openApp(k.opens[0])}>Open {storeItem(k.opens[0])!.name}</button>
            : <button className="btn" onClick={() => openApp("Shop", { kind: "software", id: "" })}><Store />Pear Store</button>)}
        </> : state !== "training" && <button className="btn primary" disabled={!canStart} onClick={() => act(research, k.id)}>Start training</button>}
      </div>
    </aside>
  );
}

export function ResearchApp() {
  const game = useStore((s) => s.game);
  const [sel, setSel] = useState(() => game.training?.id ?? SKILLS.find((k) => stateOf(game, k) === "open")?.id ?? SKILLS[0].id);
  useFocus("Research", (f) => { if (f.kind === "skill" && skillById(f.id)) setSel(f.id); });
  return (
    <div className="rs">
      <header className="rs-head">
        <div><span>Know-how</span><strong className="num">{Math.floor(game.knowHow)}</strong></div>
        <div><span>Per month</span><strong className="num">{knowHowPerMonth(game).toFixed(1)}</strong></div>
        {game.training && <div><span>In training</span><strong className="rs-head-name">{skillById(game.training.id)!.name}</strong></div>}
      </header>
      <div className="rs-tree">
        <div className="rs-canvas" style={{ width: WIDTH, height: HEIGHT }}>
          {TIERS.map((t, c) => <span key={t} className="rs-tier" style={{ left: PAD + LANE + c * (W + COL), top: PAD, width: W }}>Tier {t}</span>)}
          {LANES.map((l, i) => <span key={l.id} className="rs-track" style={{ left: PAD, top: laneTop(i), width: LANE - 16, height: l.rows * (H + ROW) - ROW }}>{l.name}</span>)}
          <Links g={game} />
          {SKILLS.map((k) => <Node key={k.id} k={k} g={game} selected={sel === k.id} onSelect={() => setSel(k.id)} />)}
        </div>
      </div>
      <Panel k={skillById(sel)!} g={game} />
    </div>
  );
}
