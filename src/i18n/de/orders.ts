import { euroCents } from "../../sim/00-core/money";
import type { Dict } from "../lang";

export default {
  "ticket.order.webHosting.subject": (p) => (p.domain ? `Bestellung: Hosting für ${p.domain}` : "Bestellung: Webhosting"),
  "ticket.order.vps.subject": () => "Bestellung: vServer (VPS)",
  "ticket.order.gameServer.subject": () => "Bestellung: Gameserver",
  "ticket.order.gpu.subject": () => "Bestellung: GPU-Server",
  "outcome.accepted": () => "Bestellung angenommen",
  "outcome.declined": () => "Bestellung abgelehnt",
  "outcome.failed": () => "Einrichtung fehlgeschlagen",
  "error.orderNotOffered": () => "Du bietest dieses Produkt in dieser Stadt nicht an.",
  "event.order.title": () => "Neue Bestellung",
  "event.order.text": (p) => `${p.name} bestellt ${p.spec}.`,
  "event.certificateSold.title": () => "SSL-Zertifikat verkauft",
  "event.certificateSold.text": (p) => `${p.name} hat ein SSL-Zertifikat für ${p.domain} bestellt.`,
  "event.orderPlaced.title": () => "Neue Bestellung",
  "event.orderPlaced.text": (p) => `${p.name} hat im Shop für ${euroCents(Number(p.price))} im Monat bestellt: ${p.spec}.`,
  "event.orderQuoted.title": () => "Angebot erstellt",
  "event.orderQuoted.text": (p) => `Die Automatisierung hat ${p.name} ein Angebot über ${euroCents(Number(p.price))} im Monat für ${p.spec} geschickt.`,
  "event.orderFailed.title": () => "Einrichtung fehlgeschlagen",
  "event.orderFailed.text": (p) => `Die Bestellung von ${p.name} konnte nicht eingerichtet werden, und der Kunde ist woanders hin. Es ging um ${p.spec}.`,
  "event.orderDeclined.title": () => "Bestellung abgelehnt",
  "event.orderDeclined.text": (p) => `Die Bestellung von ${p.name} wurde bei der Prüfung abgelehnt.`,
} satisfies Dict;
