import type { Profile } from "../src/sim/30-customers/customers";
import { createTicket, type Ticket, type TicketKind } from "../src/sim/40-support/tickets";
import { newGame, type GameState } from "../src/sim/50-state";
import { tick } from "../src/sim/88-tick/tick";
import { addCustomer, addService } from "../src/sim/90-actions/customers";

export const FEB_1 = 744, MAR_1 = 744 + 672;

export function crowd(s: GameState, profile: Profile, n: number): string[] {
  // How-to questions are about a service, so every customer runs one.
  return Array.from({ length: n }, (_, i) => {
    const id = addCustomer(s, `${profile} ${i}`, profile);
    addService(s, id, "vps", "VPS 512", 0.01, "hour");
    return id;
  });
}

export function one(seed = 1, profile: Profile = "private") {
  const s = newGame(seed);
  const cus = addCustomer(s, "Jonas Weber", profile);
  const svc = addService(s, cus, "vps", "VPS 512", 0.01, "hour");
  const c = () => s.customers.find((x) => x.id === cus)!;
  return { s, cus, svc, c };
}

export const ticketOf = (s: GameState, kind: TicketKind, topic: string, cus: string, svc: string | null): Ticket => {
  const t = createTicket(s, s.customers.find((c) => c.id === cus)!, kind, svc);
  t.topic = topic;
  return t;
};
export const get = (s: GameState, id: string) => s.tickets.find((t) => t.id === id)!;
export const runTo = (s: GameState, hour: number) => { while (s.hour < hour) tick(s); };
