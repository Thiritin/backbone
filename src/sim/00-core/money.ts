import { LOCALE } from "../../i18n/lang";
const EUR = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 0 });
const EUR_CENTS = new Intl.NumberFormat(LOCALE, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const euro = (v: number): string => `${EUR.format(v)} €`;
export const euroCents = (v: number): string => `${EUR_CENTS.format(v)} €`;
// A price: whole euros as "6 €", anything else with cents as "6.50 €".
export const euroPrice = (v: number): string => (Math.round(v * 100) % 100 ? euroCents(v) : euro(v));
