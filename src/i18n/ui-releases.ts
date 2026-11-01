import type { Dict } from "./lang";

// The Versions and News pages of every software and OS site.
export default {
  "releases.navVersions": () => "Versions",
  "releases.navNews": () => "News",
  "releases.version": () => "Version",
  "releases.released": () => "Released",
  "releases.updatesUntil": () => "Updates until",
  "releases.securityUntil": () => "Security until",
  "releases.status": () => "Status",
  "releases.supported": () => "Supported",
  "releases.securityOnly": () => "Security fixes only",
  "releases.ended": () => "End of life",
  "releases.notSet": () => "Not announced",
  "releases.title": (p) => `${p.name} released`,
} satisfies Dict;
