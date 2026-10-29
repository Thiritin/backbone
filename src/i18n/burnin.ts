import { euro } from "../sim/00-core/money";

type Params = Record<string, string | number>;

// Burn-in tests and used-market buyer protection; spread into en.
export const BURNIN_EN: Record<string, (p: Params) => string> = {
  "event.burninQuick.title": () => "Quick burn-in finished",
  "event.burninQuick.text": (p) => `${p.device} finished a quick burn-in and has ${p.found} worn ${Number(p.found) === 1 ? "part" : "parts"}.`,
  "event.burninFull.title": () => "Full burn-in finished",
  "event.burninFull.text": (p) => (Number(p.found) ? `${p.device} finished a full burn-in and ${p.found} ${Number(p.found) === 1 ? "part" : "parts"} failed.` : `${p.device} passed a full burn-in.`),
  "event.burninAborted.title": () => "Burn-in aborted",
  "event.burninAborted.text": (p) => `${p.device} lost power during its burn-in.`,
  "event.usedRefund.title": () => "Buyer protection paid out",
  "event.usedRefund.text": (p) => `A part of ${p.device} failed within 14 days of the purchase and ${euro(Number(p.amount))} came back.`,
  "ledger.usedRefund": (p) => `Buyer protection refund for ${p.device}`,
  "error.burninNoServer": () => "Only a racked server can be burned in.",
  "error.burninRunning": () => "A burn-in is already running.",
  "error.burninNoPower": () => "The server needs to be running with power.",
  "error.burninTaken": () => "The server is in use.",
};
