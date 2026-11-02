import type { Dict } from "../lang";

export default {
  "providers.skyblink.navSites": () => "Rechenzentrum",
  "providers.skyblink.navOrder": () => "Colocation",
  "providers.skyblink.navPortal": () => "MySkyBlink",
  "providers.skyblink.claim": () => "Ihre Server in den Wolken von Süd-Limburg",
  "providers.skyblink.side": (p) => `Rechenzentrum ${p.city}`,
  "providers.skyblink.more": () => "Rechenzentrum ansehen",
  "providers.skyblink.heroEarly": () => "Colocation mit dem Kopf in den Wolken und den Füßen auf dem Boden",
  "providers.skyblink.heroLate": () => "Ein Rechenzentrum im Dreiländereck",
  "providers.skyblink.text": (p) => `${p.name} in ${p.city} beherbergt Ihre Server nahe Aachen, Lüttich und Maastricht. Rackplatz gibt es ab ${p.price} im Monat.`,
  "providers.skyblink.usp1": () => "Carrier-neutral",
  "providers.skyblink.usp1Text": (p) => `Wählen Sie aus ${p.carriers} Carriern im Gebäude.`,
  "providers.skyblink.usp2": () => "Techniker vor Ort",
  "providers.skyblink.usp2Text": (p) => `Remote Hands reagieren innerhalb von ${p.hours} Stunden.`,
  "providers.skyblink.usp3": () => "Kurze Wege",
  "providers.skyblink.usp3Text": () => "Sie sprechen direkt mit den Leuten, die das Gebäude betreiben.",
  "providers.skyblink.from": (p) => `Rackplatz ab ${p.price} im Monat.`,
  "providers.skyblink.quote": () => "Angebot anfordern",
  "providers.skyblink.footer": (p) => `© ${p.year} SkyBlink B.V.`,
} satisfies Dict;
