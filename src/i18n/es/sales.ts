import { euroCents } from "../../sim/00-core/money";
import type { Dict, Params } from "../lang";

const SLA: Record<string, string> = { basic: "Basic", business: "Business", premium: "Premium" };
const sla = (p: Params) => (p.sla === "basic" ? "" : ` Necesitamos el SLA ${SLA[p.sla] ?? p.sla}.`);
const price = (p: Params) => euroCents(Number(p.price));
const web = (p: Params) => `${p.disk} GB de espacio y ${p.mail} ${Number(p.mail) === 1 ? "buzón" : "buzones"}`;
const cards = (p: Params) => `${p.gpu} GPU`;
const box = (p: Params) => `${p.cpu} vCPU, ${p.ram} GB de RAM y ${p.disk} GB de disco`;

const STUDY_NAME: Record<string, string> = {
  private: "Particulares", gamer: "Jugadores", hobbyDev: "Desarrolladores aficionados", soleProp: "Autónomos", smallBiz: "Pequeñas empresas",
  agency: "Agencias y startups", office: "Consultas médicas y despachos de abogados", onlineShop: "Tiendas online", enterprise: "Grandes empresas",
};

export default {
  "request.use.private": () => "Es solo una web personal pequeña, así que nunca hay prisa.",
  "request.use.gamer": () => "Jugamos casi todas las tardes y todo el fin de semana, así que tiene que funcionar entonces.",
  "request.use.hobbyDev": () => "Es un proyecto personal con el que trasteo cuando encuentro tiempo.",
  "request.use.soleProp": () => "Los clientes me encuentran por la web, y la miro cada pocos días.",
  "request.use.smallBiz": () => "Nuestro equipo trabaja con ella cada día en horario de oficina.",
  "request.use.agency": () => "Nuestros clientes la usan todo el día, así que vemos los problemas enseguida.",
  "request.use.office": () => "Los pacientes reservan sus citas por ahí cada mañana.",
  "request.use.onlineShop": () => "Los pedidos entran las 24 horas, y cada minuto sin conexión nos cuesta dinero.",
  "request.use.enterprise": () => "Nuestra plantilla depende de ella las 24 horas.",
  "sales.msg.webHosting.0": (p) => `Hola, busco un hogar para ${p.domain || "mi sitio web"}: unos ${web(p)}. ¿Cuánto costaría al mes?${sla(p)}`,
  "sales.msg.webHosting.1": (p) => `Un amigo te ha recomendado. Necesitamos ${web(p)} para ${p.domain || "nuestro sitio"}, alojado en ${p.city} si es posible.${sla(p)} ¿Cuál es tu precio?`,
  "sales.msg.vps.0": (p) => `Necesitamos un VPS con ${box(p)} y acceso root en ${p.city}.${sla(p)} Por favor, envíame tu precio mensual.`,
  "sales.msg.vps.1": (p) => `Nuestra aplicación se ha quedado pequeña para el hosting compartido. ¿Puedes ofrecer un VPS con ${box(p)}?${sla(p)} Nos vendría mejor la facturación mensual.`,
  "sales.msg.gameServer.0": (p) => `Nuestro clan necesita un servidor de juegos con ${box(p)} que no vaya con lag los viernes por la noche. ¿Cuánto cuesta al mes?`,
  "sales.msg.gameServer.1": (p) => `Buscamos un servidor de juegos con ${box(p)} cerca de ${p.city} para tener poco ping. ¿Cuánto cobras?`,
  "sales.msg.dedicated.0": (p) => `Buscamos un servidor dedicado con al menos ${p.ram} GB de RAM en ${p.city} con un contrato de doce meses.${sla(p)} Por favor, indícanos un precio mensual.`,
  "sales.msg.dedicated.1": (p) => `Nuestro equipo quiere hardware propio. ¿Podrías proporcionar un servidor con al menos ${p.ram} GB de RAM?${sla(p)}`,
  "sales.msg.gpu.0": (p) => `Estamos entrenando modelos y necesitamos ${cards(p)} con ${box(p)} en ${p.city}.${sla(p)} ¿Cuánto costaría al mes?`,
  "sales.msg.gpu.1": (p) => `Nuestro equipo necesita servidores GPU para renderizado e inferencia: ${cards(p)}, ${box(p)}.${sla(p)} Por favor, envíanos tu precio mensual.`,
  "sales.msg.shady": (p) => `Necesitamos hoy un VPS con ${box(p)}. Mucho tráfico, sin preguntas, sin papeleo. Pagamos en cripto, siempre puntuales. Di tu precio.`,
  "sales.msg.discount": (p) => `Tu campaña hablaba de un ${p.discount} % de descuento para agencias. Nos gustaría aprovecharlo.`,
  "sales.reply.accept": (p) => `Nos parece bien. Por favor, ponlo en marcha. Un saludo, ${p.name}`,
  "sales.reply.counter": (p) => `Es algo más de lo que tenemos presupuestado. Podríamos pagar ${price(p)} al mes. Dinos algo.`,
  "sales.reply.noBudget": (p) => `Gracias, pero no tenemos presupuesto para eso. Buscaremos otro proveedor. ${p.name}`,
  "sales.reply.refused": (p) => `Gracias por la oferta. Hemos encontrado un trato mejor en otro sitio. ${p.name}`,
  "sales.you.decline": () => "Gracias por tu interés. Ahora mismo no podemos hacernos cargo de esto.",
  "sales.need.location": (p) => `Necesita una ubicación en ${p.city}`,
  "sales.need.age": (p) => `Necesita una empresa con al menos ${p.months} meses`,
  "sales.need.reviews": (p) => `Necesita una valoración de ${p.stars} estrellas o más`,
  "sales.req.location": (p) => `Ubicación en ${p.city}`,
  "sales.req.cluster": (p) => `Clúster en ${p.city}`,
  "sales.req.server": (p) => `Servidor libre en ${p.city}`,
  "sales.req.datacenter": (p) => `Centro de datos en ${p.city}`,
  "sales.req.age": (p) => `Empresa con al menos ${p.months} meses`,
  "sales.req.reviews": (p) => `Valoración de ${p.stars} estrellas`,
  "lost.expired": () => "Sin respuesta a tiempo",
  "lost.noFittingProduct": () => "Ningún paquete adecuado",
  "lost.price": () => "Demasiado caro",
  "lost.declined": () => "Rechazado",
  "lost.noCapacity": (p) => `Sin capacidad en ${p.city}`,
  "event.salesWon.title": () => "Trato cerrado",
  "event.salesWon.text": (p) => `${p.name} ha firmado a ${price(p)} al mes por ${p.spec}.`,
  "event.salesCounter.title": () => "Contraoferta",
  "event.salesCounter.text": (p) => `${p.name} ofrece ${price(p)} al mes.`,
  "event.salesRefused.title": () => "Presupuesto rechazado",
  "event.salesRefused.text": (p) => `${p.name} ha rechazado tu presupuesto.`,
  "error.unknownRequest": () => "Esta solicitud ya no está abierta.",
  "error.quotePrice": () => "Introduce un precio mensual mayor que cero.",
  "error.requestMissing": () => "Todavía no puedes atender esta solicitud.",
  "error.yearlyPrice": () => "Los productos anuales mantienen su precio hasta la renovación.",
  "error.unknownProfile": () => "No existe ese grupo de clientes.",
  "error.studyDone": () => "Ya tienes este estudio.",
  "ledger.marketStudy": (p) => `Estudio de mercado de Gartnah: ${STUDY_NAME[p.profile] ?? p.profile}`,
  "sales.msg.transfer": (p) => `Mi sitio funciona ahora en ${p.host}. Por favor, trasladadlo por mí.`,
} satisfies Dict;
