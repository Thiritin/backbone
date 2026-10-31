import type { Dict } from "../lang";

export default {
  "error.holdPayment": () => "La facture de ce compte n'est pas encore payée.",
  "error.holdReason": () => "Choisis un motif valide.",
  "error.oversellCap": () => "Cet hôte dépasserait sa limite de survente.",
  "error.licenceCap": () => "Ta licence n'autorise pas d'autres comptes.",
  "error.licenceExpired": () => "Ta licence a expiré.",
  "event.updateBroke.title": () => "Échec de la mise à jour",
  "event.updateBroke.text": (p) => `La mise à jour de ${p.cluster} a mal tourné et ses clients restent hors ligne quelques heures de plus.`,
} satisfies Dict;
