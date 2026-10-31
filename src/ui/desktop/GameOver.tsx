import { t } from "../../i18n/en";
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
        <h2 id="game-over-title">{t("desktop.over.title", { company: game.company.name })}</h2>
        <p>{t("desktop.over.text", { day: formatDay(hour), cash: euroCents(game.cash) })}</p>
        <div className="alert-actions">
          <button className="btn" onClick={() => file.current?.click()}>{t("desktop.over.load")}</button>
          <button className="btn primary" autoFocus onClick={startGame}>{t("desktop.newGame")}</button>
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
