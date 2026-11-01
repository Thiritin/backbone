// Letterheads for the paper post, keyed by the sender a letter carries. Marks are parodies of German authority styles.
import type { ReactNode } from "react";
import { CHAMBER_NAME, NOTARY_NAME, OFFICE_NAME, REGISTER_NAME } from "../../sim/80-business/paperwork";
import { TAX_OFFICE_NAME } from "../../sim/80-business/tax";

export interface Letterhead {
  org: string; dept: string; street: string; city: string; phone: string; web: string;
  mark: ReactNode; signer?: string; serif?: boolean;
}

// A municipal shield with a city gate of three towers.
const Crest = (
  <svg viewBox="0 0 40 48" aria-hidden="true">
    <path d="M2 2h36v22c0 12-9 19-18 22C11 43 2 36 2 24Z" fill="#c8102e" stroke="#1a1a1a" strokeWidth="1.2" />
    <path d="M9 34V20h5v-4h4v4h4v-4h4v4h5v14Z" fill="#fff" />
    <path d="M17 34v-6a3 3 0 0 1 6 0v6Z" fill="#c8102e" />
    <path d="M9 16h5v-3h-5ZM26 16h5v-3h-5Z" fill="#fff" />
  </svg>
);

// A heraldic eagle beside the black, red and gold strip that federal and state authorities print.
const Eagle = (
  <svg viewBox="0 0 64 48" aria-hidden="true">
    <rect x="0" y="0" width="3" height="16" fill="#000" />
    <rect x="0" y="16" width="3" height="16" fill="#dd0000" />
    <rect x="0" y="32" width="3" height="16" fill="#ffce00" />
    <g fill="#000" transform="translate(10 2)">
      <circle cx="22" cy="7" r="4" />
      <path d="M18 11h8l2 18-6 6-6-6Z" />
      <path d="M18 12 2 6l2 5-3 1 4 4-3 2 5 3-2 2 6 2 7-3ZM26 12l16-6-2 5 3 1-4 4 3 2-5 3 2 2-6 2-7-3Z" />
      <path d="M16 35l-4 9h4l2-4 2 4h4l2-4 2 4h4l-4-9Z" />
    </g>
  </svg>
);

const Chamber = (
  <svg viewBox="0 0 96 40" aria-hidden="true">
    <path d="M2 30C20 6 44 2 70 10" fill="none" stroke="#0064a8" strokeWidth="4" strokeLinecap="round" />
    <text x="20" y="36" fontFamily="Arial, Helvetica, sans-serif" fontWeight="700" fontSize="24" fill="#0064a8" letterSpacing="2">IHQ</text>
  </svg>
);

const Seal = (
  <svg viewBox="0 0 40 40" aria-hidden="true">
    <circle cx="20" cy="20" r="18" fill="none" stroke="#1d3b8f" strokeWidth="1.5" />
    <circle cx="20" cy="20" r="14" fill="none" stroke="#1d3b8f" strokeWidth="0.8" />
    <path d="M20 9l3 7h7l-6 5 2 8-6-5-6 5 2-8-6-5h7Z" fill="#1d3b8f" />
  </svg>
);

// dept is an i18n key; the rest are proper names and stay as written.
export const LETTERHEADS: Record<string, Letterhead> = {
  [OFFICE_NAME]: {
    org: "Stadt Frankfurt am Main", dept: "paperwork.letter.office", street: "Kurt-Schumacher-Str. 10", city: "60311 Frankfurt am Main",
    phone: "069 212-4 47 10", web: "www.stadt-frankfurt.de", mark: Crest,
  },
  [REGISTER_NAME]: {
    org: "Amtsgericht Frankfurt am Main", dept: "paperwork.letter.register", street: "Gerichtstr. 2", city: "60313 Frankfurt am Main",
    phone: "069 1367-01", web: "www.amtsgericht-ffm.de", mark: Eagle,
  },
  [CHAMBER_NAME]: {
    org: "IHQ Frankfurt am Main", dept: "paperwork.letter.chamber", street: "Börsenplatz 4", city: "60313 Frankfurt am Main",
    phone: "069 2197-0", web: "www.ihq-frankfurt.de", mark: Chamber,
  },
  [TAX_OFFICE_NAME]: {
    org: "Finanzamt Frankfurt am Main III", dept: "paperwork.letter.tax", street: "Gutleutstr. 120", city: "60327 Frankfurt am Main",
    phone: "069 2545-0", web: "www.dohle.de", mark: Eagle,
  },
  [NOTARY_NAME]: {
    org: NOTARY_NAME, dept: "paperwork.letter.notary", street: "Bockenheimer Landstr. 51", city: "60325 Frankfurt am Main",
    phone: "069 97 12 34-0", web: "www.notarin-stempel.de", mark: Seal, signer: NOTARY_NAME, serif: true,
  },
};
