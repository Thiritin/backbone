// Hosted Exchange by Ionose and Lookout 365 by year (docs/design/plans/webmail-server.md, section 7).
import { hashRng, rand } from "../00-core/rng";
import { hourOfMonth } from "../00-core/time";
import { stepAt, type Steps } from "./mail-providers";

// Lookout Web Access 2003 and 2007, Lookout Web App 2010 and 2013, Lookout on the web.
export type OwaGen = "2003" | "2007" | "2010" | "2013" | "web";
export type IonoseLook = "early" | "late";

// Ionose moves to a release two to four years after it ships, a game rule.
const OWA: Record<"ionose" | "lookout", Steps<OwaGen>> = {
  ionose: [["2005-01", "2003"], ["2009-01", "2007"], ["2013-01", "2010"], ["2017-01", "2013"], ["2021-01", "web"]],
  lookout: [["2011-01", "2010"], ["2013-01", "2013"], ["2016-01", "web"]],
};
export const owaAt = (host: "ionose" | "lookout", hour: number): OwaGen => stepAt(OWA[host], hour);
// Before 2010 the web mail offers a full client that needs Internet Explorer, which the Browser is not.
export const owaLimited = (gen: OwaGen): boolean => gen === "2003" || gen === "2007";

export const ionoseLook = (hour: number): IonoseLook => (hour < hourOfMonth("2014-01") ? "early" : "late");
export const IONOSE_OWA = "owa.ionose.com";
export const IONOSE_SPF = "v=spf1 include:_spf.ionose.de ~all";

export const LOOKOUT_SITE = "lookout365.macrosoft.com";
export const LOOKOUT_ADMIN = "admin.lookout365.macrosoft.com";
export const LOOKOUT_OWA = "mail.lookout365.macrosoft.com";
export const LOOKOUT_SPF = "v=spf1 include:spf.protection.lookout365.com -all";
export const LOOKOUT_AUTODISCOVER = "autodiscover.outlook.lookout365.com";
// The admin center: the 2011 portal look until 2016, the 2017 redesign after.
export const lookoutLook = (hour: number): "early" | "late" => (hour < hourOfMonth("2017-01") ? "early" : "late");

// The TXT record that proves the domain, fixed by the game seed.
export function lookoutToken(seed: number, domain: string): string {
  const r = hashRng(seed, 6007, ...[...domain].map((c) => c.charCodeAt(0)));
  return `LO=lo${String(Math.floor(rand(r) * 1e8)).padStart(8, "0")}`;
}
