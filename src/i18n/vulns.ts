type Params = Record<string, string | number>;

// Generated vulnerabilities in installed software (economy.md, Security advisories).
export const VULNS_EN: Record<string, (p: Params) => string> = {
  "event.vulnOpen.title": () => "Patch available",
  "event.vulnOpen.text": (p) => `${p.software} on ${p.host} has a ${p.severity} vulnerability. The vendor released the update today.`,
  "event.vulnCritical.title": () => "Critical vulnerability",
  "event.vulnCritical.text": (p) => `${p.software} on ${p.host} has a critical vulnerability and the update is out. Attackers read the same changelog.`,
  "event.techUpdated.title": () => "Software updated",
  "event.techUpdated.text": (p) => `${p.name} updated ${p.software} on ${p.device}.`,
  "error.upToDate": () => "This software is up to date.",
};
