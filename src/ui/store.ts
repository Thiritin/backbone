import { booted, monthNet, pickSound, playSound, soundFor, WINDOW_MS, type Sound, type UiSound } from "./sounds";
import { useEffect } from "react";
import { create } from "zustand";
import type { GameState } from "../sim/50-state";
import { weeklyChallenge } from "../sim/10-catalog/challenges";
import type { ChangelogDay } from "./changelog";
import { newChallenge, newCompany } from "./embedded";
import { tickMinute } from "../sim/88-tick/tick";
import { isAlert } from "../sim/alerts";
import { typeOf } from "./notify-types";
import { deserialize, serialize } from "../sim/91-save/save";
import { actionName, runAction } from "../sim/90-actions/index";
import { SKIP, SPEEDS, type Speed } from "../sim/00-core/time";
import { t } from "../i18n/en";
import type { ActionResult, CartLine } from "../sim/90-actions/hardware";
import { readSession, writeSession } from "./session";

export const SAVE_KEY = "backbone.save";

// What another app asked a window to show; n changes on every request so repeating one still applies.
export interface Focus { kind: string; id: string; n: number }
export interface Win { id: string; app: string; x: number; y: number; w: number; h: number; z: number; minimized: boolean; zoomed: boolean; doc?: string; console?: string; focus?: Focus }
export interface Banner { id: number; app: string; title: string; text: string; hour: number; key?: string; target?: string }
// Older prefs also carry a banners flag, which is ignored: an allowed app shows banners and fills the notification centre.
// types holds the notification types switched off or on by id (notify-types.ts); a missing id is on.
export interface NotifyPref { allow: boolean; sound: boolean; types?: Record<string, boolean> }
const WIDE = { w: 1240, h: 680 };
const WINDOW_SIZES: Record<string, { w: number; h: number }> = {
  Security: { w: 900, h: 560 }, Browser: { w: 1100, h: 720 }, News: { w: 520, h: 640 }, Website: { w: 1100, h: 780 },
  Locations: { w: 1440, h: 860 }, Shop: { w: 1180, h: 700 }, Billing: WIDE, Customers: WIDE, Marketing: WIDE, Market: WIDE, Network: WIDE,
  Support: { w: 1400, h: 840 }, Research: { w: 1140, h: 600 }, Staff: { w: 1240, h: 640 },
};

export const prefOf = (prefs: Record<string, Partial<NotifyPref>>, app: string): NotifyPref => ({ allow: true, sound: true, ...prefs[app] });
export interface SoundPref { on: boolean; volume: number; ambience: number }
const SOUND_DEFAULT: SoundPref = { on: true, volume: 0.6, ambience: 0.5 };
const PREFS_KEY = "backbone.prefs";
export type Theme = "light" | "dark" | "auto";
const THEME_KEY = "backbone.theme";

interface Store {
  game: GameState;
  speed: Speed;
  windows: Win[];
  banners: Banner[];
  history: Banner[];
  notifyPrefs: Record<string, Partial<NotifyPref>>;
  setNotifyPref: (app: string, patch: Partial<NotifyPref>) => void;
  sound: SoundPref;
  setSound: (patch: Partial<SoundPref>) => void;
  theme: Theme;
  setTheme: (theme: Theme) => void;
  // The Pear OS update sheet: the changelog days it lists, or null when closed.
  news: ChangelogDay[] | null;
  openNews: (days: ChangelogDay[]) => void;
  closeNews: () => void;
  // The alert sheet an alert event opens; the event pauses the game and resume is the speed to return to.
  alert: Banner | null;
  resume: Speed;
  closeAlert: (resume: boolean) => void;
  // The skill whose How it works sheet is open.
  explain: string | null;
  setExplain: (id: string | null) => void;
  advance: (hours: number) => void;
  // Runs a 90-actions function on a copy of the game with these arguments; a success is kept and logged for replays.
  act: <A extends unknown[]>(fn: (s: GameState, ...args: A) => ActionResult, ...args: A) => ActionResult;
  setSpeed: (s: Speed) => void;
  openApp: (app: string, focus?: Omit<Focus, "n">) => void;
  // Opens a server's console in its own window, one per server.
  openConsole: (deviceId: string) => void;
  // Opens a desktop document: the guide in Getting started, a note in its own Notes window.
  openDoc: (id: string) => void;
  focus: (id: string) => void;
  close: (id: string) => void;
  minimize: (id: string) => void;
  toggleZoom: (id: string) => void;
  place: (id: string, box: Partial<Pick<Win, "x" | "y" | "w" | "h">>) => void;
  // key is the sim event key that picks the sound.
  notify: (app: string, title: string, text: string, key?: string) => void;
  dismiss: (id: number) => void;
  forget: (id: number | null) => void;
  started: boolean;
  unseen: number;
  clearUnseen: () => void;
  save: () => void;
  startGame: () => void;
  // Starts this week's challenge: its seed and twist.
  startChallenge: () => void;
  importSave: (raw: string) => void;
  deleteProgress: () => void;
  cart: CartLine[];
  addToCart: (line: CartLine) => void;
  setCartQty: (line: CartLine, qty: number) => void;
  clearCart: () => void;
  // The location open in Locations; the Shop delivers there by default.
  openLoc: string | null;
  setOpenLoc: (id: string | null) => void;
}

