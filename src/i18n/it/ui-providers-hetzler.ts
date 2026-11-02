import type { Dict } from "../lang";

export default {
  "providers.hetzler.overview": () => "Panoramica",
  "providers.hetzler.robot": () => "Accesso Rowbot",
  "providers.hetzler.colocation": () => "Colocation",
  "providers.hetzler.heroEarly": () => "Colocation nei nostri data center",
  "providers.hetzler.textEarly": (p) => `Porti i suoi server a ${p.cities}. Lo spazio rack con energia e traffico parte da ${p.price} al mese.`,
  "providers.hetzler.vat": () => "Tutti i prezzi sono mensili e IVA inclusa. Le fatture vengono addebitate il primo del mese.",
  "providers.hetzler.heroLate": () => "Il suo hardware nei nostri data center",
  "providers.hetzler.textLate": (p) => `Spazio rack a ${p.cities} con energia, raffreddamento e connettività ridondata.`,
  "providers.hetzler.from": (p) => `da ${p.price} al mese`,
  "providers.hetzler.orderNow": () => "Ordina ora",
  "providers.hetzler.footer": (p) => `© ${p.year} Hetzler Online GmbH, Gunzenhausen`,
} satisfies Dict;
