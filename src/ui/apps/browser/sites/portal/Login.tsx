import { t } from "../../../../../i18n/en";
import { shopById, type ShopId } from "../../../../../sim/10-catalog/shops";
import type { LoginProps } from "./skins";

// The failed login's message and the password reset link under every admin login form.
export function LoginNote({ error, onForgot }: { error?: string; onForgot?: () => void }) {
  return (
    <>
      {error && <p className="portal-login-error" role="alert">{error}</p>}
      {onForgot && <a href="#" className="portal-forgot" onClick={(e) => { e.preventDefault(); onForgot(); }}>{t("shop-setup.forgot")}</a>}
    </>
  );
}

// The admin's first screen of a browser session.
export function Login({ variant, onLogin, error, onForgot }: LoginProps & { variant: ShopId }) {
  return (
    <form className="portal-login" onSubmit={(e) => { e.preventDefault(); onLogin(e.currentTarget); }}>
      <h1>{shopById(variant).name}</h1>
      <label>{t("shop-admin.username")}<input name="username" autoComplete="off" /></label>
      <label>{t("shop-admin.password")}<input name="password" type="password" autoComplete="off" /></label>
      <button type="submit" className="pt-btn primary">{t("shop-admin.login")}</button>
      <LoginNote error={error} onForgot={onForgot} />
    </form>
  );
}
