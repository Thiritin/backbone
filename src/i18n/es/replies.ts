import { euroCents } from "../../sim/00-core/money";
import { dateOf } from "../../sim/00-core/time";
import type { Dict, Params } from "../lang";

type Mail = (p: Params) => string;
const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

const hi = (p: Params) => (p.name ? `Hola ${p.name}:` : "Hola:");
const SIGN: Mail[] = [
  (p) => `Un saludo,\nEl equipo de ${p.company}`,
  (p) => `Saludos cordiales,\nSoporte de ${p.company}\nsupport@${p.host}`,
  (p) => `Un cordial saludo,\nTu atención al cliente de ${p.company}`,
];
const to = (greet: Mail) => (i: number, body: Mail): Mail => (p) => `${greet(p)}\n\n${body(p)}\n\n${SIGN[i](p)}`;
const customer = to(hi), sender = to(() => "Estimados señores:"), lead = to((p) => `Hola ${p.name}:`);
const siteOf = (p: Params) => new URL(String(p.url)).hostname;
const site = (p: Params) => p.domain || p.service || "tu sitio web";
const svc = (p: Params) => p.hostname || p.service || "tu servicio";
const day = (p: Params) => {
  const d = dateOf(Number(p.hour));
  return `${d.getUTCDate()} de ${MONTHS[d.getUTCMonth()]} a las ${String(d.getUTCHours()).padStart(2, "0")}:00`;
};
const setupFee = (p: Params) => (Number(p.setup) > 0 ? ` más una cuota de alta única de ${euroCents(Number(p.setup))}` : "");
const hosting = (p: Params) => (p.domain ? `${p.line} para ${p.domain}` : p.line);
const plural = (n: unknown, one: string, many: string) => (Number(n) === 1 ? one : many);
const domainLine = (p: Params) => (Number(p.owned) ? `La transferencia de ${p.domain} a nosotros ya está completa, y desde ahora nos ocupamos de sus renovaciones.` : `Hemos registrado ${p.domain} para ti.`);

