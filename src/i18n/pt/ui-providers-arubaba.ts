import type { Dict } from "../lang";

export default {
  "providers.arubaba.navHome": () => "Início",
  "providers.arubaba.navSites": () => "Centro de dados",
  "providers.arubaba.navOrder": () => "Colocation",
  "providers.arubaba.clientArea": () => "Área de cliente",
  "providers.arubaba.heroEarly": () => "Colocation no nosso centro de dados italiano",
  "providers.arubaba.heroLate": () => "Os seus servidores no centro de dados Arubaba",
  "providers.arubaba.text": (p) => `Traga os seus servidores para ${p.name} em ${p.city}: um centro de dados certificado com energia redundante, extinção de incêndios e pessoal presente dia e noite.`,
  "providers.arubaba.discover": () => "Conhecer o centro de dados",
  "providers.arubaba.from": (p) => `desde ${p.price}`,
  "providers.arubaba.perMonth": () => "por mês + IVA",
  "providers.arubaba.buy": () => "Comprar",
  "providers.arubaba.vat": () => "Os preços não incluem IVA.",
  "providers.arubaba.footer": (p) => `© ${p.year} Arubaba S.p.A.`,
} satisfies Dict;
