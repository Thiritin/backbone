import { euroCents } from "../../sim/00-core/money";
import { t } from "../en";
import type { Dict, Params } from "../lang";

const gb = (x: string | number) => `${x} GB`;
const mailboxes = (n: string | number) => `${n} ${Number(n) === 1 ? "casella e-mail" : "caselle e-mail"}`;
const web = (p: Params) => `${gb(p.disk)} di spazio, ${gb(p.traffic)} di traffico al mese e ${mailboxes(p.mail)}`;
const box = (p: Params) => `${p.cpu} vCPU, ${gb(p.ram)} di RAM e ${gb(p.disk)} di disco`;
const cards = (p: Params) => `${p.gpu} GPU`;
const domain = (p: Params) => (Number(p.owned) ? `Possiedo già ${p.domain} e vorrei trasferirlo da te.${p.auth ? ` Il codice di autorizzazione è ${p.auth}.` : ""}` : `Registra per favore anche ${p.domain} per me.`);
const more = (p: Params) => (p.product === "webHosting"
  ? `da ${gb(p.disk0)} a ${gb(p.disk1)} di spazio, da ${gb(p.traffic0)} a ${gb(p.traffic1)} di traffico e da ${p.mail0} a ${mailboxes(p.mail1)}`
  : and([
    Number(p.cpu1) > 0 && `da ${p.cpu0} a ${p.cpu1} vCPU`, Number(p.ram1) > 0 && `da ${gb(p.ram0)} a ${gb(p.ram1)} di RAM`, Number(p.disk1) > 0 && `da ${gb(p.disk0)} a ${gb(p.disk1)} di disco`,
  ].filter((x): x is string => !!x)));
const and = (xs: string[]) => (xs.length > 1 ? `${xs.slice(0, -1).join(", ")} e ${xs.at(-1)}` : xs[0] ?? "più spazio");

