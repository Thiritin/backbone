import { newGame, type GameState } from "../50-state";
import { addNode, createCluster, provisionService } from "./clusters";
import { addCustomer } from "./customers";

// economy.md, Starting state: three friends on web hosting at €6 a month, running on the basement server, the cluster "Basement 1".
export const FRIENDS: [string, string][] = [["Jonas Weber", "jonasweber.de"], ["Mira Schulz", "mira-schulz.de"], ["Tobi Kraus", "tobikraus.de"]];
export const FRIEND_HAPPINESS = 85;

// A new company: the starting infrastructure of newGame with its customers placed on it.
export function startGame(seed: number): GameState {
  const s = newGame(seed);
  const cluster = createCluster(s, "loc1", "Basement 1");
  if (!cluster.ok || !addNode(s, cluster.id!, "dev3").ok) throw new Error("starting cluster failed");
  for (const [name, label] of FRIENDS) {
    const id = addCustomer(s, name, "private", "friend");
    s.customers.find((c) => c.id === id)!.happiness = FRIEND_HAPPINESS;
    if (!provisionService(s, id, "webHosting", { label, plan: "web-m", clusterId: cluster.id }).ok) throw new Error("starting service failed");
  }
  return s;
}
