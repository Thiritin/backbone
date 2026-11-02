import { useState } from "react";
import { t } from "../../../../../../i18n/en";
import { requestShopReset, resetShopPassword } from "../../../../../../sim/90-actions/shop-setup";
import { useStore } from "../../../../../store";
import "./setup.css";

// The admin area's refusal while the install folder exists, in the variants that refuse.
export const InstallDirBlock = ({ name }: { name: string }) => (
  <div className="ss-gate">
    <h2>{t("shop-setup.installDir.title")}</h2>
    <p>{t("shop-setup.installDir.block", { name })}</p>
  </div>
);

// Forgot password: the admin's e-mail address, then the same outcome whether an admin has it or not.
export function ForgotForm({ onBack }: { onBack: () => void }) {
  const attempt = useStore((s) => s.attempt), [sent, setSent] = useState(false);
  return (
    <form className="ss-gate" onSubmit={(e) => { e.preventDefault(); setSent(attempt(requestShopReset, String(new FormData(e.currentTarget).get("email") ?? "")).ok); }}>
      <h2>{t("shop-setup.forgot.title")}</h2>
      {sent ? <p role="status">{t("shop-setup.forgot.sent")}</p> : (
        <>
          <label>{t("shop-setup.email")}<input name="email" type="email" autoComplete="off" /></label>
          <button type="submit" className="btn primary">{t("shop-setup.forgot.send")}</button>
        </>
      )}
      <a href="#" onClick={(e) => { e.preventDefault(); onBack(); }}>{t("shop-setup.backToLogin")}</a>
    </form>
  );
}

// The page the reset mail links to: a new password for the admin it was sent for.
export function ResetForm({ token, onBack }: { token: string; onBack: () => void }) {
  const attempt = useStore((s) => s.attempt), [error, setError] = useState<string | null>(null), [done, setDone] = useState(false);
  const save = (form: HTMLFormElement) => {
    const d = new FormData(form), pass = String(d.get("pass") ?? "");
    if (pass !== String(d.get("confirm") ?? "")) return setError(t("shop-setup.mismatch"));
    const r = attempt(resetShopPassword, token, pass);
    setError(r.ok ? null : t(r.error, r.params));
    setDone(r.ok);
  };
  return (
    <form className="ss-gate" onSubmit={(e) => { e.preventDefault(); save(e.currentTarget); }}>
      <h2>{t("shop-setup.reset.title")}</h2>
      {done ? <p role="status">{t("shop-setup.reset.done")}</p> : (
        <>
          <label>{t("shop-setup.pass")}<input name="pass" type="password" autoComplete="new-password" /></label>
          <label>{t("shop-setup.confirm")}<input name="confirm" type="password" autoComplete="new-password" /></label>
          {error && <p className="portal-login-error" role="alert">{error}</p>}
          <button type="submit" className="btn primary">{t("shop-setup.reset.save")}</button>
        </>
      )}
      <a href="#" onClick={(e) => { e.preventDefault(); onBack(); }}>{t("shop-setup.backToLogin")}</a>
    </form>
  );
}
