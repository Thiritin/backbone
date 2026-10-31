import { t } from "../../../i18n/en";
import { segmentOf, type Segment } from "../../../sim/10-catalog/attention";
import type { Product, Profile } from "../../../sim/30-customers/customers";

const NOTICES: Record<Segment, string> = { game: t("misc.noticeGame"), business: t("misc.noticeBusiness"), private: t("misc.noticePrivate") };
export const noticesOutages = (profile: Profile, product: Product = "webHosting"): string => NOTICES[segmentOf(profile, product)];
