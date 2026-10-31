import { t } from "../../i18n/en";
import { ShieldAlert, TriangleAlert } from "lucide-react";
import { useEffect } from "react";
import { createPortal } from "react-dom";
import { euroCents } from "../../sim/00-core/money";
import type { GameState } from "../../sim/50-state";
import { ALERT_KEYS } from "../../sim/alerts";
import { advisoryNodes, ADVISORY_KEYS, vulnById, vulnerable } from "../../sim/60-infra/security";
import { useStore, type Banner } from "../store";
import { wikiUrl } from "../apps/browser/sites/wiki/articles";

const SOURCE = ["Heize online", "Twister", "Bundesamt für Sicherheit in der Informationstechnick", "PHP project"];

type Row = [string, string];

// The label/value rows and, for a PHP advisory stage, the publisher shown above the title.
function body(game: GameState, key: string): { rows: Row[]; source?: string } {
  if (key.startsWith("event.vuln.")) {
    if (!vulnById(game.security.vuln)) return { rows: [] };
    return {
      source: SOURCE[ADVISORY_KEYS.indexOf(key)],
      rows: [
        [t("desktop.alert.affectedNodes"), String(advisoryNodes(game).filter((n) => vulnerable(game, n)).length)],
        [t("desktop.alert.compromised"), String(game.security.hacked.length)],
      ],
    };
  }
  if (key === "event.cashNegative") return { rows: [[t("desktop.alert.balance"), euroCents(game.cash)]] };
  if (key === "event.loanMissed" || key === "event.loanCalled") {
    return { rows: [[t("desktop.alert.openLoans"), euroCents(game.loans.reduce((n, l) => n + l.balance, 0))]] };
  }
  if (key === "event.breach") {
    const b = openBreach(game);
    return { rows: b ? [[t("desktop.alert.host"), game.clusters.find((c) => c.id === b.hostId)?.name ?? ""], [t("desktop.alert.demand"), euroCents(b.ransom)]] : [] };
  }
  return { rows: [] };
}

// The ransom still waiting for a decision, newest first.
const openBreach = (game: GameState) => game.breaches.filter((b) => b.decision === null).at(-1);

// The Wikipedio article that explains an alert.
const ALERT_WIKI: Record<string, string> = { "event.dataLoss": "RAID", "event.dataCorrupted": "RAID" };
const LOAN_KEYS = ["event.cashNegative", "event.loanMissed", "event.loanCalled"];
const focus = (game: GameState, key: string) =>
  LOAN_KEYS.includes(key) ? { kind: "tab", id: "loans" } :
  key === "event.vulnCritical" ? { kind: "card", id: "software" } : key === "event.breach" && openBreach(game) ? { kind: "ticket", id: openBreach(game)!.ticketId } : undefined;

// The sheet an alert event opens with the game paused.
export function AlertSheet({ alert }: { alert: Banner }) {
  const game = useStore((s) => s.game);
  const closeAlert = useStore((s) => s.closeAlert);
  const openApp = useStore((s) => s.openApp);
  const key = alert.key ?? "";
  const app = ALERT_KEYS[key];
  const { rows, source } = body(game, key);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && closeAlert(true);
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [closeAlert]);

  return createPortal(
    <div className="alert-backdrop" onPointerDown={(e) => e.stopPropagation()}>
      <div className="alert advisory" role="alertdialog" aria-modal="true" aria-labelledby="alert-title">
        <span className="alert-icon">{key.startsWith("event.vuln") ? <ShieldAlert /> : <TriangleAlert />}</span>
        {source && <span className="advisory-source">{source}</span>}
        <h2 id="alert-title">{alert.title}</h2>
        <p>{alert.text}</p>
        {rows.length > 0 && (
          <dl className="advisory-facts">
            {rows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd className="num">{v}</dd></div>)}
          </dl>
        )}
        <div className="alert-actions">
          <button className="btn" onClick={() => closeAlert(true)}>{t("desktop.continue")}</button>
          {ALERT_WIKI[key] && <button className="btn" onClick={() => { closeAlert(false); openApp("Browser", { kind: "url", id: wikiUrl(ALERT_WIKI[key]) }); }}>{t("desktop.alert.wiki")}</button>}
          <button className="btn primary" autoFocus onClick={() => { closeAlert(false); openApp(app, focus(game, key) ?? alert.focus); }}>{t("desktop.alert.open", { app })}</button>
        </div>
      </div>
    </div>,
    document.querySelector(".desktop")!,
  );
}
