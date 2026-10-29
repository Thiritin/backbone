import { segmentOf, type Segment } from "../../../sim/10-catalog/attention";
import type { Product, Profile } from "../../../sim/30-customers/customers";

const NOTICES: Record<Segment, string> = { game: "At once while playing", business: "At once in business hours", private: "After hours to weeks" };
export const noticesOutages = (profile: Profile, product: Product = "webHosting"): string => NOTICES[segmentOf(profile, product)];
