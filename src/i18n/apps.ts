type Params = Record<string, string | number>;

// Customer applications: tickets, events, outcomes and errors (economy.md, Security advisories, Customer applications).
export const APPS_EN: Record<string, (p: Params) => string> = {
  "ticket.howTo.hacked.subject": () => "My website shows someone else's slogan",
  "ticket.howTo.hacked.text": (p) => `${p.domain || "My website"} shows a skull and a message in broken English where my homepage used to be. Can you fix it?`,
  "ticket.howTo.update.subject": () => "Help with updating my website",
  "ticket.howTo.update.text": () => "You wrote that the software behind my website needs an update. I have no idea how to do that. Can you do it for me?",
  "event.siteHacked.title": () => "Customer site defaced",
  "event.siteHacked.text": (p) => `${p.customer}'s site ${p.site} was defaced through a hole in ${p.software}. It sends spam until it is cleaned up.`,
  "event.siteLeft.title": () => "Customer left",
  "event.siteLeft.text": (p) => `${p.customer} cancelled after ${p.site} was defaced for the third time in a year.`,
  "event.offerDeclined.title": () => "Offer declined",
  "event.offerDeclined.text": (p) => `${p.name} turned down the offer.`,
  "outcome.cleaned": () => "Site cleaned up",
  "outcome.noBackup": () => "No backup, customer rebuilds the site",
  "outcome.updated": () => "Software updated",
  "outcome.updateSold": () => "Update sold",
  "outcome.managedSold": () => "Managed updates sold",
  "ledger.appUpdate": (p) => `Update of ${p.site}`,
  "error.notDefaced": () => "This site is not defaced.",
  "error.noBackup": () => "This site has no backup to restore.",
  "error.unknownVulnerability": () => "This vulnerability is not known.",
  "error.nobodyToNotify": () => "No customers to notify.",
};
