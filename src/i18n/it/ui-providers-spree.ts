import type { Dict } from "../lang";

export default {
  "providers.spree.navHome": () => "Home",
  "providers.spree.navSites": () => "Data center",
  "providers.spree.navOrder": () => "Prezzi e ordine",
  "providers.spree.navAccount": () => "Login clienti",
  "providers.spree.tagline": (p) => `Colocation da ${p.city}`,
  "providers.spree.news": () => "Novità",
  "providers.spree.news1": () => "Il nostro secondo UPS è installato e in funzione.",
  "providers.spree.news2": () => "Ora affittiamo anche singole unità rack.",
  "providers.spree.heroEarly": () => "Benvenuti da Spree Colo",
  "providers.spree.textEarly": () => "Gestiamo un piccolo data center sul fiume e affittiamo spazio rack ad aziende, sviluppatori e a chiunque voglia mettere un server online. Parlate direttamente con i tecnici che seguono il vostro rack.",
  "providers.spree.from": (p) => `Spazio rack da ${p.price} al mese`,
  "providers.spree.heroLate": (p) => `Il vostro rack a ${p.city}`,
  "providers.spree.textLate": () => "Siamo un fornitore di colocation indipendente con un data center proprio, decisioni rapide e tecnici che vi conoscono per nome.",
  "providers.spree.feat1": () => "Indipendenti",
  "providers.spree.feat1Text": () => "Non facciamo parte di alcun gruppo, quindi si decide nello stesso edificio in cui gira il vostro server.",
  "providers.spree.feat2": () => "Diretti",
  "providers.spree.feat2Text": () => "Quando chiamate, rispondono i tecnici che hanno montato il vostro rack.",
  "providers.spree.feat3": () => "Prezzi onesti",
  "providers.spree.feat3Text": () => "Tutti i prezzi sono sul sito e il contratto si rinnova di mese in mese.",
  "providers.spree.footer": (p) => `© ${p.year} Spree Colo GmbH`,
} satisfies Dict;
