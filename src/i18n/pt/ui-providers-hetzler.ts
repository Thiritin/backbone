import type { Dict } from "../lang";

export default {
  "providers.hetzler.overview": () => "Visão geral",
  "providers.hetzler.robot": () => "Login Rowbot",
  "providers.hetzler.colocation": () => "Colocation",
  "providers.hetzler.heroEarly": () => "Colocation em nossos próprios data centers",
  "providers.hetzler.textEarly": (p) => `Traga seus próprios servidores para ${p.cities}. Espaço em rack com energia e tráfego a partir de ${p.price} por mês.`,
  "providers.hetzler.vat": () => "Todos os preços são mensais e incluem impostos. As faturas são debitadas no primeiro dia do mês.",
  "providers.hetzler.heroLate": () => "Seu hardware em nossos data centers",
  "providers.hetzler.textLate": (p) => `Espaço em rack em ${p.cities} com energia, refrigeração e conectividade redundante.`,
  "providers.hetzler.from": (p) => `a partir de ${p.price} por mês`,
  "providers.hetzler.orderNow": () => "Contratar agora",
  "providers.hetzler.footer": (p) => `© ${p.year} Hetzler Online GmbH, Gunzenhausen`,
} satisfies Dict;
