import { euro, euroCents } from "../sim/00-core/money";

type Params = Record<string, string | number>;
const CHANNEL: Record<string, string> = { ebuy: "eBuy", board: "WebHostingTalc", chat: "Telegrump" };
const box = (p: Params) => `${p.cpu} vCPU${Number(p.cpu) === 1 ? "" : "s"}, ${p.ram} GB of RAM and ${p.disk} GB of disk`;

// The used hardware market; spread into en.
export const USED_EN: Record<string, (p: Params) => string> = {
  "event.usedScam.title": () => "Seller vanished",
  "event.usedScam.text": (p) => `The ${p.seller} seller of the ${p.model} kept your ${euro(Number(p.price))} and blocked you. Nothing will arrive.`,
  "event.usedWon.title": () => "Auction won",
  "event.usedWon.text": (p) => `You won the ${p.model} on eBuy for ${euro(Number(p.price))}. It ships to ${p.location}.`,
  "event.usedOutbid.title": () => "Auction lost",
  "event.usedOutbid.text": (p) => `Someone outbid you on the ${p.model} on eBuy.`,
  "event.usedOutbidNow.title": () => "Outbid",
  "event.usedOutbidNow.text": (p) => `Someone bid ${euro(Number(p.price))} on the ${p.model} on eBuy, above your maximum.`,
  "event.usedUnpaid.title": () => "Auction lost",
  "event.usedUnpaid.text": (p) => `You won the ${p.model} on eBuy but could not pay ${euro(Number(p.price))}, so it went to the next bidder.`,
  "event.usedSold.title": (p) => `${p.device} sold`,
  "event.usedSold.text": (p) => `A buyer on ${p.channel} paid ${euroCents(Number(p.price))} for ${p.device}.`,
  "event.usedExpired.title": () => "Listing expired",
  "event.usedExpired.text": (p) => `Nobody bought ${p.device} on ${p.channel}. It is back in storage.`,
  "event.news.used.lot.title": (p) => `Hoster goes bust, ${p.count} servers for sale`,
  "event.news.used.lot.text": (p) => `Handelsblah reports that a hoster near you went bust. Its ${p.count} servers are on WebHostingTalc as one lot.`,
  "event.news.used.clearance.title": () => "Datacenter clearance weekend",
  "event.news.used.clearance.text": (p) => `Handelsblah reports that a datacenter is clearing out. ${p.count} lots are on eBuy until Sunday evening.`,
  "ledger.usedBuy": (p) => `Used ${Number(p.qty) > 1 ? `${p.qty} × ` : ""}${p.model} from ${CHANNEL[p.channel] ?? p.channel}`,
  "ledger.usedSale": (p) => `Sold ${p.device} on ${p.channel}${Number(p.fee) ? `, ${euroCents(Number(p.fee))} fee` : ""}`,
  "error.listingGone": () => "The listing is gone.",
  "error.auctionOnly": () => "This is an auction. Place a bid instead.",
  "error.notAuction": () => "This listing has a fixed price.",
  "error.bidTooLow": () => "The bid is below the current price.",
  "error.badPrice": () => "Enter a price above zero.",
  "sales.msg.usedBoard": (p) => `I saw your post on WebHostingTalc. Do you also do VPS? I would need one with ${box(p)} in ${p.city}. What would that cost per month?`,
};
