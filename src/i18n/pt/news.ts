import type { Dict, Params } from "../lang";

const list = (v: string | number) => { const a = String(v).split("|"); return a.length < 2 ? a[0] : `${a.slice(0, -1).join(", ")} e ${a[a.length - 1]}`; };
const FEATURE: Record<string, string> = {
  cluster: "funciona como um único cluster em vários servidores",
  balloon: "recupera a RAM dos convidados com ballooning, por isso uma máquina virtual ganha RAM enquanto corre",
  importSame: "importa espaços web de outro servidor que o use",
  importOther: "importa espaços web de outros painéis de hospedagem",
};
const kind = (p: Params) => (p.kind === "panel" ? "do painel de hospedagem" : p.kind === "game" ? "do painel de servidores de jogos" : "da plataforma cloud");

export default {
  "event.news.software.title": (p) => `${p.name} já está disponível`,
  "event.news.software.text": (p) => `A Heize online noticia o lançamento ${kind(p)} ${p.name}, que já pode ser instalado nos teus servidores.`,
  "event.news.autoUpdate.title": (p) => `${p.name} atualiza-se sozinho`,
  "event.news.autoUpdate.text": (p) => `A Heize online noticia que o ${p.name} já pode instalar as suas atualizações automaticamente à noite.`,
  "event.news.generation.title": (p) => `Servidores G${p.gen} na loja`,
  "event.news.generation.text": (p) => `A Heize online noticia que a geração G${p.gen} traz ${p.cores} núcleos e ${p.ramGb} GB de RAM por servidor padrão, com ${p.disk} de armazenamento.`,
  "event.news.endOfSale.title": (p) => `${p.name} retirado do mercado`,
  "event.news.endOfSale.text": (p) => `A Heize online noticia que o ${p.name} saiu da loja e o suporte do modelo termina em ${p.supportEnd}.`,
  "event.news.mail.title": (p) => `${p.name} abre-se ao e-mail empresarial`,
  "event.news.mail.text": (p) => `O Handelsblah noticia que o ${p.name} já vende caixas de e-mail alojadas a empresas por ${p.price} euros por posto e por mês.`,
  "event.news.ipv6Dc.title": () => "IPv6 nos datacenters",
  "event.news.ipv6Dc.text": () => "O Golem.dy noticia que os datacenters já atribuem endereços IPv6, dos quais ainda ninguém ficou sem.",
  "event.news.ipv6Home.title": () => "IPv6 nas linhas domésticas",
  "event.news.ipv6Home.text": () => "O Golem.dy noticia que as linhas domésticas já transportam IPv6, pelo que a reconexão noturna tem mais um endereço para mudar.",
  "event.news.ripeLast.title": () => "RIPE atribui o seu último /8",
  "event.news.ripeLast.text": () => "O Golem.dy noticia que a RIPE chegou ao seu último /8 e os novos membros recebem agora um /22 em vez de um /21.",
  "event.news.ripeOut.title": () => "Reserva de IPv4 esgotada",
  "event.news.ripeOut.text": () => "O Golem.dy noticia que a RIPE já não tem endereços IPv4 livres e os novos membros entram numa lista de espera por um /24.",
  "event.news.gpu.title": (p) => `${p.name} lançada`,
  "event.news.gpu.text": (p) => `A Heize online noticia que a ${p.name} chega por ${p.price} euros de tabela e consome ${p.watts} watts para isso.`,
  "event.news.gpuDemand.title": (p) => (p.year === 2017 ? "O deep learning precisa de GPU" : "A IA generativa precisa de GPU"),
  "event.news.gpuDemand.text": (p) => (p.year === 2017
    ? "O Handelsblah noticia que o deep learning leva equipas a procurar servidores GPU de aluguer, e agências e programadores pedem-nos agora aos hosters."
    : "O Handelsblah noticia que a IA generativa põe as empresas em fila por servidores GPU de aluguer, e os hosters com placas livres podem fixar o preço."),
  "event.news.design.title": (p) => `Web design de ${p.year}`,
  "event.news.design.text": (p) => `O Handelsblah noticia que os visitantes esperam agora o visual de ${p.year} em todos os sites, e os designs mais antigos perdem pedidos.`,
  "event.news.line.title": (p) => `${p.line} podia vender`,
  "event.news.line.text": (p) => `O Handelsblah noticia que hoje podes fornecer ${p.line} e ainda não o puseste no teu site.`,
  "event.news.models.title": () => "Hardware novo na loja",
  "event.news.models.text": (p) => `A Heize online noticia que a loja já vende ${list(p.names)}.`,
  "event.news.shape.title": (p) => `Servidores ${p.name} na loja`,
  "event.news.shape.text": (p) => `A Heize online noticia que a loja já vende servidores ${p.name}.`,
  "event.news.feature.title": (p) => `Atualização do ${p.name}`,
  "event.news.feature.text": (p) => `A Heize online noticia que a nova versão do ${p.name} ${FEATURE[p.feature] ?? p.feature}.`,
  "event.news.desk.title": (p) => `${p.name} já está disponível`,
  "event.news.desk.text": (p) => `A Heize online noticia que o sistema de suporte ${p.name} já saiu e pode ser subscrito na Pear Store.`,
  "event.news.training.title": (p) => `Formação em ${p.name} disponível`,
  "event.news.training.text": (p) => `A Heize online noticia que já existe uma formação em ${p.name}, que a tua equipa pode fazer em Pesquisa.`,
  "event.news.release.title": (p) => `Versões de software de ${p.year}`,
  "event.news.release.text": (p) => `A Heize online noticia que as versões de ${p.year} de ${list(p.names)} já saíram e podem ser instaladas nos teus servidores.`,
  "event.news.homeLines.title": () => "Novas linhas domésticas",
  "event.news.homeLines.text": (p) => `O Golem.dy noticia que já se pode pedir ${list(p.names)} para casa.`,
  "event.news.ports.title": (p) => `Portas de ${p.gbit} Gbit/s`,
  "event.news.ports.text": (p) => `O Golem.dy noticia que operadores e pontos de troca de tráfego já vendem portas de ${p.gbit} Gbit/s.`,
  "event.news.freeSsl.title": () => "Certificados SSL grátis",
  "event.news.freeSsl.text": () => "O Handelsblah noticia que a Let's Encryptly já emite certificados SSL grátis e os clientes já não esperam pagar por um.",
} satisfies Dict;
