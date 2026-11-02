import { t } from "../../../i18n/en";
import { period } from "../../../i18n/tax";
import { euroCents } from "../../../sim/00-core/money";
import { MEIN_URL, monthsOf, portalOpen, taxNumber, vatBetween } from "../../../sim/80-business/tax";
import { owed } from "./OpenReturns";
import type { GameState } from "../../../sim/50-state";
import { fileReturn } from "../../../sim/90-actions/tax";
import { useStore } from "../../store";
import { paperDay } from "../FormDoc";
import "./dohle-formular.css";

// docs/design/plans/tax-office.md: the desktop filing program, 2005 to 2012. Sends the open returns with the certificate.
export function DohleFormularApp() {
  const game = useStore((s) => s.game), act = useStore((s) => s.act), openApp = useStore((s) => s.openApp);
  return <DohleFormular game={game} send={(id) => act(fileReturn, id)} portal={() => openApp("Browser", { kind: "url", id: MEIN_URL })} />;
}

export function DohleFormular({ game, send, portal }: { game: GameState; send: (id: string) => void; portal: () => void }) {
  return (
    <div className="dhf">
      <div className="dhf-bar"><strong>DohleFormular</strong><span>{t("ui-tax.dohle.taxNumber")}: {taxNumber(game) ?? "–"}</span></div>
      {portalOpen(game) ? (
        <div className="dhf-retired">
          <p>{t("ui-tax.formular.retired")}</p>
          <button type="button" onClick={portal}>{t("ui-tax.mein.title")}</button>
        </div>
      ) : <ReturnForms game={game} send={send} />}
    </div>
  );
}

// The open returns with their figures and a Send button each; DohleFormular and Mein DOHLE show the same forms.
export function ReturnForms({ game, send }: { game: GameState; send: (id: string) => void }) {
  const open = game.tax.returns.filter((r) => r.filedAt === null);
  return (
    <table className="dhf-table">
      <thead>
        <tr>
          <th>{t("ui-tax.formular.return")}</th><th>{t("ui-tax.formular.period")}</th><th>{t("ui-tax.formular.due")}</th>
          <th className="num">{t("ui-tax.formular.output")}</th><th className="num">{t("ui-tax.formular.input")}</th><th className="num">{t("ui-tax.formular.payable")}</th><th />
        </tr>
      </thead>
      <tbody>
        {open.map((r) => {
          const v = vatBetween(game, r.from, r.to);
          return (
            <tr key={r.id} className={game.hour >= r.dueAt ? "late" : undefined}>
              <td>{t(`ui-tax.formular.kind.${r.kind}`)}</td>
              <td>{period({ from: r.from, months: monthsOf(r) })}</td>
              <td>{paperDay(r.dueAt - 24)}</td>
              {r.kind === "vat" ? <><td className="num">{euroCents(v.output)}</td><td className="num">{euroCents(v.input)}</td></> : <><td /><td /></>}
              <td className="num">{euroCents(owed(game, r))}</td>
              <td><button type="button" onClick={() => send(r.id)}>{t("ui-tax.formular.send")}</button></td>
            </tr>
          );
        })}
        {!open.length && <tr><td colSpan={7} className="dhf-none">{t("ui-tax.formular.none")}</td></tr>}
      </tbody>
    </table>
  );
}
