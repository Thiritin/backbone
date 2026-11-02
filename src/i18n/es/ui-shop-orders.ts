import type { Dict } from "../lang";

export default {
  "shop-orders.any": () => "Todos",
  "shop-orders.number": () => "Pedido n.º",
  "shop-orders.payment": () => "Estado del pago",
  "shop-orders.invoice": () => "Factura n.º",
  "shop-orders.fraud": () => "Marcar como fraude",
  "error.unknownOrder": () => "Este pedido no existe.",
  "error.orderNotPending": () => "Este pedido ya no está pendiente.",
  "error.noShopModule": () => "La tienda no tiene módulo para este servidor.",
  "error.manualProduct": () => "Este producto no tiene grupo de servidores.",
  "error.orderInvoiced": () => "Este pedido ya se está configurando a mano en Soporte.",
} satisfies Dict;
