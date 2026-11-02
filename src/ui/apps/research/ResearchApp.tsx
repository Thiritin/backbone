import { BookOpen, Check, Hourglass, Lock, Package, Play } from "lucide-react";
import { useState, type ReactNode } from "react";
import { SOFTWARE } from "../../../sim/10-catalog/platforms";
import { SKILLS, skillById, TRACKS, type Skill, type Unlock } from "../../../sim/10-catalog/research";
import { SHOPS } from "../../../sim/10-catalog/shops";
import { storeItem } from "../../../sim/10-catalog/store";
import type { GameState } from "../../../sim/50-state";
import { yearOf } from "../../../sim/00-core/time";
import { shopVendorUrl } from "../../../sim/80-business/shoplink";
import { knowHowPerMonth } from "../../../sim/88-tick/tick";
import { research } from "../../../sim/90-actions/store";
import { useFocus, useStore } from "../../store";
import { Tile } from "../shop/Software";
import "./research.css";
import { t } from "../../../i18n/en";

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
      {state === "learned" && <span className="rs-node-sub">{t("misc2.learned")}</span>}
      {state === "training" && <>
        <span className="rs-node-sub num">{t("misc2.daysLeft", { n: daysLeft(g) })}</span>
        <span className="rs-bar"><i style={{ width: `${progress(g) * 100}%` }} /></span>
      </>}
      {state === "open" && <span className="rs-node-sub num">{t("misc2.knowHowDays", { knowHow: k.knowHow, days: k.days })}</span>}
      {state === "locked" && <span className="rs-node-sub">{missing.length > 1 ? t("misc2.needsSkills", { n: missing.length }) : t("misc2.needsSkill", { name: skillById(missing[0])!.name })}</span>}
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

// Platform software and shop systems are sold on their vendor's site.
const vendor = (id: string) => {
  const sw = SOFTWARE.find((x) => x.id === id), shop = SHOPS.find((x) => x.id === id)!;
  return sw ? { name: sw.name, from: sw.from, url: `www.${sw.site.host}/` } : { name: shop.name, from: shop.from, url: shopVendorUrl(shop.id) };
};
const inUse = (g: GameState, id: string) =>
  g.shop.variant === id || g.clusters.some((c) => c.platform === id || c.panel === id) || g.devices.some((d) => d.software.some((x) => x.id === id));

function UnlockRow({ u, g }: { u: Unlock; g: GameState }) {
  const openApp = useStore((s) => s.openApp);
  if (u.kind === "app") {
    const item = storeItem(u.id)!;
    const open = () => (g.installed.includes(u.id) ? openApp(u.id === "Nagiosaurus" ? "Security" : u.id) : openApp("Shop", { kind: "software", id: u.id }));
    return <li><button className="rs-unlock" onClick={open}><Tile item={item} size={24} />{item.name}</button></li>;
  }
  if (u.kind === "product") return <li><button className="rs-unlock" onClick={() => openApp("Marketing", { kind: "page", id: "products" })}><span className="rs-grant"><Package /></span>{t(`sim.line.${u.id}`)}</button></li>;
  if (u.kind === "software") {
    const v = vendor(u.id);
    return <li><button className="rs-unlock" onClick={() => openApp("Browser", { kind: "url", id: v.url })}><span className="rs-grant"><Package /></span>{v.name}</button></li>;
  }
  const year = yearOf(g.hour), software = u.software?.map(vendor).filter((v) => v.from <= year);
  const muted = !!u.software && !u.software.some((id) => inUse(g, id));
  return (
    <li>
      <span className="rs-grant"><Check /></span>
      <span className="rs-feature">{t(`sim.unlock.${u.id}`)}
        {software && software.length > 0 && <span className={`rs-software${muted ? " muted" : ""}`}>
          {software.map((v) => <button key={v.name} className="link" onClick={() => openApp("Browser", { kind: "url", id: v.url })}>{v.name}</button>)}
        </span>}
      </span>
    </li>
  );
}

function Panel({ k, g }: { k: Skill; g: GameState }) {
  const { act, setExplain } = useStore();
  const state = stateOf(g, k);
  const next = SKILLS.filter((s) => s.needs.includes(k.id));
  const canStart = state === "open" && !g.training && g.knowHow >= k.knowHow;
  const facts: [string, ReactNode][] = [
    [t("misc2.cost"), <span className="num">{t("misc2.costValue", { n: k.knowHow })}</span>],
    [t("misc2.training"), <span className="num">{t("misc2.trainingValue", { n: k.days })}</span>],
    [t("misc2.needs"), k.needs.map((n) => skillById(n)!.name).join(", ") || t("misc2.none")],
  ];
  if (next.length) facts.push([t("misc2.leadsTo"), next.map((s) => s.name).join(", ")]);
  return (
    <aside className="rs-panel">
      <h2>{k.name}</h2>
      <p>{k.about}</p>
      <dl className="rs-facts">{facts.map(([dt, dd]) => <div key={dt}><dt>{dt}</dt><dd>{dd}</dd></div>)}</dl>
      {k.unlocks.length > 0 && (
        <section>
          <h3>{t("misc2.unlocks")}</h3>
          <ul className="rs-opens">{k.unlocks.map((u) => <UnlockRow key={`${u.kind}-${u.id}`} u={u} g={g} />)}</ul>
        </section>
      )}
      {state === "training" && (
        <div className="rs-progress">
          <span className="rs-bar"><i style={{ width: `${progress(g) * 100}%` }} /></span>
          <span className="num">{t("misc2.daysLeft", { n: daysLeft(g) })}</span>
        </div>
      )}
      <div className="rs-actions">
        {state === "learned" ? <button className="btn" onClick={() => setExplain(k.id)}><BookOpen />{t("misc2.howItWorks")}</button>
          : state !== "training" && <button className="btn primary" disabled={!canStart} onClick={() => act(research, k.id)}>{t("misc2.startTraining")}</button>}
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
        <div><span>{t("misc2.knowHow")}</span><strong className="num">{Math.floor(game.knowHow)}</strong></div>
        <div><span>{t("misc2.perMonth")}</span><strong className="num">{knowHowPerMonth(game).toFixed(1)}</strong></div>
        {game.training && <div><span>{t("misc2.inTraining")}</span><strong className="rs-head-name">{skillById(game.training.id)!.name}</strong></div>}
      </header>
      <div className="rs-tree">
        <div className="rs-canvas" style={{ width: WIDTH, height: HEIGHT }}>
          {TIERS.map((tier, c) => <span key={tier} className="rs-tier" style={{ left: PAD + LANE + c * (W + COL), top: PAD, width: W }}>{t("misc2.tier", { n: tier })}</span>)}
          {LANES.map((l, i) => <span key={l.id} className="rs-track" style={{ left: PAD, top: laneTop(i), width: LANE - 16, height: l.rows * (H + ROW) - ROW }}>{l.name}</span>)}
          <Links g={game} />
          {SKILLS.map((k) => <Node key={k.id} k={k} g={game} selected={sel === k.id} onSelect={() => setSel(k.id)} />)}
        </div>
      </div>
      <Panel k={skillById(sel)!} g={game} />
    </div>
  );
}
