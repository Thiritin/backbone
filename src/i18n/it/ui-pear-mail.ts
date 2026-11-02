import type { Dict } from "../lang";

export default {
  "apps.about.Pear Mail": () => "Legge e invia la posta di tutti gli account che aggiungi.",
  "pearMail.build": (p) => `Pear Mail ${p.version}`,
  "pearMail.welcome.title": () => "Benvenuto in Pear Mail",
  "pearMail.welcome.add": () => "Aggiungi il tuo primo account",
  "pearMail.activity.checked": (p) => `Posta controllata per ${p.account}: ${p.count} nuovi`,
  "core.notify.newMail": () => "Nuova posta",
  "event.newMail.title": () => "Nuova posta",
  "event.newMail.text": (p) => `È arrivato un nuovo messaggio in ${p.account}.`,
  "event.newMailMore.title": () => "Nuova posta",
  "event.newMailMore.text": (p) => `Sono arrivati altri ${p.count} nuovi messaggi in ${p.account}.`,
  "error.mailNoBox": () => "Sul server non esiste una casella con questo indirizzo.",
  "error.mailAuth": () => "Il server ha rifiutato la password.",
  "error.mailExternal": () => "Il server non consente a questo programma di posta di collegarsi.",
  "error.mailDown": () => "Il server di posta non risponde.",
  "error.mailDns": () => "La posta del dominio non raggiunge questo server.",
  "error.mailClosed": () => "Questa casella è stata chiusa.",
  "error.mailPoll": () => "Il server ha rifiutato un controllo così vicino al precedente.",
} satisfies Dict;
