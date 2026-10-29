import { useEffect, useRef } from "react";
import { t } from "../../../i18n/en";
import { promptOf, recoveryReport, runCommand, type Session, type Watch } from "../../../sim/60-infra/terminal";
import { useSessionState } from "../../session";
import { useStore } from "../../store";
import "./terminal.css";

interface Line { prompt?: string; text: string }

const MAX_LINES = 400;

export function TerminalApp() {
  const game = useStore((s) => s.game);
  const [lines, setLines] = useSessionState<Line[]>("terminal.lines", []);
  const [session, setSession] = useSessionState<Session | null>("terminal.session", null);
  const [history, setHistory] = useSessionState<string[]>("terminal.history", []);
  const [watching, setWatching] = useSessionState<Watch[]>("terminal.watch", []);
  const [draft, setDraft] = useSessionState("terminal.draft", "");
  const recall = useRef(history.length);
  const screen = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => { if (screen.current) screen.current.scrollTop = screen.current.scrollHeight; }, [lines]);

  // A recovery finishes in game time, so the screen reports it when the game has moved on.
  useEffect(() => {
    const done = watching.map((w) => ({ w, report: recoveryReport(game, w) })).filter((x) => x.report);
    if (!done.length) return;
    setLines([...lines, ...done.flatMap((x) => x.report!.map((text) => ({ text })))].slice(-MAX_LINES));
    setWatching(watching.filter((w) => !done.some((x) => x.w === w)));
  }, [game, watching, lines, setLines, setWatching]);

  const submit = () => {
    const line = draft;
    const store = useStore.getState();
    const result = runCommand(store.game, session, line, history.length);
    const next: Line[] = result.clear ? [] : [...lines, { prompt: promptOf(session), text: line }, ...result.output.map((text) => ({ text }))];
    if (result.action) {
      const r = store.act(result.action);
      if (!r.ok) next.push({ text: t(r.error) });
    }
    setLines(next.slice(-MAX_LINES));
    if (result.session !== undefined) setSession(result.session);
    if (result.watch) setWatching([...watching, result.watch]);
    if (line.trim()) setHistory([...history, line].slice(-100));
    recall.current = line.trim() ? Math.min(history.length + 1, 100) : history.length;
    setDraft("");
  };

  const walk = (step: number) => {
    const at = Math.max(0, Math.min(history.length, recall.current + step));
    recall.current = at;
    setDraft(history[at] ?? "");
  };

  return (
    <div className="tm" onClick={() => { if (!getSelection()?.toString()) input.current?.focus(); }}>
      <div className="tm-screen" ref={screen}>
        {lines.map((l, i) => (
          <div key={i} className="tm-line">{l.prompt && <span className="tm-prompt">{l.prompt} </span>}{l.text}</div>
        ))}
        <div className="tm-row">
          <span className="tm-prompt">{promptOf(session)}</span>
          <input
            ref={input} value={draft} aria-label="Command" autoFocus spellCheck={false} autoCapitalize="off" autoComplete="off"
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
              else if (e.key === "ArrowUp") { e.preventDefault(); walk(-1); }
              else if (e.key === "ArrowDown") { e.preventDefault(); walk(1); }
            }}
          />
        </div>
      </div>
    </div>
  );
}
