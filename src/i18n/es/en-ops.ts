import type { Dict, Params } from "../lang";

const again = (p: Params) => (Number(p.round) > 1 ? "Este es nuestro segundo aviso y el contenido sigue en línea. " : "");
const second = (p: Params, subject: string) => (Number(p.round) > 1 ? `Segundo aviso: ${subject}` : subject);
const host = (p: Params) => String(p.url).replace(/^https:\/\/([^/]+).*$/, "$1");
const duration = (minutes: number): string =>
  minutes < 60 ? `${minutes} min` : minutes % 60 ? `${Math.floor(minutes / 60)} h ${minutes % 60} min` : `${minutes / 60} h`;

export default {
  "ticket.notice.movie.subject": (p) => second(p, `Infracción de derechos de autor en ${host(p)}`),
  "ticket.notice.movie.text": (p) => `${again(p)}En nombre de ${p.sender} hemos encontrado en ${p.url} una copia sin licencia de una de nuestras películas. Retírala sin demora.`,
  "ticket.notice.music.subject": (p) => second(p, `Música pirata en ${host(p)}`),
  "ticket.notice.music.text": (p) => `${again(p)}${p.sender} posee los derechos de las grabaciones ofrecidas para descarga en ${p.url}. Retíralas sin demora.`,
  "ticket.notice.youtuber.subject": (p) => second(p, `Elimina ${host(p)} YA`),
  "ticket.notice.youtuber.text": (p) =>
    `${again(p)}Soy TechTimo, 2,3 millones de suscriptores. La página ${p.url} dice que mi vídeo ${p.video} es el peor unboxing del año. Eso es difamación y probablemente también infracción de derechos de autor. Borra la web entera hoy.`,
  "ticket.notice.phishing.subject": (p) => second(p, `Página de phishing en ${host(p)}`),
  "ticket.notice.phishing.text": (p) => `${again(p)}La página ${p.url} imita el acceso a la banca online de ${p.sender} y recoge las contraseñas de nuestros clientes. Ponla fuera de línea.`,
  "ticket.notice.spam.subject": (p) => second(p, `Spam que anuncia ${host(p)}`),
  "ticket.notice.spam.text": (p) => `${again(p)}Tu red ha enviado 48.000 correos de spam en la última hora, todos con un enlace a ${p.url}. Detén al remitente o incluiremos tu rango de direcciones en la lista negra.`,
  "ticket.legal.data.subject": (p) => (Number(p.round) > 1 ? `Orden judicial: datos de ${host(p)}` : `Solicitud de datos de clientes: ${host(p)}`),
  "ticket.legal.data.text": (p) => Number(p.round) > 1
    ? `Un tribunal ha ordenado entregar todos los registros de abonados y los logs de ${p.url}. Responde antes del plazo o los agentes recogerán el hardware en persona.`
    : `Como parte de una investigación, solicitamos los registros de abonados, los logs de acceso y los datos de pago de ${p.url}. Responde antes del plazo.`,
  "ticket.legal.takedown.subject": (p) => (Number(p.round) > 1 ? `Orden judicial: retirar ${host(p)}` : `Orden de retirada: ${host(p)}`),
  "ticket.legal.takedown.text": (p) => Number(p.round) > 1
    ? `Un tribunal ha ordenado desconectar ${p.url}. Responde antes del plazo o los agentes recogerán el hardware en persona.`
    : `El contenido de ${p.url} es objeto de una investigación. Retíralo y confírmalo antes del plazo.`,
  "ticket.refund.outage.subject": () => "Reembolso por la caída",
  "ticket.refund.outage.text": () => "Nuestro sitio estuvo caído durante horas. Pagamos por un alojamiento que funcione, así que esperamos que nos devuelvas la cuota de este mes.",
  "ticket.refund.dataLoss.subject": () => "Hemos perdido todos nuestros datos",
  "ticket.refund.dataLoss.text": () => "Todo lo que teníamos en tu servidor ha desaparecido. Queremos que nos devuelvas la cuota de este mes, y una explicación.",
  "outcome.forwarded": () => "Reenviado al cliente",
  "outcome.takenDown": () => "Contenido retirado",
  "outcome.rejected": () => "Aviso rechazado",
  "outcome.ignored": () => "Ignorado",
  "outcome.complied": () => "Solicitud atendida",
  "outcome.objected": () => "Objeción enviada",
  "outcome.seized": () => "Plazo incumplido, servidor confiscado",
  "outcome.refunded": () => "Un mes reembolsado",
  "outcome.refused": () => "Reembolso denegado",
  "ledger.refund": (p) => `Reembolso a ${p.customer}`,
  "error.notHosted": () => "Ningún cliente usa este dominio.",
  "event.gridDark.title": () => "Corte de luz",
  "event.gridDark.text": (p) => `${p.location} estuvo ${duration(Number(p.minutes))} sin electricidad.`,
  "event.gridCarried.title": () => "Caída de la red eléctrica",
  "event.gridCarried.text": (p) => `${p.location} siguió en línea durante una caída de la red de ${duration(Number(p.minutes))}.`,
  "event.feedDark.title": () => "Fallo de acometida",
  "event.feedDark.text": (p) => `La acometida ${p.feed} de ${p.rack} falló y sus servidores se quedaron ${duration(Number(p.minutes))} sin electricidad.`,
  "event.feedCarried.title": () => "Fallo de acometida",
  "event.feedCarried.text": (p) => `${p.rack} siguió en línea durante un fallo de ${duration(Number(p.minutes))} de la acometida ${p.feed}.`,
  "event.feedCascade.title": () => "Fallo de acometida",
  "event.feedCascade.text": (p) => `La acometida ${p.feed} de ${p.rack} falló y la otra acometida no soportó toda la carga y saltó. Todos sus servidores se quedaron ${duration(Number(p.minutes))} sin electricidad.`,
  "event.seized.title": () => "Servidor confiscado",
  "event.seized.text": (p) => `${p.agency} se llevó ${p.device} de ${p.location}.`,
  "event.seizedBack.title": () => "Servidor devuelto",
  "event.seizedBack.text": (p) => `${p.device} vuelve a estar en el almacén de ${p.location}.`,
  "review.outage.bad": () => "Horas fuera de línea y ni una palabra de ellos. Nunca más.",
  "review.outage.ok": () => "Hubo una caída, pero la resolvieron.",
  "review.outage.good": () => "Hasta la única caída se gestionó bien.",
  "review.dataLoss.bad": () => "Perdieron todos nuestros archivos. Haced vuestras propias copias de seguridad.",
  "review.dataLoss.ok": () => "Perdieron nuestros datos pero nos devolvieron el dinero. Sentimientos encontrados.",
  "review.dataLoss.good": () => "Datos perdidos, pero lo arreglaron.",
  "review.fast.bad": () => "Máquina rápida, soporte lento.",
  "review.fast.ok": () => "El servidor es rápido, el resto es normalito.",
  "review.fast.good": () => "El tick rate no bajó ni una vez. El mejor servidor de juegos que hemos alquilado.",
  "review.smooth.bad": () => "Funcionaba, pero cualquier otro contacto con ellos fue un suplicio.",
  "review.smooth.ok": () => "Ninguna queja sobre la disponibilidad. Por lo demás, nada especial.",
  "review.smooth.good": () => "Un mes entero sin un solo tropiezo. Justo lo que debe ser un hosting.",
} satisfies Dict;
