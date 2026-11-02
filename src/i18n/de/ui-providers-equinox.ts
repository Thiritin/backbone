import type { Dict } from "../lang";

export default {
  "providers.equinox.navSites": () => "IBX-Rechenzentren",
  "providers.equinox.navColo": () => "Colocation",
  "providers.equinox.navPortal": () => "Kundenportal",
  "providers.equinox.ibx": () => "IBX-Center",
  "providers.equinox.heroEarly": () => "Netzneutrale Rechenzentren und Internet-Exchange-Dienste",
  "providers.equinox.heroLate": () => "Das Interconnection-Unternehmen der Welt",
  "providers.equinox.text": (p) => `${p.n} International-Bandwidth-Exchange-Center in ${p.cities} Städten, in denen sich Carrier, Content-Anbieter und Unternehmen unter einem Dach treffen.`,
  "providers.equinox.cta": () => "Rechenzentrum finden",
  "providers.equinox.col1": () => "Zertifiziert und redundant",
  "providers.equinox.col1Text": () => "Jeder Standort läuft mit A- und B-Zuführung, Generatoren und geprüfter Sicherheit.",
  "providers.equinox.col2": () => "Interconnection vor Ort",
  "providers.equinox.col2Text": () => "Cross-Connects zum Internetknoten im Haus und zu jedem Carrier im Meet-me-Room.",
  "providers.equinox.col3": () => "Remote Hands rund um die Uhr",
  "providers.equinox.col3Text": () => "Techniker sind Tag und Nacht vor Ort und rechnen stundenweise mit der Miete ab.",
  "providers.equinox.footer": (p) => `© ${p.year} Equinox, Inc. Alle Rechte vorbehalten.`,
} satisfies Dict;
