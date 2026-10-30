type Params = Record<string, string | number>;

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const clock = (h: unknown) => `${String(h).padStart(2, "0")}:00`;

// Migration offers: the ticket, the customer's answers, the events and the errors (gdd.md, Support).
export const MOVES_EN: Record<string, (p: Params) => string> = {
  "ticket.migration.offer.subject": (p) => `Moving ${p.hostname || p.service} to ${p.target}`,
  "ticket.migration.offer.text": (p) => `We would like to move ${p.hostname || p.service} to ${p.target}. Please let us know whether you agree.`,
  "ticket.migration.accept.text": (p) => `Fine with me. Please do it on ${DAYS[Number(p.day)]} between ${clock(p.from)} and ${clock(p.to)}.`,
  "ticket.migration.acceptAny.text": () => "Fine with me. Go ahead whenever it suits you.",
  "ticket.migration.decline.text": () => "I would rather keep everything as it is.",
  "ticket.migration.missed.text": () => "The move never happened. I am not happy about this.",
  "outcome.moved": () => "Moved",
  "outcome.moveDeclined": () => "Declined",
  "event.moveAccepted.title": () => "Move accepted",
  "event.moveAccepted.text": (p) => `${p.name} agreed to the move of ${p.service}.`,
  "event.moveDeclined.title": () => "Move declined",
  "event.moveDeclined.text": (p) => `${p.name} turned down the move of ${p.service}.`,
  "event.moveWindow.title": () => "Move window open",
  "event.moveWindow.text": (p) => `${p.name} expects ${p.service} to be moved until ${clock(p.to)}.`,
  "event.moveDone.title": () => "Service moved",
  "event.moveDone.text": (p) => `${p.service} of ${p.name} moved to ${p.target}.`,
  "event.moveMissed.title": () => "Move missed",
  "event.moveMissed.text": (p) => `The move of ${p.service} of ${p.name} did not run.`,
  "error.moveOffered": () => "This service has a move offer waiting for an answer.",
  "error.moveTarget": () => "This service cannot move there.",
  "ledger.moveServer": (p) => `Moving ${p.device} to ${p.location}`,
  "error.moveServerOnly": () => "Only a server moves with its workloads.",
  "error.locationNotReady": () => "The location is not ready yet.",
  "error.clusterSpans": () => "The cluster runs on more servers than this one.",
};
