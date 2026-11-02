// Hosted Exchange by Ionose and Lookout 365 by year (docs/design/plans/webmail-server.md, section 7).
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
