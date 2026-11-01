import { useState } from "react";
import { t } from "../../../i18n/en";
import { registerLicence } from "../../../sim/90-actions/lexwear";
import { useStore } from "../../store";

// Lexwear Office's Register dialog: a licence key from Lexwear's email turns its module on.
export function Register({ onClose }: { onClose: () => void }) {
  const act = useStore((s) => s.act);
  const [key, setKey] = useState("");
  const [done, setDone] = useState<string | null>(null);
  return (
    <form className="books-register" onSubmit={(e) => {
      e.preventDefault();
      const r = act(registerLicence, key);
      if (r.ok && r.id) { setDone(r.id); setKey(""); }
    }}>
      <label htmlFor="books-key">{t("vendor-sites.licenceKey")}</label>
      <input id="books-key" className="num" value={key} autoFocus spellCheck={false} autoComplete="off" onChange={(e) => { setKey(e.target.value); setDone(null); }} />
      <button className="btn primary" type="submit" disabled={!key.trim()}>{t("vendor-sites.register")}</button>
      <button className="btn ghost" type="button" onClick={onClose}>{t("support.close")}</button>
      {done && <span className="books-registered" role="status">{t("vendor-sites.registeredAs", { module: t(`vendor-sites.module.${done}`) })}</span>}
    </form>
  );
}
