type Params = Record<string, string | number>;

// Registrar partners, the company domain and company email; spread into en.
export const DOMAINS_EN: Record<string, (p: Params) => string> = {
  "ledger.registrarSignup": (p) => `Signup at ${p.name}`,
  "ledger.registrar": (p) => `Partner fee at ${p.name}`,
  "ledger.domains": (p) => `${p.count} domain${Number(p.count) === 1 ? "" : "s"} at ${p.name}`,
  "ledger.companyMail": (p) => `Company email: ${p.name}, ${p.seats} seat${Number(p.seats) === 1 ? "" : "s"}`,
  "error.unknownRegistrar": () => "This registrar partner does not exist.",
  "error.registrarLater": () => "This registrar partner is not on the market yet.",
  "error.registrarCurrent": () => "You already have a contract with this partner.",
  "error.transferBusy": () => "The domains are still moving to the current partner.",
  "error.needsRegistrar": () => "Sign a registrar contract first.",
  "error.domainInvalid": () => "Use 3 to 40 letters, digits or hyphens in front of a TLD the registries sell.",
  "error.companyDomainOwned": () => "The company already has a domain.",
  "error.noTransfer": () => "No domains are waiting to move.",
  "error.needsMail": () => "Set up company email first.",
  "error.unknownMailProvider": () => "This mail provider does not exist.",
  "error.mailProviderLater": () => "This mail provider is not on the market yet.",
  "error.noMailServer": () => "No mail server is installed.",
  "error.noMailService": () => "The company has no email service.",
  "error.oneMailServer": () => "The company runs one mail server.",
  "error.mailHost": () => "This machine already runs the mail server.",
  "error.mailInVm": () => "A mail server goes into a VM on this hypervisor.",
  "event.domainsTransferred.title": () => "Domains moved",
  "event.domainsTransferred.text": (p) => `${p.count} domain${Number(p.count) === 1 ? " is" : "s are"} now managed by ${p.name}.`,
  "event.registrarTier.title": () => "Better partner rate",
  "event.registrarTier.text": (p) => `With ${p.domains} domains, ${p.name} bills your domains at the next tier from now on.`,
};
