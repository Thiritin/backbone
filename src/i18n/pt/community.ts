import type { Dict, Params } from "../lang";

const ITEM: Record<string, [string, string]> = {
  gameServer: ["servidor de jogos", "servidores de jogos"], vps: ["VPS", "VPS"], storage: ["volume de armazenamento", "volumes de armazenamento"], webHosting: ["espaço web", "espaços web"],
};
const what = (p: Params) => {
  const [one, many] = ITEM[String(p.product)];
  const size = p.product === "storage" || p.product === "webHosting" ? `${p.diskGb} GB de disco` : `${p.vcpu} vCPU e ${p.ramGb} GB de RAM`;
  return `${p.count} ${Number(p.count) === 1 ? one : many} com ${size}${Number(p.count) === 1 ? "" : " cada"}`;
};
const span = (p: Params) => ({ 3: "o fim de semana", 7: "uma semana", 90: "três meses", 365: "um ano" })[Number(p.days) as 3] ?? `${p.days} dias`;
const PEOPLE: Record<string, string> = { gamer: "jogadores", private: "utilizadores particulares", hobbyDev: "programadores" };
const term = (p: Params) => (Number(p.months) === 1 ? "um mês" : `${p.months} meses`);
const ask = (p: Params) => `${what(p)} durante ${term(p)}, ${Number(p.free) ? "grátis" : "a metade do preço"}`;
const reach = (p: Params) => `${p.audience} ${PEOPLE[String(p.profile)]}`;
const plural = (n: unknown, one: string, many: string) => (Number(n) === 1 ? one : many);

