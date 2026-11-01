import { euro, euroCents } from "../../sim/00-core/money";
import type { Dict, Params } from "../lang";

const CHANNEL: Record<string, string> = { ebuy: "eBuy", board: "WebHostingTalc", chat: "Craigslost" };
const box = (p: Params) => `${p.cpu} vCPU, ${p.ram} GB de RAM y ${p.disk} GB de disco`;

export default {
  "event.usedScam.title": () => "El vendedor ha desaparecido",
  "event.usedScam.text": (p) => `El vendedor ${p.seller} del ${p.model} se quedó con tus ${euro(Number(p.price))} y te bloqueó. No llegará nada.`,
  "event.usedWon.title": () => "Subasta ganada",
  "event.usedWon.text": (p) => `Has ganado el ${p.model} en eBuy por ${euro(Number(p.price))}. Se envía a ${p.location}.`,
  "event.usedOutbid.title": () => "Subasta perdida",
  "event.usedOutbid.text": (p) => `Alguien ha superado tu puja por el ${p.model} en eBuy.`,
  "event.usedOutbidNow.title": () => "Puja superada",
  "event.usedOutbidNow.text": (p) => `Alguien ha pujado ${euro(Number(p.price))} por el ${p.model} en eBuy, por encima de tu máximo.`,
  "event.usedUnpaid.title": () => "Subasta perdida",
  "event.usedUnpaid.text": (p) => `Ganaste el ${p.model} en eBuy pero no pudiste pagar ${euro(Number(p.price))}, así que pasó al siguiente postor.`,
  "event.usedSold.title": (p) => `${p.device} vendido`,
  "event.usedSold.text": (p) => `Un comprador de ${p.channel} ha pagado ${euroCents(Number(p.price))} por ${p.device}.`,
  "event.usedExpired.title": () => "Anuncio caducado",
  "event.usedExpired.text": (p) => `Nadie compró ${p.device} en ${p.channel}. Vuelve a estar en el almacén.`,
  "event.news.used.lot.title": (p) => `Hoster en quiebra, ${p.count} servidores a la venta`,
  "event.news.used.lot.text": (p) => `Handelsblah informa de que un hoster cercano ha quebrado. Sus ${p.count} servidores están en WebHostingTalc como un único lote.`,
  "event.news.used.clearance.title": () => "Fin de semana de liquidación de un centro de datos",
  "event.news.used.clearance.text": (p) => `Handelsblah informa de que un centro de datos se está vaciando. Hay ${p.count} lotes en eBuy hasta el domingo por la noche.`,
  "ledger.usedBuy": (p) => `Segunda mano ${Number(p.qty) > 1 ? `${p.qty} × ` : ""}${p.model} en ${CHANNEL[p.channel] ?? p.channel}`,
  "ledger.usedSale": (p) => `${p.device} vendido en ${p.channel}${Number(p.fee) ? `, comisión de ${euroCents(Number(p.fee))}` : ""}`,
  "error.listingGone": () => "El anuncio ya no está.",
  "error.auctionOnly": () => "Esto es una subasta. Haz una puja.",
  "error.notAuction": () => "Este anuncio tiene precio fijo.",
  "error.bidTooLow": () => "La puja está por debajo del precio actual.",
  "error.badPrice": () => "Introduce un precio mayor que cero.",
  "sales.msg.usedBoard": (p) => `He visto vuestra publicación en WebHostingTalc. ¿Ofrecéis también VPS? Necesitaría uno con ${box(p)} en ${p.city}. ¿Cuánto costaría al mes?`,
} satisfies Dict;
