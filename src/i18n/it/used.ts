import { euro, euroCents } from "../../sim/00-core/money";
import type { Dict, Params } from "../lang";

const CHANNEL: Record<string, string> = { ebuy: "eBuy", board: "WebHostingTalc", chat: "Telegrump" };
const box = (p: Params) => `${p.cpu} vCPU, ${p.ram} GB di RAM e ${p.disk} GB di disco`;

export default {
  "event.usedScam.title": () => "Venditore sparito",
  "event.usedScam.text": (p) => `Il venditore ${p.seller} del ${p.model} si è tenuto i tuoi ${euro(Number(p.price))} e ti ha bloccato. Non arriverà niente.`,
  "event.usedWon.title": () => "Asta vinta",
  "event.usedWon.text": (p) => `Hai vinto il ${p.model} su eBuy per ${euro(Number(p.price))}. Viene spedito a ${p.location}.`,
  "event.usedOutbid.title": () => "Asta persa",
  "event.usedOutbid.text": (p) => `Qualcuno ha rilanciato su di te per il ${p.model} su eBuy.`,
  "event.usedOutbidNow.title": () => "Rilanciato",
  "event.usedOutbidNow.text": (p) => `Qualcuno ha offerto ${euro(Number(p.price))} per il ${p.model} su eBuy, sopra il tuo massimo.`,
  "event.usedUnpaid.title": () => "Asta persa",
  "event.usedUnpaid.text": (p) => `Hai vinto il ${p.model} su eBuy ma non hai potuto pagare ${euro(Number(p.price))}, quindi è andato al successivo offerente.`,
  "event.usedSold.title": (p) => `${p.device} venduto`,
  "event.usedSold.text": (p) => `Un acquirente su ${p.channel} ha pagato ${euroCents(Number(p.price))} per ${p.device}.`,
  "event.usedExpired.title": () => "Annuncio scaduto",
  "event.usedExpired.text": (p) => `Nessuno ha comprato ${p.device} su ${p.channel}. È tornato in magazzino.`,
  "event.news.used.lot.title": (p) => `Hoster fallito, ${p.count} server in vendita`,
  "event.news.used.lot.text": (p) => `Handelsblah riferisce che un hoster vicino a te è fallito. I suoi ${p.count} server sono su WebHostingTalc in un unico lotto.`,
  "event.news.used.clearance.title": () => "Weekend di svuotamento di un data center",
  "event.news.used.clearance.text": (p) => `Handelsblah riferisce che un data center si sta svuotando. ${p.count} lotti sono su eBuy fino a domenica sera.`,
  "ledger.usedBuy": (p) => `Usato ${Number(p.qty) > 1 ? `${p.qty} × ` : ""}${p.model} da ${CHANNEL[p.channel] ?? p.channel}`,
  "ledger.usedSale": (p) => `${p.device} venduto su ${p.channel}${Number(p.fee) ? `, commissione di ${euroCents(Number(p.fee))}` : ""}`,
  "error.listingGone": () => "L'annuncio non c'è più.",
  "error.auctionOnly": () => "Questa è un'asta. Fai un'offerta.",
  "error.notAuction": () => "Questo annuncio ha un prezzo fisso.",
  "error.bidTooLow": () => "L'offerta è inferiore al prezzo attuale.",
  "error.badPrice": () => "Inserisci un prezzo superiore a zero.",
  "sales.msg.usedBoard": (p) => `Ho visto il vostro post su WebHostingTalc. Fate anche VPS? Me ne servirebbe uno con ${box(p)} a ${p.city}. Quanto costerebbe al mese?`,
} satisfies Dict;
