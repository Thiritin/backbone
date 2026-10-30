import { useEffect, useRef, type KeyboardEvent } from "react";
import { t } from "../../../i18n/en";
import { complete, hostOf, promptOf, runLine, watchStep, type Editing, type Session, type Watch } from "../../../sim/60-infra/terminal";
import { useSessionState } from "../../session";
import { useStore } from "../../store";

export interface Line { prompt?: string; text: string }
// A file open in edit: the machine it is on, the text as last saved and the text being typed.
export interface Open extends Editing { host: string; saved: string }

const MAX_LINES = 400;

// The shell's line editing: history, Tab completion, the [Y/n] question and the lines of installs and recoveries as the
// game moves on. The Terminal and every machine's console each keep their own under prefix.
export function useShell(prefix: string, start: Session | null = null) {
  const game = useStore((s) => s.game);
  const [lines, setLines] = useSessionState<Line[]>(`${prefix}.lines`, []);
  const [session, setSession] = useSessionState<Session | null>(`${prefix}.session`, start);
  const [history, setHistory] = useSessionState<string[]>(`${prefix}.history`, []);
  const [watching, setWatching] = useSessionState<Watch[]>(`${prefix}.watch`, []);
  const [draft, setDraft] = useSessionState(`${prefix}.draft`, "");
  // The working directory, null for the home; the rest of a line waiting on a [Y/n] answer.
  const [cwd, setCwd] = useSessionState<string | null>(`${prefix}.cwd`, null);
  const [pending, setPending] = useSessionState<string | null>(`${prefix}.confirm`, null);
  const [open, setOpen] = useSessionState<Open | null>(`${prefix}.edit`, null);
  const recall = useRef(history.length);

  useEffect(() => {
    const steps = watching.map((w) => watchStep(game, w));
    if (steps.every((x, i) => x.next === watching[i])) return;
    const out = steps.flatMap((x) => x.output.map((text) => ({ text })));
    if (out.length) setLines([...lines, ...out].slice(-MAX_LINES));
    setWatching(steps.flatMap((x) => (x.next ? [x.next] : [])));
  }, [game, watching, lines, setLines, setWatching]);

  const tab = () => {
    if (pending !== null) return;
    const r = complete(useStore.getState().game, session, draft, cwd);
    if (r.options.length) setLines([...lines, { prompt: promptOf(session, cwd), text: draft }, { text: r.options.join("  ") }].slice(-MAX_LINES));
    setDraft(r.line);
  };

  const submit = (line = draft, from = session) => {
    const asked = pending, dir = from === session ? cwd : null;
    const shown: Line = { prompt: asked !== null ? t("term.apt.confirm") : promptOf(from, dir), text: line };
    setDraft("");
    if (asked !== null) {
      setPending(null);
      if (!/^\s*(y|yes)?\s*$/i.test(line)) { setLines([...lines, shown, { text: t("term.apt.abort") }].slice(-MAX_LINES)); return; }
    }
    const result = runLine(() => useStore.getState().game, (c) => useStore.getState().act(...c), from, dir, asked ?? line, history.length);
    const output = result.output.map((text) => ({ text }));
    setLines((result.clear ? output : [...lines, shown, ...output]).slice(-MAX_LINES));
    setSession(result.session);
    setCwd(result.cwd);
    setPending(result.confirm);
    if (result.dev) useStore.getState().openApp("Dev menu");
    if (result.edit) setOpen({ ...result.edit, host: hostOf(result.session), saved: result.edit.text });
    if (result.watch.length) setWatching([...watching, ...result.watch]);
    if (asked !== null) return;
    if (line.trim()) setHistory([...history, line].slice(-100));
    recall.current = line.trim() ? Math.min(history.length + 1, 100) : history.length;
  };

  const walk = (step: number) => {
    const at = Math.max(0, Math.min(history.length, recall.current + step));
    recall.current = at;
    setDraft(history[at] ?? "");
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Tab") { e.preventDefault(); tab(); }
    else if (e.key === "Enter") submit();
    else if (e.key === "ArrowUp") { e.preventDefault(); walk(-1); }
    else if (e.key === "ArrowDown") { e.preventDefault(); walk(1); }
  };

  // A fresh session on the machine, as a login starts one.
  const begin = (to: Session | null, shown: Line[]) => { setSession(to); setLines(shown); setCwd(null); setPending(null); setDraft(""); setOpen(null); };

  const prompt = pending !== null ? t("term.apt.confirm") : promptOf(session, cwd);
  return { lines, setLines, session, setSession, draft, setDraft, open, setOpen, prompt, submit, onKeyDown, begin };
}
