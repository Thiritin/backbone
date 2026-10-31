import type { Dict, Params } from "../lang";

const ITEM: Record<string, [string, string]> = {
  gameServer: ["server di gioco", "server di gioco"], vps: ["VPS", "VPS"], storage: ["volume di storage", "volumi di storage"], webHosting: ["spazio web", "spazi web"],
};
const what = (p: Params) => {
  const [one, many] = ITEM[String(p.product)];
  const size = p.product === "storage" || p.product === "webHosting" ? `${p.diskGb} GB di disco` : `${p.vcpu} vCPU e ${p.ramGb} GB di RAM`;
  return `${p.count} ${Number(p.count) === 1 ? one : many} con ${size}${Number(p.count) === 1 ? "" : " ciascuno"}`;
};
const span = (p: Params) => ({ 3: "il weekend", 7: "una settimana", 90: "tre mesi", 365: "un anno" })[Number(p.days) as 3] ?? `${p.days} giorni`;
const PEOPLE: Record<string, string> = { gamer: "giocatori", private: "utenti privati", hobbyDev: "sviluppatori" };
const term = (p: Params) => (Number(p.months) === 1 ? "un mese" : `${p.months} mesi`);
const ask = (p: Params) => `${what(p)} per ${term(p)}, ${Number(p.free) ? "gratis" : "a metà prezzo"}`;
const reach = (p: Params) => `${p.audience} ${PEOPLE[String(p.profile)]}`;
const plural = (n: unknown, one: string, many: string) => (Number(n) === 1 ? one : many);

