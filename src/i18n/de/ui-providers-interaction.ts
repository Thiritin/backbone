import type { Dict } from "../lang";

export default {
  "providers.interaction.navSites": () => `Rechenzentren`,
  "providers.interaction.navColo": () => `Colocation`,
  "providers.interaction.navPortal": () => `Kundenportal`,
  "providers.interaction.heroEarly": () => `Europas führender Anbieter carrierneutraler Colocation`,
  "providers.interaction.heroLate": () => `Vernetzte Communities`,
  "providers.interaction.text": (p) => `${p.n} carrierneutrale Rechenzentren in ${p.cities} europäischen Städten, Heimat der Communities, die das Internet am Laufen halten.`,
  "providers.interaction.cta": () => `Rechenzentrum finden`,
  "providers.interaction.communities": () => `Communities`,
  "providers.interaction.com1": () => `Carrier und ISPs`,
  "providers.interaction.com2": () => `Cloud und Hosting`,
  "providers.interaction.com3": () => `Digitale Medien`,
  "providers.interaction.com4": () => `Finanzwesen`,
  "providers.interaction.statSites": () => `Rechenzentren`,
  "providers.interaction.statCities": () => `Städte`,
  "providers.interaction.statCarriers": () => `Carrier-Anbindungen`,
  "providers.interaction.footer": (p) => `© ${p.year} Interaction Holding N.V. Alle Rechte vorbehalten.`,
} satisfies Dict;
