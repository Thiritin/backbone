import type { Dict } from "../lang";

export default {
  "tg.wts": () => "VENDO",
  "tg.topic": (p) => `Ofertas: ${p.n}`,
  "tg.talking": (p) => `Agora você está em ${p.channel}`,
  "tg.users": (p) => `${p.n} ${Number(p.n) === 1 ? "usuário" : "usuários"}`,
  "tg.send": () => "Enviar",
  "tg.notFound": () => "Mensagem não encontrada",
  "tg.max": () => "Preço máx.",
  "tg.sort": () => "Ordenar",
  "tg.cmdSearch": () => "/buscar",
  "tg.cmdMax": () => "/max",
} satisfies Dict;
