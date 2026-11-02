import type { Dict } from "../lang";

export default {
  "mailswitch.title": () => "Ancora presso questo provider",
  "mailswitch.mail": (p) => (Number(p.n) === 1 ? "1 messaggio non è stato importato presso il nuovo provider." : `${p.n} messaggi non sono stati importati presso il nuovo provider.`),
  "mailswitch.roles": () => "Una casella qui è ancora la casella principale o riceve la posta di vendite, supporto o abusi.",
  "mailswitch.collectors": (p) => (Number(p.n) === 1 ? "1 casella scarica ancora la posta da qui." : `${p.n} caselle scaricano ancora la posta da qui.`),
  "mailswitch.source": () => "Indirizzo precedente",
  "mailswitch.password": () => "Password",
  "mailswitch.target": () => "Nella casella",
  "mailswitch.start": () => "Avvia importazione",
  "mailswitch.from": () => "Da",
  "mailswitch.to": () => "A",
  "mailswitch.status": () => "Stato",
  "mailswitch.running": (p) => `In corso fino al ${p.date}`,
  "mailswitch.done": (p) => (Number(p.n) === 1 ? "1 messaggio importato" : `${p.n} messaggi importati`),
} satisfies Dict;
