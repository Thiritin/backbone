import type { Dict } from "../lang";

export default {
  "error.holdPayment": () => "Die Rechnung für dieses Konto ist noch offen.",
  "error.holdReason": () => "Wähle einen gültigen Grund.",
  "error.oversellCap": () => "Dieser Host würde seine Überbuchungsgrenze überschreiten.",
  "error.licenceCap": () => "Deine Lizenz erlaubt keine weiteren Konten.",
  "error.licenceExpired": () => "Deine Lizenz ist abgelaufen.",
  "event.updateBroke.title": () => "Update fehlgeschlagen",
  "event.updateBroke.text": (p) => `Das Update von ${p.cluster} ist schiefgegangen, die Kunden bleiben noch einige Stunden offline.`,
} satisfies Dict;
