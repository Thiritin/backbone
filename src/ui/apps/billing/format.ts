import { dateOf } from "../../../sim/00-core/time";
import { LOCALE } from "../../../i18n/lang";

export const formatDay = (hour: number) =>
  dateOf(hour).toLocaleDateString(LOCALE, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
