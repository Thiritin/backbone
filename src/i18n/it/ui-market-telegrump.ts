import type { Dict } from "../lang";

export default {
  "tg.wts": () => "VENDO",
  "tg.topic": (p) => `Offerte: ${p.n}`,
  "tg.talking": (p) => `Ora stai parlando in ${p.channel}`,
  "tg.users": (p) => `${p.n} ${Number(p.n) === 1 ? "utente" : "utenti"}`,
  "tg.send": () => "Invia",
  "tg.notFound": () => "Messaggio non trovato",
  "tg.max": () => "Prezzo max",
  "tg.sort": () => "Ordina",
  "tg.cmdSearch": () => "/cerca",
  "tg.cmdMax": () => "/max",
} satisfies Dict;
