// Who mail comes from and how much of it is junk (docs/design/plans/mail-core.md, Junk).
import { BANKS } from "./banks";
import type { MailHostId } from "./mail-providers";

// Addresses of system senders by display name; everyone else writes from no-reply@<name>.com.
export const SENDERS: Record<string, string> = Object.fromEntries(BANKS.map((b) => [b.name, `service@${b.host}`]));

// Share of all inbound mail that is spam, by year, linear between the anchors.
const SPAM_SHARE: [number, number][] = [[2005, 0.65], [2008, 0.9], [2010, 0.9], [2014, 0.7], [2020, 0.55], [2026, 0.45]];
// Junk a day that even a quiet mailbox gets.
const JUNK_FLOOR: [number, number][] = [[2005, 5], [2008, 12], [2010, 12], [2026, 2]];
export const JUNK_CAP_PER_DAY = 400;

const along = (xs: [number, number][], year: number): number => {
  const i = xs.findIndex(([y]) => y > year);
  if (i === 0) return xs[0][1];
  if (i < 0) return xs[xs.length - 1][1];
  const [y0, v0] = xs[i - 1], [y1, v1] = xs[i];
  return v0 + ((v1 - v0) * (year - y0)) / (y1 - y0);
};
export const spamShare = (year: number): number => along(SPAM_SHARE, year);
export const junkFloor = (year: number): number => along(JUNK_FLOOR, year);

// Topics under ticket.mail.junk.<id>, with their invented senders and the first year they arrive.
export const JUNK_TOPICS: { id: string; from: string; since: number }[] = [
  { id: "pharmacy", from: "Maple Meds", since: 2005 },
  { id: "lottery", from: "Lotto Galaxy International", since: 2005 },
  { id: "replica", from: "Rolecks", since: 2005 },
  { id: "bitcorn", from: "Bitcorn", since: 2013 },
];

// The share of junk a host's filter catches, before training and spam filters on an own server.
const CATCH: Record<MailHostId, number> = { gmix: 0.93, goggle: 0.99, ionose: 0.9, lookout: 0.97, self: 0.5 };
export const GMIX_FREE_CATCH = 0.85;
export const SELF_TRAINED_CATCH = 0.8;
export const catchOf = (host: string, plan: string): number =>
  host === "gmix" && plan === "free" ? GMIX_FREE_CATCH : CATCH[host as MailHostId] ?? CATCH.self;

// The chance a legitimate, non-critical message lands in Junk.
const FALSE_JUNK: Record<MailHostId, number> = { gmix: 0.015, goggle: 0.001, ionose: 0.01, lookout: 0.003, self: 0.03 };
export const falseJunkOf = (host: string): number => FALSE_JUNK[host as MailHostId] ?? FALSE_JUNK.self;
