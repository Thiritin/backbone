import { t } from "../../i18n/en";
import { guideDoc, type Doc, type GameState } from "../50-state";
import type { ActionResult } from "./hardware";
import { applyError } from "../80-business/paperwork";

const fail = (error: string): ActionResult => ({ ok: false, error });
const STEP_X = 100, STEP_Y = 100, ROWS = 6, ORIGIN = guideDoc();

// First grid spot down the left columns that no icon covers.
// ponytail: fixed 6 rows, the sim does not know the screen height.
export function freeSpot(s: GameState): { x: number; y: number } {
  for (let i = 0; ; i++) {
    const x = ORIGIN.x + Math.floor(i / ROWS) * STEP_X, y = ORIGIN.y + (i % ROWS) * STEP_Y;
    if (!s.docs.some((d) => Math.abs(d.x - x) < STEP_X && Math.abs(d.y - y) < STEP_Y)) return { x, y };
  }
}

const place = (x: number, y: number) => ({ x: Math.max(0, Math.round(x)), y: Math.max(0, Math.round(y)) });

export function addNote(s: GameState, at?: { x: number; y: number }): ActionResult {
  const id = `doc${s.nextId++}`;
  const { x, y } = at ? place(at.x, at.y) : freeSpot(s);
  s.docs.push({ id, kind: "note", title: t("doc.untitled"), body: "", x, y });
  return { ok: true, id };
}

export function editNote(s: GameState, id: string, patch: { title?: string; body?: string }): ActionResult {
  const doc = s.docs.find((d) => d.id === id);
  if (!doc) return fail("error.unknownDoc");
  const next: Partial<Doc> = {};
  if (patch.title !== undefined) {
    const title = patch.title.trim().slice(0, 80);
    if (!title) return fail("error.emptyTitle");
    next.title = title;
  }
  if (patch.body !== undefined) next.body = patch.body;
  Object.assign(doc, next);
  return { ok: true };
}

export function moveDoc(s: GameState, id: string, x: number, y: number): ActionResult {
  const doc = s.docs.find((d) => d.id === id);
  if (!doc) return fail("error.unknownDoc");
  Object.assign(doc, place(x, y));
  return { ok: true };
}

export function removeDoc(s: GameState, id: string): ActionResult {
  if (!s.docs.some((d) => d.id === id)) return fail("error.unknownDoc");
  s.docs = s.docs.filter((d) => d.id !== id);
  return { ok: true };
}

export function restoreGuide(s: GameState): ActionResult {
  if (s.docs.some((d) => d.kind === "guide")) return fail("error.guideOnDesktop");
  s.docs.push({ ...guideDoc(), ...freeSpot(s) });
  return { ok: true, id: ORIGIN.id };
}

export function addAppLink(s: GameState, app: string, at?: { x: number; y: number }): ActionResult {
  if (!s.installed.includes(app)) return fail("error.appNotInstalled");
  const id = `doc${s.nextId++}`;
  s.docs.push({ id, kind: "app", title: app, body: "", ...(at ? place(at.x, at.y) : freeSpot(s)) });
  return { ok: true, id };
}

export function setDocked(s: GameState, app: string, docked: boolean): ActionResult {
  if (!s.installed.includes(app)) return fail("error.appNotInstalled");
  s.undocked = docked ? s.undocked.filter((a) => a !== app) : [...new Set([...s.undocked, app])];
  return { ok: true };
}

// The office site's application form for the next legal form lands on the desktop.
export function downloadForm(s: GameState, form: string): ActionResult {
  const err = applyError(s, form);
  if (err) return fail(err);
  const have = s.docs.find((d) => d.kind === "form" && d.form?.form === form && !d.form.signed);
  if (have) return { ok: true, id: have.id };
  const id = `doc${s.nextId++}`;
  s.docs = [...s.docs, { id, kind: "form", title: t(`doc.form.${form}`), body: "", ...freeSpot(s), form: { form, from: s.registration!.form, signed: null } }];
  return { ok: true, id };
}

export function signForm(s: GameState, id: string): ActionResult {
  const doc = s.docs.find((d) => d.id === id);
  if (!doc?.form) return fail("error.unknownDoc");
  if (doc.form.signed !== null) return fail("error.formSigned");
  if (!s.registration) return fail("error.notRegistered");
  const err = applyError(s, doc.form.form);
  if (err) return fail(err);
  s.docs = s.docs.map((d) => (d.id === id ? { ...d, form: { ...d.form!, signed: s.hour } } : d));
  return { ok: true };
}