export default {
  "order.msg.item": (p) => `Vorrei il pacchetto ${p.item} del tuo sito.`,
  "order.msg.webHosting.0": (p) => `Salve, mi serve un hosting web per ${p.domain}: circa ${web(p)}. ${domain(p)}`,
  "order.msg.webHosting.1": (p) => `Un amico ti ha consigliato. Il mio sito ${p.domain} ha bisogno di ${web(p)}. ${domain(p)} Quanto costerebbe?`,
  "order.msg.vps.0": (p) => `Vorrei un VPS a ${p.city} con ${box(p)}. Accesso root, per favore. So quello che faccio.`,
  "order.msg.vps.1": (p) => `Per favore, configurami un server virtuale: ${box(p)}. Debiant sarebbe carino, e fatturazione mensile.`,
  "order.msg.gameServer.0": (p) => `Ci serve un server di gioco per il nostro clan con ${box(p)}. Deve essere attivo entro venerdì sera.`,
  "order.msg.gameServer.1": (p) => `Per favore, configura un server di gioco a ${p.city}: ${box(p)}. Il ping basso per noi conta più di ogni altra cosa.`,
  "order.msg.gpu.0": (p) => `Vorrei un server GPU a ${p.city} con ${cards(p)}, ${box(p)}. Mi serve per addestrare i miei modelli.`,
  "order.msg.gpu.1": (p) => `Per favore, configurami un server virtuale con ${cards(p)}: ${box(p)}. I driver CUDA sarebbero carini, e fatturazione mensile.`,
  "sales.msg.upgrade": (p) => `Continuiamo a sbattere contro i nostri limiti. Ci servono ${more(p)}. Quanto ci costerebbe l'upgrade?`,
  "sales.you.upgrade": (p) => `Possiamo fare l'upgrade per ${euroCents(Number(p.price))} al mese in totale.`,
  "sales.you.upgradeDone": (p) => `L'upgrade è attivo. Il tuo servizio ora funziona con le nuove risorse a ${euroCents(Number(p.price))} al mese.`,
  "ticket.upgrade.more.subject": (p) => `${p.hostname || p.service || "Il mio servizio"} sta diventando troppo piccolo`,
  "ticket.upgrade.more.text": () => "Continuiamo a restare senza spazio. Quanto ci costerebbe un upgrade?",
  "invoice.line.firstMonth": (p) => `${p.label}, primo mese`,
  "invoice.line.setupFee": (p) => `${p.label}, costo di attivazione`,
  "invoice.line.domain": (p) => `Dominio ${p.domain}, primo anno`,
  "invoice.line.domainTransfer": (p) => `Trasferimento di ${p.domain}`,
  "invoice.line.domainRenewal": (p) => `Dominio ${p.domain}, un altro anno`,
  "ledger.domain": (p) => `${p.domain} presso ${p.registry}`,
  "ledger.domainTransfer": (p) => `Trasferimento di ${p.domain} a ${p.registry}`,
  "ledger.domainRenewal": (p) => `Rinnovo di ${p.domain} presso ${p.registry}`,
  "activity.renewDomain": (p) => `${p.domain} rinnovato per un anno`,
  "activity.changePackage": (p) => `Passato al pacchetto ${p.pkg}`,
  "activity.upgrade": (p) => `Servizio potenziato a ${euroCents(Number(p.price))} al mese`,
  "activity.throttled": () => "Traffico limitato al piano",
  "activity.overageBilled": (p) => `Traffico in eccesso fatturato per ${euroCents(Number(p.price))}`,
  "invoice.line.trafficOverage": (p) => `${p.label}, traffico oltre il piano: ${gb(p.gb)}`,
  "ticket.upgrade.traffic.subject": (p) => `Traffico di ${p.hostname || p.service || "il nostro sito"}`,
  "ticket.upgrade.traffic.text": () => "La vostra mail dice che usiamo più traffico di quanto includa il nostro piano. Quanto costerebbe un piano più grande?",
  "error.noOveruse": () => "Questo servizio rientra nel suo traffico.",
  "error.overuseHandled": () => "Il traffico di questo servizio è già stato gestito questo mese.",
  "error.notExpandable": () => "Questo servizio non ha un piano più grande.",
  "event.orderAccepted.title": () => "Preventivo accettato",
  "event.orderAccepted.text": (p) => `${p.name} ha accettato il preventivo.`,
  "event.orderPaid.title": () => "Ordine pagato",
  "event.orderPaid.text": (p) => `${p.name} ha pagato la fattura dell'ordine e attende l'attivazione.`,
  "event.stepFailed.title": () => "Passaggio dell'ordine fallito",
  "event.stepFailed.text": (p) => `${p.name}: ${t(String(p.error))}`,
  "event.domainExpiring.title": () => "Dominio in scadenza",
  "event.domainExpiring.text": (p) => `${p.domain} scade tra ${p.days} ${Number(p.days) === 1 ? "giorno" : "giorni"}.`,
  "event.domainExpired.title": () => "Dominio scaduto",
  "event.domainExpired.text": (p) => `${p.domain} è scaduto e il suo sito è offline.`,
  "lost.unpaid": () => "Mai pagato",
  "error.needsQuote": () => "Il cliente non ha ancora accettato un preventivo.",
  "error.quoteSent": () => "Il cliente non ha ancora risposto al preventivo.",
  "error.needsAutomation": () => "Scegli un host su cui configurarlo.",
  "error.needsAccount": () => "Crea prima l'account del cliente.",
  "error.addressMissing": () => "Inserisci l'indirizzo completo.",
  "error.quoteSentAlready": () => "Questo preventivo è già stato inviato.",
  "error.quoteOtherOrder": () => "Questo preventivo è di un altro ordine.",
  "error.quoteNotAccepted": () => "Il cliente non ha accettato questo preventivo.",
  "error.quoteInvoiced": () => "Questo preventivo è già stato trasferito in fattura.",
  "error.needsInvoice": () => "Conferma prima l'ordine e invia la fattura.",
  "error.needsDomain": () => "Registra prima il dominio.",
  "error.stepDone": () => "Questo passaggio è completato.",
  "error.domainTaken": () => "Questo dominio appartiene a un altro cliente.",
  "error.unknownDomain": () => "Questo dominio non è registrato per nessun cliente attivo.",
  "error.routeElsewhere": () => "Questo cluster si trova in un'altra città.",
} satisfies Dict;
