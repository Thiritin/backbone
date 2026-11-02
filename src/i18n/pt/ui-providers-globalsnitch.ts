import type { Dict } from "../lang";

export default {
  "providers.globalsnitch.navHome": () => `Início`,
  "providers.globalsnitch.navSites": () => `Os nossos centros de dados`,
  "providers.globalsnitch.navColo": () => `Espaço e energia`,
  "providers.globalsnitch.navPortal": () => `Área de cliente`,
  "providers.globalsnitch.heroEarly": () => `Centros de dados neutros em cidades Tier 1`,
  "providers.globalsnitch.heroLate": () => `Grandes centros de dados nas principais cidades do mundo`,
  "providers.globalsnitch.text": (p) => `A Global Snitch detém e opera grandes centros de dados multi-inquilino em ${p.cities}, cada um com energia redundante e ligação a muitos operadores.`,
  "providers.globalsnitch.cta": () => `Ver os nossos centros de dados`,
  "providers.globalsnitch.owner": () => `Proprietário e operador`,
  "providers.globalsnitch.ownerText": () => `Somos donos de cada edifício que operamos, por isso os clientes lidam com um só senhorio para espaço, energia e conectividade.`,
  "providers.globalsnitch.statCarriers": () => `Ligações de operadores`,
  "providers.globalsnitch.statPower": () => `Potência por bastidor`,
  "providers.globalsnitch.statHands": () => `Resposta de remote hands`,
  "providers.globalsnitch.footer": (p) => `© ${p.year} Global Snitch Holdings Limited`,
} satisfies Dict;