export default {
  "ticket.sponsor.lanTastic.subject": (p) => `${p.event} cerca server`,
  "ticket.sponsor.lanTastic.text": (p) => `Ciao, organizziamo ${p.event}, la LAN party più grande della provincia, e l'anno scorso i server laggavano più dei nostri giocatori. Potresti sponsorizzare ${what(p)} per ${span(p)}? Il tuo logo andrà sul maxischermo tra una pausa pizza e l'altra.`,
  "ticket.sponsor.chaosClub.subject": (p) => `Incontro ${p.event}`,
  "ticket.sponsor.chaosClub.text": (p) => `Ci troviamo ogni giovedì per smontare cose che funzionavano benissimo. Ci servirebbe un host dove far girare i nostri strumenti: ${what(p)} per ${span(p)}. Non possiamo pagare, ma ti diremo cosa troviamo.`,
  "ticket.sponsor.hackASorus.subject": (p) => `Hackathon ${p.event}`,
  "ticket.sponsor.hackASorus.text": (p) => `Quaranta sviluppatori, un weekend, troppo poco sonno. Ci servono ${what(p)} per ${span(p)} per far girare i progetti. Niente va in produzione, e quello che rompiamo resta nella sandbox.`,
  "ticket.sponsor.mirror.subject": (p) => `Mirror per ${p.event}`,
  "ticket.sponsor.mirror.text": (p) => `La nostra distribuzione cerca un mirror vicino ai suoi utenti. Ci servirebbero ${what(p)} per ${span(p)}. La tua azienda comparirà sulla nostra pagina dei mirror, tra un'università e un signore di nome Gerhard.`,
  "ticket.sponsor.fragFest.subject": (p) => `Torneo ${p.event}`,
  "ticket.sponsor.fragFest.text": (p) => `Le finali di ${p.event} si avvicinano e i vecchi server stanno insieme con le fascette. Cerchiamo ${what(p)} per ${span(p)}. Il nome dello sponsor viene annunciato prima di ogni partita, quindi per favore non andare giù.`,
  "ticket.sponsor.userGroup.subject": (p) => `Sito web di ${p.event}`,
  "ticket.sponsor.userGroup.text": (p) => `Il nostro gruppo si riunisce dagli anni Novanta e il nostro sito ha passato quasi tutto questo tempo nella cantina di un socio. Potresti darci ${what(p)} per ${span(p)}? Ti citeremo come sponsor, subito sotto il verbale delle riunioni.`,
  "ticket.sponsor.codeClub.subject": (p) => `Siti web per ${p.event}`,
  "ticket.sponsor.codeClub.text": (p) => `Quest'anno i nostri studenti costruiscono i loro primi siti web e li metterebbero volentieri online per davvero. Potresti sponsorizzare ${what(p)} per ${span(p)}? Ti ringrazieremo su ogni pagina.`,
  "ticket.sponsor.shelter.subject": (p) => `Una casa per il sito di ${p.event}`,
  "ticket.sponsor.shelter.text": (p) => `Troviamo una casa a gatti, cani e a un pappagallo molto rumoroso, e anche il nostro sito ne ha bisogno. Potresti sponsorizzare ${what(p)} per ${span(p)}? Il tuo logo starebbe accanto all'elenco delle adozioni.`,
  "ticket.sponsor.pixelJam.subject": (p) => `${p.event} cerca un parco giochi`,
  "ticket.sponsor.pixelJam.text": (p) => `A ${p.event} le squadre creano un gioco in un weekend e la domenica tutti giocano ai risultati. Ci servono ${what(p)} per ${span(p)} perché il playtest non vada in crash.`,
  "ticket.sponsor.openData.subject": (p) => `Storage per ${p.event}`,
  "ticket.sponsor.openData.text": (p) => `Raccogliamo dataset pubblici della città e per una settimana li trasformiamo in mappe e strumenti. Potresti sponsorizzare ${what(p)} per ${span(p)} per ospitare i dati grezzi?`,
  "ticket.sponsor.devOops.subject": (p) => `Streaming per ${p.event}`,
  "ticket.sponsor.devOops.text": (p) => `Aspettiamo duemila partecipanti e una keynote che non può andare in buffering. Ci servono ${what(p)} per ${span(p)} per trasmettere gli interventi. I relatori ti citeranno almeno una volta, di solito per sbaglio.`,
  "outcome.sponsored": () => "Sponsorizzazione accettata",
  "outcome.sponsorDeclined": () => "Sponsorizzazione rifiutata",
  "review.sponsor.bad": () => "Il loro logo era sul maxischermo, i loro server no.",
  "review.sponsor.ok": () => "Uno sponsor che si è presentato. Più o meno.",
  "review.sponsor.good": () => "Server gratis che hanno retto tutto il weekend. Ce lo ricorderemo.",
  "event.sponsorRequest.title": () => "Richiesta di sponsorizzazione",
  "event.sponsorRequest.text": (p) => `${p.event} cerca uno sponsor.`,
  "event.sponsorDone.title": (p) => `${p.event} è finito`,
  "event.sponsorDone.text": (p) => {
    const gains = [
      Number(p.knowHow) > 0 && `${p.knowHow} di know-how`,
      Number(p.awareness) > 0 && `il ${p.awareness}% di notorietà in più`,
      Number(p.leads) > 0 && `${p.leads} ${plural(p.leads, "lead", "lead")}`,
      Number(p.stars) > 0 && `una recensione da ${p.stars} ${plural(p.stars, "stella", "stelle")}`,
      Number(p.recommendation) > 0 && "una raccomandazione per un'assunzione qualificata",
    ].filter(Boolean);
    return `I server di ${p.event} hanno retto. Hai ottenuto ${gains.length ? gains.join(", ") : "un grazie"}.`;
  },
  "ticket.sponsor.board.clan.subject": (p) => `Candidatura di ${p.event}`,
  "ticket.sponsor.board.clan.text": (p) => `Qui ${p.event}. Il nostro clan ha ${reach(p)} che non sono mai stati d'accordo su niente tranne il lag. Abbiamo visto la tua offerta su Sponsor-Bored e vorremmo ${ask(p)}. Il tuo banner andrà sulla home del nostro sito.`,
  "ticket.sponsor.board.lanParty.subject": (p) => `Candidatura di ${p.event}`,
  "ticket.sponsor.board.lanParty.text": (p) => `Organizziamo ${p.event} in una palestra affittata per ${reach(p)} e una quantità pericolosa di cavi. Vorremmo ${ask(p)}. Ti citeremo sul palco tra una consegna di pizze e l'altra.`,
  "ticket.sponsor.board.fanSite.subject": (p) => `Candidatura di ${p.event}`,
  "ticket.sponsor.board.fanSite.text": (p) => `${p.event} è letto ogni mese da ${reach(p)}, soprattutto di notte. Vorremmo ${ask(p)}. Il tuo banner starà in cima a ogni pagina, proprio sopra le discussioni.`,
  "ticket.sponsor.board.student.subject": (p) => `Candidatura di ${p.event}`,
  "ticket.sponsor.board.student.text": (p) => `Siamo un progetto di studenti con ${reach(p)} nel corso, e il nostro professore dice che la demo deve girare da qualche parte di vero. Vorremmo ${ask(p)}. Il tuo nome andrà in ogni firma del forum del team.`,
  "ticket.sponsor.board.mirror.subject": (p) => `Candidatura di ${p.event}`,
  "ticket.sponsor.board.mirror.text": (p) => `Facciamo il mirror di software open source per ${reach(p)} che preferirebbero compilarselo da soli. Vorremmo ${ask(p)}. Ogni maintainer firma i suoi messaggi sul forum con un grazie a te.`,
  "event.boardApplication.title": () => "Candidatura per la sponsorizzazione",
  "event.boardApplication.text": (p) => `${p.event} si è candidato per una sponsorizzazione.`,
  "event.halfAccepted.title": (p) => `${p.event} accetta la tua offerta`,
  "event.halfAccepted.text": (p) => `${p.event} ha accettato la tua offerta a metà prezzo e i servizi sono attivi.`,
  "event.halfDeclined.title": (p) => `${p.event} ha scelto un altro sponsor`,
  "event.halfDeclined.text": (p) => `${p.event} ha rifiutato la tua offerta a metà prezzo.`,
  "event.boardDropped.title": (p) => `${p.event} ha tolto il tuo banner`,
  "event.boardDropped.text": (p) => `${p.event} ha rimosso il tuo banner, quindi la sponsorizzazione non porta più notorietà né lead.`,
  "event.boardDone.title": (p) => `${p.event} è finito`,
  "event.boardDone.text": (p) => `La sponsorizzazione di ${p.event} è terminata.`,
  "error.badOffer": () => "Questa offerta non può essere pubblicata.",
  "error.offersOpen": () => "Ci sono già tre offerte aperte.",
  "error.unknownOffer": () => "Questa offerta non è più aperta.",
  "error.offerFull": () => "Tutti i posti di questa offerta sono occupati.",
  "event.sponsorFailed.title": (p) => `${p.event} è andato male`,
  "event.sponsorFailed.text": (p) => `I server di ${p.event} sono rimasti giù per ${p.hours} ${plural(p.hours, "ora", "ore")}. Sono state pubblicate due recensioni negative e la tua notorietà è calata.`,
} satisfies Dict;
