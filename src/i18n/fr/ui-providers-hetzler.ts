import type { Dict } from "../lang";

export default {
  "providers.hetzler.overview": () => "Aperçu",
  "providers.hetzler.robot": () => "Connexion Rowbot",
  "providers.hetzler.colocation": () => "Colocation",
  "providers.hetzler.heroEarly": () => "Colocation dans nos propres datacenters",
  "providers.hetzler.textEarly": (p) => `Installez vos propres serveurs à ${p.cities}. L'espace en baie avec énergie et trafic commence à ${p.price} par mois.`,
  "providers.hetzler.vat": () => "Tous les prix sont mensuels, TVA incluse. Les factures sont prélevées le premier du mois.",
  "providers.hetzler.heroLate": () => "Votre matériel dans nos datacenters",
  "providers.hetzler.textLate": (p) => `De l'espace en baie à ${p.cities} avec énergie, refroidissement et connectivité redondante.`,
  "providers.hetzler.from": (p) => `à partir de ${p.price} par mois`,
  "providers.hetzler.orderNow": () => "Commander",
  "providers.hetzler.footer": (p) => `© ${p.year} Hetzler Online GmbH, Gunzenhausen`,
} satisfies Dict;
