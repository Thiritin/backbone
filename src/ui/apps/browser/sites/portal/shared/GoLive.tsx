import { useState } from "react";
import { goLivePlan } from "../../../../../../sim/80-business/portal";
import { importExisting } from "../../../../../../sim/90-actions/portal";
import type { GameState } from "../../../../../../sim/50-state";
import { t } from "../../../../../../i18n/en";
import { useStore } from "../../../../../store";

// "Bestandskunden übernehmen": what moves into the shop, asked once; also on the Settings screen.
export function GoLive({ game }: { game: GameState }) {
  const act = useStore((s) => s.act);
  const [done, setDone] = useState(false);
  const p = goLivePlan(game), n = p.services.length;
  const rows: [string, number][] = [["setup.golive.customers", p.customers.length], ["setup.golive.matched", p.matched], ["setup.golive.custom", n - p.matched], ["setup.golive.open", p.open]];
  return (
    <>
      <dl className="setup-fields">{rows.map(([k, v]) => <div key={k}><dt>{t(k)}</dt><dd className="num">{v}</dd></div>)}</dl>
      <p>
        <button className="btn" disabled={!p.customers.length} onClick={() => setDone(act(importExisting).ok)}>{t("setup.golive.title")}</button>
        {done && <span> {t("setup.golive.done")}</span>}
      </p>
    </>
  );
}
