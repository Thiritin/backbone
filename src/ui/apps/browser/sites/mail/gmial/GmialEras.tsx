import { useEffect, useRef, useState, useSyncExternalStore, type KeyboardEvent, type ReactNode } from "react";
import { t } from "../../../../../../i18n/en";
import { hourOfMonth } from "../../../../../../sim/00-core/time";
import type { MailAccount, Message } from "../../../../../../sim/42-mail/types";
import type { GameState } from "../../../../../../sim/50-state";
import { feed } from "../../../../../../sim/80-business/news";
import {
  CATEGORIES, GMIAL, gogglesQuiz, inboxType, labFlags, labOn, labsShown, starsOf, STAR_TYPES, tabsOf, THEMES, themeOf, UNDO_PERIODS, type GmialLook,
} from "../../../../../../sim/80-business/gmial";
import { setAccountPrefs } from "../../../../../../sim/90-actions/mailbox";
import { usePageAct } from "../../../pageAct";
import { seenAddresses } from "../gmix/GmixMail";
import "./gmial-eras.css";

const since = (game: GameState, ym: string) => game.hour >= hourOfMonth(ym);

export function useSaved(): [(ok: boolean) => void, ReactNode] {
  const [saved, setSaved] = useState(false);
  return [setSaved, saved ? <span className="gml-ok" role="status">{t("gmial.set.saved")}</span> : null];
}

// Undo Send: the page holds one sent message for the period; leaving Gmial sends it at once.
type Held = { send: () => void; undo: () => void; timer: ReturnType<typeof setTimeout> };
let held: Held | null = null;
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());
const take = (): Held | null => { const h = held; if (h) clearTimeout(h.timer); held = null; emit(); return h; };
export function holdSend(send: () => void, undo: () => void, seconds: number): void {
  take()?.send();
  held = { send, undo, timer: setTimeout(() => take()?.send(), seconds * 1000) };
  emit();
}
export const flushSend = () => take()?.send();
export const undoSend = () => take()?.undo();
export const useHeld = (): boolean => useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, () => held !== null);

// The black Goggle bar of the 2011 redesign; Documents became Drive in April 2012.
export function BlackBar({ game, go, say }: { game: GameState; go: (url: string) => void; say: (key: string) => void }) {
  const items = ["you", "search", "images", "maps", "play", "youtub", "news", "gmial", since(game, "2012-04") ? "drive" : "docs", "calendar", "more"];
  return (
    <nav className="gml-bar">
      {items.map((k) => k === "gmial" ? <b key={k}>{t("gmial.bar.gmial")}</b>
        : <a key={k} href={`#${k}`} onClick={(e) => { e.preventDefault(); if (k === "youtub") go("www.youtub.com"); else if (k === "you") say("gmial.moved"); }}>{t(`gmial.bar.${k}`)}</a>)}
    </nav>
  );
}

export function WebClip({ game }: { game: GameState }) {
  const news = feed(game), item = news[Math.floor(game.hour / 6) % Math.max(1, news.length)];
  return item ? <p className="gml-clip" aria-label={t("gmial.clips")}>{t(item.key, item.params)}</p> : null;
}

// Chat until 2013, Hangups until the 2018 look, then the Calendar, Keep and Tasks strip.
export function Side({ game, account, look, say }: { game: GameState; account: MailAccount; look: GmialLook; say: (key: string) => void }) {
  if (look === "material" || look === "pill") return (
    <aside className="gml-side gml-apps">{["calendar", "keep", "tasks"].map((k) => <span key={k} className={`gml-app gml-app-${k}`} title={t(`gmial.side.${k}`)} aria-label={t(`gmial.side.${k}`)} />)}</aside>
  );
  const people = seenAddresses(game, account).slice(0, 8);
  return (
    <aside className="gml-side">
      <h3>{look === "tabs" ? <a href="#hangups" onClick={(e) => { e.preventDefault(); say("gmial.moved"); }}>{t("gmial.side.hangups")}</a> : t("gmial.side.chat")}</h3>
      <ul>{people.map((x) => <li key={x}><i className={`gml-dot gml-dot-${[...x].reduce((n, c) => n + c.charCodeAt(0), 0) % 3}`} />{x}</li>)}</ul>
    </aside>
  );
}

const STAR_GLYPH = ["★", "★", "★", "!", "✓", "i", "★", "?"];
export function StarIcon({ m }: { m: Pick<Message, "star" | "flag"> | undefined }) {
  const n = m?.star ? m.flag ?? 0 : -1;
  return <span className={n < 0 ? undefined : `gml-st gml-st-${n}`}>{n < 0 ? "☆" : STAR_GLYPH[n]}</span>;
}

function Dialog({ title, close, children, onKeyDown }: { title: string; close: () => void; children: ReactNode; onKeyDown?: (e: KeyboardEvent) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { ref.current?.focus(); }, []);
  return (
    <div className="gml-dialog" role="dialog" aria-label={title} tabIndex={-1} ref={ref} onKeyDown={(e) => { e.stopPropagation(); if (e.key === "Escape") close(); else onKeyDown?.(e); }}>
      <h2>{title}</h2>
      {children}
      <button type="button" onClick={close}>{t("gmial.keys.close")}</button>
    </div>
  );
}

