import { useState } from "react";
import { t } from "../../../i18n/en";
import type { GameState } from "../../../sim/50-state";
import { booksLinked, DOHLE_NAME, taxView } from "../../../sim/80-business/tax";
import { connectDohle, submitTaxReturn } from "../../../sim/90-actions/tax";
import { useStore } from "../../store";
import { OpenReturns } from "../dohle/OpenReturns";
import { useBooks } from "./view";

export function BooksTax({ game, connect, submit }: { game: GameState; connect: (doc: string) => void; submit: (id: string) => void }) {
  const certs = game.docs.filter((d) => d.kind === "cert");
  const [doc, setDoc] = useState(certs[0]?.id ?? "");
  const linked = booksLinked(game);
  return (
    <div className="fin-scroll">
      <div className="fin-toolbar">
        {!taxView(game) ? null
          : linked ? <span>{DOHLE_NAME}: {t("ui-tax.books.connected")}</span>
          : (
            <>
              <label>{t("ui-tax.dohle.certificate")} <select value={doc} onChange={(e) => setDoc(e.target.value)}>{certs.map((d) => <option key={d.id} value={d.id}>{d.title}</option>)}</select></label>
              <button className="btn" disabled={!doc} onClick={() => connect(doc)}>{t("ui-tax.books.connect")}</button>
            </>
          )}
      </div>
      <OpenReturns game={game} submit={linked ? submit : undefined} />
    </div>
  );
}

export function TaxTab() {
  const game = useBooks(), act = useStore((s) => s.act);
  return <BooksTax game={game} connect={(doc) => act(connectDohle, doc)} submit={(id) => act(submitTaxReturn, id)} />;
}
