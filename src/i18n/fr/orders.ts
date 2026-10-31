import { euroCents } from "../../sim/00-core/money";
import type { Dict } from "../lang";

export default {
  "ticket.order.webHosting.subject": (p) => (p.domain ? `Commande : hébergement pour ${p.domain}` : "Commande : hébergement web"),
  "ticket.order.vps.subject": () => "Commande : VPS",
  "ticket.order.gameServer.subject": () => "Commande : serveur de jeu",
  "ticket.order.gpu.subject": () => "Commande : serveur GPU",
  "outcome.accepted": () => "Commande acceptée",
  "outcome.declined": () => "Commande refusée",
  "outcome.failed": () => "Échec de la mise en place",
  "error.orderNotOffered": () => "Tu ne proposes pas ce produit dans cette ville.",
  "event.order.title": () => "Nouvelle commande",
  "event.order.text": (p) => `${p.name} commande ${p.spec}.`,
  "event.certificateSold.title": () => "Certificat SSL vendu",
  "event.certificateSold.text": (p) => `${p.name} a commandé un certificat SSL pour ${p.domain}.`,
  "event.orderPlaced.title": () => "Nouvelle commande",
  "event.orderPlaced.text": (p) => `${p.name} a commandé via le formulaire de commande à ${euroCents(Number(p.price))} par mois : ${p.spec}.`,
  "event.orderQuoted.title": () => "Devis envoyé",
  "event.orderQuoted.text": (p) => `L'automatisation a envoyé à ${p.name} un devis de ${euroCents(Number(p.price))} par mois pour ${p.spec}.`,
  "event.orderFailed.title": () => "Échec de la mise en place",
  "event.orderFailed.text": (p) => `La commande de ${p.name} n'a pas pu être mise en place, et le client est allé voir ailleurs. Il s'agissait de ${p.spec}.`,
} satisfies Dict;
