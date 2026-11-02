import type { Dict, Params } from "../lang";

const ITEM: Record<string, [string, string]> = {
  gameServer: ["servidor de juegos", "servidores de juegos"], vps: ["VPS", "VPS"], storage: ["volumen de almacenamiento", "volúmenes de almacenamiento"], webHosting: ["espacio web", "espacios web"],
};
const what = (p: Params) => {
  const [one, many] = ITEM[String(p.product)];
  const size = p.product === "storage" || p.product === "webHosting" ? `${p.diskGb} GB de disco` : `${p.vcpu} vCPU y ${p.ramGb} GB de RAM`;
  return `${p.count} ${Number(p.count) === 1 ? one : many} con ${size}${Number(p.count) === 1 ? "" : " cada uno"}`;
};
const span = (p: Params) => ({ 3: "el fin de semana", 7: "una semana", 90: "tres meses", 365: "un año" })[Number(p.days) as 3] ?? `${p.days} días`;
const PEOPLE: Record<string, string> = { gamer: "jugadores", private: "usuarios particulares", hobbyDev: "desarrolladores" };
const term = (p: Params) => (Number(p.months) === 1 ? "un mes" : `${p.months} meses`);
const ask = (p: Params) => `${what(p)} durante ${term(p)}, ${Number(p.free) ? "gratis" : "a mitad de precio"}`;
const reach = (p: Params) => `${p.audience} ${PEOPLE[String(p.profile)]}`;
const plural = (n: unknown, one: string, many: string) => (Number(n) === 1 ? one : many);

