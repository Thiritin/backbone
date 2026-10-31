import { yearOf } from "../00-core/time";
import { providerById, seatsFor, type MailProviderId, type SelfMailSoftware } from "../80-business/mail";
import type { GameState } from "../50-state";
import type { ActionResult } from "./hardware";

const fail = (error: string): ActionResult => ({ ok: false, error });

// Books an external mail provider for the company; the seats follow the staff and are billed at each month start.
export function bookMail(s: GameState, provider: MailProviderId): ActionResult {
  const p = providerById(provider);
  if (!p) return fail("error.unknownMailProvider");
  if (!s.company.domain) return fail("error.needsDomain");
  if (yearOf(s.hour) < p.from) return fail("error.mailProviderLater");
  s.company = { ...s.company, mail: { kind: "external", provider, seats: seatsFor(s) } };
  return { ok: true, id: provider };
}

// Takes the mail server the company runs (Email app, Change provider) back into use after another service.
export function selectMailServer(s: GameState): ActionResult {
  const c = s.clusters.find((x) => x.kind === "mail");
  const software = c && (c.panel ?? c.switching?.to);
  if (!c || !software) return fail("error.noMailServer");
  s.company = { ...s.company, mail: { kind: "self", software: software as SelfMailSoftware, clusterId: c.id } };
  return { ok: true, id: c.id };
}

// Cancels the company's mail service and goes back to free GMix; a mail server stays installed.
export function cancelMail(s: GameState): ActionResult {
  if (s.company.mail.kind === "free") return fail("error.noMailService");
  s.company = { ...s.company, mail: { kind: "free" } };
  return { ok: true };
}