export const SHORTCUTS: [string, string][] = [
  ["c", "compose"], ["j", "next"], ["k", "prev"], ["o", "open"], ["u", "back"], ["x", "select"], ["e", "archive"], ["#", "delete"], ["!", "spam"],
  ["r", "reply"], ["a", "all"], ["f", "fwd"], ["s", "star"], ["l", "label"], ["/", "search"], ["g i", "inbox"], ["g s", "starred"], ["?", "help"],
];
export function CheatSheet({ close }: { close: () => void }) {
  return (
    <Dialog title={t("gmial.keys.title")} close={close}>
      <table className="gml-plain"><tbody>{SHORTCUTS.map(([k, id]) => <tr key={id}><td><kbd>{k}</kbd></td><td>{t(`gmial.keys.${id}`)}</td></tr>)}</tbody></table>
    </Dialog>
  );
}

const N = 15;
type Snake = { body: [number, number][]; dir: [number, number]; food: [number, number]; over: boolean };
const fresh = (): Snake => ({ body: [[7, 7], [6, 7], [5, 7]], dir: [1, 0], food: [11, 7], over: false });
function step(g: Snake): Snake {
  if (g.over) return g;
  const [x, y] = g.body[0], head: [number, number] = [x + g.dir[0], y + g.dir[1]];
  if (head[0] < 0 || head[1] < 0 || head[0] >= N || head[1] >= N || g.body.some(([a, b]) => a === head[0] && b === head[1])) return { ...g, over: true };
  const ate = head[0] === g.food[0] && head[1] === g.food[1];
  const body = [head, ...(ate ? g.body : g.body.slice(0, -1))];
  let food = g.food;
  while (ate && body.some(([a, b]) => a === food[0] && b === food[1])) food = [Math.floor(Math.random() * N), Math.floor(Math.random() * N)];
  return { ...g, body, food };
}
const DIRS: Record<string, [number, number]> = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };

export function Snakey({ close }: { close: () => void }) {
  const [g, setG] = useState(fresh);
  useEffect(() => { if (g.over) return; const id = setInterval(() => setG(step), 160); return () => clearInterval(id); }, [g.over]);
  const turn = (e: KeyboardEvent) => {
    const d = DIRS[e.key];
    if (d && (d[0] !== -g.dir[0] || d[1] !== -g.dir[1])) { e.preventDefault(); setG({ ...g, dir: d }); }
  };
  const at = (x: number, y: number) => g.body.some(([a, b]) => a === x && b === y) ? "gml-sn-body" : g.food[0] === x && g.food[1] === y ? "gml-sn-food" : "";
  return (
    <Dialog title={t("gmial.labs.snakey.name")} close={close} onKeyDown={turn}>
      <div className="gml-snake">{Array.from({ length: N * N }, (_, i) => <i key={i} className={at(i % N, Math.floor(i / N))} />)}</div>
      <p>{t("gmial.snakey.score", { n: g.body.length - 3 })} {g.over && <><b>{t("gmial.snakey.over")}</b> <button type="button" onClick={() => setG(fresh())}>{t("gmial.snakey.again")}</button></>}</p>
    </Dialog>
  );
}

// Mail Goggles: five sums before a late-night send, the same ones within the game hour.
export function GogglesQuiz({ game, pass, close }: { game: GameState; pass: () => void; close: () => void }) {
  const [sums] = useState(() => gogglesQuiz(game.seed, game.hour)), [got, setGot] = useState(sums.map(() => "")), [wrong, setWrong] = useState(false);
  return (
    <Dialog title={t("gmial.labs.goggles.name")} close={close}>
      <form onSubmit={(e) => { e.preventDefault(); if (sums.every(([a, b], i) => Number(got[i]) === a + b)) pass(); else setWrong(true); }}>
        <p>{t("gmial.goggles.ask")}</p>
        {sums.map(([a, b], i) => (
          <label key={i} className="gml-sum">{a} + {b} = <input name={`sum${i}`} inputMode="numeric" value={got[i]} onChange={(e) => setGot(got.map((x, j) => (j === i ? e.target.value : x)))} autoComplete="off" /></label>
        ))}
        {wrong && <p className="gml-error" role="alert">{t("gmial.goggles.wrong")}</p>}
        <button type="submit">{t("gmial.goggles.send")}</button>
      </form>
    </Dialog>
  );
}

