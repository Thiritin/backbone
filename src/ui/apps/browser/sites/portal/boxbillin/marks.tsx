import type { ScreenName } from "../shared/nav";

// The orange cube of BoxBillin' and the blue open box of FOSSBillin', drawn in code.
export const Cube = ({ size = 28 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
    <path d="M16 2 29 9 16 16 3 9Z" fill="#ffc94a" />
    <path d="M3 9 16 16V30L3 23Z" fill="#f08a1c" />
    <path d="M29 9 16 16V30L29 23Z" fill="#c9600c" />
    <path d="M9.5 5.5 22.5 12.5" stroke="#c9600c" strokeWidth="1.6" opacity="0.6" />
  </svg>
);

export const OpenBox = ({ size = 26 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
    <rect width="32" height="32" rx="8" fill="#2f6fe4" />
    <path d="M8 13 16 9 24 13V22L16 26 8 22Z M8 13 16 17 24 13 M16 17V26 M8 13 5 10 13 6 16 9 M24 13 27 10 19 6 16 9" fill="none" stroke="#fff" strokeWidth="1.7" strokeLinejoin="round" />
  </svg>
);

const PATHS: Partial<Record<ScreenName, string>> = {
  home: "M2 8 8 3 14 8 M4 7V13H12V7",
  products: "M2 5 8 2 14 5V11L8 14 2 11Z M2 5 8 8 14 5 M8 8V14",
  options: "M3 4H13 M3 8H13 M3 12H13 M6 2.5V5.5 M10 6.5V9.5 M5 10.5V13.5",
  servers: "M2.5 2.5H13.5V6.5H2.5Z M2.5 9.5H13.5V13.5H2.5Z M5 4.5H6 M5 11.5H6",
  orders: "M1.5 2.5H3.5L5 10.5H12.5L14 4.5H4 M6 13.5H6.5 M11 13.5H11.5",
  clients: "M6 7.5A2.5 2.5 0 1 0 6 2.5A2.5 2.5 0 1 0 6 7.5 M1.5 13.5C2 10.5 10 10.5 10.5 13.5 M11 3A2 2 0 0 1 11 7 M12.5 9.5C14 10.2 14.5 11.5 14.5 13",
  invoices: "M3.5 1.5H10.5L12.5 3.5V14.5H3.5Z M6 6H10 M6 9H10 M6 12H8.5",
  licence: "M5.5 10.5A3 3 0 1 0 5.5 4.5A3 3 0 1 0 5.5 10.5 M8 7.5H14.5V10 M12 7.5V9.5",
  updates: "M13 8A5 5 0 1 1 11.5 4.5 M11.5 1.5V4.5H8.5",
};

export const Icon = ({ name }: { name: ScreenName }) => (
  <svg className="bx-ico" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
    <path d={PATHS[name] ?? PATHS.home} fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
