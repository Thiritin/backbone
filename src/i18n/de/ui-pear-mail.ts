import type { Dict } from "../lang";

export default {
  "apps.about.Pear Mail": () => "Liest und sendet die E-Mails aller Accounts, die du hinzufügst.",
  "pearMail.build": (p) => `Pear Mail ${p.version}`,
  "pearMail.welcome.title": () => "Willkommen bei Pear Mail",
  "pearMail.welcome.add": () => "Ersten Account hinzufügen",
  "pearMail.activity.checked": (p) => `E-Mails für ${p.account} geprüft: ${p.count} neu`,
  "core.notify.newMail": () => "Neue E-Mails",
  "event.newMail.title": () => "Neue E-Mail",
  "event.newMail.text": (p) => `Eine neue E-Mail ist in ${p.account} eingetroffen.`,
  "event.newMailMore.title": () => "Neue E-Mails",
  "event.newMailMore.text": (p) => `${p.count} weitere neue E-Mails sind in ${p.account} eingetroffen.`,
  "error.mailNoBox": () => "Auf dem Server gibt es kein Postfach mit dieser Adresse.",
  "error.mailAuth": () => "Der Server hat das Kennwort abgelehnt.",
  "error.mailExternal": () => "Der Server lässt dieses E-Mail-Programm nicht zu.",
  "error.mailDown": () => "Der E-Mail-Server antwortet nicht.",
  "error.mailDns": () => "Die E-Mails der Domain erreichen diesen Server nicht.",
  "error.mailClosed": () => "Dieses Postfach wurde geschlossen.",
  "error.mailPoll": () => "Der Server hat eine Abfrage so kurz nach der letzten abgelehnt.",
} satisfies Dict;
