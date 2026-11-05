import { t } from "../../../../../../i18n/en";
import { makeSkin } from "../shared/makeSkin";
import type { ScreenName } from "../shared/nav";
import "./skin.css";

// ModernBill had no quotes or marketplace; those screens stay reachable by address.
const SCREENS: ScreenName[] = ["home", "clients", "orders", "invoices", "products", "servers", "emails", "settings", "updates"];

export const modemBillSkin = makeSkin({
  cls: "sk-modem",
  nav: "top",
  dash: "modem",
  screens: SCREENS,
  labels: Object.fromEntries(SCREENS.map((n) => [n, t(`modemBill.nav.${n}`)])),
});
