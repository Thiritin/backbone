import { ding } from "./ding";
import { useEffect } from "react";
import { create } from "zustand";
import type { GameState } from "../sim/50-state";
import { startGame as newCompany } from "../sim/90-actions/start";
import { tick } from "../sim/88-tick/tick";
import { ADVISORY_KEYS } from "../sim/60-infra/security";
import { deserialize, serialize } from "../sim/91-save/save";
import type { Speed } from "../sim/00-core/time";
import { t } from "../i18n/en";
import type { ActionResult } from "../sim/90-actions/hardware";

export const SAVE_KEY = "backbone.save";

// What another app asked a window to show; n changes on every request so repeating one still applies.
export interface Focus { kind: string; id: string; n: number }
export interface Win { id: string; app: string; x: number; y: number; w: number; h: number; z: number; minimized: boolean; zoomed: boolean; doc?: string; focus?: Focus }
export interface Banner { id: number; app: string; title: string; text: string; hour: number }
// Older prefs also carry a banners flag, which is ignored: an allowed app shows banners and fills the notification centre.
export interface NotifyPref { allow: boolean; sound: boolean }
const WIDE = { w: 1240, h: 680 };
const WINDOW_SIZES: Record<string, { w: number; h: number }> = {
  Security: { w: 900, h: 420 }, Website: { w: 1100, h: 700 },
  Locations: { w: 1280, h: 760 }, Shop: { w: 1180, h: 700 }, Billing: WIDE, Bank: WIDE, Customers: WIDE, Marketing: WIDE, Market: WIDE, Network: WIDE,
  Support: { w: 1240, h: 720 }, Research: { w: 1140, h: 600 }, Products: { w: 1120, h: 720 }, "Virtual machines": { w: 1180, h: 680 }, Staff: { w: 1240, h: 640 },
};

export const prefOf = (prefs: Record<string, Partial<NotifyPref>>, app: string): NotifyPref => ({ allow: true, sound: app === "Support", ...prefs[app] });
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
  theme: Theme;
  setTheme: (theme: Theme) => void;
  // The Welcome to Pear sheet a new game opens with.
  welcome: boolean;
  closeWelcome: () => void;
  // The server whose first-time setup sheet is open.
  setup: string | null;
  setSetup: (deviceId: string | null) => void;
  // The security advisory sheet a vulnerability stage opens; the stage pauses the game.
  advisory: boolean;
  setAdvisory: (open: boolean) => void;
  // The skill whose How it works sheet is open.
  explain: string | null;
  setExplain: (id: string | null) => void;
  advance: (hours: number) => void;
  act: (fn: (s: GameState) => ActionResult) => ActionResult;
  setSpeed: (s: Speed) => void;
  openApp: (app: string, focus?: Omit<Focus, "n">) => void;
  // Opens a desktop document: the guide in Getting started, a note in its own Notes window.
  openDoc: (id: string) => void;
  focus: (id: string) => void;
  close: (id: string) => void;
  minimize: (id: string) => void;
  toggleZoom: (id: string) => void;
  place: (id: string, box: Partial<Pick<Win, "x" | "y" | "w" | "h">>) => void;
  notify: (app: string, title: string, text: string) => void;
  dismiss: (id: number) => void;
  forget: (id: number | null) => void;
  started: boolean;
  unseen: number;
  clearUnseen: () => void;
  save: () => void;
  startGame: () => void;
  importSave: (raw: string) => void;
  deleteProgress: () => void;
  cart: CartLine[];
  addToCart: (line: CartLine) => void;
  setCartQty: (model: string, brand: string, qty: number) => void;
  clearCart: () => void;
  // The location open in Locations; the Shop delivers there by default.
  openLoc: string | null;
  setOpenLoc: (id: string | null) => void;
}

export interface CartLine { model: string; brand: string; qty: number }

let bannerId = 0, focusId = 0;
const fresh = () => ({ speed: 0 as Speed, windows: [], banners: [], history: [], unseen: 0, cart: [], openLoc: null, welcome: false, setup: null, explain: null, advisory: false });
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

function loadPrefs(): Record<string, Partial<NotifyPref>> {
  try {
    return JSON.parse(localStorage.getItem(PREFS_KEY) ?? "{}").notify ?? {};
  } catch {
    return {};
  }
}

function loadTheme(): Theme {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === "light" || saved === "dark") return saved;
  } catch {
    // Storage blocked; follow the system setting.
  }
  return "auto";
}

