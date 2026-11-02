import type { ReactNode } from "react";
import type { GameState } from "../../../../../../sim/50-state";
import type { Ticket } from "../../../../../../sim/40-support/tickets";
import { useTicketPane, type PaneModel } from "./useTicketPane";

type Slot = (m: PaneModel) => ReactNode;

// A ticket's head, parties and thread, each drawn by the slot the caller passes; the reply panel goes in as children.
export function TicketPane({ game, ticket, head, party, thread, children }: { game: GameState; ticket: Ticket; head?: Slot; party?: Slot; thread?: Slot; children?: ReactNode }) {
  const m = useTicketPane(game, ticket);
  return <>{head?.(m)}{party?.(m)}{thread?.(m)}{children}</>;
}
