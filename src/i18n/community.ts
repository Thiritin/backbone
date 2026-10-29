type Params = Record<string, string | number>;

const ITEM: Record<string, [string, string]> = {
  gameServer: ["game server", "game servers"], vps: ["VPS", "VPS"], storage: ["storage volume", "storage volumes"], webHosting: ["web space", "web spaces"],
};
const what = (p: Params) => {
  const [one, many] = ITEM[String(p.product)];
  const size = p.product === "storage" || p.product === "webHosting" ? `${p.diskGb} GB of disk` : `${p.vcpu} vCPU and ${p.ramGb} GB of RAM`;
  return `${p.count} ${Number(p.count) === 1 ? one : many} with ${size} each`;
};
const span = (p: Params) => ({ 3: "the weekend", 7: "a week", 90: "three months", 365: "a year" })[Number(p.days) as 3] ?? `${p.days} days`;
const plural = (n: unknown, one: string, many: string) => (Number(n) === 1 ? one : many);

// Sponsoring requests: the emails, the events and the outcomes (gdd.md, Marketing and reviews).
export const COMMUNITY_EN: Record<string, (p: Params) => string> = {
  "ticket.sponsor.lanTastic.subject": (p) => `${p.event} needs servers`,
  "ticket.sponsor.lanTastic.text": (p) => `Hi, we run ${p.event}, the biggest LAN party in the county, and last year the servers lagged harder than our players. Could you sponsor ${what(p)} for ${span(p)}? Your logo goes on the big screen between the pizza breaks.`,
  "ticket.sponsor.chaosClub.subject": (p) => `${p.event} meetup`,
  "ticket.sponsor.chaosClub.text": (p) => `We meet every Thursday to take things apart that were working fine. A host to run our tools on would help: ${what(p)} for ${span(p)}. We cannot pay, but we will tell you what we find.`,
  "ticket.sponsor.hackASorus.subject": (p) => `${p.event} hackathon`,
  "ticket.sponsor.hackASorus.text": (p) => `Forty developers, one weekend, too little sleep. We need ${what(p)} for ${span(p)} to run the entries. Nothing is deployed to production, and whatever we break stays in the sandbox.`,
  "ticket.sponsor.mirror.subject": (p) => `Mirror for ${p.event}`,
  "ticket.sponsor.mirror.text": (p) => `Our distribution is looking for a mirror close to its users. We would need ${what(p)} for ${span(p)}. Your company will be listed on our mirror page, between a university and a man called Gerhard.`,
  "ticket.sponsor.fragFest.subject": (p) => `${p.event} tournament`,
  "ticket.sponsor.fragFest.text": (p) => `The finals of ${p.event} are coming and the old servers are held together by cable ties. We are looking for ${what(p)} for ${span(p)}. The sponsor name is read out before every match, so please do not go down.`,
  "ticket.sponsor.userGroup.subject": (p) => `Website of the ${p.event}`,
  "ticket.sponsor.userGroup.text": (p) => `Our group has met since the nineties and our website has lived in a member's cellar for most of them. Could you give us ${what(p)} for ${span(p)}? We will list you as our sponsor, right under the meeting minutes.`,
  "ticket.sponsor.devOops.subject": (p) => `${p.event} streaming`,
  "ticket.sponsor.devOops.text": (p) => `We expect two thousand attendees and a keynote that cannot buffer. We need ${what(p)} for ${span(p)} to stream the talks. The speakers will mention you at least once, usually by accident.`,
  "outcome.sponsored": () => "Sponsorship accepted",
  "outcome.sponsorDeclined": () => "Sponsorship declined",
  "review.sponsor.bad": () => "Their logo was on the big screen and their servers were not.",
  "review.sponsor.ok": () => "A sponsor that showed up. Mostly.",
  "review.sponsor.good": () => "Free servers that stayed up all weekend. We will remember this.",
  "event.sponsorRequest.title": () => "Sponsoring request",
  "event.sponsorRequest.text": (p) => `${p.event} asks for a sponsor.`,
  "event.sponsorDone.title": (p) => `${p.event} is over`,
  "event.sponsorDone.text": (p) => {
    const gains = [
      Number(p.knowHow) > 0 && `${p.knowHow} know-how`,
      Number(p.awareness) > 0 && `${p.awareness}% more awareness`,
      Number(p.leads) > 0 && `${p.leads} ${plural(p.leads, "lead", "leads")}`,
      Number(p.stars) > 0 && `a ${p.stars}-star review`,
      Number(p.recommendation) > 0 && "a recommendation for a skilled hire",
    ].filter(Boolean);
    return `The servers for ${p.event} stayed up. You gained ${gains.length ? gains.join(", ") : "a thank you"}.`;
  },
  "event.sponsorFailed.title": (p) => `${p.event} went wrong`,
  "event.sponsorFailed.text": (p) => `The servers for ${p.event} were down for ${p.hours} ${plural(p.hours, "hour", "hours")}. Two bad reviews were posted and your awareness dropped.`,
};
