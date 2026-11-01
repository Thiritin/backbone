import type { Dict } from "../lang";

export default {
  "releases.navVersions": () => "Versionen",
  "releases.navNews": () => "Neuigkeiten",
  "releases.version": () => "Version",
  "releases.released": () => "Veröffentlicht",
  "releases.updatesUntil": () => "Updates bis",
  "releases.securityUntil": () => "Sicherheitsupdates bis",
  "releases.status": () => "Status",
  "releases.supported": () => "Unterstützt",
  "releases.securityOnly": () => "Nur Sicherheitsupdates",
  "releases.ended": () => "Abgekündigt",
  "releases.notSet": () => "Nicht angekündigt",
  "releases.title": (p) => `${p.name} veröffentlicht`,
} satisfies Dict;
