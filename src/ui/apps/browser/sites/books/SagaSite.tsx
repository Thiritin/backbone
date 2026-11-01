import { VendorShop, type SiteProps } from "./VendorShop";

// Saga: the business tier, green and serious.
export const SagaSite = (p: SiteProps) => (
  <VendorShop {...p} id="saga" look={{ brand: "#00704a", ink: "#fff", page: "#e3ebe6", font: "Georgia, 'Times New Roman', serif" }}
    logo={<span className="bv-logo"><b>saga</b> Office Line</span>} />
);
