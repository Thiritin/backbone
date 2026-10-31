import type { Dict } from "../lang";

export default {
  "event.vulnOpen.title": () => "Patch verfügbar",
  "event.vulnOpen.text": (p) => `${p.software} auf ${p.host} hat eine Schwachstelle (${p.severity}). Der Hersteller hat heute das Update veröffentlicht.`,
  "event.vulnCritical.title": () => "Kritische Schwachstelle",
  "event.vulnCritical.text": (p) => `${p.software} auf ${p.host} hat eine kritische Schwachstelle, und das Update ist da. Angreifer lesen dasselbe Changelog.`,
  "event.techUpdated.title": () => "Software aktualisiert",
  "event.techUpdated.text": (p) => `${p.name} hat ${p.software} auf ${p.device} aktualisiert.`,
  "error.upToDate": () => "Diese Software ist auf dem neuesten Stand.",
  "error.noAutoUpdate": () => "Diese Software hat noch keine automatischen Updates.",
} satisfies Dict;
