import { registrarById, tierFor } from "../10-catalog/registrars";
import { domainOf, heldDomains, NS_MINUTES, nsActive, outCode, REGISTRIES, register, type NameServerMode } from "../30-customers/registry";
import { beginTransfer, DOMAIN_OUT, TRANSFER_MINUTES } from "../30-customers/registrar";
import { deliverMail, MINUTES } from "../40-support/tickets";
import { find, queue } from "./support";
import { taken } from "../30-customers/domains";
import { partnerOf, providerDomain, registrarUrl } from "../80-business/browser";
import { nowMinutes, yearOf } from "../00-core/time";
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
  const was = s.registrar, n = heldDomains(s).length;
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
  // The partner's confirmation of the first domain opens its login, where the DNS page edits the company zone.
  if (!s.domains.length) deliverMail(s, partnerOf(s).name, "registrarLogin", { name: partnerOf(s).name, domain: name, url: `${registrarUrl(s)}login` });
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


const heldAt = (s: GameState, name: string) => {
  const d = domainOf(s, name);
  return d && !d.lapsed && d.leavesAt === undefined ? d : undefined;
};

// The reseller panel: the auth code that lets a domain transfer away.
export function generateAuthCode(s: GameState, name: string): ActionResult {
  if (!heldAt(s, name)) return fail("error.unknownDomain");
  const code = outCode(s.seed, name);
  s.domains = s.domains.map((d) => (d.name === name ? { ...d, code } : d));
  return { ok: true, id: code };
}

// Switches a domain's renewal at the partner; a cancelled domain lapses at expiry.
export function setDomainRenewal(s: GameState, name: string, on: boolean): ActionResult {
  if (!heldAt(s, name)) return fail("error.unknownDomain");
  s.domains = s.domains.map((d) => (d.name === name ? { ...d, cancelled: on ? undefined : true } : d));
  return { ok: true };
}

// A further domain of the company's own, parked at the partner like any new order there; the partner bills it monthly.
export function orderDomain(s: GameState, input: string): ActionResult {
  const name = input.trim().toLowerCase();
  if (!s.registrar) return fail("error.needsRegistrar");
  const bad = companyDomainError(s, name);
  if (bad) return fail(bad);
  register(s, name, null, false);
  s.domains = s.domains.map((d) => (d.name === name ? { ...d, ns: "registrar" } : d));
  return { ok: true, id: name };
}

const HOST = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/;

// Points a domain at other name servers; it answers with the old ones for NS_MINUTES.
export function setNameServers(s: GameState, name: string, ns: NameServerMode, hosts?: [string, string]): ActionResult {
  const d = heldAt(s, name);
  if (!d) return fail("error.unknownDomain");
  const nsHosts = ns === "custom" ? hosts?.map((h) => h.trim().toLowerCase()) as [string, string] | undefined : undefined;
  if (ns === "custom" && (nsHosts?.length !== 2 || !nsHosts.every((h) => HOST.test(h)) || nsHosts[0] === nsHosts[1])) return fail("error.nsInvalid");
  if (d.ns === ns && d.nsHosts?.join() === nsHosts?.join()) return { ok: true };
  const nsPrev = nsActive(s, d);
  s.domains = s.domains.map((x) => (x.name === name ? { ...x, ns, nsHosts, nsPrev: { ns: nsPrev.ns, nsHosts: nsPrev.nsHosts }, nsReadyAt: nowMinutes(s) + NS_MINUTES } : x));
  return { ok: true };
}

// Answers a transfer request with the auth code generated in the panel, or refuses it.
export function answerDomainTransfer(s: GameState, ticketId: string, code: string | null): ActionResult {
  const f = find(s, ticketId);
  if ("error" in f) return f.error;
  if (f.t.topic !== DOMAIN_OUT || f.t.status !== "open") return fail("error.ticketNotOpen");
  if (code !== null) {
    const d = heldAt(s, f.t.domain ?? "");
    if (!d) return fail("error.unknownDomain");
    if (!d.code || code.trim().toUpperCase() !== d.code) return fail("error.authCode");
  }
  return queue(s, f.t, "resolve", code === null ? "refuse" : "authCode", MINUTES.billing);
}
