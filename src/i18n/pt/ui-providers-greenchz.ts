import type { Dict } from "../lang";

export default {
  "providers.greenchz.navHome": () => "Início",
  "providers.greenchz.navSites": () => "Centros de dados",
  "providers.greenchz.navOrder": () => "Colocation",
  "providers.greenchz.navAccount": () => "Centro de cliente",
  "providers.greenchz.heroEarly": () => "Housing e colocation na Suíça",
  "providers.greenchz.heroLate": () => "Centros de dados suíços para dados que ficam na Suíça.",
  "providers.greenchz.text": (p) => `O nosso centro de dados perto de ${p.city} guarda os seus dados segundo a lei suíça, numa infraestrutura certificada alimentada por energia renovável.`,
  "providers.greenchz.cta": () => "Pedir uma proposta",
  "providers.greenchz.point1": () => "Qualidade suíça",
  "providers.greenchz.point1Text": () => "Construímos e operamos cada instalação nós mesmos e mantemos os seus dados no país.",
  "providers.greenchz.point2": () => "Segurança certificada",
  "providers.greenchz.point2Text": () => "O controlo de acessos, a energia redundante e as auditorias seguem normas reconhecidas.",
  "providers.greenchz.point3": () => "Energia renovável",
  "providers.greenchz.point3Text": () => "Os nossos centros de dados funcionam com eletricidade hidroelétrica suíça.",
  "providers.greenchz.footer": (p) => `© ${p.year} green.chz AG`,
} satisfies Dict;