// General settings rows of later years: shortcuts, Superstars' star types and the Undo Send period.
export type Later = { keys: string; stars: number[]; undo: number };
export const laterOf = (a: MailAccount): Later => ({ keys: String(a.prefs?.keys ?? "off"), stars: starsOf(a), undo: Number(a.prefs?.undo ?? 0) });
export function LaterGeneral({ game, account, v, set }: { game: GameState; account: MailAccount; v: Later; set: (v: Later) => void }) {
  const undoSetting = since(game, GMIAL.undoSetting), always = since(game, GMIAL.undoAlways), undoOn = labOn(game.hour, account, "undo");
  const period = UNDO_PERIODS.includes(v.undo) ? v.undo : always ? 5 : 10;
  return (
    <>
      {since(game, GMIAL.keys) && <tr><th>{t("gmial.gen.keys")}</th><td>
        {(["off", "on"] as const).map((k) => <label key={k}><input type="radio" name="keys" checked={(v.keys === "on" ? "on" : "off") === k} onChange={() => set({ ...v, keys: k })} />{t(k === "on" ? "gmial.gen.keysOn" : "gmial.gen.keysOff")}</label>)}
      </td></tr>}
      {labOn(game.hour, account, "superstars") && <tr><th>{t("gmial.gen.stars")}</th><td className="gml-stars">
        {STAR_TYPES.map((n) => <label key={n}><input type="checkbox" name={`star${n}`} checked={v.stars.includes(n)}
          onChange={(e) => set({ ...v, stars: e.target.checked ? [...v.stars, n].sort() : v.stars.filter((x) => x !== n) })} /><StarIcon m={{ star: true, flag: n || undefined }} /> {t(`gmial.star.${n}`)}</label>)}
      </td></tr>}
      {(undoOn || undoSetting) && <tr><th>{t("gmial.gen.undo")}</th><td>
        {undoSetting && !always && <label><input type="checkbox" name="undoOn" checked={v.undo > 0} onChange={(e) => set({ ...v, undo: e.target.checked ? period : 0 })} />{t("gmial.gen.undoOn")}</label>}
        <label>{t("gmial.gen.undoPeriod")} <select name="undo" value={period} onChange={(e) => set({ ...v, undo: Number(e.target.value) })}>
          {UNDO_PERIODS.map((n) => <option key={n} value={n}>{t("gmial.gen.seconds", { n })}</option>)}
        </select></label>
      </td></tr>}
    </>
  );
}
export const laterPrefs = (v: Later) => ({ keys: v.keys, stars: v.stars.join(","), undo: v.undo });

export function InboxSettings({ game, account }: { game: GameState; account: MailAccount }) {
  const act = usePageAct(), [setSaved, mark] = useSaved();
  const [type, setType] = useState(inboxType(game.hour, account)), [tabs, setTabs] = useState(tabsOf(account));
  const typed = since(game, GMIAL.priority) && !since(game, GMIAL.priorityUntil), cats = since(game, "2013-05");
  return (
    <form onSubmit={(e) => { e.preventDefault(); setSaved(act(setAccountPrefs, account.id, { inbox: type, tabs: tabs.filter((c) => c !== "primary").join(",") }).ok); }}>
      <table className="gml-fields"><tbody>
        {typed && <tr><th>{t("gmial.inbox.type")}</th><td><select name="inboxType" value={type} onChange={(e) => setType(e.target.value as typeof type)}>
          <option value="default">{t("gmial.inbox.default")}</option><option value="priority">{t("gmial.inbox.priority")}</option>
        </select></td></tr>}
        {cats && <tr><th>{t("gmial.inbox.categories")}</th><td>{CATEGORIES.map((c) => (
          <label key={c}><input type="checkbox" name={`tab-${c}`} disabled={c === "primary" || type === "priority"} checked={tabs.includes(c)}
            onChange={(e) => setTabs(e.target.checked ? [...tabs, c] : tabs.filter((x) => x !== c))} />{t(`gmial.tab.${c}`)}</label>
        ))}</td></tr>}
      </tbody></table>
      <button type="submit">{t("gmial.set.save")}</button>{mark}
    </form>
  );
}

export function LabsSettings({ game, account }: { game: GameState; account: MailAccount }) {
  const act = usePageAct(), [setSaved, mark] = useSaved(), [on, setOn] = useState(labFlags(account));
  return (
    <form onSubmit={(e) => { e.preventDefault(); setSaved(act(setAccountPrefs, account.id, { labs: on.join(",") }).ok); }}>
      <h2>{t("gmial.labs.title")}</h2>
      <table className="gml-plain"><tbody>{labsShown(game.hour).map(({ id }) => (
        <tr key={id} data-lab={id}>
          <td><b>{t(`gmial.labs.${id}.name`)}</b><br />{t(`gmial.labs.${id}.text`)}</td>
          <td>{([true, false] as const).map((x) => <label key={String(x)}><input type="radio" name={`lab-${id}`} checked={on.includes(id) === x}
            onChange={() => setOn(x ? [...on, id] : on.filter((y) => y !== id))} />{t(x ? "gmial.labs.enable" : "gmial.labs.disable")}</label>)}</td>
        </tr>
      ))}</tbody></table>
      <button type="submit">{t("gmial.set.save")}</button>{mark}
    </form>
  );
}

export function ThemeSettings({ game, account }: { game: GameState; account: MailAccount }) {
  const act = usePageAct(), now = themeOf(game.hour, account);
  return (
    <ul className="gml-themes">{THEMES.map((k) => (
      <li key={k}><button type="button" className={`gml-theme-swatch gml-theme-${k}`} aria-pressed={now === k} onClick={() => act(setAccountPrefs, account.id, { theme: k })}>{t(`gmial.theme.${k}`)}</button></li>
    ))}</ul>
  );
}
