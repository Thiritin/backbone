import { ShieldAlert } from "lucide-react";
import { useEffect } from "react";
import { createPortal } from "react-dom";
import { formatClock } from "../../sim/00-core/time";
import { t } from "../../i18n/en";
import { advisoryNodes, ADVISORY_KEYS, STAGE_HOURS, vulnById, vulnerable } from "../../sim/60-infra/security";
import { useStore } from "../store";

const SOURCE = ["Heize online", "Twister", "Bundesamt für Sicherheit in der Informationstechnick", "PHP project"];

// The sheet each stage of a security advisory opens with the game paused.
export function SecurityAlert() {
  const { game, setAdvisory, openApp } = useStore();
  const v = vulnById(game.security.vuln);
  const close = () => setAdvisory(false);

  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === "Escape" && setAdvisory(false);
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [setAdvisory]);

  if (!v) return null;
  const key = ADVISORY_KEYS[game.security.stage];
  const params = { name: v.id, versions: v.versions.join(", "), date: formatClock(v.at + STAGE_HOURS[3]) };
  const nodes = advisoryNodes(game);
  const rows: [string, number][] = [
    ["Affected nodes", nodes.filter((n) => vulnerable(game, n)).length],
    ["Offline", game.security.offline.length],
    ["Compromised", game.security.hacked.length],
  ];
  return createPortal(
    <div className="alert-backdrop" onPointerDown={(e) => e.stopPropagation()}>
      <div className="alert advisory" role="alertdialog" aria-modal="true" aria-labelledby="advisory-title">
        <span className="alert-icon"><ShieldAlert /></span>
        <span className="advisory-source">{SOURCE[game.security.stage]}</span>
        <h2 id="advisory-title">{t(`${key}.title`, params)}</h2>
        <p>{t(`${key}.text`, params)}</p>
        <dl className="advisory-facts">
          {rows.map(([k, n]) => <div key={k}><dt>{k}</dt><dd className="num">{n}</dd></div>)}
        </dl>
        <div className="alert-actions">
          <button className="btn" onClick={close}>Close</button>
          <button className="btn primary" autoFocus onClick={() => { close(); openApp("Security"); }}>Show nodes</button>
        </div>
      </div>
    </div>,
    document.querySelector(".desktop")!,
  );
}
