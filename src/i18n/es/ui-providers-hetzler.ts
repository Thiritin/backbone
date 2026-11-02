import type { Dict } from "../lang";

export default {
  "providers.hetzler.overview": () => "Resumen",
  "providers.hetzler.robot": () => "Acceso a Rowbot",
  "providers.hetzler.colocation": () => "Colocation",
  "providers.hetzler.heroEarly": () => "Colocation en nuestros propios centros de datos",
  "providers.hetzler.textEarly": (p) => `Traiga sus propios servidores a ${p.cities}. El espacio en rack con energía y tráfico empieza en ${p.price} al mes.`,
  "providers.hetzler.vat": () => "Todos los precios son mensuales e incluyen IVA. Las facturas se cargan por domiciliación el día uno de cada mes.",
  "providers.hetzler.heroLate": () => "Su hardware en nuestros centros de datos",
  "providers.hetzler.textLate": (p) => `Espacio en rack en ${p.cities} con energía, refrigeración y conectividad redundante.`,
  "providers.hetzler.from": (p) => `desde ${p.price} al mes`,
  "providers.hetzler.orderNow": () => "Contratar ahora",
  "providers.hetzler.footer": (p) => `© ${p.year} Hetzler Online GmbH, Gunzenhausen`,
} satisfies Dict;
