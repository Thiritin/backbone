import type { Dict } from "../lang";

export default {
  "mailswitch.title": () => "Noch bei diesem Anbieter",
  "mailswitch.mail": (p) => (Number(p.n) === 1 ? "1 Nachricht wurde beim neuen Anbieter noch nicht importiert." : `${p.n} Nachrichten wurden beim neuen Anbieter noch nicht importiert.`),
  "mailswitch.roles": () => "Ein Postfach hier ist noch das Hauptpostfach oder empfängt Vertriebs-, Support- oder Abuse-Mails.",
  "mailswitch.collectors": (p) => (Number(p.n) === 1 ? "1 Postfach ruft noch E-Mails von hier ab." : `${p.n} Postfächer rufen noch E-Mails von hier ab.`),
  "mailswitch.source": () => "Bisherige Adresse",
  "mailswitch.password": () => "Passwort",
  "mailswitch.target": () => "In Postfach",
  "mailswitch.start": () => "Import starten",
  "mailswitch.from": () => "Von",
  "mailswitch.to": () => "Nach",
  "mailswitch.status": () => "Status",
  "mailswitch.running": (p) => `Läuft bis ${p.date}`,
  "mailswitch.done": (p) => (Number(p.n) === 1 ? "1 Nachricht importiert" : `${p.n} Nachrichten importiert`),
} satisfies Dict;
