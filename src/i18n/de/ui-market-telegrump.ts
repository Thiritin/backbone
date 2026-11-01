import type { Dict } from "../lang";

export default {
  "tg.wts": () => "VK",
  "tg.topic": (p) => `Angebote: ${p.n}`,
  "tg.talking": (p) => `Du bist jetzt in ${p.channel}`,
  "tg.users": (p) => `${p.n} Nutzer`,
  "tg.send": () => "Senden",
  "tg.notFound": () => "Nachricht nicht gefunden",
  "tg.max": () => "Höchstpreis",
  "tg.sort": () => "Sortieren",
  "tg.cmdSearch": () => "/suche",
  "tg.cmdMax": () => "/max",
} satisfies Dict;
