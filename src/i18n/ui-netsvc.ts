import type { Dict } from "./lang";

export default {
  "netsvc.deferred": (p) => `Deferred: ${p.n}`,
  "netsvc.flush": () => "Flush queue",
  "netsvc.deleteAll": () => "Delete all",
  "netsvc.queueId": () => "Queue ID",
  "netsvc.sender": () => "Sender",
  "netsvc.recipients": () => "Recipients",
  "netsvc.arrived": () => "Arrival time",
  "netsvc.reason": () => "Reason",
  "netsvc.reasonBlocked": (p) => `host ${p.mx} refused to talk to me: 554 5.7.1 Service unavailable; Client host [${p.ip}] blocked using bl.spamhouse.example`,
  "netsvc.reasonTimeout": (p) => `connect to ${p.mx}: Connection timed out`,
  "error.mailStillListed": () => "The queue stays deferred while the address is listed or the mail host is down.",
  "error.queueDeleted": () => "The queue was already deleted in the last 24 hours.",
} satisfies Dict;
