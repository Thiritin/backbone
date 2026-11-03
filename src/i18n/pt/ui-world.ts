import type { Dict } from "../lang";

export default {
  "world.standUp": () => "Levantar-se",
  "world.room": () => "Sala",
  "world.you": () => "Tu",
  "world.obj.pc": () => "Computador",
  "world.obj.desk": () => "Secretária",
  "world.obj.scanner": () => "Scanner",
  "world.obj.door": () => "Porta",
  "world.obj.letterbox": () => "Caixa do correio",
  "world.obj.shelf": () => "Prateleira do armazém",
  "world.obj.fusebox": () => "Quadro elétrico",
  "world.obj.fan": () => "Ventoinha da janela",
  "world.obj.xconnect": () => "Painel de cross-connect",
  "world.obj.cooling": () => "Unidade de refrigeração",
  "world.obj.pdu": () => "PDU",
  "world.obj.extinguisher": () => "Extintor",
  "world.obj.noc": () => "Posto NOC",
  "world.obj.dock": () => "Doca de carga",
  "world.inHands": () => "Nas tuas mãos",
  "world.obj.parcels": (p) => `${p.n} encomendas`,
} satisfies Dict;
