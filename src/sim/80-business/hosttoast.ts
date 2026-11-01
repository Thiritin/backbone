// HOSTtoast for you: the monthly fee, the uptime record, the test ticket, tier drops and the January awards
// (competitors.md, HOSTtoast).
import { t } from "../../i18n/en";
import { hashRng, rand } from "../00-core/rng";
import { dateOf, yearOf } from "../00-core/time";
import { AWARD_PRODUCTS, HOSTTOAST, lower, TIER_IDS, TIERS, type ListedProduct, type TierId } from "../10-catalog/hosttoast";
import { marketPrice, marketRates, sizeSpec } from "../10-catalog/products";
import type { Profile } from "../30-customers/customers";
import { locationCities, offers, openRivals, playerScores, priceIndex } from "../30-market/market";
import { monthOf, reviewCount, rivalScore, sellsIn, withBadges, yearAwards } from "../30-market/rivals";
import { createTicket, deliverMail } from "../40-support/tickets";
import type { GameState } from "../50-state";
import type { SimEvent } from "../88-tick/tick";
import { REVIEW_HOURS, reviewScore } from "./marketing";

export interface ListRow { id: string; name: string; tier: TierId; score: number; reviews: number; price: number; P: number; R: number; C: number }
// The buyer a product's scores are shown for.
const SHOWN_FOR: Record<ListedProduct, Profile> = { webHosting: "smallBiz", vps: "hobbyDev", gameServer: "gamer", reseller: "agency" };

// HOSTtoast's list for a product, in one city or all: open rivals and you once listed, by tier and then review score.
// Reseller rows show the price per GB, yours from your rates.
export function hosttoastList(s: GameState, product: ListedProduct, city: string | null): ListRow[] {
  const year = yearOf(s.hour), perGb = product === "reseller", from = perGb ? marketRates(product, year).diskGb ?? 0 : marketPrice(product, sizeSpec(product, 0, year), year);
  const yours = perGb ? s.rates.reseller?.diskGb ?? from : from * priceIndex(s);
  const rows: ListRow[] = openRivals(s).filter((r) => r.sells.includes(product) && (city === null || sellsIn(r, city))).map((r) => ({
    id: r.id, name: r.name, tier: r.tier, score: rivalScore(r), reviews: reviewCount(r), price: from * r.priceFactor, P: r.P, R: r.R, C: r.C,
  }));
  const cities = city === null ? locationCities(s) : [city];
  const at = cities.find((c) => offers(s, product, c));
  if (s.hosttoast.tier && at) {
    const sc = playerScores(s, SHOWN_FOR[product], at);
    rows.push({ id: "you", name: s.company.name, tier: s.hosttoast.tier, score: reviewScore(s), reviews: s.marketing.reviews.filter((r) => s.hour - r.hour < REVIEW_HOURS).length, price: yours, ...sc });
  }
  return rows.sort((a, b) => TIER_IDS.indexOf(b.tier) - TIER_IDS.indexOf(a.tier) || b.score - a.score);
}

// 90-day uptime: the mean of the last three months, 100% without a record.
export function uptime90(s: GameState): number {
  const u = s.hosttoast.uptime.slice(-3);
  return u.length ? u.reduce((a, b) => a + b, 0) / u.length : 1;
}

// The error key tier is refused with now, or null when you meet its needs; the test ticket is judged by the monthly audit.
export function tierRefusal(s: GameState, tier: TierId): string | null {
  const need = TIERS[tier];
  if (monthOf(s.hour) < need.months) return "error.hosttoast.tooYoung";
  if (uptime90(s) < need.uptime) return need.uptime > 0.99 ? "error.hosttoast.uptime995" : "error.hosttoast.uptime99";
  return null;
}

export const tierName = (tier: TierId): string => t(`hosttoast.tier.${tier}`);

export function hosttoastMail(s: GameState, topic: string, params: Record<string, string | number>): SimEvent {
  const m = deliverMail(s, HOSTTOAST, topic, params);
  return { app: "Support", key: "event.ticket", params: { ...params, ticketId: m.id, name: HOSTTOAST, subject: `ticket.mail.${topic}.subject` } };
}

