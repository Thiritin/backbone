import { t } from "../../../i18n/en";
import { LOCALE } from "../../../i18n/lang";
import { euroCents } from "../../../sim/00-core/money";
import type { MethodId, PaymentMethod } from "../../../sim/10-catalog/payments";

export const methodName = (id: MethodId): string => t(id === "transfer" ? "payment-methods.transfer" : `vendor-sites.module.${id}`);

export const feeText = (m: PaymentMethod): string =>
  [m.pct > 0 && t("payment-methods.pct", { pct: (m.pct * 100).toLocaleString(LOCALE) }), m.fixed > 0 && euroCents(m.fixed)].filter(Boolean).join(" + ") || t("marketing.free");
