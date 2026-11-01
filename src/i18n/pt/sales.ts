import { euroCents } from "../../sim/00-core/money";
import type { Dict, Params } from "../lang";

const SLA: Record<string, string> = { basic: "Basic", business: "Business", premium: "Premium" };
const sla = (p: Params) => (p.sla === "basic" ? "" : ` Precisamos do SLA ${SLA[p.sla] ?? p.sla}.`);
const price = (p: Params) => euroCents(Number(p.price));
const web = (p: Params) => `${p.disk} GB de espaço e ${p.mail} ${Number(p.mail) === 1 ? "caixa de e-mail" : "caixas de e-mail"}`;
const cards = (p: Params) => `${p.gpu} GPU`;
const box = (p: Params) => `${p.cpu} vCPU, ${p.ram} GB de RAM e ${p.disk} GB de disco`;

const STUDY_NAME: Record<string, string> = {
  private: "Particulares", gamer: "Jogadores", hobbyDev: "Programadores amadores", soleProp: "Empresários em nome individual", smallBiz: "Pequenas empresas",
  agency: "Agências e startups", office: "Consultórios e escritórios de advogados", onlineShop: "Lojas online", enterprise: "Grandes empresas",
};

export default {
  "request.use.private": () => "É só um pequeno site pessoal, por isso nunca há pressa.",
  "request.use.gamer": () => "Jogamos quase todas as noites e o fim de semana inteiro, por isso tem de estar no ar nessas alturas.",
  "request.use.hobbyDev": () => "É um projeto paralelo em que mexo quando arranjo tempo.",
  "request.use.soleProp": () => "Os clientes encontram-me pelo site, e eu vejo-o de poucos em poucos dias.",
  "request.use.smallBiz": () => "A nossa equipa trabalha com ele todos os dias em horário de expediente.",
  "request.use.agency": () => "Os nossos clientes usam-no o dia todo, por isso notamos os problemas depressa.",
  "request.use.office": () => "Os pacientes marcam as consultas por lá todas as manhãs.",
  "request.use.onlineShop": () => "As encomendas entram a toda a hora, e cada minuto offline custa-nos dinheiro.",
  "request.use.enterprise": () => "Os nossos funcionários dependem dele a toda a hora.",
  "sales.msg.webHosting.0": (p) => `Olá, procuro uma casa para ${p.domain || "o meu site"}: cerca de ${web(p)}. Quanto custaria por mês?${sla(p)}`,
  "sales.msg.webHosting.1": (p) => `Um amigo recomendou-te. Precisamos de ${web(p)} para ${p.domain || "o nosso site"}, alojado em ${p.city} se possível.${sla(p)} Qual é o teu preço?`,
  "sales.msg.vps.0": (p) => `Precisamos de um VPS com ${box(p)} e acesso root em ${p.city}.${sla(p)} Envia-me o teu preço mensal, por favor.`,
  "sales.msg.vps.1": (p) => `A nossa aplicação ficou pequena para a hospedagem partilhada. Consegues oferecer um VPS com ${box(p)}?${sla(p)} A faturação mensal era o que mais nos convinha.`,
  "sales.msg.gameServer.0": (p) => `O nosso clã precisa de um servidor de jogos com ${box(p)} que não tenha lag às sextas à noite. Quanto custa por mês?`,
  "sales.msg.gameServer.1": (p) => `Procuramos um servidor de jogos com ${box(p)} perto de ${p.city} para ter ping baixo. Quanto cobras?`,
  "sales.msg.dedicated.0": (p) => `Procuramos um servidor dedicado com pelo menos ${p.ram} GB de RAM em ${p.city} com contrato de doze meses.${sla(p)} Indica-nos um preço mensal, por favor.`,
  "sales.msg.dedicated.1": (p) => `A nossa equipa quer hardware próprio. Podias fornecer um servidor com pelo menos ${p.ram} GB de RAM?${sla(p)}`,
  "sales.msg.gpu.0": (p) => `Estamos a treinar modelos e precisamos de ${cards(p)} com ${box(p)} em ${p.city}.${sla(p)} Quanto custaria por mês?`,
  "sales.msg.gpu.1": (p) => `A nossa equipa precisa de servidores GPU para renderização e inferência: ${cards(p)}, ${box(p)}.${sla(p)} Envia-nos o teu preço mensal, por favor.`,
  "sales.msg.shady": (p) => `Precisamos hoje de um VPS com ${box(p)}. Muito tráfego, sem perguntas, sem papelada. Pagamos em cripto, sempre a horas. Diz o teu preço.`,
  "sales.msg.discount": (p) => `A tua campanha falava em ${p.discount}% de desconto para agências. Gostávamos de aproveitar.`,
  "sales.reply.accept": (p) => `Para nós está bem. Podem avançar com a ativação. Cumprimentos, ${p.name}`,
  "sales.reply.counter": (p) => `Está um pouco acima do nosso orçamento. Podíamos fazer ${price(p)} por mês. Diz-nos alguma coisa.`,
  "sales.reply.noBudget": (p) => `Obrigado, mas não temos orçamento para isso. Vamos procurar outro fornecedor. ${p.name}`,
  "sales.reply.refused": (p) => `Obrigado pela proposta. Encontrámos um negócio melhor noutro lado. ${p.name}`,
  "sales.you.decline": () => "Obrigado pelo interesse. De momento não podemos tratar disto.",
  "sales.need.location": (p) => `Precisa de um local em ${p.city}`,
  "sales.need.age": (p) => `Precisa de uma empresa com pelo menos ${p.months} meses`,
  "sales.need.reviews": (p) => `Precisa de uma avaliação de ${p.stars} estrelas ou mais`,
  "sales.req.location": (p) => `Local em ${p.city}`,
  "sales.req.cluster": (p) => `Cluster em ${p.city}`,
  "sales.req.server": (p) => `Servidor livre em ${p.city}`,
  "sales.req.datacenter": (p) => `Datacenter em ${p.city}`,
  "sales.req.age": (p) => `Empresa com pelo menos ${p.months} meses`,
  "sales.req.reviews": (p) => `Avaliação de ${p.stars} estrelas`,
  "lost.expired": () => "Sem resposta a tempo",
  "lost.price": () => "Demasiado caro",
  "lost.declined": () => "Recusado",
  "lost.noCapacity": (p) => `Sem capacidade em ${p.city}`,
  "event.salesWon.title": () => "Negócio fechado",
  "event.salesWon.text": (p) => `${p.name} assinou por ${price(p)} por mês para ${p.spec}.`,
  "event.salesCounter.title": () => "Contraproposta",
  "event.salesCounter.text": (p) => `${p.name} oferece ${price(p)} por mês.`,
  "event.salesRefused.title": () => "Orçamento recusado",
  "event.salesRefused.text": (p) => `${p.name} recusou o teu orçamento.`,
  "error.unknownRequest": () => "Este pedido já não está aberto.",
  "error.quotePrice": () => "Introduz um preço mensal superior a zero.",
  "error.requestMissing": () => "Ainda não podes satisfazer este pedido.",
  "error.yearlyPrice": () => "Os produtos anuais mantêm o preço até à renovação.",
  "error.unknownProfile": () => "Esse grupo de clientes não existe.",
  "error.studyDone": () => "Já tens este estudo.",
  "ledger.marketStudy": (p) => `Estudo de mercado da Gartnah: ${STUDY_NAME[p.profile] ?? p.profile}`,
  "sales.msg.transfer": (p) => `O meu site está neste momento em ${p.host}. Por favor, mudem-no por mim.`,
} satisfies Dict;
