import { type GameState } from "../src/sim/50-state";
import { tick, type SimEvent } from "../src/sim/88-tick/tick";
import { acceptSponsorship } from "../src/sim/90-actions/community";
import { panelVm, readyGame as fresh } from "./fixtures";

// Sponsoring requests need Marketing basics.
export const readyGame = (seed: number) => { const s = fresh(seed); s.unlocks = [...s.unlocks, "marketingBasics"]; return s; };

export const runTo = (s: GameState, hour: number, events: SimEvent[] = []) => { while (s.hour < hour) events.push(...tick(s)); };
export const ticketOf = (s: GameState) => s.tickets.find((t) => t.kind === "sponsor" && t.status === "open")!;

// The first request of a new company, optionally swapped for another event.
export function asked(seed: number, event?: string, roomy = true): GameState {
  const s = readyGame(seed);
  if (roomy) for (const c of s.devices.find((d) => d.id === "dev3")!.components) if (c.kind === "ram") c.size = 16;
  while (!s.sponsorships.length) tick(s);
  if (event) {
    // The mirror is a storage service, which needs storage server software.
    if (event === "mirror") panelVm(s, s.clusters.find((c) => c.kind === "cloud")!.id, "vsftpeed", { vcpu: 1, ramGb: 2, diskGb: 600 });
    s.sponsorships[0].event = event;
    ticketOf(s).topic = event;
  }
  return s;
}

// The home line drops now and then and nothing can be placed meanwhile, so the accept waits a few hours; some seeds lose the
// basement server to a seizure first, which returns false.
export function accept(s: GameState): boolean {
  for (let i = 0; i < 6; i++) {
    const r = acceptSponsorship(s, s.sponsorships[0].ticketId);
    if (r.ok) return true;
    if (r.error !== "error.needsInternet") throw new Error(r.error);
    tick(s);
  }
  return false;
}

// Accepts the request and runs the event to its end; a long event is cut to a day.
export function through(s: GameState, events: SimEvent[] = []): GameState | null {
  if (!accept(s)) return null;
  s.sponsorships[0].endsAt = s.hour + 24;
  runTo(s, s.sponsorships[0].endsAt + 1, events);
  return s;
}
export const done = (s: GameState, events?: SimEvent[]): GameState => through(s, events)!;
