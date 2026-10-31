import type { Dict } from "../lang";

export default {
  "error.holdPayment": () => "La fattura di questo account non è ancora pagata.",
  "error.holdReason": () => "Scegli un motivo valido.",
  "error.oversellCap": () => "Questo host supererebbe il suo limite di overselling.",
  "error.licenceCap": () => "La tua licenza non consente altri account.",
  "error.licenceExpired": () => "La tua licenza è scaduta.",
  "event.updateBroke.title": () => "Aggiornamento non riuscito",
  "event.updateBroke.text": (p) => `L'aggiornamento di ${p.cluster} è andato male e i suoi clienti restano offline per qualche ora ancora.`,
} satisfies Dict;
