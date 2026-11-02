import type { Dict } from "../lang";

export default {
  "providers.myloch.navHome": () => "Início",
  "providers.myloch.navSites": () => "Data center",
  "providers.myloch.navOrder": () => "Colocation",
  "providers.myloch.navPortal": () => "Centro de cliente",
  "providers.myloch.claim": () => "Alojamento a partir de Düsseldorf",
  "providers.myloch.heroEarly": () => "Colocation a preços justos",
  "providers.myloch.heroLate": () => "Os seus servidores no nosso data center em Düsseldorf",
  "providers.myloch.text": (p) => `Instale o seu próprio hardware em ${p.name} em ${p.city}, com energia, rede e suporte incluídos.`,
  "providers.myloch.from": (p) => `A partir de ${p.price} por mês`,
  "providers.myloch.units": (p) => `${p.n} unidades de rack`,
  "providers.myloch.power": (p) => `${p.kw} kW de potência`,
  "providers.myloch.hands": (p) => `Remote hands em ${p.hours} horas`,
  "providers.myloch.perMonth": (p) => `${p.price} / mês`,
  "providers.myloch.order": () => "Encomendar",
  "providers.myloch.vat": () => "Todos os preços são mensais e não incluem IVA.",
  "providers.myloch.footer": (p) => `© ${p.year} myLoch managed IT AG`,
} satisfies Dict;
