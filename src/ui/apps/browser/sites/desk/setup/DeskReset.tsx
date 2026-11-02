import { useState } from "react";
import { t } from "../../../../../../i18n/en";
import type { SelfDeskId } from "../../../../../../sim/10-catalog/archives";
import { requestDeskReset, resetDeskPassword } from "../../../../../../sim/90-actions/desk-setup";
import { useStore } from "../../../../../store";
import "../../portal/setup/setup.css";

// Forgot password on a self-hosted desk: OsTickit takes a username or address, FreeScoot the address; the outcome is the
// same whether a staff member has it.
export function DeskForgot({ id, onBack }: { id: SelfDeskId; onBack: () => void }) {
  const attempt = useStore((s) => s.attempt), [sent, setSent] = useState(false);
  return (
    <form className="ss-gate" onSubmit={(e) => { e.preventDefault(); setSent(attempt(requestDeskReset, String(new FormData(e.currentTarget).get("who") ?? "")).ok); }}>
      <h2>{t(`desk-setup.${id}.forgot`)}</h2>
      {sent ? <p role="status">{t(`desk-setup.${id}.forgotSent`)}</p> : (
        <>
          <label>{t(`desk-setup.${id}.forgotWho`)}<input name="who" autoComplete="off" /></label>
          <button type="submit" className="btn primary">{t(`desk-setup.${id}.forgotSend`)}</button>
        </>
      )}
      <a href="#" onClick={(e) => { e.preventDefault(); onBack(); }}>{t("shop-setup.backToLogin")}</a>
    </form>
  );
}

// The page the reset mail links to: a new password for the staff member it was sent for.
export function DeskReset({ id, token, onBack }: { id: SelfDeskId; token: string; onBack: () => void }) {
  const attempt = useStore((s) => s.attempt), [error, setError] = useState<string | null>(null), [done, setDone] = useState(false);
  const save = (form: HTMLFormElement) => {
    const d = new FormData(form), pass = String(d.get("pass") ?? "");
    if (pass !== String(d.get("confirm") ?? "")) return setError(t("shop-setup.mismatch"));
    const r = attempt(resetDeskPassword, token, pass);
    setError(r.ok ? null : t(r.error, r.params));
    setDone(r.ok);
  };
  return (
    <form className="ss-gate" onSubmit={(e) => { e.preventDefault(); save(e.currentTarget); }}>
      <h2>{t(`desk-setup.${id}.reset`)}</h2>
      {done ? <p role="status">{t("shop-setup.reset.done")}</p> : (
        <>
          <label>{t("desk-setup.newPass")}<input name="pass" type="password" autoComplete="new-password" /></label>
          <label>{t("desk-setup.retype")}<input name="confirm" type="password" autoComplete="new-password" /></label>
          {error && <p className="portal-login-error" role="alert">{error}</p>}
          <button type="submit" className="btn primary">{t("shop-setup.reset.save")}</button>
        </>
      )}
      <a href="#" onClick={(e) => { e.preventDefault(); onBack(); }}>{t("shop-setup.backToLogin")}</a>
    </form>
  );
}
