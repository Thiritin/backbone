import { VendorShop, type SiteProps } from "./VendorShop";

// sevDeck: the fintech-era cloud office in teal.
export const SevdeckSite = (p: SiteProps) => (
  <VendorShop {...p} id="sevdeck" look={{ brand: "#0f8b8d", ink: "#fff", page: "#f3f7f7", font: "'Helvetica Neue', Arial, sans-serif", flat: true }}
    logo={<span className="bv-logo">sev<b>Deck</b></span>} />
);
