import { t } from "../../../../../i18n/en";
import { shopById, type ShopId } from "../../../../../sim/10-catalog/shops";

// The admin's first screen of a browser session.
export function Login({ variant, onLogin }: { variant: ShopId; onLogin: () => void }) {
  return (
    <form className="portal-login" onSubmit={(e) => { e.preventDefault(); onLogin(); }}>
      <h1>{shopById(variant).name}</h1>
      <label>{t("shop-admin.username")}<input name="username" defaultValue="admin" autoComplete="off" /></label>
      <label>{t("shop-admin.password")}<input name="password" type="password" defaultValue="password" autoComplete="off" /></label>
      <button type="submit" className="btn primary">{t("shop-admin.login")}</button>
    </form>
  );
}
