import type { Dict } from "../lang";

export default {
  "providers.skyblink.navSites": () => "Data center",
  "providers.skyblink.navOrder": () => "Colocation",
  "providers.skyblink.navPortal": () => "MySkyBlink",
  "providers.skyblink.claim": () => "Os seus servidores nas nuvens do Limburgo do Sul",
  "providers.skyblink.side": (p) => `Data center ${p.city}`,
  "providers.skyblink.more": () => "Ver o data center",
  "providers.skyblink.heroEarly": () => "Colocation com a cabeça nas nuvens e os pés no chão",
  "providers.skyblink.heroLate": () => "Um data center na fronteira de três países",
  "providers.skyblink.text": (p) => `${p.name} em ${p.city} aloja os seus servidores perto de Aachen, Liège e Maastricht. O espaço em rack começa em ${p.price} por mês.`,
  "providers.skyblink.usp1": () => "Neutro em operadoras",
  "providers.skyblink.usp1Text": (p) => `Escolha entre ${p.carriers} operadoras no edifício.`,
  "providers.skyblink.usp2": () => "Técnicos no local",
  "providers.skyblink.usp2Text": (p) => `O remote hands responde em ${p.hours} horas.`,
  "providers.skyblink.usp3": () => "Contacto direto",
  "providers.skyblink.usp3Text": () => "Fala diretamente com quem gere o edifício.",
  "providers.skyblink.from": (p) => `Espaço em rack a partir de ${p.price} por mês.`,
  "providers.skyblink.quote": () => "Pedir orçamento",
  "providers.skyblink.footer": (p) => `© ${p.year} SkyBlink B.V.`,
} satisfies Dict;