const MAILS: Record<string, [Mail, Mail, Mail]> = {
  "tpl.ack": [
    (p) => `Gracias por avisarnos. Sabemos que ${svc(p)} no responde y nuestros técnicos están trabajando en ello ahora mismo. Te escribiremos en cuanto vuelva a funcionar.`,
    (p) => `Confirmamos la caída de ${svc(p)}. La causa se está solucionando mientras escribimos, y tendrás noticias nuestras en cuanto vuelva a funcionar.`,
    (p) => `Perdona las molestias. ${svc(p)} está caído por nuestra parte y la solución está en marcha. No tienes que hacer nada.`,
  ],
  "tpl.back": [
    (p) => `${svc(p)} vuelve a estar en línea y todo funciona con normalidad. Pedimos disculpas por la interrupción.`,
    (p) => `Buenas noticias: el problema está resuelto y ${svc(p)} vuelve a responder. Gracias por tu paciencia.`,
    (p) => `La caída ha terminado y ${svc(p)} vuelve a estar accesible. Avísanos si algo sigue sin ir bien.`,
  ],
  "tpl.askDetails": [
    () => "Gracias por tu mensaje. ¿Puedes contarnos un poco más sobre lo que ves, a ser posible con el mensaje de error exacto y la hora a la que ocurrió?",
    () => "Queremos ayudarte con esto. ¿Puedes enviarnos una captura de pantalla o el texto exacto del mensaje que recibes?",
    () => "Para investigarlo bien, necesitamos algunos detalles más. ¿Qué estabas haciendo cuando pasó y qué viste?",
  ],
  "tpl.ftp": [
    (p) => `Conéctate con un cliente FTP como FileZilla a ftp.${p.host} con tus datos de acceso del panel y copia tus archivos en la carpeta htdocs de ${site(p)}. Quedan publicados al instante.`,
    (p) => `Puedes subir tus páginas por FTP: el servidor es ftp.${p.host}, y el usuario y la contraseña son los de tu panel. Todo lo que haya en la carpeta htdocs aparece en ${site(p)}.`,
    (p) => `Lo más rápido es el FTP. Apunta tu programa FTP a ftp.${p.host}, entra con los datos de tu panel y suelta los archivos en htdocs. ${site(p)} los muestra enseguida.`,
  ],
  "tpl.mail": [
    (p) => `Introduce mail.${p.host} como servidor de entrada y de salida, con tu dirección de correo completa como usuario, el puerto 993 para IMAP y el 587 para enviar.`,
    (p) => `El nombre del servidor para el correo entrante y saliente es mail.${p.host}. Usa tu dirección de correo completa como usuario y la contraseña de tu buzón.`,
    (p) => `En Outlook, elige IMAP e introduce mail.${p.host} para ambos servidores. El usuario es tu dirección completa${p.domain ? ` en ${p.domain}` : ""}.`,
  ],
  "tpl.dns": [
    (p) => `Indica ns1.${p.host} y ns2.${p.host} como servidores de nombres de ${site(p)} en tu registrador. El cambio puede tardar hasta un día en llegar a todo el mundo.`,
    (p) => `En el registrador donde compraste ${site(p)}, sustituye los servidores de nombres por ns1.${p.host} y ns2.${p.host}. En un día como mucho, el dominio mostrará tu sitio.`,
    (p) => `${p.domain ? `${p.domain} tiene` : "Tu dominio tiene"} que apuntar a nosotros: introduce ns1.${p.host} y ns2.${p.host} como servidores de nombres en tu registrador. Suele tardar unas horas, un día como máximo.`,
  ],
  "tpl.panel": [
    (p) => `Hemos enviado una contraseña nueva del panel de control a tu dirección de contacto. Puedes entrar en panel.${p.host}.`,
    (p) => `Una contraseña nueva del panel va de camino a tu bandeja de entrada. La página de acceso es panel.${p.host}.`,
    (p) => `Hemos restablecido el acceso a tu panel de control y te hemos enviado la contraseña nueva por correo. Entra en panel.${p.host} y cámbiala.`,
  ],
  "tpl.ssl": [
    (p) => `Podemos instalar un certificado SSL para ${site(p)}. En cuanto lo pidas, el candado aparece en menos de una hora y la advertencia desaparece.`,
    (p) => `La advertencia desaparece con un certificado SSL. Pide uno para ${site(p)} y te lo instalamos.`,
    (p) => `${site(p)} necesita un certificado SSL para mostrar el candado. Te lo configuramos en cuanto lo pidas.`,
  ],
  "tpl.ssh": [
    (p) => `Abre un cliente SSH como PuTTYcat y conéctate a ${p.hostname || "tu servidor"} como root. La contraseña está en el correo de configuración que enviamos desde ${p.host}.`,
    (p) => `Entras por SSH: conéctate a ${p.hostname || "tu servidor"} con el usuario root y la contraseña de tu correo de configuración.`,
    (p) => `Usa cualquier cliente SSH y conéctate a ${p.hostname || "tu servidor"} como root. Si has perdido el correo de configuración con la contraseña, responde aquí y te mandamos otro.`,
  ],
  "tpl.addon": [
    (p) => `Sí, puede compartir el paquete. Añade el dominio nuevo en el panel de control, en panel.${p.host}, dentro de Dominios, y elige una carpeta para él.`,
    (p) => `No hace falta un segundo paquete. En el panel de control, en panel.${p.host}, añade el dominio en Dominios y apúntalo a su propia carpeta.`,
    (p) => `Puedes usar el dominio nuevo con el mismo alojamiento. Abre Dominios en el panel de control, en panel.${p.host}, añádelo y elige una carpeta.`,
  ],
  "tpl.php": [
    (p) => `La versión de PHP de ${site(p)} la eliges tú mismo en el panel de control, en panel.${p.host}, dentro de Ajustes de PHP. Se aplica al instante.`,
    (p) => `Abre Ajustes de PHP en el panel de control, en panel.${p.host}, y elige la versión más reciente. ${site(p)} la usa de inmediato.`,
    (p) => `En el panel de control, en panel.${p.host}, Ajustes de PHP te permite cambiar de versión para ${site(p)}. Recomendamos la más nueva que admitan tus plugins.`,
  ],
  offerOnce: [
    (p) => `Podemos poner ${site(p)} al día por ti. Es un trabajo puntual de ${euroCents(Number(p.once))}, y no tienes que hacer nada.`,
    (p) => `Al software de ${site(p)} le faltan actualizaciones de seguridad. Las instalamos por una tarifa única de ${euroCents(Number(p.once))}.`,
    (p) => `Nos encargamos encantados de la actualización de ${site(p)}. El precio único es de ${euroCents(Number(p.once))}.`,
  ],
  offerManaged: [
    (p) => `Podemos mantener ${site(p)} al día por ti a partir de ahora. Las actualizaciones gestionadas cuestan ${euroCents(Number(p.managed))} al mes, e instalamos cada parche de seguridad en menos de un día.`,
    (p) => `Con las actualizaciones gestionadas por ${euroCents(Number(p.managed))} al mes, actualizamos el software de ${site(p)} en cuanto sale un parche, para que no tengas que preocuparte.`,
    (p) => `Te ofrecemos encargarnos de las actualizaciones de ${site(p)} por ${euroCents(Number(p.managed))} al mes. Cada parche de seguridad se instala en menos de un día.`,
  ],
  free: [
    (p) => `Hemos actualizado gratis el software de ${site(p)}. Todo vuelve a funcionar con la última versión.`,
    (p) => `Tu actualización de ${site(p)} está hecha y no tienes nada que pagar. El sitio funciona con la última versión.`,
    (p) => `Nos hemos encargado de la actualización de ${site(p)}. Esta vez es gratis, y el sitio está al día.`,
  ],
  clean: [
    (p) => `Hemos limpiado ${site(p)} y restaurado tu página de inicio. Cambia tus contraseñas y mantén el software actualizado.`,
    (p) => `${site(p)} vuelve a estar limpio y muestra tu propia página de inicio. Si actualizas el software y cambias tus contraseñas, seguirá así.`,
    (p) => `Tu sitio ${site(p)} ha vuelto a la normalidad. Hemos eliminado los archivos del intruso; actualiza el software y elige contraseñas nuevas.`,
  ],
  noBackup: [
    (p) => `No tenemos ninguna copia de seguridad de ${site(p)} que restaurar. Vuelve a subir el sitio desde tu propia copia y elige contraseñas nuevas.`,
    (p) => `Por desgracia, no hay copia de seguridad de ${site(p)} por nuestra parte. Tendrás que restaurarlo desde tus propios archivos y cambiar tus contraseñas.`,
    (p) => `No podemos restaurar ${site(p)} porque no existe ninguna copia de seguridad. Reconstrúyelo desde tu propia copia y mantén el software actualizado.`,
  ],
  "tpl.explain": [
    () => "El segundo pago corresponde al consumo del mes pasado, que facturamos a mes vencido. No se te ha cobrado dos veces.",
    () => "Hay dos facturas porque el consumo se factura a final de cada mes por el mes anterior. Las dos son correctas, y no se ha cobrado nada dos veces.",
    () => "Un pago es la factura actual y el otro el consumo del mes pasado, que facturamos a mes vencido. Tu cuenta está en orden.",
  ],
  "tpl.resend": [
    () => "Te hemos enviado una copia de la factura. Avísanos si no te llega.",
    () => "Una copia de la factura va de camino a tu dirección de contacto.",
    () => "Claro. Te hemos vuelto a enviar la factura por correo, debería estar en tu bandeja de entrada en unos minutos.",
  ],
  "tpl.extension": [
    () => "No hay problema, esta vez puedes pagar la factura dos semanas más tarde. Tus servicios siguen en línea.",
    () => "Hemos retrasado dos semanas el vencimiento de tu factura. Lo demás no cambia.",
    () => "De acuerdo. Paga dentro de las dos semanas posteriores a la fecha habitual, tus servicios siguen funcionando mientras tanto.",
  ],
  "tpl.newPrice": [
    (p) => `Nuestros costes han subido este año, y el precio nuevo de ${svc(p)} nos permite mantenerlo rápido y fiable.`,
    (p) => `Entendemos que la subida no sea bienvenida. La electricidad y el hardware se han encarecido, y el precio nuevo mantiene ${svc(p)} con la calidad que conoces.`,
    (p) => `El precio nuevo de ${svc(p)} refleja los mayores costes de electricidad y hardware. También paga a las personas que responden correos como este.`,
  ],
  "tpl.awaitPayment": [
    () => "Gracias. Tus servicios vuelven a estar en línea en cuanto llegue el pago.",
    () => "Gracias por avisarnos. En cuanto el pago llegue a nosotros, todo se reactiva automáticamente.",
    () => "Entendido. Tus servicios vuelven en el momento en que registremos el pago.",
  ],
  "tpl.offer": [
    (p) => `Podemos darle más recursos a ${svc(p)} sin tiempo de inactividad. Los precios están en el resumen adjunto, responde y lo cambiamos.`,
    (p) => `Más recursos no son problema. La actualización tarda unos minutos, ${svc(p)} sigue en línea y los precios los tienes en el adjunto.`,
    (p) => `Gracias por crecer con nosotros. Hemos adjuntado los precios de más recursos, y cambiamos ${svc(p)} el mismo día en que respondas.`,
  ],
  "tpl.warn": [
    (p) => `${svc(p)} está enviando tráfico abusivo que otras redes nos denuncian. Arréglalo en 24 horas; si no, tendremos que suspenderlo.`,
    (p) => `Hemos recibido denuncias de abuso sobre ${svc(p)}. Asegúralo en 24 horas para evitar una suspensión.`,
    (p) => `Otros proveedores denuncian ataques o spam procedentes de ${svc(p)}. Probablemente esté comprometido. Límpialo en 24 horas o lo suspenderemos.`,
  ],
  credit: [
    (p) => `Sentimos las molestias. Hemos abonado ${euroCents(Number(p.credit))} en tu cuenta, que se descontarán de tu próxima factura.`,
    (p) => `Como disculpa, tu próxima factura es ${euroCents(Number(p.credit))} más baja. Gracias por seguir con nosotros.`,
    (p) => `Hemos añadido un crédito de ${euroCents(Number(p.credit))} a tu cuenta. Se descuenta automáticamente de tu próxima factura.`,
  ],
  refund: [
    (p) => `Te hemos reembolsado un mes, ${euroCents(Number(p.refund))}, en tu cuenta. Sentimos mucho lo ocurrido.`,
    (p) => `Recibirás un reembolso de ${euroCents(Number(p.refund))} por este mes. Te pedimos disculpas.`,
    (p) => `Hemos emitido el reembolso de un mes completo, ${euroCents(Number(p.refund))}. El dinero llega a tu cuenta en pocos días.`,
  ],
  refuse: [
    () => "Hemos estudiado tu solicitud con atención. La interrupción está cubierta por las condiciones de tu contrato, así que esta vez no podemos ofrecer un reembolso.",
    () => "Gracias por tu mensaje. Tu nivel de servicio cubre este caso, por lo que no es posible un reembolso. Lamentamos las molestias.",
    () => "Entendemos tu frustración, pero no podemos reembolsar este periodo. Aquí se aplican las condiciones de tu contrato.",
  ],
  revert: [
    (p) => `Hemos devuelto el precio de ${svc(p)} a lo que pagabas antes. El cambio se aplica desde tu próxima factura.`,
    (p) => `Haces bien en preguntar. ${svc(p)} vuelve a su precio anterior a partir de la próxima factura.`,
    (p) => `Hemos revertido el cambio de precio de ${svc(p)}. Tu próxima factura volverá a mostrar el precio antiguo.`,
  ],
  "retain.half": [
    () => "Nos daría pena que te fueras. Si te quedas, tu próximo mes te sale a mitad de precio, con todo como ahora.",
    () => "Antes de que te vayas, nos gustaría descontarte un 50 % de tu próximo mes. Responde si quieres quedarte.",
    () => "Te valoramos como cliente. Quédate con nosotros y te reducimos a la mitad el próximo mes.",
  ],
  "retain.free": [
    () => "Nos daría pena que te fueras. Si te quedas, tu próximo mes corre de nuestra cuenta, con todo como ahora.",
    () => "Antes de que te vayas, nos gustaría ofrecerte un mes gratis para compensar las molestias. Responde si quieres quedarte.",
    () => "Te valoramos como cliente. Quédate con nosotros y el próximo mes no te cuesta nada.",
  ],
  "retain.discount": [
    (p) => `Nos daría pena que te fueras. Si te quedas, te descontamos un 20 % en tus servicios durante ${p.months} ${plural(p.months, "mes", "meses")}.`,
    (p) => `Antes de que te vayas, nos gustaría ofrecerte un 20 % de descuento durante ${p.months} ${plural(p.months, "mes", "meses")}. Responde si quieres quedarte.`,
    (p) => `Te valoramos como cliente. Quédate con nosotros y tu precio baja una quinta parte durante ${p.months} ${plural(p.months, "mes", "meses")}.`,
  ],
  "retain.upgrade": [
    () => "Nos daría pena que te fueras. Si te quedas, subimos tu servicio un tamaño por el precio que pagas hoy.",
    () => "Antes de que te vayas, nos gustaría darte más recursos sin coste adicional. Responde si quieres quedarte.",
    () => "Te valoramos como cliente. Quédate con nosotros y mejoramos tu servicio gratis.",
  ],
  "retain.fix": [
    (p) => `Sentimos las molestias. Lo solucionaremos en ${p.fixDays} ${plural(p.fixDays, "día", "días")} y volveremos a contactar contigo entonces. Danos la oportunidad de arreglarlo.`,
    (p) => `Acepta nuestras disculpas. Nuestro equipo está en ello, y en ${p.fixDays} ${plural(p.fixDays, "día", "días")} tu servicio funcionará como debe.`,
    (p) => `Te hemos fallado y lo sentimos. Danos ${p.fixDays} ${plural(p.fixDays, "día", "días")} para solucionarlo antes de decidir.`,
  ],
  "retain.move": [
    () => "Sentimos las molestias. Si te quedas, trasladamos tu servicio a un servidor mejor de nuestro centro de datos y nos encargamos de la mudanza.",
    () => "Antes de que te vayas, déjanos trasladar tu servicio a un servidor mejor. Organizamos la mudanza para el momento que te venga bien.",
    () => "Te valoramos como cliente. Quédate con nosotros y trasladamos tu servicio a un servidor más nuevo sin coste.",
  ],
  cancel: [
    () => "Hemos tramitado tu baja. Tus servicios terminan hoy y recibirás una factura final. Gracias por alojarte con nosotros.",
    () => "Tu contrato queda cancelado como pediste. Descarga todo lo que quieras conservar, los servicios terminan hoy.",
    () => "Confirmamos la baja de tus servicios. Gracias por el tiempo con nosotros, y mucha suerte con tu nuevo proveedor.",
  ],
  unsuspend: [
    (p) => `Tus servicios vuelven a estar en línea. Te quedan ${p.days} ${plural(p.days, "día", "días")} para pagar la factura pendiente.`,
    (p) => `Hemos reactivado todo y ampliado el plazo de pago en ${p.days} ${plural(p.days, "día", "días")}.`,
    (p) => `Tus servicios funcionan de nuevo. Salda la factura en ${plural(p.days, "el próximo día", `los próximos ${p.days} días`)}.`,
  ],
  keep: [
    () => "Entendemos la situación, pero tus servicios siguen suspendidos hasta que se pague la factura pendiente. Después vuelven automáticamente.",
    () => "Lo sentimos, pero no podemos levantar la suspensión antes de recibir el pago. En cuanto llegue, todo vuelve de inmediato.",
    () => "Tus servicios siguen suspendidos por ahora. En cuanto se pague la factura, se reactivan sin más pasos.",
  ],
  forward: [
    (p) => `Les agradecemos su aviso sobre ${p.url}. Lo hemos reenviado a nuestro cliente y le hemos pedido que responda.`,
    (p) => `Hemos trasladado su aviso sobre ${p.url} al cliente responsable del sitio.`,
    (p) => `Su aviso sobre ${p.url} se ha reenviado a nuestro cliente. Para cualquier otra cuestión, contacten con él directamente.`,
  ],
  takedown: [
    (p) => `Les agradecemos su aviso. El contenido de ${p.url} se ha retirado durante ${p.hours} ${plural(p.hours, "hora", "horas")} mientras nuestro cliente lo revisa.`,
    (p) => `Hemos desactivado el acceso a ${p.url} durante ${p.hours} ${plural(p.hours, "hora", "horas")} e informado a nuestro cliente.`,
    (p) => `El material de ${p.url} está fuera de línea desde ahora. Nuestro cliente tiene ${p.hours} ${plural(p.hours, "hora", "horas")} para responder a su aviso.`,
  ],
  notOurs: [
    (p) => `Les agradecemos su aviso sobre ${p.url}. Este sitio no está en nuestra red, por lo que no podemos actuar. Ejecuten "whois ${siteOf(p)}" para averiguar su registrador y después whois sobre la dirección IP a la que apunta el dominio: el resultado indica el proveedor de alojamiento y su contacto de abusos.`,
    (p) => `Hemos comprobado ${p.url} y no está alojado en nuestra red. Una consulta whois de ${siteOf(p)} muestra el registrador, y una consulta whois de la dirección IP del sitio muestra la red que lo aloja, normalmente con una dirección de abusos a la que escribir.`,
    (p) => `El sitio de ${p.url} no es nuestro. Para encontrar el contacto adecuado, consulten ${siteOf(p)} con whois para el registrador, y su dirección IP con whois para el departamento de abusos del proveedor de alojamiento.`,
  ],
  reject: [
    (p) => `Hemos revisado su aviso sobre ${p.url}. No cumple los requisitos formales, por lo que no tomaremos medidas.`,
    (p) => `Les agradecemos su mensaje sobre ${p.url}. Tras la revisión, no vemos motivos para retirar el contenido.`,
    (p) => `Hemos estudiado su aviso sobre ${p.url} y no podemos actuar con él en su forma actual.`,
  ],
  comply: [
    (p) => `Confirmamos la recepción de su solicitud sobre ${p.url}. Vamos a atenderla y facilitaremos la información solicitada en el plazo indicado.`,
    (p) => `Hemos recibido su solicitud sobre ${p.url}. Colaboraremos y les enviaremos la información que piden.`,
    (p) => `Atenderemos su solicitud sobre ${p.url}. Nuestro equipo está preparando los registros solicitados.`,
  ],
  object: [
    (p) => `Hemos recibido su solicitud sobre ${p.url}. Nos oponemos a ella en esta forma y pedimos una orden judicial antes de revelar datos o retirar contenido.`,
    (p) => `En cuanto a ${p.url}, no podemos atender la solicitud sin una orden judicial. Por supuesto, responderemos con prontitud a una.`,
    (p) => `Declinamos respetuosamente su solicitud sobre ${p.url}. Los datos de nuestros clientes solo se entregan con una orden judicial.`,
  ],
  "decline.notOffered": [
    (p) => `Gracias por tu interés en ${hosting(p)}. Por desgracia, de momento no ofrecemos este producto en ${p.city}, así que no podemos aceptar tu pedido.`,
    (p) => `Gracias por tu pedido. Lo sentimos, pero ${p.line} aún no está disponible en ${p.city}. Esperamos poder ayudarte en el futuro.`,
    (p) => `Gracias por pensar en nosotros. ${p.line} no forma parte de nuestra oferta en ${p.city} por ahora, así que tenemos que rechazar este pedido.`,
  ],
  "decline.noCapacity": [
    (p) => `Gracias por tu pedido de ${hosting(p)}. Nuestros servidores en ${p.city} están completos de momento, así que no podemos configurarlo para ti.`,
    (p) => `Lo sentimos, pero ahora mismo no tenemos capacidad libre en ${p.city} y no podemos aceptar tu pedido. Esperamos darte la bienvenida en otra ocasión.`,
    (p) => `Gracias por elegirnos. Por desgracia, ${p.city} está a plena capacidad, y preferimos rechazar el pedido antes que configurar mal ${p.line}.`,
  ],
  "decline.busy": [
    (p) => `Gracias por tu interés en ${hosting(p)}. De momento no aceptamos pedidos nuevos de este tipo.`,
    () => "Gracias por tu pedido. Por desgracia, no podemos asumirlo en este momento. Te deseamos mucho éxito con tu proyecto.",
    (p) => `Agradecemos tu solicitud de ${hosting(p)}, pero no podemos aceptarla ahora mismo.`,
  ],
  accept: [
    (p) => `Gracias por tu pedido. ${hosting(p)} está configurado en ${p.city} y en línea desde el ${day(p)}, por ${euroCents(Number(p.price))} al mes. Tus datos de acceso llegan en otro correo.`,
    (p) => `¡Bienvenido a bordo! Hemos configurado ${hosting(p)} en ${p.city} el ${day(p)}. El precio mensual es de ${euroCents(Number(p.price))}, y tus datos de acceso van de camino.`,
    (p) => `Tu pedido está completo: ${hosting(p)} funciona en ${p.city} desde el ${day(p)} por ${euroCents(Number(p.price))} al mes. Recibirás los datos de acceso en breve.`,
  ],
  failed: [
    (p) => `Gracias por tu pedido. Intentamos configurar ${hosting(p)}, pero no pudo completarse por nuestra parte. Lo sentimos, y hemos cancelado el pedido.`,
    (p) => `Lo sentimos: la configuración de ${hosting(p)} en ${p.city} ha fallado, así que tenemos que cancelar tu pedido. No se te ha cobrado nada.`,
    (p) => `Por desgracia, no hemos podido configurar ${hosting(p)} como pediste. El pedido está cancelado y no se facturará nada.`,
  ],
  "order.quote": [
    (p) => `Gracias por tu consulta sobre ${hosting(p)}. Podemos ofrecértelo por ${euroCents(Number(p.price))} al mes${setupFee(p)}. Dinos si te encaja.`,
    (p) => `Esta es nuestra oferta para ${hosting(p)} en ${p.city}: ${euroCents(Number(p.price))} al mes${setupFee(p)}. Lo configuramos todo en cuanto confirmes.`,
    (p) => `Gracias por ponerte en contacto. Por ${hosting(p)} cobraríamos ${euroCents(Number(p.price))} al mes${setupFee(p)}. Dinos si quieres seguir adelante.`,
  ],
  "order.invoice": [
    (p) => `Confirmamos tu pedido de ${hosting(p)} por ${euroCents(Number(p.price))} al mes. Adjuntamos la factura ${p.invoice} por ${euroCents(Number(p.total))}. Lo configuramos todo en cuanto se pague.`,
    (p) => `Tu pedido está confirmado: ${hosting(p)} en ${p.city} por ${euroCents(Number(p.price))} al mes. Paga la factura ${p.invoice} (${euroCents(Number(p.total))}) y nos ponemos manos a la obra.`,
    (p) => `Gracias, el pedido sigue adelante. ${hosting(p)} cuesta ${euroCents(Number(p.price))} al mes; la primera factura, ${p.invoice}, asciende a ${euroCents(Number(p.total))}.`,
  ],
  "order.live": [
    (p) => (p.domain
      ? `${domainLine(p)} Está en línea en nuestros servidores de ${p.city} desde el ${day(p)}. Entra en panel.${p.host} con el usuario ${String(p.domain).split(".")[0]}; la contraseña llega en otro correo. Sube tu sitio por FTP a ftp.${p.domain}.`
      : `Tu ${p.line} en ${p.city} funciona desde el ${day(p)}. Entra como root por SSH; la dirección y la contraseña llegan en otro correo.`),
    (p) => (p.domain
      ? `${domainLine(p)} Tu espacio web está listo desde el ${day(p)}. El panel de control está en panel.${p.host}, y tus buzones están configurados en mail.${p.host}.`
      : `${p.line} está en línea en ${p.city} desde el ${day(p)}. Tu acceso root va de camino en otro correo.`),
    (p) => `Todo está configurado: ${hosting(p)} funciona en ${p.city} desde el ${day(p)}.${p.domain ? ` ${domainLine(p)}` : ""} Tus datos de acceso llegan en otro correo.`,
  ],
};
const LEAD = ["decline.notOffered", "decline.noCapacity", "decline.busy", "accept", "failed", "order.quote", "order.invoice", "order.live"];
const SENDER = ["forward", "takedown", "notOurs", "reject", "comply", "object"];

export default Object.fromEntries(Object.entries(MAILS).flatMap(([what, bodies]) =>
  bodies.map((body, i) => [`reply.${what}.${i}`, (LEAD.includes(what) ? lead : SENDER.includes(what) ? sender : customer)(i, body)]))) as Dict;
