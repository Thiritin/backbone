type Params = Record<string, string | number>;

const again = (p: Params) => (Number(p.round) > 1 ? "This is our second notice, and the content is still online. " : "");
const second = (p: Params, subject: string) => (Number(p.round) > 1 ? `Second notice: ${subject}` : subject);
const host = (p: Params) => String(p.url).replace(/^https:\/\/([^/]+).*$/, "$1");
export const duration = (minutes: number): string =>
  minutes < 60 ? `${minutes} min` : minutes % 60 ? `${Math.floor(minutes / 60)} h ${minutes % 60} min` : `${minutes / 60} h`;

// Notices, legal requests, refunds and incidents.
export const OPS: Record<string, (p: Params) => string> = {
  "ticket.notice.movie.subject": (p) => second(p, `Copyright infringement at ${host(p)}`),
  "ticket.notice.movie.text": (p) => `${again(p)}On behalf of ${p.sender} we have found an unlicensed copy of one of our films at ${p.url}. Remove it without delay.`,
  "ticket.notice.music.subject": (p) => second(p, `Pirated music at ${host(p)}`),
  "ticket.notice.music.text": (p) => `${again(p)}${p.sender} owns the rights to the recordings offered for download at ${p.url}. Remove them without delay.`,
  "ticket.notice.youtuber.subject": (p) => second(p, `Take down ${host(p)} NOW`),
  "ticket.notice.youtuber.text": (p) =>
    `${again(p)}TechTimo here, 2.3 million subscribers. The page at ${p.url} calls my video ${p.video} the worst unboxing of the year. That is defamation and probably copyright too. Delete the whole site today.`,
  "ticket.notice.phishing.subject": (p) => second(p, `Phishing page at ${host(p)}`),
  "ticket.notice.phishing.text": (p) => `${again(p)}The page at ${p.url} imitates the online banking login of ${p.sender} and collects our customers' passwords. Take it offline.`,
  "ticket.notice.spam.subject": (p) => second(p, `Spam advertising ${host(p)}`),
  "ticket.notice.spam.text": (p) => `${again(p)}Your network sent 48,000 spam mails in the last hour, all of them linking to ${p.url}. Stop the sender, or we list your address range.`,
  "ticket.legal.data.subject": (p) => (Number(p.round) > 1 ? `Court order: data for ${host(p)}` : `Request for customer data: ${host(p)}`),
  "ticket.legal.data.text": (p) => Number(p.round) > 1
    ? `A court has ordered the release of all subscriber records and logs for ${p.url}. Answer before the deadline, or officers will collect the hardware in person.`
    : `As part of an investigation we request the subscriber records, access logs and payment details for ${p.url}. Answer before the deadline.`,
  "ticket.legal.takedown.subject": (p) => (Number(p.round) > 1 ? `Court order: take down ${host(p)}` : `Takedown order: ${host(p)}`),
  "ticket.legal.takedown.text": (p) => Number(p.round) > 1
    ? `A court has ordered ${p.url} offline. Answer before the deadline, or officers will collect the hardware in person.`
    : `The content at ${p.url} is subject to an investigation. Take it offline and confirm before the deadline.`,
  "ticket.refund.outage.subject": () => "Refund for the outage",
  "ticket.refund.outage.text": () => "Our site was offline for hours. We pay for hosting that works, so we expect this month's fee back.",
  "ticket.refund.dataLoss.subject": () => "All our data is gone",
  "ticket.refund.dataLoss.text": () => "Everything we had on your server has disappeared. We want this month's fee back, and an explanation.",
  "outcome.forwarded": () => "Forwarded to the customer",
  "outcome.takenDown": () => "Content taken down",
  "outcome.rejected": () => "Notice rejected",
  "outcome.ignored": () => "Ignored",
  "outcome.complied": () => "Request complied with",
  "outcome.objected": () => "Objection sent",
  "outcome.seized": () => "Deadline missed, server seized",
  "outcome.refunded": () => "One month refunded",
  "outcome.refused": () => "Refund refused",
  "ledger.refund": (p) => `Refund for ${p.customer}`,
  "error.notHosted": () => "No customer uses this domain.",
  "event.gridDark.title": () => "Power outage",
  "event.gridDark.text": (p) => `${p.location} was without power for ${duration(Number(p.minutes))}.`,
  "event.gridCarried.title": () => "Grid outage",
  "event.gridCarried.text": (p) => `${p.location} stayed online through a ${duration(Number(p.minutes))} grid outage.`,
  "event.seized.title": () => "Server seized",
  "event.seized.text": (p) => `${p.agency} took ${p.device} from ${p.location}.`,
  "event.seizedBack.title": () => "Server returned",
  "event.seizedBack.text": (p) => `${p.device} is back in storage at ${p.location}.`,
  "review.outage.bad": () => "Offline for hours and not a word from them. Never again.",
  "review.outage.ok": () => "There was an outage, but they sorted it out.",
  "review.outage.good": () => "Even the one outage was handled well.",
  "review.dataLoss.bad": () => "They lost every file we had. Keep your own backups.",
  "review.dataLoss.ok": () => "They lost our data but paid us back. Mixed feelings.",
  "review.dataLoss.good": () => "Data gone, but they made it right.",
};
