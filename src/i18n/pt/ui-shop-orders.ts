import type { Dict } from "../lang";

export default {
  "shop-orders.any": () => "Todos",
  "shop-orders.number": () => "Pedido n.º",
  "shop-orders.payment": () => "Estado do pagamento",
  "shop-orders.invoice": () => "Fatura n.º",
  "shop-orders.fraud": () => "Marcar como fraude",
  "error.unknownOrder": () => "Este pedido não existe.",
  "error.orderNotPending": () => "Este pedido já não está pendente.",
  "error.noShopModule": () => "A loja não tem módulo para este servidor.",
  "error.manualProduct": () => "Este produto não tem grupo de servidores.",
  "error.orderInvoiced": () => "Este pedido já está a ser configurado à mão no Suporte.",
} satisfies Dict;
