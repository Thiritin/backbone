import type { ComponentType } from "react";
import type { BooksVendorId } from "../../../../../sim/10-catalog/bookkeeping";
import { CollmixSite } from "./CollmixSite";
import { GnuCacheSite } from "./GnuCacheSite";
import { LexoffizeSite } from "./LexoffizeSite";
import { OrgaminSite } from "./OrgaminSite";
import { SagaSite } from "./SagaSite";
import { SevdeckSite } from "./SevdeckSite";
import type { SiteProps } from "./VendorShop";
import { WizoSite } from "./WizoSite";

// Lexwear keeps its own site in ../lexwear.
export const BOOKS_SITES: Record<Exclude<BooksVendorId, "lexwear">, ComponentType<SiteProps>> = {
  wizo: WizoSite, saga: SagaSite, orgamin: OrgaminSite, collmix: CollmixSite, sevdeck: SevdeckSite, lexoffize: LexoffizeSite, gnucache: GnuCacheSite,
};