export type { CartLine };
// Two lines are the same item when model, brand, build and part match.
export const sameLine = (a: CartLine, b: CartLine): boolean =>
  a.model === b.model && a.brand === b.brand && a.vendor === b.vendor && JSON.stringify([a.extras ?? [], a.part ?? null]) === JSON.stringify([b.extras ?? [], b.part ?? null]);

let bannerId = 0, focusId = 0;
const fresh = () => ({ speed: 0 as Speed, windows: [], banners: [], history: [], unseen: 0, cart: [], openLoc: null, news: null, explain: null, alert: null });
const topZ = (ws: Win[]) => ws.reduce((m, w) => Math.max(m, w.z), 0);

function loadGame(): { game: GameState; loaded: boolean } {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) return { game: deserialize(raw), loaded: true };
  } catch {
    // An unreadable save starts a new company.
  }
  return { game: newCompany(Date.now() >>> 0), loaded: false };
}

const initial = loadGame();
// A reload (the dev server's after a code change, or the player's) reopens the windows of the saved game and keeps its clock running.
const restored = initial.loaded ? readSession<Win[]>("windows", []) : [];
const savedSpeed = readSession<Speed>("speed", 0);
const restoredSpeed: Speed = initial.loaded && SPEEDS.includes(savedSpeed) ? savedSpeed : 0;

function loadPrefs(): { notify: Record<string, Partial<NotifyPref>>; sound: SoundPref } {
  try {
    const p = JSON.parse(localStorage.getItem(PREFS_KEY) ?? "{}");
    return { notify: p.notify ?? {}, sound: { ...SOUND_DEFAULT, ...p.sound } };
  } catch {
    return { notify: {}, sound: SOUND_DEFAULT };
  }
}
const prefs = loadPrefs();

function savePrefs(notify: Record<string, Partial<NotifyPref>>, sound: SoundPref) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify({ notify, sound }));
  } catch {
    // Kept for this session only.
  }
}

// Sounds queued during one advance or action play together once it returns.
export const uiSound = (kind: UiSound) => {
  const { sound: { on, volume }, game } = useStore.getState();
  if (on) playSound(kind, volume, false, game.os);
};
const pending = new Set<Sound>(), lastPlayed: Partial<Record<Sound, number>> = {};
let lastBanner = -Infinity;

function loadTheme(): Theme {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === "light" || saved === "dark") return saved;
  } catch {
    // Storage blocked; follow the system setting.
  }
  return "auto";
}

// Fraction of the current game hour that has run; outside the store so the clock can read it every frame without re-renders.
export const clockCarry = { current: 0 };

