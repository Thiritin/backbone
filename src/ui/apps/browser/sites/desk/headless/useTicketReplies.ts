import { euroCents } from "../../../../../../sim/00-core/money";
import { updatePrice } from "../../../../../../sim/10-catalog/apps";
import { actionsOf, isFinal, monthlyValue, shownTemplates, templatesOf, type Ticket, type TicketAction } from "../../../../../../sim/40-support/tickets";
import { subjectParams, TAKEDOWN_HOURS } from "../../../../../../sim/40-support/notices";
import { companyParams } from "../../../../../../sim/40-support/replies";
import { retentionOptions, type Odds, type RetentionId } from "../../../../../../sim/40-support/retention";
import { EXTENSION_DAYS } from "../../../../../../sim/45-billing/billing";
import { cleanupPrice } from "../../../../../../sim/60-infra/apps";
import { DOMAIN_OUT } from "../../../../../../sim/30-customers/registrar";
import { specText } from "../../../../../../sim/30-market/spec";
import { OVERDRAFT } from "../../../../../../sim/80-business/walk";
import { HELD_TOPIC } from "../../../../../../sim/80-business/community";
import type { GameState } from "../../../../../../sim/50-state";
import { t } from "../../../../../../i18n/en";

const ACTION_LABEL: Record<TicketAction, string> = {
  credit: t("support.action.credit"),
  cancel: t("support.action.cancel"),
  unsuspend: t("support.action.unsuspend", { days: EXTENSION_DAYS }),
  keep: t("support.action.keep"),
  forward: t("support.action.forward"),
  takedown: t("support.action.takedown", { h: TAKEDOWN_HOURS }),
  reject: t("support.action.reject"),
  comply: t("support.action.comply"),
  object: t("support.action.object"),
  refund: t("support.action.refund"),
  revert: t("support.action.revert"),
  pay: t("support.action.pay"),
  refuse: t("support.action.refuse"),
  accept: t("support.action.accept"),
  offerOnce: t("support.action.offerOnce"),
  offerManaged: t("support.action.offerManaged"),
  free: t("support.action.free"),
  clean: t("support.action.clean"),
  cleanPaid: t("support.action.cleanPaid"),
  noBackup: t("support.action.noBackup"),
};
const OFFER_TITLE: Record<RetentionId, string> = {
  half: t("support.offer.half"),
  free: t("support.offer.free"),
  d3: t("support.offer.d3"),
  d6: t("support.offer.d6"),
  d12: t("support.offer.d12"),
  upgrade: t("support.offer.upgrade"),
  fix: t("support.offer.fix"),
  move: t("support.offer.move"),
};
const ODDS_LABEL: Record<Odds, string> = { unlikely: t("support.odds.unlikely"), even: t("support.odds.even"), likely: t("support.odds.likely") };

// Answers outside the action list: a bank mail opens the bank, a sponsor or title switch is accepted or declined.
export type ReplyAnswer = "overdraft" | "sponsorNo" | "sponsorYes" | "sponsorDecline" | "sponsorAccept" | "titleAccept";

export interface ReplyModel {
  final: boolean;
  locked: boolean;
  // null hides the section; an empty list keeps its heading.
  templates: { id: string; title: string; preview: string | null }[] | null;
  offers: { id: RetentionId; title: string; value: string; odds: Odds; oddsLabel: string }[] | null;
  transfer: boolean;
  actions: { id: TicketAction; label: string; amount: string | null; disabled: boolean }[];
  answers: { id: ReplyAnswer; label: string; primary: boolean; disabled: boolean }[];
  close: string | null;
  resolve: boolean;
}

function amountOf(s: GameState, a: TicketAction, monthly: number, ransom: number): string | null {
  if (a === "credit") return euroCents(monthly * 0.1);
  if (a === "refund") return euroCents(monthly);
  if (a === "pay") return euroCents(ransom);
  if (a === "offerOnce") return euroCents(updatePrice(s.rates.webHosting, "updateOnce"));
  if (a === "offerManaged") return t("support.perMonth", { price: euroCents(updatePrice(s.rates.webHosting, "updates")) });
  return null;
}

// Everything a ticket can be answered with. `previews` shows template texts and every template.
export function useTicketReplies(s: GameState, tk: Ticket, previews = false): ReplyModel {
  const c = s.customers.find((x) => x.id === tk.customerId);
  const monthly = c ? monthlyValue(s.services, c.id) : 0;
  const p = subjectParams(s, tk);
  const locked = !!tk.work || isFinal(tk);
  const open = tk.status === "open";
  const stray = tk.kind === "notice" && !tk.customerId;
  const held = tk.topic === HELD_TOPIC;
  const answers: ReplyModel["answers"] = [];
  const answer = (id: ReplyAnswer, key: string, primary: boolean) => answers.push({ id, label: t(key), primary, disabled: id !== "overdraft" && locked });
  if (tk.kind === "pear" && tk.topic === OVERDRAFT) answer("overdraft", "apps.open", true);
  if (tk.kind === "sponsor" && held) { answer("sponsorNo", "support.toughLuck", false); answer("sponsorYes", "support.bannerBack", true); }
  if (tk.kind === "sponsor" && !held) { answer("sponsorDecline", "support.decline", false); answer("sponsorAccept", "support.accept", true); }
  if (tk.topic === "switchTitle" && !isFinal(tk)) answer("titleAccept", "support.accept", true);
  return {
    final: isFinal(tk),
    locked,
    templates: open && templatesOf(tk).length > 0
      ? shownTemplates(s, tk, previews).map((id) => ({ id, title: t(`template.${id}.title`), preview: previews ? t(`template.${id}.text`, { ...companyParams(s), ...p }) : null }))
      : null,
    offers: tk.kind === "cancellation" && open
      ? retentionOptions(s, tk).map((o) => {
          const v = s.services.find((x) => x.id === o.serviceId);
          return { id: o.id, title: OFFER_TITLE[o.id], value: o.spec && v ? specText(v.product, o.spec) : o.target ?? (o.cost > 0 ? euroCents(o.cost) : t("support.noCost")), odds: o.odds, oddsLabel: ODDS_LABEL[o.odds] };
        })
      : null,
    transfer: tk.topic === DOMAIN_OUT && open,
    actions: actionsOf(tk).filter((a) => (a !== "revert" || tk.topic === "price") && (!stray || a === "reject")).map((a) => ({
      id: a,
      label: tk.kind === "refund" && a === "reject" ? t("support.action.refuse") : ACTION_LABEL[a],
      amount: a === "cleanPaid" && c ? euroCents(cleanupPrice(s, c)) : amountOf(s, a, monthly, Number(p.ransom)),
      disabled: locked || ((a === "forward" || a === "takedown") && !c),
    })),
    answers,
    close: stray || tk.kind === "sponsor" ? null : tk.notice ? t("support.ignore") : tk.topic === "switchTitle" ? t("support.decline") : t("support.close"),
    resolve: tk.status === "waiting" && tk.kind !== "migration" && !tk.work,
  };
}
