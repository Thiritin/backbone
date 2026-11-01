import { euro, euroCents } from "../../sim/00-core/money";
import type { Dict, Params } from "../lang";

const CHANNEL: Record<string, string> = { ebuy: "eBuy", board: "WebHostingTalc", chat: "Craigslost" };
const box = (p: Params) => `${p.cpu} vCPU, ${p.ram} GB de RAM e ${p.disk} GB de disco`;

export default {
  "event.usedScam.title": () => "Vendedor desapareceu",
  "event.usedScam.text": (p) => `O vendedor ${p.seller} do ${p.model} ficou com os teus ${euro(Number(p.price))} e bloqueou-te. Não vai chegar nada.`,
  "event.usedWon.title": () => "Leilão ganho",
  "event.usedWon.text": (p) => `Ganhaste o ${p.model} na eBuy por ${euro(Number(p.price))}. Segue para ${p.location}.`,
  "event.usedOutbid.title": () => "Leilão perdido",
  "event.usedOutbid.text": (p) => `Alguém cobriu a tua licitação do ${p.model} na eBuy.`,
  "event.usedOutbidNow.title": () => "Licitação coberta",
  "event.usedOutbidNow.text": (p) => `Alguém licitou ${euro(Number(p.price))} pelo ${p.model} na eBuy, acima do teu máximo.`,
  "event.usedUnpaid.title": () => "Leilão perdido",
  "event.usedUnpaid.text": (p) => `Ganhaste o ${p.model} na eBuy mas não conseguiste pagar ${euro(Number(p.price))}, por isso passou para o licitador seguinte.`,
  "event.usedSold.title": (p) => `${p.device} vendido`,
  "event.usedSold.text": (p) => `Um comprador na ${p.channel} pagou ${euroCents(Number(p.price))} por ${p.device}.`,
  "event.usedExpired.title": () => "Anúncio expirado",
  "event.usedExpired.text": (p) => `Ninguém comprou ${p.device} na ${p.channel}. Voltou para o armazém.`,
  "event.news.used.lot.title": (p) => `Hoster faliu, ${p.count} servidores à venda`,
  "event.news.used.lot.text": (p) => `O Handelsblah noticia que um hoster perto de ti faliu. Os seus ${p.count} servidores estão na WebHostingTalc num único lote.`,
  "event.news.used.clearance.title": () => "Fim de semana de liquidação de datacenter",
  "event.news.used.clearance.text": (p) => `O Handelsblah noticia que um datacenter está a despejar material. Há ${p.count} lotes na eBuy até domingo à noite.`,
  "ledger.usedBuy": (p) => `Usado ${Number(p.qty) > 1 ? `${p.qty} × ` : ""}${p.model} da ${CHANNEL[p.channel] ?? p.channel}`,
  "ledger.usedSale": (p) => `${p.device} vendido na ${p.channel}${Number(p.fee) ? `, comissão de ${euroCents(Number(p.fee))}` : ""}`,
  "error.listingGone": () => "O anúncio desapareceu.",
  "error.auctionOnly": () => "Isto é um leilão. Faz uma licitação.",
  "error.notAuction": () => "Este anúncio tem preço fixo.",
  "error.bidTooLow": () => "A licitação está abaixo do preço atual.",
  "error.badPrice": () => "Indica um preço acima de zero.",
  "sales.msg.usedBoard": (p) => `Vi a vossa publicação na WebHostingTalc. Também fazem VPS? Precisava de um com ${box(p)} em ${p.city}. Quanto custaria por mês?`,
} satisfies Dict;
