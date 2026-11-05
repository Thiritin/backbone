import { t } from "../../../../../../i18n/en";
import { yearOf } from "../../../../../../sim/00-core/time";
import { makeSkin } from "../shared/makeSkin";
import type { ScreenName } from "../shared/nav";
import "./skin.css";

// Stroke marks of the icon sidebar, one per menu entry.
const PATHS: Partial<Record<ScreenName, string>> = {
  home: "M2 13.5H14 M3.5 13.5V8 M7 13.5V4.5 M10.5 13.5V9.5 M14 13.5V2.5",
  clients: "M6 7.5A2.5 2.5 0 1 0 6 2.5A2.5 2.5 0 1 0 6 7.5 M1.5 13.5C2 10.5 10 10.5 10.5 13.5 M11 3A2 2 0 0 1 11 7 M12.5 9.5C14 10.2 14.5 11.5 14.5 13",
  orders: "M1.5 2.5H3.5L5 10.5H12.5L14 4.5H4 M6 13.5H6.5 M11 13.5H11.5",
  invoices: "M3.5 1.5H10.5L12.5 3.5V14.5H3.5Z M6 6H10 M6 9H10 M6 12H8.5",
  quotes: "M2.5 3H13.5V10H8L5 13V10H2.5Z M5.5 6.5H10.5",
  products: "M2 5 8 2 14 5V11L8 14 2 11Z M2 5 8 8 14 5 M8 8V14",
  servers: "M2.5 2.5H13.5V6.5H2.5Z M2.5 9.5H13.5V13.5H2.5Z M5 4.5H6 M5 11.5H6",
  emails: "M2 4H14V12H2Z M2 4 8 9 14 4",
  settings: "M3 4H13 M3 8H13 M3 12H13 M6 2.5V5.5 M10 6.5V9.5 M5 10.5V13.5",
  marketplace: "M2 2H7V7H2Z M9 2H14V7H9Z M2 9H7V14H2Z M9 9H14V14H9Z",
  updates: "M13 8A5 5 0 1 1 11.5 4.5 M11.5 1.5V4.5H8.5",
};

const icon = (n: ScreenName) => (
  <svg className="hb-ico" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
    <path d={PATHS[n]} fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const SCREENS: ScreenName[] = ["home", "clients", "orders", "invoices", "quotes", "products", "servers", "emails", "settings", "marketplace", "updates"];

// The dark navy sidebar came with HostBill 4 in 2019; the years before show the light admin.
export const hostBullSkin = makeSkin({
  cls: "sk-bull",
  nav: "side",
  dash: "hostbill",
  icon,
  era: (hour) => (yearOf(hour) >= 2019 ? "late" : "mid"),
  screens: SCREENS,
  labels: Object.fromEntries(SCREENS.map((n) => [n, t(`hostBull.nav.${n}`)])),
  stepsFrom: 2013,
});
