import type { Dict } from "../lang";

export default {
  "netsvc.deferred": (p) => `En attente : ${p.n}`,
  "netsvc.flush": () => "Vider la file",
  "netsvc.deleteAll": () => "Tout supprimer",
  "netsvc.queueId": () => "ID de file",
  "netsvc.sender": () => "Expéditeur",
  "netsvc.recipients": () => "Destinataires",
  "netsvc.arrived": () => "Heure d'arrivée",
  "netsvc.reason": () => "Motif",
  "netsvc.reasonBlocked": (p) => `host ${p.mx} refused to talk to me: 554 5.7.1 Service unavailable; Client host [${p.ip}] blocked using bl.spamhouse.example`,
  "netsvc.reasonTimeout": (p) => `connect to ${p.mx}: Connection timed out`,
  "error.mailStillListed": () => "La file reste en attente tant que l'adresse est listée ou que le serveur de messagerie est hors service.",
  "error.queueDeleted": () => "La file a déjà été supprimée au cours des dernières 24 heures.",
} satisfies Dict;
