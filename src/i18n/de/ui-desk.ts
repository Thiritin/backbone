import type { Dict } from "../lang";

export default {
  "desk.records.title": () => "Domain-Einträge",
  "desk.records.type": () => "Typ",
  "desk.records.name": () => "Name",
  "desk.records.value": () => "Wert",
  "desk.records.status": () => "Status",
  "desk.records.ok": () => "Aktiv",
  "desk.records.missing": () => "Nicht gefunden",
  "desk.records.noAddress": () => "Keine öffentliche Adresse",
  "desk.records.copy": () => "Kopieren",
  "desk.records.copied": () => "Kopiert",
  "desk.records.verify": () => "Prüfen",
  "desk.records.verified": () => "Geprüft",
  "desk.records.dns": () => "DNS-Einstellungen öffnen",
  "error.deskRecords": () => "Einige Einträge wurden nicht gefunden.",
  "desk.site.notFound": () => "Nicht gefunden",
  "desk.site.notFoundText": (p) => `Die angeforderte URL ${p.path} wurde auf diesem Server nicht gefunden.`,
  "desk.launcher.mailbox": () => "Postfach öffnen",
} satisfies Dict;
