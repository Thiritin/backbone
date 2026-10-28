import { euroCents } from "../sim/00-core/money";

type Params = Record<string, string | number>;
const SLA: Record<string, string> = { basic: "Basic", business: "Business", premium: "Premium" };
const sla = (p: Params) => (p.sla === "basic" ? "" : ` We need the ${SLA[p.sla] ?? p.sla} SLA.`);
const price = (p: Params) => euroCents(Number(p.price));

const STUDY_NAME: Record<string, string> = {
  private: "Private individuals", gamer: "Gamers", hobbyDev: "Hobby developers", soleProp: "Sole proprietors", smallBiz: "Small businesses",
  agency: "Agencies and startups", office: "Doctor's and law offices", onlineShop: "Online shops", enterprise: "Enterprises",
};

// Sales requests, customer replies and lost-sale reasons; spread into en.
export const SALES_EN: Record<string, (p: Params) => string> = {
  "sales.msg.webHosting.0": (p) => `Hello, I am looking for a home for my website. Would ${p.plan} work for us, and what would it cost a month?${sla(p)}`,
  "sales.msg.webHosting.1": (p) => `A friend recommended you. We need ${p.plan} for our site, hosted in ${p.city} if possible.${sla(p)} What is your price?`,
  "sales.msg.vps.0": (p) => `We need a ${p.plan} with root access in ${p.city}.${sla(p)} Please send me your monthly price.`,
  "sales.msg.vps.1": (p) => `Our app has outgrown shared hosting. Can you offer a ${p.plan}?${sla(p)} Monthly billing would suit us best.`,
  "sales.msg.gameServer.0": (p) => `Our clan needs a ${p.plan} that does not lag on Friday nights. How much a month?`,
  "sales.msg.gameServer.1": (p) => `Looking for a ${p.plan} close to ${p.city} for low ping. What do you charge?`,
  "sales.msg.dedicated.0": (p) => `We are looking for a ${p.plan} in ${p.city} on a twelve-month contract.${sla(p)} Please quote a monthly price.`,
  "sales.msg.dedicated.1": (p) => `Our team wants hardware of our own. Could you provide a ${p.plan}?${sla(p)}`,
  "sales.msg.expansion": (p) => `We keep hitting the limits of our plan. What would ${p.plan} cost us a month?`,
  "sales.msg.shady": (p) => `We need ${p.plan} today. Lots of traffic, no questions, no paperwork. We pay in crypto, always on time. Name your price.`,
  "sales.msg.discount": (p) => `Your campaign mentioned ${p.discount}% off for agencies. We would like to take you up on that.`,
  "sales.reply.accept": (p) => `That works for us. Please set it up. Best, ${p.name}`,
  "sales.reply.gone": () => "We waited for the login details, but nothing came. We have signed with another host.",
  "sales.reply.counter": (p) => `That is a bit above our budget. We could do ${price(p)} a month. Let me know.`,
  "sales.reply.noBudget": (p) => `Thank you, but we do not have the budget for that. We will look for another provider. ${p.name}`,
  "sales.reply.refused": (p) => `Thanks for the offer. We have found a better deal elsewhere. ${p.name}`,
  "sales.you.quote": (p) => `We can offer this for ${price(p)} a month.`,
  "sales.you.decline": () => "Thank you for your interest. We cannot take this on at the moment.",
  "sales.need.location": (p) => `Needs a location in ${p.city}`,
  "sales.need.cluster": (p) => `Needs a cluster in ${p.city}`,
  "sales.need.server": (p) => `Needs a free server in ${p.city}`,
  "sales.need.datacenter": (p) => `Needs a datacenter location in ${p.city} for this SLA`,
  "sales.need.age": (p) => `Needs a company at least ${p.months} months old`,
  "sales.need.reviews": (p) => `Needs a review score of ${p.stars} stars or more`,
  "sales.req.location": (p) => `Location in ${p.city}`,
  "sales.req.cluster": (p) => `Cluster in ${p.city}`,
  "sales.req.server": (p) => `Free server in ${p.city}`,
  "sales.req.datacenter": (p) => `Datacenter in ${p.city}`,
  "sales.req.age": (p) => `Company at least ${p.months} months old`,
  "sales.req.reviews": (p) => `Review score of ${p.stars} stars`,
  "lost.expired": () => "No answer in time",
  "lost.price": () => "Too expensive",
  "lost.declined": () => "Declined",
  "lost.noCapacity": (p) => `No capacity in ${p.city}`,
  "event.salesRequest.title": () => "New request",
  "event.salesRequest.text": (p) => `${p.name} asks for ${p.plan}.`,
  "event.salesWon.title": () => "Deal won",
  "event.salesWon.text": (p) => `${p.name} signed for ${p.plan} at ${price(p)} a month.`,
  "event.salesFailed.title": () => "Setup failed",
  "event.salesFailed.text": (p) => `${p.plan} for ${p.name} found no room in ${p.city}. The customer went elsewhere.`,
  "event.salesCounter.title": () => "Counter-offer",
  "event.salesCounter.text": (p) => `${p.name} offers ${price(p)} a month.`,
  "event.salesRefused.title": () => "Quote refused",
  "event.salesRefused.text": (p) => `${p.name} turned down your quote.`,
  "error.unknownRequest": () => "This request is no longer open.",
  "error.quotePrice": () => "Enter a monthly price above zero.",
  "error.requestMissing": () => "You cannot serve this request yet.",
  "error.yearlyPrice": () => "Yearly products keep their price until renewal.",
  "error.unknownProfile": () => "There is no such customer group.",
  "error.studyDone": () => "You already have this study.",
  "ledger.marketStudy": (p) => `Market study by Gartnah: ${STUDY_NAME[p.profile] ?? p.profile}`,
};
