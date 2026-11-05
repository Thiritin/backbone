import type { GameState } from "../../../../sim/50-state";
import { booksLinked, taxView } from "../../../../sim/80-business/tax";

// Whether the tax portal is reachable, the books are linked to it, and the certificates that can link them.
export function vatReturns(s: GameState) {
  return {
    available: !!taxView(s),
    linked: booksLinked(s),
    certs: s.docs.filter((d) => d.kind === "cert"),
  };
}
