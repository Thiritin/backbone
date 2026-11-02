import type { ReactNode } from "react";
import type { GameState } from "../../../../../../sim/50-state";
import type { Ticket, TicketAction } from "../../../../../../sim/40-support/tickets";
import type { RetentionId } from "../../../../../../sim/40-support/retention";
import { acceptSponsorship, answerSponsor, declineSponsorship } from "../../../../../../sim/90-actions/community";
import { changeTitle } from "../../../../../../sim/90-actions/games";
import { gameOf } from "../../../../../../sim/60-infra/games";
import { answerDomainTransfer } from "../../../../../../sim/90-actions/registrar";
import { closeTicket, replyTicket, resolveTicket, retainTicket } from "../../../../../../sim/90-actions/support";
import { bankUrl, HOME_URL } from "../../../../../../sim/80-business/browser";
import { uiSound, useStore } from "../../../../../store";
import { useTicketReplies, type ReplyAnswer, type ReplyModel } from "./useTicketReplies";

export interface ReplyHandlers {
  reply: (template: string) => void;
  retain: (offer: RetentionId) => void;
  action: (a: TicketAction) => void;
  answer: (a: ReplyAnswer) => void;
  transfer: (code: string | null) => void;
  close: () => void;
  resolve: () => void;
}
type Slot = (m: ReplyModel, h: ReplyHandlers) => ReactNode;

// The ways to answer an open ticket, each drawn by the slot the caller passes. Nothing renders for a closed ticket.
export function ReplyPanel({ game, ticket, previews, frame, templates, offers, transfer, buttons }: { game: GameState; ticket: Ticket; previews?: boolean; frame?: (body: ReactNode) => ReactNode; templates?: Slot; offers?: Slot; transfer?: Slot; buttons?: Slot }) {
  const act = useStore((s) => s.act);
  const openApp = useStore((s) => s.openApp);
  const m = useTicketReplies(game, ticket, previews);
  if (m.final) return null;
  const id = ticket.id;
  const typed: typeof act = (fn, ...args) => {
    const r = act(fn, ...args);
    if (r.ok) uiSound("typing");
    return r;
  };
  const h: ReplyHandlers = {
    reply: (tpl) => typed(replyTicket, id, tpl),
    retain: (o) => typed(retainTicket, id, o),
    action: (a) => typed(resolveTicket, id, a),
    answer: (a) => {
      if (a === "overdraft") openApp("Browser", { kind: "url", id: game.bank ? `${bankUrl(game.bank.id)}banking/overdraft` : HOME_URL });
      else if (a === "sponsorNo" || a === "sponsorYes") act(answerSponsor, id, a === "sponsorYes");
      else if (a === "sponsorDecline") act(declineSponsorship, id);
      else if (a === "sponsorAccept") act(acceptSponsorship, id);
      else act(changeTitle, ticket.serviceId!, gameOf(game, ticket.serviceId!)?.switchTo ?? "");
    },
    transfer: (code) => act(answerDomainTransfer, id, code),
    close: () => act(closeTicket, id),
    resolve: () => act(resolveTicket, id),
  };
  const body = <>{m.templates && templates?.(m, h)}{m.offers && offers?.(m, h)}{m.transfer && transfer?.(m, h)}{buttons?.(m, h)}</>;
  return <>{frame ? frame(body) : body}</>;
}
