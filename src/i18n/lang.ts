export type Params = Record<string, string | number>;
export type Dict = Record<string, (p: Params) => string>;

export const LANGS = { en: "English", de: "Deutsch", fr: "Français", es: "Español", it: "Italiano", pt: "Português" } as const;
export type Lang = keyof typeof LANGS;
const LOCALES: Record<Lang, string> = { en: "en-GB", de: "de-DE", fr: "fr-FR", es: "es-ES", it: "it-IT", pt: "pt-PT" };
const KEY = "backbone.lang";

function stored(): Lang {
  try {
    const v = localStorage.getItem(KEY);
    if (v && v in LANGS) return v as Lang;
  } catch {
    // No storage: fall through to the browser language.
  }
  const nav = typeof navigator === "undefined" ? "en" : navigator.language.slice(0, 2);
  return nav in LANGS ? (nav as Lang) : "en";
}

export let lang: Lang = stored();
export let LOCALE = LOCALES[lang];
// Entries of the active language; missing ones fall back to English.
export const active: Dict = {};

const packs = import.meta.glob<{ default: Dict }>(["./*/*.ts"]);

export async function loadLang(l: Lang = lang): Promise<void> {
  lang = l;
  LOCALE = LOCALES[l];
  const files = Object.entries(packs).filter(([path]) => path.startsWith(`./${l}/`));
  const mods = await Promise.all(files.map(([, load]) => load()));
  for (const k of Object.keys(active)) delete active[k];
  Object.assign(active, ...mods.map((m) => m.default));
  if (typeof document !== "undefined") document.documentElement.lang = l;
}

export function setLang(l: Lang) {
  try {
    localStorage.setItem(KEY, l);
  } catch {
    // Kept for this page only.
  }
  location.reload();
}
