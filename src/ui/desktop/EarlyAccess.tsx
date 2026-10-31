import { t } from "../../i18n/en";
import { FlaskConical } from "lucide-react";
import { useState } from "react";

const SEEN_KEY = "backbone.earlyAccessSeen";

const seen = () => { try { return !!localStorage.getItem(SEEN_KEY); } catch { return true; } };

export function EarlyAccess() {
  const [open, setOpen] = useState(() => !seen());
  if (!open) return null;
  const close = () => {
    try { localStorage.setItem(SEEN_KEY, "1"); } catch { /* Shows again next visit. */ }
    setOpen(false);
  };
  return (
    <div className="alert-backdrop" onPointerDown={(e) => e.stopPropagation()}>
      <div className="alert" role="alertdialog" aria-modal="true" aria-labelledby="ea-title" aria-describedby="ea-text">
        <span className="alert-icon"><FlaskConical /></span>
        <h2 id="ea-title">{t("desktop.early.title")}</h2>
        <p id="ea-text">{t("desktop.early.text")}</p>
        <div className="alert-actions">
          <a className="btn" href="https://github.com/Thiritin/backbone/issues" target="_blank" rel="noopener">GitHub</a>
          <a className="btn" href="https://discord.gg/e8nTAV8Yk7" target="_blank" rel="noopener">Discord</a>
        </div>
        <div className="alert-actions single">
          <button className="btn primary" autoFocus onClick={close}>{t("desktop.continue")}</button>
        </div>
      </div>
    </div>
  );
}
