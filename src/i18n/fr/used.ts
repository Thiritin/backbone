import { euro, euroCents } from "../../sim/00-core/money";
import type { Dict, Params } from "../lang";

const CHANNEL: Record<string, string> = { ebuy: "eBuy", board: "WebHostingTalc", chat: "Craigslost" };
const box = (p: Params) => `${p.cpu} vCPU, ${p.ram} Go de RAM et ${p.disk} Go de disque`;

export default {
  "event.usedScam.title": () => "Vendeur disparu",
  "event.usedScam.text": (p) => `Le vendeur ${p.seller} du ${p.model} a gardé tes ${euro(Number(p.price))} et t'a bloqué. Rien n'arrivera.`,
  "event.usedWon.title": () => "Enchère remportée",
  "event.usedWon.text": (p) => `Tu as remporté le ${p.model} sur eBuy pour ${euro(Number(p.price))}. Il est expédié à ${p.location}.`,
  "event.usedOutbid.title": () => "Enchère perdue",
  "event.usedOutbid.text": (p) => `Quelqu'un a surenchéri sur le ${p.model} sur eBuy.`,
  "event.usedOutbidNow.title": () => "Surenchéri",
  "event.usedOutbidNow.text": (p) => `Quelqu'un a enchéri ${euro(Number(p.price))} sur le ${p.model} sur eBuy, au-dessus de ton maximum.`,
  "event.usedUnpaid.title": () => "Enchère perdue",
  "event.usedUnpaid.text": (p) => `Tu as remporté le ${p.model} sur eBuy mais tu n'as pas pu payer ${euro(Number(p.price))}, il est donc parti à l'enchérisseur suivant.`,
  "event.usedSold.title": (p) => `${p.device} vendu`,
  "event.usedSold.text": (p) => `Un acheteur sur ${p.channel} a payé ${euroCents(Number(p.price))} pour ${p.device}.`,
  "event.usedExpired.title": () => "Annonce expirée",
  "event.usedExpired.text": (p) => `Personne n'a acheté ${p.device} sur ${p.channel}. Il est de retour en stock.`,
  "event.news.used.lot.title": (p) => `Hébergeur en faillite, ${p.count} serveurs à vendre`,
  "event.news.used.lot.text": (p) => `Handelsblah rapporte qu'un hébergeur près de chez toi a fait faillite. Ses ${p.count} serveurs sont sur WebHostingTalc en un seul lot.`,
  "event.news.used.clearance.title": () => "Week-end de liquidation de centre de données",
  "event.news.used.clearance.text": (p) => `Handelsblah rapporte qu'un centre de données se vide. ${p.count} lots sont sur eBuy jusqu'à dimanche soir.`,
  "ledger.usedBuy": (p) => `Occasion ${Number(p.qty) > 1 ? `${p.qty} × ` : ""}${p.model} chez ${CHANNEL[p.channel] ?? p.channel}`,
  "ledger.usedSale": (p) => `${p.device} vendu sur ${p.channel}${Number(p.fee) ? `, ${euroCents(Number(p.fee))} de frais` : ""}`,
  "error.listingGone": () => "L'annonce a disparu.",
  "error.auctionOnly": () => "C'est une enchère. Fais plutôt une offre.",
  "error.notAuction": () => "Cette annonce est à prix fixe.",
  "error.bidTooLow": () => "L'offre est inférieure au prix actuel.",
  "error.badPrice": () => "Saisis un prix supérieur à zéro.",
  "sales.msg.usedBoard": (p) => `J'ai vu votre message sur WebHostingTalc. Proposez-vous aussi des VPS ? Il m'en faudrait un avec ${box(p)} à ${p.city}. Combien cela coûterait-il par mois ?`,
} satisfies Dict;