export const useStore = create<Store>((set, get) => ({
  game: initial.game,
  speed: 0,
  windows: [],
  banners: [],
  history: [],
  notifyPrefs: loadPrefs(),
  theme: loadTheme(),
  setTheme: (theme) => {
    set({ theme });
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      // Kept for this session only.
    }
  },
  welcome: false,
  closeWelcome: () => {
    set({ welcome: false });
    get().openApp("Getting started");
  },
  setup: null,
  setSetup: (setup) => set({ setup }),
  advisory: false,
  setAdvisory: (advisory) => set({ advisory }),
  explain: null,
  setExplain: (explain) => set({ explain }),
  started: initial.loaded,
  unseen: 0,
  cart: [],

  // The cart lives only in memory; a line at qty 0 leaves the cart.
  addToCart: (l) => {
    const cart = get().cart, at = cart.find((c) => c.model === l.model && c.brand === l.brand);
    set({ cart: at ? cart.map((c) => (c === at ? { ...c, qty: c.qty + l.qty } : c)) : [...cart, l] });
  },
  setCartQty: (model, brand, qty) => set({ cart: get().cart.flatMap((c) => (c.model === model && c.brand === brand ? (qty > 0 ? [{ ...c, qty }] : []) : [c])) }),
  clearCart: () => set({ cart: [] }),
  openLoc: null,
  setOpenLoc: (openLoc) => set({ openLoc }),

  advance: (hours) => {
    const game = { ...get().game, rng: { ...get().game.rng } };
    let advisory = false;
    for (let i = 0; i < hours; i++) {
      for (const e of tick(game)) {
        get().notify(e.app, t(`${e.key}.title`, e.params), t(`${e.key}.text`, e.params));
        if (e.key === "event.trainingDone") set({ explain: String(e.params.id) });
        if (ADVISORY_KEYS.includes(e.key)) advisory = true;
      }
      if (game.gameOver !== null || advisory) break;
    }
    set(game.gameOver !== null ? { game, speed: 0 } : advisory ? { game, speed: 0, advisory } : { game });
  },
  act: (fn) => {
    const game = structuredClone(get().game);
    const r = fn(game);
    if (r.ok) set({ game });
    else get().notify("Settings", t("action.failed.title"), t(r.error));
    return r;
  },
  setSpeed: (speed) => set({ speed }),

  openApp: (app, target) => {
    const ws = get().windows;
    const open = ws.find((w) => w.app === app);
    const focus = target ? { ...target, n: ++focusId } : open?.focus;
    if (open) return set({ windows: ws.map((w) => (w.id === open.id ? { ...w, minimized: false, z: topZ(ws) + 1, focus } : w)) });
    const n = ws.length % 8, size = WINDOW_SIZES[app] ?? { w: 760, h: 480 };
    set({ windows: [...ws, { id: `${app}-${Date.now()}`, app, x: 96 + n * 32, y: 64 + n * 28, ...size, z: topZ(ws) + 1, minimized: false, zoomed: false, focus }] });
  },
  openDoc: (doc) => {
    const ws = get().windows, d = get().game.docs.find((x) => x.id === doc);
    if (!d) return;
    if (d.kind === "guide") return get().openApp("Getting started");
    const open = ws.find((w) => w.doc === doc);
    if (open) return set({ windows: ws.map((w) => (w.id === open.id ? { ...w, minimized: false, z: topZ(ws) + 1 } : w)) });
    const n = ws.length % 8;
    set({ windows: [...ws, { id: `${doc}-${Date.now()}`, app: "Notes", doc, x: 160 + n * 32, y: 84 + n * 28, w: 560, h: 420, z: topZ(ws) + 1, minimized: false, zoomed: false }] });
  },
  focus: (id) => set(({ windows }) => ({ windows: windows.map((w) => (w.id === id ? { ...w, z: topZ(windows) + 1 } : w)) })),
  close: (id) => set(({ windows }) => ({ windows: windows.filter((w) => w.id !== id) })),
  minimize: (id) => set(({ windows }) => ({ windows: windows.map((w) => (w.id === id ? { ...w, minimized: true } : w)) })),
  toggleZoom: (id) => set(({ windows }) => ({ windows: windows.map((w) => (w.id === id ? { ...w, zoomed: !w.zoomed } : w)) })),
  place: (id, box) => set(({ windows }) => ({ windows: windows.map((w) => (w.id === id ? { ...w, ...box } : w)) })),

  setNotifyPref: (app, patch) => {
    const notifyPrefs = { ...get().notifyPrefs, [app]: { ...prefOf(get().notifyPrefs, app), ...patch } };
    set({ notifyPrefs });
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify({ notify: notifyPrefs }));
    } catch {
      // Kept for this session only.
    }
  },
  notify: (app, title, text) => {
    const pref = prefOf(get().notifyPrefs, app);
    if (!pref.allow) return;
    if (pref.sound) ding();
    const b = { id: ++bannerId, app, title, text, hour: get().game.hour };
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
    set({ ...fresh(), game: newCompany(Date.now() >>> 0), started: true, welcome: true });
    get().save();
  },
  importSave: (raw) => {
    try {
      set({ ...fresh(), game: deserialize(raw), started: true });
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

export const loadedFromSave = initial.loaded;

// Runs apply with the focus another app opened this app's window on, on mount and on every new request.
export function useFocus(app: string, apply: (f: Focus) => void): void {
  const focus = useStore((s) => s.windows.find((w) => w.app === app)?.focus);
  useEffect(() => { if (focus) apply(focus); }, [focus?.n]);
}
