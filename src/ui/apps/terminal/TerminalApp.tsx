import { useEffect, useRef, useState } from "react";
import { t } from "../../../i18n/en";
import { complete, DESK_PROMPT, promptOf, recoveryReport, runCommand, type Session, type Watch } from "../../../sim/60-infra/terminal";
import { useSessionState } from "../../session";
import { uiSound, useFocus, useStore } from "../../store";
import "./terminal.css";

interface Line { prompt?: string; text: string }

const MAX_LINES = 400;
const SETUP_KEY = "backbone.shell";

// The first Terminal ever opened installs zsh by itself: two typos and a fist on the desk, then completion.
const INTRO: { cmd: string; out: string[]; thump?: boolean }[] = [
  { cmd: "sudo apt-get install zhs", out: ["Reading package lists... Done", "Building dependency tree... Done", "E: Couldn't find package zhs"], thump: true },
  { cmd: "sduo apt-get install zsh", out: ["bash: sduo: command not found"], thump: true },
  {
    cmd: "sudo apt-get install zsh",
    out: [
      "Reading package lists... Done", "Building dependency tree... Done", "The following NEW packages will be installed:", "  zsh",
      "Get:1 http://ftp.debian.org sarge/main zsh 4.2.5-1 [1772kB]", "Fetched 1772kB in 4s (412kB/s)",
      "Unpacking zsh (from .../zsh_4.2.5-1_i386.deb) ...", "Setting up zsh (4.2.5-1) ...",
    ],
  },
  { cmd: "chsh -s /bin/zsh", out: [] },
  { cmd: "echo 'autoload -U compinit; compinit' >> ~/.zshrc", out: ["You can now complete server names with Tab, for example after ssh."] },
];

const setupDone = () => { try { return !!localStorage.getItem(SETUP_KEY); } catch { return true; } };

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
  const [ready, setReady] = useState(setupDone);

  useEffect(() => { if (screen.current) screen.current.scrollTop = screen.current.scrollHeight; }, [lines]);

  // A recovery finishes in game time, so the screen reports it when the game has moved on.
  useEffect(() => {
    const done = watching.map((w) => ({ w, report: recoveryReport(game, w) })).filter((x) => x.report);
    if (!done.length) return;
    setLines([...lines, ...done.flatMap((x) => x.report!.map((text) => ({ text })))].slice(-MAX_LINES));
    setWatching(watching.filter((w) => !done.some((x) => x.w === w)));
  }, [game, watching, lines, setLines, setWatching]);

  useEffect(() => {
    if (ready) return;
    let live = true;
    const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
    void (async () => {
      const shown: Line[] = [];
      setLines(shown);
      for (const step of INTRO) {
        await wait(700);
        for (let i = 1; i <= step.cmd.length && live; i++) {
          setDraft(step.cmd.slice(0, i));
          uiSound("key");
          await wait(25 + Math.random() * 55);
        }
        await wait(300);
        if (!live) return;
        setDraft("");
        shown.push({ prompt: DESK_PROMPT, text: step.cmd });
        setLines([...shown]);
        for (const text of step.out) {
          await wait(step.out.length > 3 ? 180 : 60);
          shown.push({ text });
          setLines([...shown]);
        }
        if (step.thump) { await wait(700); uiSound("thump"); }
      }
      if (!live) return;
      try { localStorage.setItem(SETUP_KEY, "1"); } catch { /* Plays again next time. */ }
      setReady(true);
    })();
    return () => { live = false; };
  }, [ready, setLines, setDraft]);

  const tab = () => {
    const r = complete(useStore.getState().game, session, draft);
    if (r.options.length) setLines([...lines, { prompt: promptOf(session), text: draft }, { text: r.options.join("  ") }].slice(-MAX_LINES));
    setDraft(r.line);
  };

  const submit = (line = draft, from = session) => {
    const store = useStore.getState();
    const result = runCommand(store.game, from, line, history.length);
    const next: Line[] = result.clear ? [] : [...lines, { prompt: promptOf(from), text: line }, ...result.output.map((text) => ({ text }))];
    if (result.action) {
      const r = store.act(...result.action);
      if (!r.ok) next.push({ text: t(r.error) });
    }
    setLines(next.slice(-MAX_LINES));
    if (result.session !== undefined) setSession(result.session);
    if (result.watch) setWatching([...watching, result.watch]);
    if (line.trim()) setHistory([...history, line].slice(-100));
    recall.current = line.trim() ? Math.min(history.length + 1, 100) : history.length;
    setDraft("");
  };

  // Terminal on a server drops any open session and connects to it.
  const [target, setTarget] = useState<string | null>(null);
  useFocus("Terminal", (f) => { if (f.kind === "ssh") setTarget(f.id); });
  useEffect(() => {
    if (!ready || !target) return;
    setTarget(null);
    setSession(null);
    submit(`ssh ${target}`, null);
  }, [ready, target]);

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
            ref={input} value={draft} aria-label="Command" autoFocus spellCheck={false} autoCapitalize="off" autoComplete="off" readOnly={!ready}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (!ready) return;
              if (e.key === "Tab") { e.preventDefault(); tab(); }
              else if (e.key === "Enter") submit();
              else if (e.key === "ArrowUp") { e.preventDefault(); walk(-1); }
              else if (e.key === "ArrowDown") { e.preventDefault(); walk(1); }
            }}
          />
        </div>
      </div>
    </div>
  );
}
