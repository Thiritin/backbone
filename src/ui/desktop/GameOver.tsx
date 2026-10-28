import { Gavel } from "lucide-react";
import { useRef } from "react";
import { euroCents } from "../../sim/00-core/money";
import { formatDay } from "../apps/billing/BillingApp";
import { useStore } from "../store";

export function GameOver({ hour }: { hour: number }) {
  const { game, startGame, importSave } = useStore();
  const file = useRef<HTMLInputElement>(null);
  return (
    <div className="alert-backdrop" onPointerDown={(e) => e.stopPropagation()}>
      <div className="alert game-over" role="alertdialog" aria-modal="true" aria-labelledby="game-over-title">
        <span className="alert-icon"><Gavel /></span>
        <h2 id="game-over-title">{game.company.name} is bankrupt</h2>
        <p>The company became insolvent on {formatDay(hour)} with a balance of <span className="num">{euroCents(game.cash)}</span>.</p>
        <div className="alert-actions">
          <button className="btn" onClick={() => file.current?.click()}>Load export</button>
          <button className="btn primary" autoFocus onClick={startGame}>New game</button>
        </div>
        <input ref={file} type="file" accept="application/json,.json" hidden onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) importSave(await f.text());
        }} />
      </div>
    </div>
  );
}