export default {
  "ticket.sponsor.lanTastic.subject": (p) => `${p.event} precisa de servidores`,
  "ticket.sponsor.lanTastic.text": (p) => `Olá, organizamos o ${p.event}, a maior LAN party do concelho, e no ano passado os servidores tinham mais lag do que os nossos jogadores. Podias patrocinar ${what(p)} durante ${span(p)}? O teu logótipo aparece no ecrã grande entre as pausas para a pizza.`,
  "ticket.sponsor.chaosClub.subject": (p) => `Encontro ${p.event}`,
  "ticket.sponsor.chaosClub.text": (p) => `Encontramo-nos todas as quintas para desmontar coisas que funcionavam perfeitamente. Um host para correr as nossas ferramentas ajudava: ${what(p)} durante ${span(p)}. Não podemos pagar, mas contamos-te o que encontrarmos.`,
  "ticket.sponsor.hackASorus.subject": (p) => `Hackathon ${p.event}`,
  "ticket.sponsor.hackASorus.text": (p) => `Quarenta programadores, um fim de semana, pouco sono. Precisamos de ${what(p)} durante ${span(p)} para correr os projetos. Nada vai para produção, e o que partirmos fica na sandbox.`,
  "ticket.sponsor.mirror.subject": (p) => `Mirror para ${p.event}`,
  "ticket.sponsor.mirror.text": (p) => `A nossa distribuição procura um mirror perto dos seus utilizadores. Precisávamos de ${what(p)} durante ${span(p)}. A tua empresa aparece na nossa página de mirrors, entre uma universidade e um senhor chamado Gerhard.`,
  "ticket.sponsor.fragFest.subject": (p) => `Torneio ${p.event}`,
  "ticket.sponsor.fragFest.text": (p) => `As finais do ${p.event} estão a chegar e os servidores velhos aguentam-se com abraçadeiras. Procuramos ${what(p)} durante ${span(p)}. O nome do patrocinador é anunciado antes de cada jogo, por isso, por favor, não caias.`,
  "ticket.sponsor.userGroup.subject": (p) => `Site de ${p.event}`,
  "ticket.sponsor.userGroup.text": (p) => `O nosso grupo reúne desde os anos noventa e o nosso site passou quase todo esse tempo na cave de um sócio. Podias dar-nos ${what(p)} durante ${span(p)}? Listamos-te como patrocinador, mesmo por baixo das atas das reuniões.`,
  "ticket.sponsor.codeClub.subject": (p) => `Sites para ${p.event}`,
  "ticket.sponsor.codeClub.text": (p) => `Este ano os nossos alunos criam os primeiros sites e adorariam pô-los online a sério. Podias patrocinar ${what(p)} durante ${span(p)}? Agradecemos-te em todas as páginas.`,
  "ticket.sponsor.shelter.subject": (p) => `Uma casa para o site de ${p.event}`,
  "ticket.sponsor.shelter.text": (p) => `Arranjamos casa a gatos, cães e a um papagaio muito barulhento, e o nosso site também precisa de uma. Podias patrocinar ${what(p)} durante ${span(p)}? O teu logótipo ficava ao lado da lista de adoções.`,
  "ticket.sponsor.pixelJam.subject": (p) => `${p.event} precisa de um parque de diversões`,
  "ticket.sponsor.pixelJam.text": (p) => `No ${p.event} as equipas criam um jogo num fim de semana e no domingo toda a gente joga os resultados. Precisamos de ${what(p)} durante ${span(p)} para que o playtest não vá abaixo.`,
  "ticket.sponsor.openData.subject": (p) => `Armazenamento para ${p.event}`,
  "ticket.sponsor.openData.text": (p) => `Recolhemos conjuntos de dados públicos da cidade e durante uma semana transformamo-los em mapas e ferramentas. Podias patrocinar ${what(p)} durante ${span(p)} para guardar os dados em bruto?`,
  "ticket.sponsor.devOops.subject": (p) => `Streaming para ${p.event}`,
  "ticket.sponsor.devOops.text": (p) => `Esperamos dois mil participantes e uma keynote que não pode ter buffering. Precisamos de ${what(p)} durante ${span(p)} para transmitir as palestras. Os oradores vão mencionar-te pelo menos uma vez, normalmente sem querer.`,
  "outcome.sponsored": () => "Patrocínio aceite",
  "outcome.sponsorDeclined": () => "Patrocínio recusado",
  "review.sponsor.bad": () => "O logótipo deles estava no ecrã grande e os servidores não.",
  "review.sponsor.ok": () => "Um patrocinador que apareceu. Mais ou menos.",
  "review.sponsor.good": () => "Servidores grátis que aguentaram o fim de semana todo. Vamos lembrar-nos disto.",
  "event.sponsorRequest.title": () => "Pedido de patrocínio",
  "event.sponsorRequest.text": (p) => `${p.event} procura um patrocinador.`,
  "event.sponsorDone.title": (p) => `${p.event} terminou`,
  "event.sponsorDone.text": (p) => {
    const gains = [
      Number(p.knowHow) > 0 && `${p.knowHow} de know-how`,
      Number(p.awareness) > 0 && `mais ${p.awareness}% de notoriedade`,
      Number(p.leads) > 0 && `${p.leads} ${plural(p.leads, "lead", "leads")}`,
      Number(p.stars) > 0 && `uma avaliação de ${p.stars} ${plural(p.stars, "estrela", "estrelas")}`,
      Number(p.recommendation) > 0 && "uma recomendação para uma contratação qualificada",
    ].filter(Boolean);
    return `Os servidores de ${p.event} aguentaram-se. Ganhaste ${gains.length ? gains.join(", ") : "um agradecimento"}.`;
  },
  "ticket.sponsor.board.clan.subject": (p) => `Candidatura de ${p.event}`,
  "ticket.sponsor.board.clan.text": (p) => `Aqui é ${p.event}. O nosso clã tem ${reach(p)} que nunca concordaram em nada, exceto no lag. Vimos a tua oferta no Sponsor-Bored e queríamos ${ask(p)}. O teu banner vai para a página inicial do nosso site.`,
  "ticket.sponsor.board.lanParty.subject": (p) => `Candidatura de ${p.event}`,
  "ticket.sponsor.board.lanParty.text": (p) => `Organizamos ${p.event} num pavilhão alugado para ${reach(p)} e uma quantidade perigosa de cabos. Queríamos ${ask(p)}. Mencionamos-te em palco entre as entregas de pizza.`,
  "ticket.sponsor.board.fanSite.subject": (p) => `Candidatura de ${p.event}`,
  "ticket.sponsor.board.fanSite.text": (p) => `${p.event} é lido todos os meses por ${reach(p)}, sobretudo à noite. Queríamos ${ask(p)}. O teu banner fica no topo de todas as páginas, mesmo por cima das discussões.`,
  "ticket.sponsor.board.student.subject": (p) => `Candidatura de ${p.event}`,
  "ticket.sponsor.board.student.text": (p) => `Somos um projeto de estudantes com ${reach(p)} no curso, e o nosso professor diz que a demo tem de correr num sítio a sério. Queríamos ${ask(p)}. O teu nome vai para a assinatura de fórum de toda a equipa.`,
  "ticket.sponsor.board.mirror.subject": (p) => `Candidatura de ${p.event}`,
  "ticket.sponsor.board.mirror.text": (p) => `Fazemos mirror de software open source para ${reach(p)} que preferiam compilá-lo eles próprios. Queríamos ${ask(p)}. Cada maintainer assina as mensagens do fórum com um agradecimento a ti.`,
  "event.boardApplication.title": () => "Candidatura a patrocínio",
  "event.boardApplication.text": (p) => `${p.event} candidatou-se a um patrocínio.`,
  "event.halfAccepted.title": (p) => `${p.event} aceitou a tua oferta`,
  "event.halfAccepted.text": (p) => `${p.event} aceitou a tua oferta a metade do preço e os serviços estão a funcionar.`,
  "event.halfDeclined.title": (p) => `${p.event} escolheu outro patrocinador`,
  "event.halfDeclined.text": (p) => `${p.event} recusou a tua oferta a metade do preço.`,
  "event.boardDropped.title": (p) => `${p.event} tirou o teu banner`,
  "event.boardDropped.text": (p) => `${p.event} retirou o teu banner, por isso o patrocínio já não traz notoriedade nem leads.`,
  "event.boardDone.title": (p) => `${p.event} terminou`,
  "event.boardDone.text": (p) => `O patrocínio de ${p.event} terminou.`,
  "error.badOffer": () => "Esta oferta não pode ser publicada.",
  "error.offersOpen": () => "Já há três ofertas abertas.",
  "error.unknownOffer": () => "Esta oferta já não está aberta.",
  "error.offerFull": () => "Todas as vagas desta oferta estão preenchidas.",
  "event.sponsorFailed.title": (p) => `${p.event} correu mal`,
  "event.sponsorFailed.text": (p) => `Os servidores de ${p.event} estiveram em baixo durante ${p.hours} ${plural(p.hours, "hora", "horas")}. Foram publicadas duas avaliações más e a tua notoriedade desceu.`,
} satisfies Dict;
