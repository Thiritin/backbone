import { euroCents } from "../../sim/00-core/money";
import type { Dict, Params } from "../lang";

const SLA: Record<string, string> = { basic: "Basic", business: "Business", premium: "Premium" };
const sla = (p: Params) => (p.sla === "basic" ? "" : ` Ci serve lo SLA ${SLA[p.sla] ?? p.sla}.`);
const price = (p: Params) => euroCents(Number(p.price));
const web = (p: Params) => `${p.disk} GB di spazio e ${p.mail} ${Number(p.mail) === 1 ? "casella e-mail" : "caselle e-mail"}`;
const cards = (p: Params) => `${p.gpu} GPU`;
const box = (p: Params) => `${p.cpu} vCPU, ${p.ram} GB di RAM e ${p.disk} GB di disco`;

const STUDY_NAME: Record<string, string> = {
  private: "Privati", gamer: "Giocatori", hobbyDev: "Sviluppatori amatoriali", soleProp: "Ditte individuali", smallBiz: "Piccole imprese",
  agency: "Agenzie e startup", office: "Studi medici e legali", onlineShop: "Negozi online", enterprise: "Grandi aziende",
};

export default {
  "request.use.private": () => "È solo un piccolo sito personale, quindi non c'è mai fretta.",
  "request.use.gamer": () => "Giochiamo quasi ogni sera e tutto il weekend, quindi deve funzionare in quei momenti.",
  "request.use.hobbyDev": () => "È un progetto personale con cui smanetto quando trovo il tempo.",
  "request.use.soleProp": () => "I clienti mi trovano tramite il sito, e lo controllo ogni pochi giorni.",
  "request.use.smallBiz": () => "Il nostro team ci lavora ogni giorno durante l'orario d'ufficio.",
  "request.use.agency": () => "I nostri clienti ci stanno sopra tutto il giorno, quindi notiamo subito i problemi.",
  "request.use.office": () => "I pazienti prenotano i loro appuntamenti da lì ogni mattina.",
  "request.use.onlineShop": () => "Gli ordini arrivano giorno e notte, e ogni minuto offline ci costa denaro.",
  "request.use.enterprise": () => "Il nostro personale ci conta giorno e notte.",
  "sales.msg.webHosting.0": (p) => `Salve, cerco una casa per ${p.domain || "il mio sito web"}: circa ${web(p)}. Quanto costerebbe al mese?${sla(p)}`,
  "sales.msg.webHosting.1": (p) => `Un amico ti ha consigliato. Ci servono ${web(p)} per ${p.domain || "il nostro sito"}, se possibile ospitato a ${p.city}.${sla(p)} Qual è il tuo prezzo?`,
  "sales.msg.vps.0": (p) => `Ci serve un VPS con ${box(p)} e accesso root a ${p.city}.${sla(p)} Mandami per favore il tuo prezzo mensile.`,
  "sales.msg.vps.1": (p) => `La nostra app è cresciuta troppo per l'hosting condiviso. Puoi offrire un VPS con ${box(p)}?${sla(p)} La fatturazione mensile sarebbe la soluzione migliore.`,
  "sales.msg.gameServer.0": (p) => `Il nostro clan ha bisogno di un server di gioco con ${box(p)} che non laggi il venerdì sera. Quanto costa al mese?`,
  "sales.msg.gameServer.1": (p) => `Cerchiamo un server di gioco con ${box(p)} vicino a ${p.city} per un ping basso. Quanto chiedi?`,
  "sales.msg.dedicated.0": (p) => `Cerchiamo un server dedicato con almeno ${p.ram} GB di RAM a ${p.city} con contratto di dodici mesi.${sla(p)} Indicaci per favore un prezzo mensile.`,
  "sales.msg.dedicated.1": (p) => `Il nostro team vuole hardware proprio. Potresti fornire un server con almeno ${p.ram} GB di RAM?${sla(p)}`,
  "sales.msg.gpu.0": (p) => `Stiamo addestrando dei modelli e ci servono ${cards(p)} con ${box(p)} a ${p.city}.${sla(p)} Quanto costerebbe al mese?`,
  "sales.msg.gpu.1": (p) => `Il nostro team ha bisogno di server GPU per rendering e inferenza: ${cards(p)}, ${box(p)}.${sla(p)} Mandaci per favore il tuo prezzo mensile.`,
  "sales.msg.shady": (p) => `Ci serve oggi un VPS con ${box(p)}. Tanto traffico, niente domande, niente scartoffie. Paghiamo in crypto, sempre puntuali. Dì il tuo prezzo.`,
  "sales.msg.discount": (p) => `La tua campagna parlava del ${p.discount}% di sconto per le agenzie. Vorremmo approfittarne.`,
  "sales.reply.accept": (p) => `Per noi va bene. Procedi pure con l'attivazione. Cordiali saluti, ${p.name}`,
  "sales.reply.counter": (p) => `È un po' sopra il nostro budget. Potremmo arrivare a ${price(p)} al mese. Facci sapere.`,
  "sales.reply.noBudget": (p) => `Grazie, ma non abbiamo il budget per questo. Cercheremo un altro fornitore. ${p.name}`,
  "sales.reply.refused": (p) => `Grazie per l'offerta. Abbiamo trovato un affare migliore altrove. ${p.name}`,
  "sales.you.decline": () => "Grazie per l'interesse. Al momento non possiamo occuparcene.",
  "sales.need.location": (p) => `Richiede una sede a ${p.city}`,
  "sales.need.age": (p) => `Richiede un'azienda con almeno ${p.months} mesi di vita`,
  "sales.need.reviews": (p) => `Richiede una valutazione di ${p.stars} stelle o più`,
  "sales.req.location": (p) => `Sede a ${p.city}`,
  "sales.req.cluster": (p) => `Cluster a ${p.city}`,
  "sales.req.server": (p) => `Server libero a ${p.city}`,
  "sales.req.datacenter": (p) => `Data center a ${p.city}`,
  "sales.req.age": (p) => `Azienda con almeno ${p.months} mesi di vita`,
  "sales.req.reviews": (p) => `Valutazione di ${p.stars} stelle`,
  "lost.expired": () => "Nessuna risposta in tempo",
  "lost.noFittingProduct": () => "Nessun pacchetto adatto",
  "lost.price": () => "Troppo caro",
  "lost.declined": () => "Rifiutato",
  "lost.noCapacity": (p) => `Nessuna capacità a ${p.city}`,
  "event.salesWon.title": () => "Affare concluso",
  "event.salesWon.text": (p) => `${p.name} ha firmato a ${price(p)} al mese per ${p.spec}.`,
  "event.salesCounter.title": () => "Controfferta",
  "event.salesCounter.text": (p) => `${p.name} offre ${price(p)} al mese.`,
  "event.salesRefused.title": () => "Preventivo rifiutato",
  "event.salesRefused.text": (p) => `${p.name} ha rifiutato il tuo preventivo.`,
  "error.unknownRequest": () => "Questa richiesta non è più aperta.",
  "error.quotePrice": () => "Inserisci un prezzo mensile maggiore di zero.",
  "error.requestMissing": () => "Non puoi ancora soddisfare questa richiesta.",
  "error.yearlyPrice": () => "I prodotti annuali mantengono il prezzo fino al rinnovo.",
  "error.unknownProfile": () => "Questo gruppo di clienti non esiste.",
  "error.studyDone": () => "Hai già questo studio.",
  "ledger.marketStudy": (p) => `Studio di mercato di Gartnah: ${STUDY_NAME[p.profile] ?? p.profile}`,
  "sales.msg.transfer": (p) => `Il mio sito è attualmente presso ${p.host}. Per favore, trasferitelo per me.`,
} satisfies Dict;