export const useStore = create<Store>((set, get) => ({
  game: initial.game,
  speed: restoredSpeed,
  windows: restored,
  banners: [],
  history: [],
  notifyPrefs: prefs.notify,
  sound: prefs.sound,
  theme: loadTheme(),
  setTheme: (theme) => {
    set({ theme });
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      // Kept for this session only.
    }
  },
  news: null,
  openNews: (news) => set({ news }),
  closeNews: () => set({ news: null }),
  alert: null,
  resume: 0,
  closeAlert: (resume) => set(({ resume: speed }) => (resume ? { alert: null, speed } : { alert: null })),
  explain: null,
  setExplain: (explain) => set({ explain }),
  started: initial.loaded,
  unseen: 0,
  cart: [],

  // The cart lives only in memory; a line at qty 0 leaves the cart.
  addToCart: (l) => {
    const cart = get().cart, at = cart.find((c) => sameLine(c, l));
    set({ cart: at ? cart.map((c) => (c === at ? { ...c, qty: c.qty + l.qty } : c)) : [...cart, l] });
  },
  setCartQty: (line, qty) => set({ cart: get().cart.flatMap((c) => (sameLine(c, line) ? (qty > 0 ? [{ ...c, qty }] : []) : [c])) }),
  clearCart: () => set({ cart: [] }),
  openLoc: null,
  setOpenLoc: (openLoc) => set({ openLoc }),

  // Steps game minutes, so hours may be fractional; the hourly tick runs on every sixtieth.
  advance: (hours) => {
    const game = { ...get().game, rng: { ...get().game.rng } }, skip = get().speed === SKIP;
    let alert: Banner | null = null, happened = false;
    for (let i = 0, n = Math.round(hours * 60); i < n; i++) {
      for (const e of tickMinute(game)) {
        happened = true;
        get().notify(e.app, t(`${e.key}.title`, e.params), t(`${e.key}.text`, e.params), e.key);
        if (e.key === "event.trainingDone") set({ explain: String(e.params.id) });
        if (isAlert(e.key) && !alert) alert = { id: ++bannerId, app: e.app, title: t(`${e.key}.title`, e.params), text: t(`${e.key}.text`, e.params), hour: game.hour, key: e.key, target: e.params.deviceId === undefined ? undefined : String(e.params.deviceId) };
      }
      if (game.gameOver !== null || alert || (skip && happened)) break;
    }
    if (game.gameOver !== null) set({ game, speed: 0 });
    else if (alert) set(({ speed, alert: open, resume }) => ({ game, alert: open ?? alert, speed: 0, resume: open ? resume : speed === SKIP ? 1 : speed }));
    else if (skip && happened) set({ game, speed: 1 });
    else set({ game });
  },
  act: (fn, ...args) => {
    const game = structuredClone(get().game);
    const name = actionName(fn);
    if (!name) console.error(`${fn.name || "An action"} is not in ACTIONS, so replays miss it.`);
    const r = name ? runAction(game, name, args) : fn(game, ...args);
    if (r.ok) {
      if (booted(get().game, game)) setTimeout(() => uiSound("post"), 1200);
      if (game.media.stick.in !== get().game.media.stick.in) uiSound(game.media.stick.in ? "plug" : "unplug");
      set({ game });
    } else {
      uiSound("error");
      lastBanner = Date.now();
      get().notify("Settings", t("action.failed.title"), t(r.error));
    }
    return r;
  },
  setSpeed: (speed) => set({ speed }),

  openApp: (app, target) => {
    const ws = get().windows;
    const open = ws.find((w) => w.app === app);
    const focus = target ? { ...target, n: ++focusId } : open?.focus;
    if (open) return set({ windows: ws.map((w) => (w.id === open.id ? { ...w, minimized: false, z: topZ(ws) + 1, focus } : w)) });
    const n = ws.length % 8, size = WINDOW_SIZES[app] ?? { w: 760, h: 480 };
    const x = 96 + n * 32, y = 64 + n * 28;
    // Leaves room for the dock on small screens.
    const w = Math.min(size.w, (globalThis.innerWidth ?? Infinity) - x - 16), h = Math.min(size.h, (globalThis.innerHeight ?? Infinity) - y - 110);
    uiSound("open");
    set({ windows: [...ws, { id: `${app}-${Date.now()}`, app, x, y, w: Math.max(w, 480), h: Math.max(h, 320), z: topZ(ws) + 1, minimized: false, zoomed: false, focus }] });
  },
  openConsole: (deviceId) => {
    const ws = get().windows, open = ws.find((w) => w.console === deviceId);
    if (open) return set({ windows: ws.map((w) => (w.id === open.id ? { ...w, minimized: false, z: topZ(ws) + 1 } : w)) });
    const n = ws.length % 8, x = 140 + n * 32, y = 80 + n * 28;
    uiSound("open");
    set({ windows: [...ws, { id: `console-${deviceId}-${Date.now()}`, app: "Console", console: deviceId, x, y, w: 720, h: 620, z: topZ(ws) + 1, minimized: false, zoomed: false }] });
  },
  openDoc: (doc) => {
    const ws = get().windows, d = get().game.docs.find((x) => x.id === doc);
    if (!d) return;
    if (d.kind === "guide") return get().openApp("Getting started");
    if (d.kind === "app") return get().openApp(d.title);
    const open = ws.find((w) => w.doc === doc);
    if (open) return set({ windows: ws.map((w) => (w.id === open.id ? { ...w, minimized: false, z: topZ(ws) + 1 } : w)) });
    const n = ws.length % 8;
    set({ windows: [...ws, { id: `${doc}-${Date.now()}`, app: "Notes", doc, x: 160 + n * 32, y: 84 + n * 28, w: 560, h: 420, z: topZ(ws) + 1, minimized: false, zoomed: false }] });
  },
  focus: (id) => set(({ windows }) => ({ windows: windows.map((w) => (w.id === id ? { ...w, z: topZ(windows) + 1 } : w)) })),
  close: (id) => {
    uiSound("close");
    set(({ windows }) => ({ windows: windows.filter((w) => w.id !== id) }));
  },
  minimize: (id) => {
    uiSound("minimize");
    set(({ windows }) => ({ windows: windows.map((w) => (w.id === id ? { ...w, minimized: true } : w)) }));
  },
  toggleZoom: (id) => set(({ windows }) => ({ windows: windows.map((w) => (w.id === id ? { ...w, zoomed: !w.zoomed } : w)) })),
  place: (id, box) => set(({ windows }) => ({ windows: windows.map((w) => (w.id === id ? { ...w, ...box } : w)) })),

  setNotifyPref: (app, patch) => {
    const notifyPrefs = { ...get().notifyPrefs, [app]: { ...prefOf(get().notifyPrefs, app), ...patch } };
    set({ notifyPrefs });
    savePrefs(notifyPrefs, get().sound);
  },
  setSound: (patch) => {
    const sound = { ...get().sound, ...patch };
    set({ sound });
    savePrefs(get().notifyPrefs, sound);
  },
  notify: (app, title, text, key) => {
    const pref = prefOf(get().notifyPrefs, app);
    // Alerts show whatever the preferences say.
    if (!(key && isAlert(key)) && (!pref.allow || (key && pref.types?.[typeOf(app, key)] === false))) return;
    const kind = key ? soundFor(app, key) : null;
    if (kind && pref.allow && pref.sound && get().speed > 0 && get().sound.on && !globalThis.document?.hidden) {
      if (!pending.size) queueMicrotask(() => {
        const now = Date.now(), pick = pickSound(pending, now, lastPlayed), { game, sound } = get();
        pending.clear();
        if (!pick) return;
        lastPlayed[pick] = now;
        playSound(pick, sound.volume, pick === "month" && monthNet(game.ledger, game.hour) > 0);
      });
      pending.add(kind);
    } else if (!kind && pref.sound && get().sound.on && !globalThis.document?.hidden && Date.now() - lastBanner >= WINDOW_MS) {
      lastBanner = Date.now();
      uiSound("banner");
    }
    const b = { id: ++bannerId, app, title, text, hour: get().game.hour, key };
    set(({ banners, history, unseen }) => ({ banners: [...banners, b].slice(-4), history: [b, ...history].slice(0, 50), unseen: unseen + 1 }));
    setTimeout(() => get().dismiss(b.id), 6000);
  },
  dismiss: (id) => set(({ banners }) => ({ banners: banners.filter((b) => b.id !== id) })),
  // null clears the whole history.
  forget: (id) => set(({ banners, history }) => ({ banners: banners.filter((b) => id !== null && b.id !== id), history: id === null ? [] : history.filter((b) => b.id !== id) })),

  clearUnseen: () => set({ unseen: 0 }),
  save: () => {
    if (!get().started) return;
    try {
      localStorage.setItem(SAVE_KEY, serialize(get().game));
    } catch {
      get().notify("Settings", t("save.failed.title"), t("save.failed.text"));
    }
  },
  startGame: () => {
    set({ ...fresh(), game: newCompany(Date.now() >>> 0), started: true });
    uiSound("startup");
    get().openApp("Getting started");
    get().save();
  },
  startChallenge: () => {
    set({ ...fresh(), game: newChallenge(weeklyChallenge(new Date()).id), started: true });
    uiSound("startup");
    get().openApp("Getting started");
    get().save();
  },
  importSave: (raw) => {
    try {
      const game = deserialize(raw);
      set({ ...fresh(), game, started: true });
      uiSound("startup");
    } catch {
      get().notify("Settings", t("save.importFailed.title"), t("save.importFailed.text"));
      return;
    }
    get().save();
    get().notify("Settings", t("save.imported.title"), t("save.imported.text"));
  },
  deleteProgress: () => {
    try {
      localStorage.removeItem(SAVE_KEY);
    } catch {
      // Nothing stored to remove.
    }
    set({ ...fresh(), game: newCompany(Date.now() >>> 0), started: false });
  },
}));
// Without the focus another app asked for, so a reload keeps what the window shows now.
useStore.subscribe((s, prev) => {
  if (s.windows !== prev.windows) writeSession("windows", s.windows.map(({ focus: _, ...w }) => w));
  if (s.speed !== prev.speed) writeSession("speed", s.speed);
});

export const loadedFromSave = initial.loaded;

// Runs apply with the focus another app opened this app's window on, on mount and on every new request.
export function useFocus(app: string, apply: (f: Focus) => void): void {
  const focus = useStore((s) => s.windows.find((w) => w.app === app)?.focus);
  useEffect(() => { if (focus) apply(focus); }, [focus?.n]);
}
