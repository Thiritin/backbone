import { euroCents } from "../../sim/00-core/money";
import { t } from "../en";
import type { Dict, Params } from "../lang";

const gb = (x: string | number) => `${x} GB`;
const mailboxes = (n: string | number) => `${n} ${Number(n) === 1 ? "buzón" : "buzones"}`;
const web = (p: Params) => `${gb(p.disk)} de espacio, ${gb(p.traffic)} de tráfico al mes y ${mailboxes(p.mail)}`;
const box = (p: Params) => `${p.cpu} vCPU, ${gb(p.ram)} de RAM y ${gb(p.disk)} de disco`;
const cards = (p: Params) => `${p.gpu} GPU`;
const domain = (p: Params) => (Number(p.owned) ? `Ya tengo ${p.domain} y me gustaría trasladarlo contigo.${p.auth ? ` El código de autorización es ${p.auth}.` : ""}` : `Por favor, registra también ${p.domain} para mí.`);
const more = (p: Params) => (p.product === "webHosting"
  ? `de ${gb(p.disk0)} a ${gb(p.disk1)} de espacio, de ${gb(p.traffic0)} a ${gb(p.traffic1)} de tráfico y de ${p.mail0} a ${mailboxes(p.mail1)}`
  : and([
    Number(p.cpu1) > 0 && `de ${p.cpu0} a ${p.cpu1} vCPU`, Number(p.ram1) > 0 && `de ${gb(p.ram0)} a ${gb(p.ram1)} de RAM`, Number(p.disk1) > 0 && `de ${gb(p.disk0)} a ${gb(p.disk1)} de disco`,
  ].filter((x): x is string => !!x)));
const and = (xs: string[]) => (xs.length > 1 ? `${xs.slice(0, -1).join(", ")} y ${xs.at(-1)}` : xs[0] ?? "más espacio");

