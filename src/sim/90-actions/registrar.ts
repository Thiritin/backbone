import { registrarById, tierFor } from "../10-catalog/registrars";
import { domainOf, REGISTRIES, register } from "../30-customers/registry";
import { beginTransfer, TRANSFER_MINUTES } from "../30-customers/registrar";
import { taken } from "../30-customers/domains";
import { providerDomain } from "../80-business/browser";
import { yearOf } from "../00-core/time";
import { techsAt, OP_TASK, queueOp } from "../47-staff/technicians";
import type { GameState } from "../50-state";
import type { ActionResult } from "./hardware";

const fail = (error: string): ActionResult => ({ ok: false, error });

// Signs the first contract, or switches to another partner: every domain then moves over, a hand task of TRANSFER_MINUTES each.
export function signRegistrar(s: GameState, id: string): ActionResult {
  const def = registrarById(id);
  if (!def) return fail("error.unknownRegistrar");
  if (yearOf(s.hour) < def.from) return fail("error.registrarLater");
  if (s.registrar?.id === id) return fail("error.registrarCurrent");
  if (s.registrar?.transfer) return fail("error.transferBusy");
  if (s.cash < def.signup) return fail("error.noCash");
  const was = s.registrar, n = s.domains.length;
  s.registrar = { id: def.id, since: s.hour, tier: tierFor(n), billed: false, transfer: was && n ? { from: was.id, domains: n, doneAt: null } : null };
  return { ok: true, id: def.id };
}

// A name the company can own: a free label of letters, digits and hyphens under a TLD the registries sell.
export function companyDomainError(s: GameState, name: string): string | null {
  const tld = Object.keys(REGISTRIES).find((t) => name.endsWith(`.${t}`)), label = tld ? name.slice(0, -tld.length - 1) : "";
  if (!tld || label.length < 3 || label.length > 40 || !/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(label)) return "error.domainInvalid";
  return domainOf(s, name) || taken(s).has(name) || providerDomain(name) ? "error.domainTaken" : null;
}

// Registers the company's own domain through the registrar under contract; it joins the domains under management.
export function registerCompanyDomain(s: GameState, input: string): ActionResult {
  const name = input.trim().toLowerCase();
  if (!s.registrar) return fail("error.needsRegistrar");
  if (s.company.domain) return fail("error.companyDomainOwned");
  const bad = companyDomainError(s, name);
  if (bad) return fail(bad);
  register(s, name, null, false);
  s.company = { ...s.company, domain: name };
  return { ok: true, id: name };
}

// The registrar site: signs that registrar when none is under contract yet, then registers the company domain.
export function orderCompanyDomain(s: GameState, registrarId: string, input: string): ActionResult {
  if (s.company.domain) return fail("error.companyDomainOwned");
  if (s.registrar && s.registrar.id !== registrarId) return fail("error.registrarOther");
  const bad = companyDomainError(s, input.trim().toLowerCase());
  if (bad) return fail(bad);
  if (!s.registrar) {
    const signed = signRegistrar(s, registrarId);
    if (!signed.ok) return signed;
  }
  return registerCompanyDomain(s, input);
}

// Moves the domains to the new partner by hand: the player is busy for TRANSFER_MINUTES a domain.
export function transferDomains(s: GameState): ActionResult {
  const t = s.registrar?.transfer;
  if (!t) return fail("error.noTransfer");
  if (t.doneAt !== null) return fail("error.alreadyQueued");
  const busy = Math.max(s.playerBusyUntil, s.hour * 60) + t.domains * TRANSFER_MINUTES;
  s.playerBusyUntil = busy;
  beginTransfer(s, Math.ceil(busy / 60));
  return { ok: true };
}

// Hands the move to a technician trained on panels.
export function queueTransfer(s: GameState): ActionResult {
  const t = s.registrar?.transfer;
  if (!t) return fail("error.noTransfer");
  if (t.doneAt !== null || s.techOps.some((o) => o.kind === "domains")) return fail("error.alreadyQueued");
  if (!techsAt(s, s.locations[0].id, OP_TASK.domains).length) return fail("error.noTechnician");
  return { ok: true, id: queueOp(s, "domains", "").id };
}