// Last year's awards for you and the rivals; the rivals' badges count for the new year.
function awards(s: GameState): SimEvent[] {
  const year = yearOf(s.hour) - 1, listed = s.hosttoast.tier !== null;
  const count = s.marketing.reviews.filter((r) => s.hour - r.hour < REVIEW_HOURS).length;
  const sells = AWARD_PRODUCTS.filter((p) => locationCities(s).some((city) => offers(s, p, city)));
  const clean = listed && s.hosttoast.uptime.length > 0 && s.hosttoast.uptime.slice(-12).every((u) => u >= 1) && s.services.some((v) => v.endedAt === null);
  const won = yearAwards(s.competitors, year, listed ? { score: reviewScore(s), count, sells, clean } : null);
  s.hosttoast = { ...s.hosttoast, awards: [...s.hosttoast.awards, ...won] };
  s.competitors = withBadges(s.competitors, won);
  const events: SimEvent[] = [];
  for (const a of won) {
    if (a.kind === "host") {
      const id = `rival.award.${a.id}.${monthOf(s.hour)}.${AWARD_PRODUCTS.indexOf(a.product!)}.${year}`;
      s.news = [...s.news, `${id}@${s.hour}`];
      const name = a.id === "you" ? s.company.name : s.competitors.find((r) => r.id === a.id)?.name ?? "";
      events.push({ app: "News", key: "event.news.toastAward", params: { name, product: t(`sim.line.${a.product}`), year } });
    }
    if (a.id === "you") events.push(hosttoastMail(s, a.kind === "host" ? "hosttoastHost" : "hosttoastSeal", { year, product: a.product ? t(`sim.line.${a.product}`) : "" }));
  }
  return events;
}

// The 1st of each month, before billing clears downHours: record last month's uptime, judge the test ticket and the
// 90-day uptime, bill the fee and open the next test ticket.
export function hosttoastTick(s: GameState): SimEvent[] {
  const live = s.services.filter((v) => v.endedAt === null);
  const down = live.reduce((n, v) => n + Math.min(730, s.downHours[v.id] ?? 0), 0);
  const up = live.length ? Math.round((1 - down / (live.length * 730)) * 10000) / 10000 : 1;
  s.hosttoast = { ...s.hosttoast, uptime: [...s.hosttoast.uptime, up].slice(-12) };
  const events = dateOf(s.hour).getUTCMonth() === 0 ? awards(s) : [];
  const tier = s.hosttoast.tier;
  if (!tier) return events;

  const audit = s.tickets.find((x) => x.id === s.hosttoast.audit), limit = TIERS[tier].answer;
  const late = !!audit && limit !== null && (!audit.replies.length || audit.replies[0].hour - audit.createdAt > limit);
  const low = uptime90(s) < TIERS[tier].uptime;
  const now = late || low ? lower(tier) : tier;
  if (now !== tier) events.push(hosttoastMail(s, late ? "hosttoastLate" : "hosttoastUptime", { tier: tierName(now) }));

  const fee = TIERS[now].fee;
  if (fee > 0) {
    s.cash = Math.round((s.cash - fee) * 100) / 100;
    s.ledger = [...s.ledger, { hour: s.hour, category: "marketing", key: "ledger.hosttoast", params: { tier: tierName(now) }, amount: -fee }];
  }
  // The test ticket looks like any how-to ticket from one of your customers.
  const customers = s.customers.filter((c) => c.churnedAt === null && c.habit !== "friend");
  let ticket: string | null = null;
  if (TIERS[now].answer !== null && customers.length) {
    const r = hashRng(s.seed, s.hour, 0x7e57), c = customers[Math.floor(rand(r) * customers.length)];
    const topic = rand(r) < 0.5 ? "upload" : "email", made = createTicket(s, c, "howTo", null, topic);
    ticket = made.id;
    events.push({ app: "Support", key: "event.ticket", params: { ticketId: made.id, name: c.name, subject: `ticket.howTo.${topic}.subject`, service: "", hostname: "" } });
  }
  s.hosttoast = { ...s.hosttoast, tier: now, audit: ticket };
  return events;
}

