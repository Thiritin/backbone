import { yearOf } from "../00-core/time";
import type { Profile } from "../30-customers/customers";
import type { GameState } from "../50-state";
import { BUDGETS, CAMPAIGNS, DISCOUNTS, OWNED, owns, PLATFORMS, reach, type CampaignChannel, type OwnedChannel, type PlatformId } from "../80-business/marketing";
import type { ActionResult } from "./hardware";

const fail = (error: string): ActionResult => ({ ok: false, error });

export function setUpChannel(s: GameState, channel: OwnedChannel): ActionResult {
  const def = OWNED[channel];
  if (!def) return fail("error.unknownChannel");
  if (owns(s, channel)) return fail("error.channelOwned");
  if (def.needs && !owns(s, def.needs)) return fail("error.needsWebsite");
  if (yearOf(s.hour) < def.fromYear) return fail("error.channelLater");
  if (s.cash < def.setup) return fail("error.noCash");
  s.cash = Math.round((s.cash - def.setup) * 100) / 100;
  s.ledger = [...s.ledger, { hour: s.hour, category: "marketing", key: "ledger.marketingSetup", params: { channel }, amount: -def.setup }];
  s.marketing = { ...s.marketing, owned: [...s.marketing.owned, channel] };
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
  s.marketing = { ...s.marketing, platform };
  return { ok: true };
}
