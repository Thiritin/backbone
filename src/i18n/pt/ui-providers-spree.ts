import type { Dict } from "../lang";

export default {
  "providers.spree.navHome": () => "Início",
  "providers.spree.navSites": () => "Centro de dados",
  "providers.spree.navOrder": () => "Preços e encomenda",
  "providers.spree.navAccount": () => "Área de cliente",
  "providers.spree.tagline": (p) => `Colocation a partir de ${p.city}`,
  "providers.spree.news": () => "Novidades",
  "providers.spree.news1": () => "A nossa segunda UPS está instalada e a funcionar.",
  "providers.spree.news2": () => "Agora também alugamos unidades de altura avulsas.",
  "providers.spree.heroEarly": () => "Bem-vindo à Spree Colo",
  "providers.spree.textEarly": () => "Gerimos um pequeno centro de dados junto ao rio e alugamos espaço em rack a empresas, programadores e a quem precise de pôr um servidor online. Fala diretamente com os técnicos que cuidam do seu rack.",
  "providers.spree.from": (p) => `Espaço em rack desde ${p.price} por mês`,
  "providers.spree.heroLate": (p) => `O seu rack em ${p.city}`,
  "providers.spree.textLate": () => "Somos um fornecedor independente de colocation com centro de dados próprio, decisões rápidas e técnicos que o conhecem pelo nome.",
  "providers.spree.feat1": () => "Independentes",
  "providers.spree.feat1Text": () => "Não pertencemos a nenhum grupo, por isso as decisões são tomadas no edifício onde corre o seu servidor.",
  "providers.spree.feat2": () => "Pessoais",
  "providers.spree.feat2Text": () => "Quando liga, fala com os técnicos que instalaram o seu rack.",
  "providers.spree.feat3": () => "Preços justos",
  "providers.spree.feat3Text": () => "Todos os preços estão no site e o contrato renova-se mês a mês.",
  "providers.spree.footer": (p) => `© ${p.year} Spree Colo GmbH`,
} satisfies Dict;
