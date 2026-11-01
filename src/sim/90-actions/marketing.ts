import { yearOf } from "../00-core/time";
import type { Profile } from "../30-customers/customers";
import type { GameState } from "../50-state";
import { BUDGETS, CAMPAIGNS, DISCOUNTS, OWNED, owns, PLATFORMS, reach, type CampaignChannel, type OwnedChannel, type PlatformId } from "../80-business/marketing";
import { hasMarketingManager } from "../47-staff/staff";
import { fairCost, upcomingFairs } from "../80-business/fairs";
import { generationOf } from "../80-business/website";
import { metrics } from "../metrics";
import type { ActionResult } from "./hardware";

const fail = (error: string): ActionResult => ({ ok: false, error });

export function setUpChannel(s: GameState, channel: OwnedChannel): ActionResult {
  const def = OWNED[channel];
  if (!def) return fail("error.unknownChannel");
  if (owns(s, channel)) return fail("error.channelOwned");
  if (def.needs && !owns(s, def.needs)) return fail("error.needsWebsite");
  if (channel === "website" && !s.marketing.launched) return fail("error.needsLaunch");
  if (yearOf(s.hour) < def.fromYear) return fail("error.channelLater");
  if (s.cash < def.setup) return fail("error.noCash");
  s.cash = Math.round((s.cash - def.setup) * 100) / 100;
  s.ledger = [...s.ledger, { hour: s.hour, category: "marketing", key: "ledger.marketingSetup", params: { channel }, amount: -def.setup }];
  s.marketing = { ...s.marketing, owned: [...s.marketing.owned, channel], ...(channel === "website" && { designYear: generationOf(yearOf(s.hour)) }) };
  return { ok: true, id: channel };
}

// Starts or changes the campaign of a channel; its budget is billed at each month start.
export function setCampaign(s: GameState, channel: CampaignChannel, profiles: Profile[], budget: number, discount = 0): ActionResult {
  const def = CAMPAIGNS[channel];
  if (!def) return fail("error.unknownChannel");
  if (def.needs && !owns(s, def.needs)) return fail("error.channelMissing");
  const targets = [...new Set(profiles)];
  if (!targets.length || targets.some((p) => !reach(channel).includes(p))) return fail("error.campaignTargets");
  if (!BUDGETS.includes(budget)) return fail("error.campaignBudget");
  if (!DISCOUNTS.includes(discount) || (discount > 0 && !def.discount)) return fail("error.campaignDiscount");
  const campaigns = s.marketing.campaigns.filter((c) => c.channel !== channel);
  s.marketing = { ...s.marketing, campaigns: [...campaigns, { channel, profiles: targets, budget, discount }] };
  return { ok: true, id: channel };
}

export function stopCampaign(s: GameState, channel: CampaignChannel): ActionResult {
  if (!s.marketing.campaigns.some((c) => c.channel === channel)) return fail("error.noCampaign");
  s.marketing = { ...s.marketing, campaigns: s.marketing.campaigns.filter((c) => c.channel !== channel) };
  return { ok: true };
}

// One review platform at a time; null leaves the current one.
export function setReviewPlatform(s: GameState, platform: PlatformId | null): ActionResult {
  if (platform !== null && !PLATFORMS[platform]) return fail("error.unknownPlatform");
  if (platform !== null && PLATFORMS[platform].fee > 0 && !hasMarketingManager(s)) return fail("error.needsMarketingManager");
  s.marketing = { ...s.marketing, platform };
  return { ok: true };
}

// Books the next run of a fair and sends one employee, who is away for its days.
export function bookFair(s: GameState, fairId: string, employeeId: string): ActionResult {
  const next = upcomingFairs(s).find((d) => d.fair.id === fairId);
  if (!next) return fail("error.unknownFair");
  if (next.booking) return fail("error.fairBooked");
  if (next.start <= s.hour) return fail("error.fairStarted");
  if (metrics(s).level.level < next.fair.level) return fail("error.fairLevel");
  const e = s.staff.find((x) => x.id === employeeId);
  if (!e) return fail("error.unknownEmployee");
  if (s.fairs.some((b) => b.employeeId === e.id && b.start < next.end && next.start < b.end)) return fail("error.attendeeBusy");
  const cost = fairCost(next.fair, next.year);
  if (s.cash < cost) return fail("error.noCash");
  s.cash = Math.round((s.cash - cost) * 100) / 100;
  s.ledger = [...s.ledger, { hour: s.hour, category: "marketing", key: "ledger.tradeFair", params: { name: next.fair.name }, amount: -cost }];
  s.fairs = [...s.fairs, { fair: fairId, year: next.year, employeeId, start: next.start, end: next.end, attended: null, leads: 0 }];
  return { ok: true };
}
