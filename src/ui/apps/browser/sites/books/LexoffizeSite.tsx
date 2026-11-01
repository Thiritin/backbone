import { VendorShop, type SiteProps } from "./VendorShop";

// lexoffize: Lexwear's cloud sibling, blue with a red dot.
export const LexoffizeSite = (p: SiteProps) => (
  <VendorShop {...p} id="lexoffize" look={{ brand: "#2b7de9", ink: "#fff", page: "#f2f6fc", font: "'Helvetica Neue', Arial, sans-serif", flat: true }}
    logo={<span className="bv-logo">lex<b>offize</b><span style={{ color: "#d62d42" }}>.</span></span>} />
);
