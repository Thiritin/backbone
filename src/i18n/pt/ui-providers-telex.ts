import type { Dict } from "../lang";

export default {
  "providers.telex.navSites": () => "Instalações",
  "providers.telex.navOrder": () => "Colocation",
  "providers.telex.navPortal": () => "TelexNet",
  "providers.telex.heroEarly": () => "Onde as redes do mundo se encontram em Manhattan",
  "providers.telex.heroLate": () => "Interligação no coração de Nova Iorque",
  "providers.telex.text": (p) => `${p.name} em ${p.city} é um dos edifícios mais ligados do mundo. Os seus racks ficam a um cross-connect de cada grande operadora.`,
  "providers.telex.cta": () => "Visitar a instalação",
  "providers.telex.box1": () => "Salas meet-me",
  "providers.telex.box1Text": () => "As operadoras entregam as suas redes umas às outras nos nossos pisos.",
  "providers.telex.box2": () => "Colocation",
  "providers.telex.box2Text": () => "Bastidores e cages com alimentação A e B ao lado das operadoras.",
  "providers.telex.box3": () => "Cross-connects",
  "providers.telex.box3Text": () => "Encomende um cross-connect e os nossos técnicos fazem a ligação por si.",
  "providers.telex.cardText": (p) => `Carrier hotel com ${p.exchange} no local.`,
  "providers.telex.counter": () => "Operadoras no local",
  "providers.telex.footer": (p) => `© ${p.year} The Telex Group, Inc.`,
} satisfies Dict;
