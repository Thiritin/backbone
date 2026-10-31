import type { Dict, Params } from "../lang";

const again = (p: Params) => (Number(p.round) > 1 ? "Questo è il nostro secondo sollecito, e il contenuto è ancora online. " : "");
const second = (p: Params, subject: string) => (Number(p.round) > 1 ? `Secondo sollecito: ${subject}` : subject);
const host = (p: Params) => String(p.url).replace(/^https:\/\/([^/]+).*$/, "$1");
const duration = (minutes: number): string =>
  minutes < 60 ? `${minutes} min` : minutes % 60 ? `${Math.floor(minutes / 60)} h ${minutes % 60} min` : `${minutes / 60} h`;

export default {
  "ticket.notice.movie.subject": (p) => second(p, `Violazione del copyright su ${host(p)}`),
  "ticket.notice.movie.text": (p) => `${again(p)}Per conto di ${p.sender} abbiamo trovato su ${p.url} una copia senza licenza di uno dei nostri film. Rimuovila senza indugio.`,
  "ticket.notice.music.subject": (p) => second(p, `Musica piratata su ${host(p)}`),
  "ticket.notice.music.text": (p) => `${again(p)}${p.sender} detiene i diritti delle registrazioni offerte in download su ${p.url}. Rimuovile senza indugio.`,
  "ticket.notice.youtuber.subject": (p) => second(p, `Rimuovi ${host(p)} ORA`),
  "ticket.notice.youtuber.text": (p) =>
    `${again(p)}Sono TechTimo, 2,3 milioni di iscritti. La pagina ${p.url} definisce il mio video ${p.video} il peggior unboxing dell'anno. È diffamazione e probabilmente anche violazione del copyright. Cancella tutto il sito oggi stesso.`,
  "ticket.notice.phishing.subject": (p) => second(p, `Pagina di phishing su ${host(p)}`),
  "ticket.notice.phishing.text": (p) => `${again(p)}La pagina ${p.url} imita il login dell'home banking di ${p.sender} e raccoglie le password dei nostri clienti. Mettila offline.`,
  "ticket.notice.spam.subject": (p) => second(p, `Spam che pubblicizza ${host(p)}`),
  "ticket.notice.spam.text": (p) => `${again(p)}La tua rete ha inviato 48.000 e-mail di spam nell'ultima ora, tutte con un link a ${p.url}. Blocca il mittente, altrimenti inseriremo il tuo intervallo di indirizzi nella blacklist.`,
  "ticket.legal.data.subject": (p) => (Number(p.round) > 1 ? `Ordine del tribunale: dati di ${host(p)}` : `Richiesta di dati dei clienti: ${host(p)}`),
  "ticket.legal.data.text": (p) => Number(p.round) > 1
    ? `Un tribunale ha ordinato la consegna di tutti i dati degli abbonati e dei log di ${p.url}. Rispondi entro la scadenza, altrimenti gli agenti ritireranno l'hardware di persona.`
    : `Nell'ambito di un'indagine richiediamo i dati degli abbonati, i log di accesso e i dettagli di pagamento di ${p.url}. Rispondi entro la scadenza.`,
  "ticket.legal.takedown.subject": (p) => (Number(p.round) > 1 ? `Ordine del tribunale: rimuovere ${host(p)}` : `Ordine di rimozione: ${host(p)}`),
  "ticket.legal.takedown.text": (p) => Number(p.round) > 1
    ? `Un tribunale ha ordinato di mettere offline ${p.url}. Rispondi entro la scadenza, altrimenti gli agenti ritireranno l'hardware di persona.`
    : `Il contenuto di ${p.url} è oggetto di un'indagine. Mettilo offline e conferma entro la scadenza.`,
  "ticket.refund.outage.subject": () => "Rimborso per il disservizio",
  "ticket.refund.outage.text": () => "Il nostro sito è rimasto offline per ore. Paghiamo per un hosting che funzioni, quindi ci aspettiamo il rimborso della quota di questo mese.",
  "ticket.refund.dataLoss.subject": () => "Tutti i nostri dati sono spariti",
  "ticket.refund.dataLoss.text": () => "Tutto quello che avevamo sul tuo server è sparito. Vogliamo il rimborso della quota di questo mese, e una spiegazione.",
  "outcome.forwarded": () => "Inoltrato al cliente",
  "outcome.takenDown": () => "Contenuto rimosso",
  "outcome.rejected": () => "Segnalazione respinta",
  "outcome.ignored": () => "Ignorato",
  "outcome.complied": () => "Richiesta soddisfatta",
  "outcome.objected": () => "Opposizione inviata",
  "outcome.seized": () => "Scadenza mancata, server sequestrato",
  "outcome.refunded": () => "Un mese rimborsato",
  "outcome.refused": () => "Rimborso rifiutato",
  "ledger.refund": (p) => `Rimborso a ${p.customer}`,
  "error.notHosted": () => "Nessun cliente usa questo dominio.",
  "event.gridDark.title": () => "Blackout",
  "event.gridDark.text": (p) => `${p.location} è rimasta senza corrente per ${duration(Number(p.minutes))}.`,
  "event.gridCarried.title": () => "Guasto alla rete elettrica",
  "event.gridCarried.text": (p) => `${p.location} è rimasta online durante un guasto alla rete di ${duration(Number(p.minutes))}.`,
  "event.feedDark.title": () => "Guasto a una linea di alimentazione",
  "event.feedDark.text": (p) => `La linea ${p.feed} di ${p.rack} è andata in guasto e i suoi server sono rimasti senza corrente per ${duration(Number(p.minutes))}.`,
  "event.feedCarried.title": () => "Guasto a una linea di alimentazione",
  "event.feedCarried.text": (p) => `${p.rack} è rimasto online durante un guasto di ${duration(Number(p.minutes))} della linea ${p.feed}.`,
  "event.coolingFailed.title": () => "Guasto al raffreddamento",
  "event.coolingFailed.text": (p) => `Il raffreddamento a ${p.location} si è guastato per ${duration(Number(p.minutes))}.`,
  "event.overheated.title": () => "Server surriscaldati",
  "event.overheated.text": (p) => `${Number(p.count) === 1 ? "1 server" : `${p.count} server`} a ${p.location} si ${Number(p.count) === 1 ? "è spento" : "sono spenti"} per il calore.`,
  "event.seized.title": () => "Server sequestrato",
  "event.seized.text": (p) => `${p.agency} ha portato via ${p.device} da ${p.location}.`,
  "event.seizedBack.title": () => "Server restituito",
  "event.seizedBack.text": (p) => `${p.device} è tornato in magazzino a ${p.location}.`,
  "review.outage.bad": () => "Offline per ore e nemmeno una parola da parte loro. Mai più.",
  "review.outage.ok": () => "C'è stato un disservizio, ma l'hanno risolto.",
  "review.outage.good": () => "Anche l'unico disservizio è stato gestito bene.",
  "review.dataLoss.bad": () => "Hanno perso tutti i nostri file. Fate i vostri backup.",
  "review.dataLoss.ok": () => "Hanno perso i nostri dati ma ci hanno rimborsato. Sentimenti contrastanti.",
  "review.dataLoss.good": () => "Dati persi, ma hanno rimediato.",
  "review.fast.bad": () => "Macchina veloce, supporto lento.",
  "review.fast.ok": () => "Il server è veloce, il resto è nella media.",
  "review.fast.good": () => "Il tick rate non è mai sceso. Il miglior server di gioco che abbiamo mai affittato.",
  "review.smooth.bad": () => "Funzionava, ma ogni altro contatto con loro è stato un tormento.",
  "review.smooth.ok": () => "Nessun reclamo sull'uptime. Per il resto niente di speciale.",
  "review.smooth.good": () => "Un mese intero senza intoppi. Esattamente come dovrebbe essere un hosting.",
} satisfies Dict;
