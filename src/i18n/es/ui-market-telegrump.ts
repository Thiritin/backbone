import type { Dict } from "../lang";

export default {
  "tg.wts": () => "VENDO",
  "tg.topic": (p) => `Ofertas: ${p.n}`,
  "tg.talking": (p) => `Ahora hablas en ${p.channel}`,
  "tg.users": (p) => `${p.n} ${Number(p.n) === 1 ? "usuario" : "usuarios"}`,
  "tg.send": () => "Enviar",
  "tg.notFound": () => "Mensaje no encontrado",
  "tg.max": () => "Precio máx.",
  "tg.sort": () => "Ordenar",
  "tg.cmdSearch": () => "/buscar",
  "tg.cmdMax": () => "/max",
} satisfies Dict;
