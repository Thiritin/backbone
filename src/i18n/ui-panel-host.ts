import type { Dict } from "./lang";

export default {
  "error.holdPayment": () => "The invoice for this account is still unpaid.",
  "error.holdReason": () => "Choose a valid reason.",
  "error.oversellCap": () => "This host would exceed its oversell cap.",
  "error.licenceCap": () => "Your license does not allow more accounts.",
  "error.licenceExpired": () => "Your license has expired.",
  "event.updateBroke.title": () => "Update failed",
  "event.updateBroke.text": (p) => `The update of ${p.cluster} went wrong and its customers stay offline for a few more hours.`,
} satisfies Dict;
