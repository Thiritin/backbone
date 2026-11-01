import { euro, euroCents } from "../../sim/00-core/money";
import type { Dict, Params } from "../lang";

const CHANNEL: Record<string, string> = { ebuy: "eBuy", board: "WebHostingTalc", chat: "Craigslost" };
const box = (p: Params) => `${p.cpu} vCPU${Number(p.cpu) === 1 ? "" : "s"}, ${p.ram} GB RAM und ${p.disk} GB Festplatte`;

export default {
  "event.usedScam.title": () => "Verkäufer verschwunden",
  "event.usedScam.text": (p) => `Der ${p.seller}-Verkäufer des ${p.model} hat deine ${euro(Number(p.price))} behalten und dich blockiert. Es wird nichts ankommen.`,
  "event.usedWon.title": () => "Auktion gewonnen",
  "event.usedWon.text": (p) => `Du hast den ${p.model} bei eBuy für ${euro(Number(p.price))} gewonnen. Er wird an ${p.location} geliefert.`,
  "event.usedOutbid.title": () => "Auktion verloren",
  "event.usedOutbid.text": (p) => `Jemand hat dich bei eBuy beim ${p.model} überboten.`,
  "event.usedOutbidNow.title": () => "Überboten",
  "event.usedOutbidNow.text": (p) => `Jemand hat bei eBuy ${euro(Number(p.price))} auf den ${p.model} geboten, mehr als dein Maximum.`,
  "event.usedUnpaid.title": () => "Auktion verloren",
  "event.usedUnpaid.text": (p) => `Du hast den ${p.model} bei eBuy gewonnen, konntest aber ${euro(Number(p.price))} nicht bezahlen, also ging er an den nächsten Bieter.`,
  "event.usedSold.title": (p) => `${p.device} verkauft`,
  "event.usedSold.text": (p) => `Ein Käufer auf ${p.channel} hat ${euroCents(Number(p.price))} für ${p.device} bezahlt.`,
  "event.usedExpired.title": () => "Angebot abgelaufen",
  "event.usedExpired.text": (p) => `Niemand hat ${p.device} auf ${p.channel} gekauft. Es liegt wieder im Lager.`,
  "event.news.used.lot.title": (p) => `Hoster pleite, ${p.count} Server zu verkaufen`,
  "event.news.used.lot.text": (p) => `Handelsblah meldet, dass ein Hoster in deiner Nähe pleitegegangen ist. Seine ${p.count} Server stehen als ein Los auf WebHostingTalc.`,
  "event.news.used.clearance.title": () => "Rechenzentrums-Räumungswochenende",
  "event.news.used.clearance.text": (p) => `Handelsblah meldet, dass ein Rechenzentrum ausgeräumt wird. ${p.count} Lose stehen bis Sonntagabend auf eBuy.`,
  "ledger.usedBuy": (p) => `Gebraucht ${Number(p.qty) > 1 ? `${p.qty} × ` : ""}${p.model} von ${CHANNEL[p.channel] ?? p.channel}`,
  "ledger.usedSale": (p) => `${p.device} auf ${p.channel} verkauft${Number(p.fee) ? `, ${euroCents(Number(p.fee))} Gebühr` : ""}`,
  "error.listingGone": () => "Das Angebot ist weg.",
  "error.auctionOnly": () => "Das ist eine Auktion. Gib stattdessen ein Gebot ab.",
  "error.notAuction": () => "Dieses Angebot hat einen Festpreis.",
  "error.bidTooLow": () => "Das Gebot liegt unter dem aktuellen Preis.",
  "error.badPrice": () => "Gib einen Preis über null ein.",
  "sales.msg.usedBoard": (p) => `Ich habe euren Beitrag auf WebHostingTalc gesehen. Macht ihr auch VPS? Ich bräuchte einen mit ${box(p)} in ${p.city}. Was würde das pro Monat kosten?`,
} satisfies Dict;
