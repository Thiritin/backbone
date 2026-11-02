// game-servers plan 3.3 to 3.6: the hourly crashes, restarts and release waves of every game server.
import { hashRng, rand } from "../00-core/rng";
import { dateOf, yearOf } from "../00-core/time";
import { modById, releaseHour, releasedAt, successorOf, titleById, type GameTitle } from "../10-catalog/games";
import { idNum } from "../10-catalog/usage";
import { bump, createTicket, HOURS_PER_MONTH } from "../40-support/tickets";
import { resize } from "../30-market/manual";
import type { GameState } from "../50-state";
import { workloadsOf } from "../60-infra/cluster";
import { daemonBehind, daemonTick } from "../60-infra/daemons";
import { brokenMods, modCount, playersOf, type GameServer } from "../60-infra/games";
import { declineTitleSwitch, switchTicket } from "../90-actions/games";
import { workloadPerf } from "./products";

export const CRASH_BASE = 0.0008, LEAK_TITLE = 0.01, AUTO_PENALTY = 0.2, PEAK_PENALTY = 0.5;
// economy.md, Happiness and churn: a quarter of a faded title's customers stay for good; the rest ask to move, more often every year.
export const FAN_SHARE = 0.25, SWITCH_MONTHLY = 0.04, SWITCH_HOURS = 7 * 24;
// Release waves: a customer left on an old version loses 0.15 happiness an hour-day after a month, up to 12 per release.
export const OUTDATED_GRACE = 30, OUTDATED_DRAIN = 0.15, OUTDATED_CAP = 12, WAVE_DAYS = 14, WAVE_CHANCE = 0.25;

// Evenings and weekend afternoons are when the players are on.
export const isPeak = (hour: number, day: number): boolean => (hour >= 17 && hour <= 22) || ((day === 0 || day === 6) && hour >= 12 && hour < 17);

export function crashChance(s: GameState, g: GameServer): number {
  const w = workloadsOf(s, g.serviceId)[0], slow = w && workloadPerf(s, w, "gameServer") < 0.9;
  return CRASH_BASE * (1 + 0.25 * modCount(g)) * (1 + 2 * brokenMods(g)) * (1 + 2 * g.leak) * (slow ? 2 : 1) * (daemonBehind(s, g.serviceId) ? 2 : 1);
}

// Per hour: the full mark, the schedule, memory growth, crashes and the release waves.
export function gamesTick(s: GameState): void {
  daemonTick(s);
  if (!s.gameServers.length) return;
  const d = dateOf(s.hour), hour = d.getUTCHours(), day = d.getUTCDay();
  s.gameServers = s.gameServers.map((g0) => {
    const v = s.services.find((x) => x.id === g0.serviceId), c = v && s.customers.find((x) => x.id === v.customerId), t = titleById(g0.title);
    if (!v || v.endedAt !== null || !c || !t) return g0;
    let g = g0;
    const r = g.restart;
    if (r.every !== "off" && r.hour === hour && (r.every === "daily" || r.day === day)) {
      g = { ...g, crashedAt: null, leak: 0 };
      if (isPeak(hour, day)) bump(c, -PEAK_PENALTY);
    }
    if (g.crashedAt === null) {
      g = { ...g, leak: Math.min(1, g.leak + (t.leak ? LEAK_TITLE : 0) + g.mods.reduce((n, id) => n + (modById(id)?.leak ?? 0), 0)) };
      if (rand(hashRng(s.seed, idNum(g.serviceId), s.hour)) < crashChance(s, g)) {
        g = { ...g, crashes: g.crashes + 1, leak: 0, crashedAt: g.auto ? null : s.hour };
        if (g.auto) bump(c, -AUTO_PENALTY);
      }
    }
    const p = g.crashedAt === null ? playersOf(s, g.serviceId) : null;
    if (p && p.players >= p.slots) g = { ...g, seenFull: s.hour };
    gameWave(s, g, c);
    return faded(s, g, c, t);
  });
  for (const g of s.gameServers) {
    const tk = g.switchTo ? switchTicket(s, g.serviceId) : undefined;
    if (tk && s.hour - tk.createdAt >= SWITCH_HOURS) declineTitleSwitch(s, tk.id);
  }
}

// Fans of a title stay when it fades; the seed decides who.
export const isFan = (s: GameState, serviceId: string): boolean => rand(hashRng(s.seed, idNum(serviceId), 61)) < FAN_SHARE;

// Past its fade a server shrinks once a month to the slots its busiest hour of the week needs, and a drifter may ask to move.
function faded(s: GameState, g: GameServer, c: GameState["customers"][number], t: GameTitle): GameServer {
  const year = yearOf(s.hour), id = idNum(g.serviceId);
  if (year <= t.fade) return g;
  if ((s.hour + id) % HOURS_PER_MONTH === 0) g = shrink(s, g, t);
  const next = successorOf(t, year);
  if (g.switchTo || !next || isFan(s, g.serviceId) || rand(hashRng(s.seed, id, s.hour, 62)) >= (SWITCH_MONTHLY * (year - t.fade)) / HOURS_PER_MONTH) return g;
  createTicket(s, c, "upgrade", g.serviceId, "switchTitle");
  return { ...g, switchTo: next.id };
}

function shrink(s: GameState, g: GameServer, t: GameTitle): GameServer {
  const v = s.services.find((x) => x.id === g.serviceId), now = playersOf(s, g.serviceId);
  if (!v || !now) return g;
  let peak = 0;
  for (let h = s.hour - 167; h <= s.hour; h++) peak = Math.max(peak, playersOf(s, g.serviceId, h)?.players ?? 0);
  const need = Math.min(now.slots, Math.max(t.slots[0], peak));
  if (need >= now.slots) return g;
  const r = need / now.slots;
  if (!resize(s, v, { ...v.spec, vcpu: v.spec.vcpu * r, ramGb: v.spec.ramGb * r }, "auto", "").ok) return g;
  s.services = s.services.map((x) => (x.id === v.id ? { ...x, price: x.price * r } : x));
  return g.slots === null ? g : { ...g, slots: need };
}

// An outdated server writes in once in four, on a day of the first two weeks, and then drains happiness after a month.
function gameWave(s: GameState, g: GameServer, c: GameState["customers"][number]): void {
  const t = titleById(g.title)!, latest = releasedAt(t, s.hour);
  if (g.version >= latest) return;
  const days = (s.hour - releaseHour(t, latest)) / 24, x = rand(hashRng(s.seed, idNum(g.serviceId), 5000 + latest));
  if (x < WAVE_CHANCE && Math.floor((x / WAVE_CHANCE) * WAVE_DAYS * 24) === Math.floor(days * 24)) createTicket(s, c, "howTo", g.serviceId, "gameVersion");
  if (days > OUTDATED_GRACE && days <= OUTDATED_GRACE + OUTDATED_CAP / OUTDATED_DRAIN) bump(c, -OUTDATED_DRAIN / 24);
}

