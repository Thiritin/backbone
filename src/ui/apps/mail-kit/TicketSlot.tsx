import type { ComponentProps, ReactNode } from "react";
import { ticketOf } from "../../../sim/42-mail/model";
import type { Message } from "../../../sim/42-mail/types";
import type { GameState } from "../../../sim/50-state";
import { ReplyPanel } from "../browser/sites/desk/headless/ReplyPanel";
import { TicketPane } from "../browser/sites/desk/headless/TicketPane";
import { deskUrl } from "../browser/sites/desk/DeskSite";

type Slots = Omit<ComponentProps<typeof ReplyPanel>, "game" | "ticket">;

// The ticket under a request's envelope: once a desk imports the mailbox it holds the ticket, so the slot shows the
// caller's desk note with the desk's address; before that the reply panel answers it here.
export function TicketSlot({ game, message, desk, ...slots }: Slots & { game: GameState; message: Message; desk: (url: string) => ReactNode }) {
  const tk = ticketOf(game, message);
  if (!tk) return null;
  const url = deskUrl(game, { kind: "ticket", id: tk.id });
  if (url) return <>{desk(url)}</>;
  return <TicketPane game={game} ticket={tk}><ReplyPanel game={game} ticket={tk} {...slots} /></TicketPane>;
}
