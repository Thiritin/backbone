import { euroCents } from "../../sim/00-core/money";
import { t } from "../en";
import type { Dict, Params } from "../lang";

const gb = (x: string | number) => `${x} GB`;
const mailboxes = (n: string | number) => `${n} ${Number(n) === 1 ? "caixa de e-mail" : "caixas de e-mail"}`;
const web = (p: Params) => `${gb(p.disk)} de espaço, ${gb(p.traffic)} de tráfego por mês e ${mailboxes(p.mail)}`;
const box = (p: Params) => `${p.cpu} vCPU, ${gb(p.ram)} de RAM e ${gb(p.disk)} de disco`;
const cards = (p: Params) => `${p.gpu} GPU`;
const domain = (p: Params) => (Number(p.owned) ? `Já tenho ${p.domain} e gostava de o transferir para ti.` : `Regista também ${p.domain} para mim, por favor.`);
const more = (p: Params) => (p.product === "webHosting"
  ? `de ${gb(p.disk0)} a ${gb(p.disk1)} de espaço, de ${gb(p.traffic0)} a ${gb(p.traffic1)} de tráfego e de ${p.mail0} a ${mailboxes(p.mail1)}`
  : and([
    Number(p.cpu1) > 0 && `de ${p.cpu0} a ${p.cpu1} vCPU`, Number(p.ram1) > 0 && `de ${gb(p.ram0)} a ${gb(p.ram1)} de RAM`, Number(p.disk1) > 0 && `de ${gb(p.disk0)} a ${gb(p.disk1)} de disco`,
  ].filter((x): x is string => !!x)));
const and = (xs: string[]) => (xs.length > 1 ? `${xs.slice(0, -1).join(", ")} e ${xs.at(-1)}` : xs[0] ?? "mais espaço");

export default {
  "order.msg.webHosting.0": (p) => `Olá, preciso de hospedagem web para ${p.domain}: cerca de ${web(p)}. ${domain(p)}`,
  "order.msg.webHosting.1": (p) => `Um amigo recomendou-te. O meu site ${p.domain} precisa de ${web(p)}. ${domain(p)} Quanto custaria?`,
  "order.msg.vps.0": (p) => `Queria um VPS em ${p.city} com ${box(p)}. Acesso root, por favor. Sei o que estou a fazer.`,
  "order.msg.vps.1": (p) => `Por favor, configura-me um servidor virtual: ${box(p)}. Debiant era bom, e faturação mensal.`,
  "order.msg.gameServer.0": (p) => `Precisamos de um servidor de jogos para o nosso clã com ${box(p)}. Tem de estar a funcionar até sexta à noite.`,
  "order.msg.gameServer.1": (p) => `Por favor, configura um servidor de jogos em ${p.city}: ${box(p)}. Para nós o ping baixo importa mais do que tudo.`,
  "order.msg.gpu.0": (p) => `Queria um servidor GPU em ${p.city} com ${cards(p)}, ${box(p)}. Preciso dele para treinar os meus modelos.`,
  "order.msg.gpu.1": (p) => `Por favor, configura-me um servidor virtual com ${cards(p)}: ${box(p)}. Drivers CUDA eram bons, e faturação mensal.`,
  "sales.msg.upgrade": (p) => `Estamos sempre a bater nos limites. Precisamos de ${more(p)}. Quanto nos custaria o upgrade?`,
  "sales.you.upgrade": (p) => `Podemos fazer o upgrade por ${euroCents(Number(p.price))} por mês no total.`,
  "sales.you.upgradeDone": (p) => `O upgrade está ativo. O teu serviço funciona agora com os novos recursos a ${euroCents(Number(p.price))} por mês.`,
  "ticket.upgrade.more.subject": (p) => `${p.hostname || p.service || "O meu serviço"} está a ficar pequeno`,
  "ticket.upgrade.more.text": () => "Estamos sempre a ficar sem espaço. Quanto nos custaria um upgrade?",
  "invoice.line.firstMonth": (p) => `${p.label}, primeiro mês`,
  "invoice.line.setupFee": (p) => `${p.label}, taxa de instalação`,
  "invoice.line.domain": (p) => `Domínio ${p.domain}, primeiro ano`,
  "invoice.line.domainTransfer": (p) => `Transferência de ${p.domain}`,
  "invoice.line.domainRenewal": (p) => `Domínio ${p.domain}, mais um ano`,
  "ledger.domain": (p) => `${p.domain} em ${p.registry}`,
  "ledger.domainTransfer": (p) => `Transferência de ${p.domain} para ${p.registry}`,
  "ledger.domainRenewal": (p) => `Renovação de ${p.domain} em ${p.registry}`,
  "activity.renewDomain": (p) => `${p.domain} renovado por um ano`,
  "activity.changePackage": (p) => `Mudado para o pacote ${p.pkg}`,
  "activity.upgrade": (p) => `Serviço atualizado para ${euroCents(Number(p.price))} por mês`,
  "event.orderAccepted.title": () => "Orçamento aceite",
  "event.orderAccepted.text": (p) => `${p.name} aceitou o orçamento.`,
  "event.orderPaid.title": () => "Pedido pago",
  "event.orderPaid.text": (p) => `${p.name} pagou a fatura do pedido e aguarda a configuração.`,
  "event.stepFailed.title": () => "Passo do pedido falhou",
  "event.stepFailed.text": (p) => `${p.name}: ${t(String(p.error))}`,
  "event.domainExpiring.title": () => "Domínio a expirar em breve",
  "event.domainExpiring.text": (p) => `${p.domain} expira dentro de ${p.days} ${Number(p.days) === 1 ? "dia" : "dias"}.`,
  "event.domainExpired.title": () => "Domínio expirado",
  "event.domainExpired.text": (p) => `${p.domain} expirou e o seu site está offline.`,
  "lost.unpaid": () => "Nunca pagou",
  "error.needsQuote": () => "O cliente ainda não aceitou um orçamento.",
  "error.quoteSent": () => "O cliente ainda não respondeu ao orçamento.",
  "error.needsAutomation": () => "Escolhe um host onde o configurar.",
  "error.needsAccount": () => "Cria primeiro a conta do cliente.",
  "error.needsInvoice": () => "Confirma primeiro o pedido e envia a fatura.",
  "error.needsDomain": () => "Regista primeiro o domínio.",
  "error.stepDone": () => "Este passo já está concluído.",
  "error.domainTaken": () => "Este domínio pertence a outro cliente.",
  "error.unknownDomain": () => "Este domínio não está registado para nenhum cliente ativo.",
  "error.routeElsewhere": () => "Este cluster fica noutra cidade.",
} satisfies Dict;
