import type { Dict } from "../lang";

export default {
  "providers.tellyhouse.navSites": () => `Centros de dados`,
  "providers.tellyhouse.navColo": () => `Serviços de colocation`,
  "providers.tellyhouse.navPortal": () => `Portal do cliente`,
  "providers.tellyhouse.tagline": () => `A casa da colocation neutra desde 1990`,
  "providers.tellyhouse.welcome": () => `Bem-vindo à Tellyhouse Europe`,
  "providers.tellyhouse.text": (p) => `Os nossos ${p.n} centros de dados em ${p.cities} acolhem ${p.carriers} ligações de operadores e os pontos de troca de Internet que neles se encontram.`,
  "providers.tellyhouse.campuses": () => `Os nossos campus`,
  "providers.tellyhouse.quick": () => `Ligações rápidas`,
  "providers.tellyhouse.contactBox": () => `Contactos comerciais`,
  "providers.tellyhouse.contactText": () => `A nossa equipa comercial responde a cada pedido num dia útil.`,
  "providers.tellyhouse.heroLate": () => `Onde as redes da Europa se encontram`,
  "providers.tellyhouse.cta": () => `Pedir informações`,
  "providers.tellyhouse.statCarriers": () => `Ligações de operadores`,
  "providers.tellyhouse.statExchanges": () => `Pontos de troca`,
  "providers.tellyhouse.view": () => `Ver centro de dados`,
  "providers.tellyhouse.footer": (p) => `© ${p.year} Tellyhouse International Corporation of Europe Ltd.`,
} satisfies Dict;
