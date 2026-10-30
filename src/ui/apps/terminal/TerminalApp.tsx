import { useEffect, useRef, useState } from "react";
import { t } from "../../../i18n/en";
import { DESK_PROMPT } from "../../../sim/60-infra/terminal";
import { editFiles } from "../../../sim/90-actions/files";
import { uiSound, useFocus, useStore } from "../../store";
import { useShell, type Line, type Open } from "./shell";
import "./terminal.css";

const SETUP_KEY = "backbone.shell";

// The first Terminal ever opened installs zsh by itself: two typos and a fist on the desk, then completion.
const INTRO: { cmd: string; out: string[]; thump?: boolean }[] = [
  { cmd: "sudo apt-get install zhs", out: ["Reading package lists... Done", "Building dependency tree... Done", "E: Couldn't find package zhs"], thump: true },
  { cmd: "sduo apt-get install zsh", out: ["bash: sduo: command not found"], thump: true },
  {
    cmd: "sudo apt-get install zsh",
    out: [
      "Reading package lists... Done", "Building dependency tree... Done", "The following NEW packages will be installed:", "  zsh",
      "Get:1 http://deb.debiant.org sarge/main zsh 4.2.5-1 [1772kB]", "Fetched 1772kB in 4s (412kB/s)",
      "Unpacking zsh (from .../zsh_4.2.5-1_i386.deb) ...", "Setting up zsh (4.2.5-1) ...",
    ],
  },
  { cmd: "chsh -s /bin/zsh", out: [] },
  { cmd: "echo 'autoload -U compinit; compinit' >> ~/.zshrc", out: ["You can now complete server names with Tab, for example after ssh."] },
];

const setupDone = () => { try { return !!localStorage.getItem(SETUP_KEY); } catch { return true; } };

export function TerminalApp() {
  const shell = useShell("terminal");
  const { lines, setLines, draft, setDraft, open, setOpen } = shell;
  const screen = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [ready, setReady] = useState(setupDone);

  useEffect(() => { if (screen.current) screen.current.scrollTop = screen.current.scrollHeight; }, [lines]);

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

  // Terminal on a server drops any open session and connects to it.
  const [target, setTarget] = useState<string | null>(null);
  useFocus("Terminal", (f) => { if (f.kind === "ssh") setTarget(f.id); });
  useEffect(() => {
    if (!ready || !target) return;
    setTarget(null);
    shell.setSession(null);
    shell.submit(`ssh ${target}`, null);
  }, [ready, target]);

  if (open) return <Editor file={open} onChange={setOpen} onClose={() => { setOpen(null); setTimeout(() => input.current?.focus()); }} />;

  return (
    <div className="tm" onClick={() => { if (!getSelection()?.toString()) input.current?.focus(); }}>
      <div className="tm-screen" ref={screen}>
        {lines.map((l, i) => (
          <div key={i} className="tm-line">{l.prompt && <span className="tm-prompt">{l.prompt} </span>}{l.text}</div>
        ))}
        <div className="tm-row">
          <span className="tm-prompt">{shell.prompt}</span>
          <input
            ref={input} value={draft} aria-label="Command" autoFocus spellCheck={false} autoCapitalize="off" autoComplete="off" readOnly={!ready}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (ready) shell.onKeyDown(e); }}
          />
        </div>
      </div>
    </div>
  );
}

// edit: the whole window is the file. Ctrl+S saves, Ctrl+X or Escape closes, twice when there are unsaved changes.
export function Editor({ file, onChange, onClose }: { file: Open; onChange: (f: Open) => void; onClose: () => void }) {
  const [status, setStatus] = useState<string | null>(null);
  const dirty = file.text !== file.saved;
  const save = () => {
    const r = useStore.getState().act(editFiles, file.host, [["write", file.path, file.text]]);
    if (r.ok) onChange({ ...file, saved: file.text });
    setStatus(r.ok ? "Saved" : t(r.error));
  };
  const close = () => {
    if (dirty && status !== "Unsaved changes") setStatus("Unsaved changes");
    else onClose();
  };
  return (
    <div className="tm tm-edit">
      <div className="tm-bar"><span>edit</span><span>{file.name}{dirty ? " *" : ""}</span></div>
      <textarea
        value={file.text} aria-label={file.name} autoFocus spellCheck={false} autoCapitalize="off" autoComplete="off"
        onChange={(e) => { onChange({ ...file, text: e.target.value }); setStatus(null); }}
        onKeyDown={(e) => {
          const key = e.key.toLowerCase();
          if ((e.ctrlKey || e.metaKey) && key === "s") { e.preventDefault(); save(); }
          else if ((e.ctrlKey && key === "x") || e.key === "Escape") { e.preventDefault(); close(); }
        }}
      />
      <div className="tm-bar"><span>{status ?? ""}</span><span>^S Save   ^X Exit</span></div>
    </div>
  );
}
