import { useEffect } from "react";
import { create } from "zustand";
import { newGame, type GameState } from "../sim/50-state";
import { tick } from "../sim/88-tick/tick";
import { deserialize, serialize } from "../sim/91-save/save";
import type { Speed } from "../sim/00-core/time";
import { t } from "../i18n/en";
import type { ActionResult } from "../sim/90-actions/hardware";

export const SAVE_KEY = "backbone.save";

// What another app asked a window to show; n changes on every request so repeating one still applies.
export interface Focus { kind: string; id: string; n: number }
export interface Win { id: string; app: string; x: number; y: number; w: number; h: number; z: number; minimized: boolean; zoomed: boolean; focus?: Focus }
export interface Banner { id: number; app: string; title: string; text: string; hour: number }
export interface NotifyPref { allow: boolean; banners: boolean }
export const DEFAULT_PREF: NotifyPref = { allow: true, banners: true };
const PREFS_KEY = "backbone.prefs";

interface Store {
  game: GameState;
  speed: Speed;
  windows: Win[];
  banners: Banner[];
  history: Banner[];
  notifyPrefs: Record<string, NotifyPref>;
  setNotifyPref: (app: string, patch: Partial<NotifyPref>) => void;
  advance: (hours: number) => void;
  act: (fn: (s: GameState) => ActionResult) => ActionResult;
  setSpeed: (s: Speed) => void;
  openApp: (app: string, focus?: Omit<Focus, "n">) => void;
  focus: (id: string) => void;
  close: (id: string) => void;
  minimize: (id: string) => void;
  toggleZoom: (id: string) => void;
  place: (id: string, box: Partial<Pick<Win, "x" | "y" | "w" | "h">>) => void;
  notify: (app: string, title: string, text: string) => void;
  dismiss: (id: number) => void;
  started: boolean;
  unseen: number;
  clearUnseen: () => void;
  save: () => void;
  startGame: () => void;
  importSave: (raw: string) => void;
  deleteProgress: () => void;
}

let bannerId = 0, focusId = 0;
const fresh = () => ({ speed: 0 as Speed, windows: [], banners: [], history: [], unseen: 0 });
const topZ = (ws: Win[]) => ws.reduce((m, w) => Math.max(m, w.z), 0);

function loadGame(): { game: GameState; loaded: boolean } {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) return { game: deserialize(raw), loaded: true };
  } catch {
    // An unreadable save starts a new company.
  }
  return { game: newGame(Date.now() >>> 0), loaded: false };
}

const initial = loadGame();

function loadPrefs(): Record<string, NotifyPref> {
  try {
    return JSON.parse(localStorage.getItem(PREFS_KEY) ?? "{}").notify ?? {};
  } catch {
    return {};
  }
}

export const useStore = create<Store>((set, get) => ({
  game: initial.game,
  speed: 0,
  windows: [],
  banners: [],
  history: [],
  notifyPrefs: loadPrefs(),
  started: initial.loaded,
  unseen: 0,

  advance: (hours) => {
    const game = { ...get().game, rng: { ...get().game.rng } };
    for (let i = 0; i < hours; i++) {
      for (const e of tick(game)) get().notify(e.app, t(`${e.key}.title`, e.params), t(`${e.key}.text`, e.params));
    }
    set({ game });
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
    const n = ws.length % 8, size = app === "Locations" ? { w: 1120, h: 700 } : app === "Billing" || app === "Bank" || app === "Customers" ? { w: 1240, h: 680 } : app === "Support" ? { w: 1160, h: 680 } : { w: 760, h: 480 };
    set({ windows: [...ws, { id: `${app}-${Date.now()}`, app, x: 96 + n * 32, y: 64 + n * 28, ...size, z: topZ(ws) + 1, minimized: false, zoomed: false, focus }] });
  },
  focus: (id) => set(({ windows }) => ({ windows: windows.map((w) => (w.id === id ? { ...w, z: topZ(windows) + 1 } : w)) })),
  close: (id) => set(({ windows }) => ({ windows: windows.filter((w) => w.id !== id) })),
  minimize: (id) => set(({ windows }) => ({ windows: windows.map((w) => (w.id === id ? { ...w, minimized: true } : w)) })),
  toggleZoom: (id) => set(({ windows }) => ({ windows: windows.map((w) => (w.id === id ? { ...w, zoomed: !w.zoomed } : w)) })),
  place: (id, box) => set(({ windows }) => ({ windows: windows.map((w) => (w.id === id ? { ...w, ...box } : w)) })),

  setNotifyPref: (app, patch) => {
    const notifyPrefs = { ...get().notifyPrefs, [app]: { ...(get().notifyPrefs[app] ?? DEFAULT_PREF), ...patch } };
    set({ notifyPrefs });
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify({ notify: notifyPrefs }));
    } catch {
      // Kept for this session only.
    }
  },
  notify: (app, title, text) => {
    const pref = get().notifyPrefs[app] ?? DEFAULT_PREF;
    if (!pref.allow) return;
    const b = { id: ++bannerId, app, title, text, hour: get().game.hour };
    set(({ banners, history, unseen }) => ({ banners: pref.banners ? [...banners, b].slice(-4) : banners, history: [b, ...history].slice(0, 50), unseen: unseen + 1 }));
    if (pref.banners) setTimeout(() => get().dismiss(b.id), 6000);
  },
  dismiss: (id) => set(({ banners }) => ({ banners: banners.filter((b) => b.id !== id) })),

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
    set({ ...fresh(), game: newGame(Date.now() >>> 0), started: true });
    get().save();
    get().notify("Settings", t("game.new.title"), t("game.new.text"));
    get().openApp("Getting started");
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
    set({ ...fresh(), game: newGame(Date.now() >>> 0), started: false });
  },
}));

export const loadedFromSave = initial.loaded;

// Runs apply with the focus another app opened this app's window on, on mount and on every new request.
export function useFocus(app: string, apply: (f: Focus) => void): void {
  const focus = useStore((s) => s.windows.find((w) => w.app === app)?.focus);
  useEffect(() => { if (focus) apply(focus); }, [focus?.n]);
}
