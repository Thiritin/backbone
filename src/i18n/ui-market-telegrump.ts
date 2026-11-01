import type { Dict } from "./lang";

export default {
  "tg.wts": () => "WTS",
  "tg.topic": (p) => `Offers: ${p.n}`,
  "tg.talking": (p) => `Now talking in ${p.channel}`,
  "tg.users": (p) => `${p.n} ${Number(p.n) === 1 ? "user" : "users"}`,
  "tg.send": () => "Send",
  "tg.notFound": () => "Message not found",
  "tg.max": () => "Max price",
  "tg.sort": () => "Sort",
  "tg.cmdSearch": () => "/search",
  "tg.cmdMax": () => "/max",
} satisfies Dict;
