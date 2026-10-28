import { Network } from "lucide-react";
import { useRef } from "react";
import { useStore } from "../store";

export function StartScreen() {
  const { startGame, importSave } = useStore();
  const file = useRef<HTMLInputElement>(null);
  return (
    <main className="start">
      <span className="start-logo"><Network /></span>
      <h1>Backbone</h1>
      <div className="start-actions">
        <button className="btn primary" autoFocus onClick={startGame}>New game</button>
        <button className="btn" onClick={() => file.current?.click()}>Import save</button>
      </div>
      <input ref={file} type="file" accept="application/json,.json" hidden onChange={async (e) => {
        const f = e.target.files?.[0];
        e.target.value = "";
        if (f) importSave(await f.text());
      }} />
    </main>
  );
}
