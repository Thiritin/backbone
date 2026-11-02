// docs/design/plans/webmail-server.md, 2.2: the web front ends of the own mail server. admin is the mail admin, which
// never answers at webmail.<domain>.
export type WebmailId = "squirrelmeal" | "squarecube" | "sogoat" | "postfixitadmin";
export type WebmailFeature = "threads" | "sieve" | "labels";
export interface WebmailRow { id: WebmailId; name: string; from: number; until: number | null; features: WebmailFeature[]; admin?: true }

export const WEBMAIL: WebmailRow[] = [
  { id: "squirrelmeal", name: "SquirrelMeal", from: 2005, until: null, features: ["threads"] },
  { id: "postfixitadmin", name: "Postfixit Admin", from: 2005, until: null, features: [], admin: true },
  { id: "squarecube", name: "Squarecube", from: 2008, until: null, features: ["threads", "sieve"] },
  { id: "sogoat", name: "SOGoat", from: 2009, until: null, features: ["threads", "sieve"] },
];
