import { Network } from "lucide-react";
import { useRef, useState } from "react";
import { useStore } from "../store";
import { Intro } from "./Intro";

export function StartScreen() {
  const { startGame, importSave } = useStore();
  const file = useRef<HTMLInputElement>(null);
  const [intro, setIntro] = useState(false);
  return (
    <main className="start">
      <span className="start-logo"><Network /></span>
      <h1>Backbone</h1>
      <div className="start-actions">
        <button className="btn primary" autoFocus onClick={startGame}>New game</button>
        <button className="btn" onClick={() => file.current?.click()}>Import save</button>
      </div>
      <button className="start-intro" onClick={() => setIntro(true)}>First time here?</button>
      {intro && <Intro onClose={() => setIntro(false)} />}
      <input ref={file} type="file" accept="application/json,.json" hidden onChange={async (e) => {
        const f = e.target.files?.[0];
        e.target.value = "";
        if (f) importSave(await f.text());
      }} />
    </main>
  );
}