export default {
  "order.msg.item": (p) => `Quiero el paquete ${p.item} de tu web.`,
  "order.msg.webHosting.0": (p) => `Hola, necesito alojamiento web para ${p.domain}: unos ${web(p)}. ${domain(p)}`,
  "order.msg.webHosting.1": (p) => `Un amigo te ha recomendado. Mi sitio web ${p.domain} necesita ${web(p)}. ${domain(p)} ¿Cuánto costaría?`,
  "order.msg.vps.0": (p) => `Quisiera un VPS en ${p.city} con ${box(p)}. Acceso root, por favor. Sé lo que hago.`,
  "order.msg.vps.1": (p) => `Por favor, móntame un servidor virtual: ${box(p)}. Debiant estaría bien, y facturación mensual.`,
  "order.msg.gameServer.0": (p) => `Necesitamos un servidor de juegos para nuestro clan con ${box(p)}. Tiene que estar listo para el viernes por la noche.`,
  "order.msg.gameServer.1": (p) => `Por favor, monta un servidor de juegos en ${p.city}: ${box(p)}. Para nosotros el ping bajo importa más que nada.`,
  "order.msg.gpu.0": (p) => `Quisiera un servidor GPU en ${p.city} con ${cards(p)}, ${box(p)}. Lo necesito para entrenar mis modelos.`,
  "order.msg.gpu.1": (p) => `Por favor, móntame un servidor virtual con ${cards(p)}: ${box(p)}. Los drivers CUDA estarían bien, y facturación mensual.`,
  "sales.msg.upgrade": (p) => `Nos estamos topando con los límites. Necesitamos ${more(p)}. ¿Cuánto nos costaría ampliar?`,
  "sales.you.upgrade": (p) => `Podemos hacer la ampliación por ${euroCents(Number(p.price))} al mes en total.`,
  "sales.you.upgradeDone": (p) => `La ampliación ya está activa. Tu servicio funciona con los nuevos recursos a ${euroCents(Number(p.price))} al mes desde ahora.`,
  "ticket.upgrade.more.subject": (p) => `${p.hostname || p.service || "Mi servicio"} se está quedando pequeño`,
  "ticket.upgrade.more.text": () => "Nos estamos quedando sin espacio. ¿Cuánto nos costaría ampliar?",
  "invoice.line.firstMonth": (p) => `${p.label}, primer mes`,
  "invoice.line.setupFee": (p) => `${p.label}, cuota de alta`,
  "invoice.line.domain": (p) => `Dominio ${p.domain}, primer año`,
  "invoice.line.domainTransfer": (p) => `Traslado de ${p.domain}`,
  "invoice.line.domainRenewal": (p) => `Dominio ${p.domain}, un año más`,
  "ledger.domain": (p) => `${p.domain} en ${p.registry}`,
  "ledger.domainTransfer": (p) => `Traslado de ${p.domain} a ${p.registry}`,
  "ledger.domainRenewal": (p) => `Renovación de ${p.domain} en ${p.registry}`,
  "activity.renewDomain": (p) => `${p.domain} renovado por un año`,
  "activity.changePackage": (p) => `Cambiado al paquete ${p.pkg}`,
  "activity.upgrade": (p) => `Servicio ampliado a ${euroCents(Number(p.price))} al mes`,
  "activity.throttled": () => "Tráfico limitado al plan",
  "activity.overageBilled": (p) => `Exceso de tráfico facturado por ${euroCents(Number(p.price))}`,
  "invoice.line.trafficOverage": (p) => `${p.label}, tráfico por encima del plan: ${gb(p.gb)}`,
  "ticket.upgrade.traffic.subject": (p) => `Tráfico de ${p.hostname || p.service || "nuestra web"}`,
  "ticket.upgrade.traffic.text": () => "Su correo dice que usamos más tráfico del que incluye nuestro plan. ¿Cuánto costaría un plan mayor?",
  "error.noOveruse": () => "Este servicio está dentro de su tráfico.",
  "error.overuseHandled": () => "El tráfico de este servicio ya se gestionó este mes.",
  "error.notExpandable": () => "Este servicio no tiene un plan mayor.",
  "event.orderAccepted.title": () => "Presupuesto aceptado",
  "event.orderAccepted.text": (p) => `${p.name} ha aceptado el presupuesto.`,
  "event.orderPaid.title": () => "Pedido pagado",
  "event.orderPaid.text": (p) => `${p.name} ha pagado la factura del pedido y espera la puesta en marcha.`,
  "event.stepFailed.title": () => "Falló un paso del pedido",
  "event.stepFailed.text": (p) => `${p.name}: ${t(String(p.error))}`,
  "event.domainExpiring.title": () => "El dominio caduca pronto",
  "event.domainExpiring.text": (p) => `${p.domain} caduca en ${p.days} ${Number(p.days) === 1 ? "día" : "días"}.`,
  "event.domainExpired.title": () => "Dominio caducado",
  "event.domainExpired.text": (p) => `${p.domain} ha caducado y su sitio está fuera de línea.`,
  "lost.unpaid": () => "Nunca pagó",
  "error.needsQuote": () => "El cliente todavía no ha aceptado un presupuesto.",
  "error.quoteSent": () => "El cliente todavía no ha respondido al presupuesto.",
  "error.needsAutomation": () => "Elige un host donde configurarlo.",
  "error.needsAccount": () => "Crea primero la cuenta del cliente.",
  "error.addressMissing": () => "Introduce la dirección completa.",
  "error.quoteSentAlready": () => "Este presupuesto ya se envió.",
  "error.quoteOtherOrder": () => "Este presupuesto es de otro pedido.",
  "error.quoteNotAccepted": () => "El cliente no ha aceptado este presupuesto.",
  "error.quoteInvoiced": () => "Este presupuesto ya se traspasó a factura.",
  "error.needsInvoice": () => "Confirma primero el pedido y envía la factura.",
  "error.needsDomain": () => "Registra primero el dominio.",
  "error.stepDone": () => "Este paso ya está hecho.",
  "error.domainTaken": () => "Este dominio pertenece a otro cliente.",
  "error.unknownDomain": () => "Este dominio no está registrado para ningún cliente activo.",
  "error.routeElsewhere": () => "Este clúster está en otra ciudad.",
} satisfies Dict;