export default {
  "ticket.sponsor.lanTastic.subject": (p) => `${p.event} necesita servidores`,
  "ticket.sponsor.lanTastic.text": (p) => `Hola, organizamos ${p.event}, la mayor LAN party de la comarca, y el año pasado los servidores iban peor de lag que nuestros jugadores. ¿Podrías patrocinar ${what(p)} durante ${span(p)}? Tu logo saldrá en la pantalla grande entre los descansos para la pizza.`,
  "ticket.sponsor.chaosClub.subject": (p) => `Quedada de ${p.event}`,
  "ticket.sponsor.chaosClub.text": (p) => `Quedamos todos los jueves para desmontar cosas que funcionaban perfectamente. Nos vendría bien un host donde ejecutar nuestras herramientas: ${what(p)} durante ${span(p)}. No podemos pagar, pero te contaremos lo que encontremos.`,
  "ticket.sponsor.hackASorus.subject": (p) => `Hackathon ${p.event}`,
  "ticket.sponsor.hackASorus.text": (p) => `Cuarenta desarrolladores, un fin de semana, muy poco sueño. Necesitamos ${what(p)} durante ${span(p)} para ejecutar los proyectos. Nada se despliega en producción, y lo que rompamos se queda en el sandbox.`,
  "ticket.sponsor.mirror.subject": (p) => `Mirror para ${p.event}`,
  "ticket.sponsor.mirror.text": (p) => `Nuestra distribución busca un mirror cerca de sus usuarios. Necesitaríamos ${what(p)} durante ${span(p)}. Tu empresa aparecerá en nuestra página de mirrors, entre una universidad y un señor llamado Gerhard.`,
  "ticket.sponsor.fragFest.subject": (p) => `Torneo ${p.event}`,
  "ticket.sponsor.fragFest.text": (p) => `Se acercan las finales de ${p.event} y los servidores viejos se sostienen con bridas. Buscamos ${what(p)} durante ${span(p)}. El nombre del patrocinador se anuncia antes de cada partida, así que por favor, no te caigas.`,
  "ticket.sponsor.userGroup.subject": (p) => `Sitio web de ${p.event}`,
  "ticket.sponsor.userGroup.text": (p) => `Nuestro grupo se reúne desde los noventa y nuestro sitio web ha vivido casi todo ese tiempo en el sótano de un socio. ¿Podrías darnos ${what(p)} durante ${span(p)}? Te pondremos como patrocinador, justo debajo de las actas de las reuniones.`,
  "ticket.sponsor.codeClub.subject": (p) => `Sitios web para ${p.event}`,
  "ticket.sponsor.codeClub.text": (p) => `Este año nuestros alumnos crean sus primeros sitios web y les encantaría ponerlos en línea de verdad. ¿Podrías patrocinar ${what(p)} durante ${span(p)}? Te daremos las gracias en cada página.`,
  "ticket.sponsor.shelter.subject": (p) => `Un hogar para el sitio web de ${p.event}`,
  "ticket.sponsor.shelter.text": (p) => `Buscamos hogar a gatos, perros y un loro muy ruidoso, y nuestro sitio web también necesita uno. ¿Podrías patrocinar ${what(p)} durante ${span(p)}? Tu logo iría junto a la lista de adopciones.`,
  "ticket.sponsor.pixelJam.subject": (p) => `${p.event} necesita un campo de juego`,
  "ticket.sponsor.pixelJam.text": (p) => `En ${p.event} los equipos hacen un juego en un fin de semana y el domingo todo el mundo juega los resultados. Necesitamos ${what(p)} durante ${span(p)} para que la prueba de juego no se caiga.`,
  "ticket.sponsor.openData.subject": (p) => `Almacenamiento para ${p.event}`,
  "ticket.sponsor.openData.text": (p) => `Recopilamos conjuntos de datos públicos de la ciudad y durante una semana los convertimos en mapas y herramientas. ¿Podrías patrocinar ${what(p)} durante ${span(p)} para guardar los datos sin procesar?`,
  "ticket.sponsor.devOops.subject": (p) => `Streaming para ${p.event}`,
  "ticket.sponsor.devOops.text": (p) => `Esperamos a dos mil asistentes y una keynote que no puede ir con buffering. Necesitamos ${what(p)} durante ${span(p)} para emitir las charlas. Los ponentes te mencionarán al menos una vez, normalmente sin querer.`,
  "outcome.sponsored": () => "Patrocinio aceptado",
  "outcome.sponsorDeclined": () => "Patrocinio rechazado",
  "review.sponsor.bad": () => "Su logo estaba en la pantalla grande y sus servidores no.",
  "review.sponsor.ok": () => "Un patrocinador que apareció. Más o menos.",
  "review.sponsor.good": () => "Servidores gratis que aguantaron todo el fin de semana. Lo recordaremos.",
  "event.sponsorRequest.title": () => "Solicitud de patrocinio",
  "event.sponsorRequest.text": (p) => `${p.event} busca un patrocinador.`,
  "event.sponsorDone.title": (p) => `${p.event} ha terminado`,
  "event.sponsorDone.text": (p) => {
    const gains = [
      Number(p.knowHow) > 0 && `${p.knowHow} de know-how`,
      Number(p.awareness) > 0 && `un ${p.awareness} % más de notoriedad`,
      Number(p.leads) > 0 && `${p.leads} ${plural(p.leads, "lead", "leads")}`,
      Number(p.stars) > 0 && `una reseña de ${p.stars} ${plural(p.stars, "estrella", "estrellas")}`,
      Number(p.recommendation) > 0 && "una recomendación para una contratación cualificada",
    ].filter(Boolean);
    return `Los servidores de ${p.event} aguantaron. Has conseguido ${gains.length ? gains.join(", ") : "un agradecimiento"}.`;
  },
  "ticket.sponsor.board.clan.subject": (p) => `Solicitud de ${p.event}`,
  "ticket.sponsor.board.clan.text": (p) => `Somos ${p.event}. Nuestro clan tiene ${reach(p)} que nunca se han puesto de acuerdo en nada salvo en el lag. Hemos visto tu oferta en Sponsor-Bored y nos gustaría ${ask(p)}. Tu banner irá en la portada de nuestro sitio.`,
  "ticket.sponsor.board.lanParty.subject": (p) => `Solicitud de ${p.event}`,
  "ticket.sponsor.board.lanParty.text": (p) => `Organizamos ${p.event} en un gimnasio alquilado para ${reach(p)} y una cantidad peligrosa de cables. Nos gustaría ${ask(p)}. Te mencionaremos en el escenario entre reparto y reparto de pizzas.`,
  "ticket.sponsor.board.fanSite.subject": (p) => `Solicitud de ${p.event}`,
  "ticket.sponsor.board.fanSite.text": (p) => `${p.event} lo leen ${reach(p)} cada mes, sobre todo de noche. Nos gustaría ${ask(p)}. Tu banner estará arriba de cada página, justo encima de las discusiones.`,
  "ticket.sponsor.board.student.subject": (p) => `Solicitud de ${p.event}`,
  "ticket.sponsor.board.student.text": (p) => `Somos un proyecto de estudiantes con ${reach(p)} en el curso, y nuestro profesor dice que la demo tiene que funcionar en algún sitio de verdad. Nos gustaría ${ask(p)}. Tu nombre irá en la firma de foro de todo el equipo.`,
  "ticket.sponsor.board.mirror.subject": (p) => `Solicitud de ${p.event}`,
  "ticket.sponsor.board.mirror.text": (p) => `Replicamos software de código abierto para ${reach(p)} que preferirían compilarlo ellos mismos. Nos gustaría ${ask(p)}. Cada mantenedor firma sus mensajes del foro con un agradecimiento para ti.`,
  "event.boardApplication.title": () => "Solicitud de patrocinio",
  "event.boardApplication.text": (p) => `${p.event} ha solicitado un patrocinio.`,
  "event.halfAccepted.title": (p) => `${p.event} acepta tu oferta`,
  "event.halfAccepted.text": (p) => `${p.event} ha aceptado tu oferta de mitad de precio y los servicios ya funcionan.`,
  "event.halfDeclined.title": (p) => `${p.event} ha elegido a otro patrocinador`,
  "event.halfDeclined.text": (p) => `${p.event} ha rechazado tu oferta de mitad de precio.`,
  "event.boardDropped.title": (p) => `${p.event} ha quitado tu banner`,
  "event.boardDropped.text": (p) => `${p.event} ha retirado tu banner, así que el patrocinio ya no aporta notoriedad ni leads.`,
  "event.boardDone.title": (p) => `${p.event} ha terminado`,
  "event.boardDone.text": (p) => `El patrocinio de ${p.event} ha finalizado.`,
  "error.badOffer": () => "Esta oferta no se puede publicar.",
  "error.offersOpen": () => "Ya hay tres ofertas abiertas.",
  "error.unknownOffer": () => "Esta oferta ya no está abierta.",
  "error.offerFull": () => "Todas las plazas de esta oferta están ocupadas.",
  "ticket.sponsor.board.held.subject": (p) => `${p.event}: nuestro servidor está caído`,
  "ticket.sponsor.board.held.text": () => `Hola, nuestro servidor está caído de repente. Solo quitamos vuestro banner por el nuevo diseño, ¿eso no es motivo para bloquearnos, verdad? Por favor, volved a activarlo.`,
  "error.sponsorNotDropped": () => "Este patrocinio todavía muestra tu banner.",
  "event.sponsorFailed.title": (p) => `${p.event} ha salido mal`,
  "event.sponsorFailed.text": (p) => `Los servidores de ${p.event} estuvieron caídos ${p.hours} ${plural(p.hours, "hora", "horas")}. Se publicaron dos reseñas malas y tu notoriedad ha bajado.`,
} satisfies Dict;
