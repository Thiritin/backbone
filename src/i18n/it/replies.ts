import { euroCents } from "../../sim/00-core/money";
import { dateOf } from "../../sim/00-core/time";
import type { Dict, Params } from "../lang";

type Mail = (p: Params) => string;
const MONTHS = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"];

const hi = (p: Params) => (p.name ? `Ciao ${p.name},` : "Ciao,");
const SIGN: Mail[] = [
  (p) => `Cordiali saluti,\nIl team di ${p.company}`,
  (p) => `Un saluto,\nSupporto ${p.company}\nsupport@${p.host}`,
  (p) => `A presto,\nIl tuo servizio clienti ${p.company}`,
];
const to = (greet: Mail) => (i: number, body: Mail): Mail => (p) => `${greet(p)}\n\n${body(p)}\n\n${SIGN[i](p)}`;
const customer = to(hi), sender = to(() => "Gentili signori,"), lead = to((p) => `Ciao ${p.name},`);
const siteOf = (p: Params) => new URL(String(p.url)).hostname;
const site = (p: Params) => p.domain || p.service || "il tuo sito";
const svc = (p: Params) => p.hostname || p.service || "il tuo servizio";
const when = (p: Params) => {
  const d = dateOf(Number(p.hour));
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}, ore ${String(d.getUTCHours()).padStart(2, "0")}:00`;
};
// "dal 5 maggio", but "dall'8", "dall'11" and "dall'18".
const since = (p: Params) => `${[8, 11, 18].includes(dateOf(Number(p.hour)).getUTCDate()) ? "dall'" : "dal "}${when(p)}`;
const setupFee = (p: Params) => (Number(p.setup) > 0 ? ` più un costo di attivazione una tantum di ${euroCents(Number(p.setup))}` : "");
const hosting = (p: Params) => (p.domain ? `${p.line} per ${p.domain}` : p.line);
const plural = (n: unknown, one: string, many: string) => (Number(n) === 1 ? one : many);
const domainLine = (p: Params) => (Number(p.owned) ? `Il trasferimento di ${p.domain} da noi è completato, e da ora ci occupiamo dei suoi rinnovi.` : `Abbiamo registrato ${p.domain} per te.`);

const MAILS: Record<string, [Mail, Mail, Mail]> = {
  "tpl.ack": [
    (p) => `Grazie per la segnalazione. Sappiamo che ${svc(p)} non è raggiungibile e i nostri tecnici ci stanno lavorando proprio ora. Ti scriveremo non appena sarà di nuovo attivo.`,
    (p) => `Confermiamo il disservizio di ${svc(p)}. La causa è in via di risoluzione mentre scriviamo, e ci sentiremo appena tutto funziona di nuovo.`,
    (p) => `Scusa per l'interruzione. ${svc(p)} è fermo da parte nostra e la riparazione è in corso. Non devi fare nulla.`,
  ],
  "tpl.back": [
    (p) => `${svc(p)} è di nuovo online e tutto funziona normalmente. Ci scusiamo per l'interruzione.`,
    (p) => `Buone notizie: il problema è risolto e ${svc(p)} risponde di nuovo. Grazie per la pazienza.`,
    (p) => `Il disservizio è finito e ${svc(p)} è di nuovo raggiungibile. Facci sapere se qualcosa non va ancora.`,
  ],
  "tpl.askDetails": [
    () => "Grazie per il tuo messaggio. Puoi dirci qualcosa di più su quello che vedi, possibilmente con il messaggio di errore esatto e l'ora in cui è successo?",
    () => "Vorremmo aiutarti. Puoi mandarci uno screenshot o il testo esatto del messaggio che ricevi?",
    () => "Per indagare bene ci servono ancora alcuni dettagli. Cosa stavi facendo quando è successo e cosa hai visto?",
  ],
  "tpl.ftp": [
    (p) => `Collegati con un client FTP come FileZilla a ftp.${p.host} usando le credenziali del pannello, poi copia i tuoi file nella cartella htdocs di ${site(p)}. Sono online subito.`,
    (p) => `Puoi caricare le tue pagine via FTP: il server è ftp.${p.host}, utente e password sono quelli del pannello. Tutto ciò che sta nella cartella htdocs compare su ${site(p)}.`,
    (p) => `Il modo più rapido è l'FTP. Punta il tuo programma FTP su ftp.${p.host}, accedi con i dati del pannello e butta i file in htdocs. ${site(p)} li mostra subito.`,
  ],
  "tpl.mail": [
    (p) => `Inserisci mail.${p.host} come server in entrata e in uscita, con il tuo indirizzo e-mail completo come nome utente, porta 993 per IMAP e 587 per l'invio.`,
    (p) => `Il nome del server per la posta in entrata e in uscita è mail.${p.host}. Usa il tuo indirizzo e-mail completo come nome utente e la password della casella.`,
    (p) => `In Outlook scegli IMAP e inserisci mail.${p.host} per entrambi i server. Il nome utente è il tuo indirizzo completo${p.domain ? ` su ${p.domain}` : ""}.`,
  ],
  "tpl.dns": [
    (p) => `Imposta ns1.${p.host} e ns2.${p.host} come name server di ${site(p)} presso il tuo registrar. La modifica può impiegare fino a un giorno per arrivare ovunque.`,
    (p) => `Presso il registrar dove hai comprato ${site(p)}, sostituisci i name server con ns1.${p.host} e ns2.${p.host}. Entro un giorno il dominio mostra il tuo sito.`,
    (p) => `${p.domain ? `${p.domain} deve` : "Il tuo dominio deve"} puntare a noi: inserisci ns1.${p.host} e ns2.${p.host} come name server presso il tuo registrar. Di solito bastano poche ore, al massimo un giorno.`,
  ],
  "tpl.panel": [
    (p) => `Abbiamo inviato una nuova password del pannello di controllo al tuo indirizzo di contatto. Puoi accedere su panel.${p.host}.`,
    (p) => `Una nuova password del pannello sta arrivando nella tua casella. La pagina di accesso è panel.${p.host}.`,
    (p) => `Abbiamo reimpostato l'accesso al tuo pannello di controllo e ti abbiamo mandato la nuova password via e-mail. Accedi su panel.${p.host} e cambiala.`,
  ],
  "tpl.ssl": [
    (p) => `Possiamo installare un certificato SSL per ${site(p)}. Appena lo ordini, il lucchetto compare entro un'ora e l'avviso sparisce.`,
    (p) => `L'avviso sparisce con un certificato SSL. Ordinane uno per ${site(p)} e lo installiamo noi.`,
    (p) => `${site(p)} ha bisogno di un certificato SSL per il lucchetto. Lo configuriamo noi appena lo ordini.`,
  ],
  "tpl.ssh": [
    (p) => `Apri un client SSH come PuTTYcat e collegati a ${p.hostname || "il tuo server"} come root. La password è nell'e-mail di configurazione che abbiamo inviato da ${p.host}.`,
    (p) => `Si accede via SSH: collegati a ${p.hostname || "il tuo server"} con l'utente root e la password della tua e-mail di configurazione.`,
    (p) => `Usa un qualsiasi client SSH e collegati a ${p.hostname || "il tuo server"} come root. Se hai perso l'e-mail di configurazione con la password, rispondi qui e te ne mandiamo una nuova.`,
  ],
  "tpl.addon": [
    (p) => `Sì, può condividere il pacchetto. Aggiungi il nuovo dominio nel pannello di controllo su panel.${p.host}, sotto Domini, e scegli una cartella per lui.`,
    (p) => `Non serve un secondo pacchetto. Nel pannello di controllo su panel.${p.host}, aggiungi il dominio sotto Domini e puntalo a una cartella tutta sua.`,
    (p) => `Puoi far girare il nuovo dominio sullo stesso hosting. Apri Domini nel pannello di controllo su panel.${p.host}, aggiungilo e scegli una cartella.`,
  ],
  "tpl.php": [
    (p) => `La versione di PHP di ${site(p)} la scegli tu nel pannello di controllo su panel.${p.host}, sotto Impostazioni PHP. Vale subito.`,
    (p) => `Apri le Impostazioni PHP nel pannello di controllo su panel.${p.host} e scegli la versione più recente. ${site(p)} la usa subito.`,
    (p) => `Nel pannello di controllo su panel.${p.host}, le Impostazioni PHP ti permettono di cambiare versione per ${site(p)}. Consigliamo la più recente supportata dai tuoi plugin.`,
  ],
  offerOnce: [
    (p) => `Possiamo aggiornare ${site(p)} per te. È un intervento una tantum da ${euroCents(Number(p.once))}, e non devi fare nulla.`,
    (p) => `Al software di ${site(p)} mancano gli aggiornamenti di sicurezza. Li installiamo con una tariffa una tantum di ${euroCents(Number(p.once))}.`,
    (p) => `Ci occupiamo volentieri dell'aggiornamento di ${site(p)}. Il prezzo una tantum è di ${euroCents(Number(p.once))}.`,
  ],
  offerManaged: [
    (p) => `Possiamo tenere ${site(p)} aggiornato per te d'ora in poi. Gli aggiornamenti gestiti costano ${euroCents(Number(p.managed))} al mese, e installiamo ogni patch di sicurezza entro un giorno.`,
    (p) => `Con gli aggiornamenti gestiti a ${euroCents(Number(p.managed))} al mese, aggiorniamo il software di ${site(p)} appena esce una correzione, così non devi pensarci.`,
    (p) => `Ti proponiamo di occuparci degli aggiornamenti di ${site(p)} per ${euroCents(Number(p.managed))} al mese. Ogni patch di sicurezza viene installata entro un giorno.`,
  ],
  free: [
    (p) => `Abbiamo aggiornato gratuitamente il software di ${site(p)}. Tutto gira di nuovo sull'ultima versione.`,
    (p) => `L'aggiornamento di ${site(p)} è fatto e non c'è niente da pagare. Il sito gira sull'ultima versione.`,
    (p) => `Ci siamo occupati noi dell'aggiornamento di ${site(p)}. Stavolta è gratis, e il sito è aggiornato.`,
  ],
  clean: [
    (p) => `Abbiamo ripulito ${site(p)} e ripristinato la tua homepage. Cambia le password e tieni il software aggiornato.`,
    (p) => `${site(p)} è di nuovo pulito e mostra la tua homepage. Se aggiorni il software e cambi le password, resterà così.`,
    (p) => `Il tuo sito ${site(p)} è tornato normale. Abbiamo rimosso i file dell'intruso; aggiorna il software e scegli nuove password.`,
  ],
  noBackup: [
    (p) => `Non abbiamo nessun backup di ${site(p)} da ripristinare. Ricarica il sito dalla tua copia e scegli nuove password.`,
    (p) => `Purtroppo da noi non esiste un backup di ${site(p)}. Dovrai ripristinarlo dai tuoi file e cambiare le password.`,
    (p) => `Non possiamo ripristinare ${site(p)} perché non esiste alcun backup. Ricostruiscilo dalla tua copia e tieni il software aggiornato.`,
  ],
  "tpl.explain": [
    () => "Il secondo pagamento copre i consumi del mese scorso, che fatturiamo in via posticipata. Non ti è stato addebitato due volte nulla.",
    () => "Ci sono due fatture perché i consumi vengono fatturati a fine mese per il mese precedente. Sono entrambe corrette, e nulla è stato addebitato due volte.",
    () => "Un pagamento è la fattura attuale, l'altro i consumi del mese scorso, che fatturiamo in via posticipata. Il tuo conto è in ordine.",
  ],
  "tpl.foundPayment": [
    () => "Abbiamo trovato il tuo bonifico e lo abbiamo registrato sulla fattura. Puoi ignorare il sollecito.",
    () => "Grazie, il pagamento è arrivato e la fattura è saldata. Il sollecito è partito prima che lo registrassimo.",
    () => "Il tuo bonifico ora è registrato sulla fattura. Non resta nulla di aperto, quindi il sollecito non vale più.",
  ],
  "tpl.resend": [
    () => "Ti abbiamo mandato una copia della fattura. Facci sapere se non arriva.",
    () => "Una copia della fattura è in arrivo al tuo indirizzo di contatto.",
    () => "Certo. Ti abbiamo rimandato la fattura via e-mail, dovrebbe essere nella tua casella tra pochi minuti.",
  ],
  "tpl.extension": [
    () => "Nessun problema, stavolta puoi pagare la fattura due settimane dopo. I tuoi servizi restano online.",
    () => "Abbiamo spostato di due settimane la scadenza della tua fattura. Il resto non cambia.",
    () => "Va bene. Paga entro due settimane dalla data abituale, nel frattempo i tuoi servizi continuano a funzionare.",
  ],
  "tpl.newPrice": [
    (p) => `Quest'anno i nostri costi sono aumentati, e il nuovo prezzo di ${svc(p)} ci permette di mantenerlo veloce e affidabile.`,
    (p) => `Capiamo che l'aumento non faccia piacere. Energia e hardware sono rincarati, e il nuovo prezzo mantiene ${svc(p)} alla qualità che conosci.`,
    (p) => `Il nuovo prezzo di ${svc(p)} riflette i maggiori costi di energia e hardware. Paga anche le persone che rispondono a e-mail come questa.`,
  ],
  "tpl.awaitPayment": [
    () => "Grazie. I tuoi servizi tornano online appena arriva il pagamento.",
    () => "Grazie per l'avviso. Quando il pagamento ci raggiunge, tutto viene riattivato automaticamente.",
    () => "Capito. I tuoi servizi tornano nel momento in cui il pagamento viene registrato da noi.",
  ],
  "tpl.offer": [
    (p) => `Possiamo dare più risorse a ${svc(p)} senza fermi. I prezzi sono nel riepilogo allegato, rispondi e facciamo il passaggio.`,
    (p) => `Più risorse non sono un problema. L'upgrade richiede pochi minuti, ${svc(p)} resta online e i prezzi li trovi nell'allegato.`,
    (p) => `Grazie di crescere con noi. Abbiamo allegato i prezzi per più risorse, e passiamo ${svc(p)} al nuovo piano lo stesso giorno in cui rispondi.`,
  ],
  "tpl.warn": [
    (p) => `${svc(p)} sta inviando traffico abusivo che altre reti ci segnalano. Risolvi entro 24 ore, altrimenti dovremo sospenderlo.`,
    (p) => `Abbiamo ricevuto segnalazioni di abuso su ${svc(p)}. Mettilo in sicurezza entro 24 ore per evitare la sospensione.`,
    (p) => `Altri provider segnalano attacchi o spam provenienti da ${svc(p)}. Probabilmente è compromesso. Ripuliscilo entro 24 ore, o lo sospenderemo.`,
  ],
  credit: [
    (p) => `Ci dispiace per il disagio. Abbiamo accreditato ${euroCents(Number(p.credit))} sul tuo conto, che verranno detratti dalla prossima fattura.`,
    (p) => `Per scusarci, la tua prossima fattura è più bassa di ${euroCents(Number(p.credit))}. Grazie di restare con noi.`,
    (p) => `Abbiamo aggiunto un credito di ${euroCents(Number(p.credit))} al tuo conto. Viene detratto automaticamente dalla prossima fattura.`,
  ],
  refund: [
    (p) => `Ti abbiamo rimborsato un mese, ${euroCents(Number(p.refund))}, sul tuo conto. Ci dispiace per quanto successo.`,
    (p) => `Riceverai un rimborso di ${euroCents(Number(p.refund))} per questo mese. Accetta le nostre scuse.`,
    (p) => `Abbiamo disposto il rimborso di un mese intero, ${euroCents(Number(p.refund))}. Il denaro arriva sul tuo conto in pochi giorni.`,
  ],
  refuse: [
    () => "Abbiamo esaminato con attenzione la tua richiesta. L'interruzione è coperta dalle condizioni del tuo contratto, quindi stavolta non possiamo offrire un rimborso.",
    () => "Grazie per il tuo messaggio. Il tuo livello di servizio copre questo caso, quindi un rimborso non è possibile. Ci dispiace per il disagio.",
    () => "Capiamo la tua frustrazione, ma non possiamo rimborsare questo periodo. Qui valgono le condizioni del tuo contratto.",
  ],
  revert: [
    (p) => `Abbiamo riportato il prezzo di ${svc(p)} a quello che pagavi prima. La modifica vale dalla prossima fattura.`,
    (p) => `Fai bene a chiedere. ${svc(p)} torna al prezzo precedente dalla prossima fattura.`,
    (p) => `Abbiamo annullato la variazione di prezzo di ${svc(p)}. La tua prossima fattura mostrerà di nuovo il vecchio prezzo.`,
  ],
  "retain.half": [
    () => "Ci dispiacerebbe vederti andare via. Se resti, il prossimo mese ti costa la metà, con tutto come adesso.",
    () => "Prima che tu vada, vorremmo scontarti il 50% sul prossimo mese. Rispondi se vuoi restare.",
    () => "Ci teniamo a te come cliente. Resta con noi e dimezziamo il tuo prossimo mese.",
  ],
  "retain.free": [
    () => "Ci dispiacerebbe vederti andare via. Se resti, il prossimo mese offriamo noi, con tutto come adesso.",
    () => "Prima che tu vada, vorremmo offrirti un mese gratis per rimediare al disagio. Rispondi se vuoi restare.",
    () => "Ci teniamo a te come cliente. Resta con noi e il prossimo mese non ti costa nulla.",
  ],
  "retain.discount": [
    (p) => `Ci dispiacerebbe vederti andare via. Se resti, ti facciamo il 20% di sconto sui tuoi servizi per ${p.months} ${plural(p.months, "mese", "mesi")}.`,
    (p) => `Prima che tu vada, vorremmo offrirti il 20% di sconto per ${p.months} ${plural(p.months, "mese", "mesi")}. Rispondi se vuoi restare.`,
    (p) => `Ci teniamo a te come cliente. Resta con noi e il tuo prezzo scende di un quinto per ${p.months} ${plural(p.months, "mese", "mesi")}.`,
  ],
  "retain.upgrade": [
    () => "Ci dispiacerebbe vederti andare via. Se resti, portiamo il tuo servizio alla taglia successiva allo stesso prezzo di oggi.",
    () => "Prima che tu vada, vorremmo darti più risorse senza costi aggiuntivi. Rispondi se vuoi restare.",
    () => "Ci teniamo a te come cliente. Resta con noi e potenziamo il tuo servizio gratis.",
  ],
  "retain.fix": [
    (p) => `Ci dispiace per il disagio. Lo risolveremo entro ${p.fixDays} ${plural(p.fixDays, "giorno", "giorni")} e ti ricontatteremo allora. Dacci la possibilità di rimediare.`,
    (p) => `Accetta le nostre scuse. Il nostro team ci sta lavorando, e entro ${p.fixDays} ${plural(p.fixDays, "giorno", "giorni")} il tuo servizio funzionerà come deve.`,
    (p) => `Ti abbiamo deluso e ce ne dispiace. Dacci ${p.fixDays} ${plural(p.fixDays, "giorno", "giorni")} per sistemare tutto prima di decidere.`,
  ],
  "retain.move": [
    () => "Ci dispiace per il disagio. Se resti, spostiamo il tuo servizio su un server migliore del nostro data center e ci occupiamo noi del trasloco.",
    () => "Prima che tu vada, lascia che spostiamo il tuo servizio su un server migliore. Organizziamo il trasloco quando ti fa comodo.",
    () => "Ci teniamo a te come cliente. Resta con noi e spostiamo il tuo servizio su un server più recente senza costi.",
  ],
  cancel: [
    () => "Abbiamo elaborato la tua disdetta. I tuoi servizi terminano oggi e riceverai una fattura finale. Grazie di aver scelto il nostro hosting.",
    () => "Il tuo contratto è disdetto come richiesto. Scarica tutto ciò che vuoi conservare, i servizi terminano oggi.",
    () => "Confermiamo la disdetta dei tuoi servizi. Grazie per il tempo passato con noi, e buona fortuna con il tuo nuovo provider.",
  ],
  unsuspend: [
    (p) => `I tuoi servizi sono di nuovo online. Hai ancora ${p.days} ${plural(p.days, "giorno", "giorni")} per pagare la fattura aperta.`,
    (p) => `Abbiamo riattivato tutto e prorogato la scadenza del pagamento di ${p.days} ${plural(p.days, "giorno", "giorni")}.`,
    (p) => `I tuoi servizi funzionano di nuovo. Salda la fattura ${plural(p.days, "entro il giorno successivo", `nei prossimi ${p.days} giorni`)}.`,
  ],
  keep: [
    () => "Capiamo la situazione, ma i tuoi servizi restano sospesi finché la fattura aperta non è pagata. Dopo tornano automaticamente.",
    () => "Ci dispiace, ma non possiamo revocare la sospensione prima dell'arrivo del pagamento. Appena arriva, tutto torna subito.",
    () => "Per ora i tuoi servizi restano sospesi. Appena la fattura viene pagata, vengono riattivati senza altri passaggi.",
  ],
  forward: [
    (p) => `Vi ringraziamo per la segnalazione riguardo a ${p.url}. L'abbiamo inoltrata al nostro cliente chiedendogli di rispondere.`,
    (p) => `Abbiamo girato la vostra segnalazione riguardo a ${p.url} al cliente responsabile del sito.`,
    (p) => `La vostra segnalazione riguardo a ${p.url} è stata inoltrata al nostro cliente. Per ogni ulteriore questione, contattatelo direttamente.`,
  ],
  takedown: [
    (p) => `Vi ringraziamo per la segnalazione. Il contenuto su ${p.url} è stato messo offline per ${p.hours} ${plural(p.hours, "ora", "ore")} mentre il nostro cliente lo verifica.`,
    (p) => `Abbiamo disattivato l'accesso a ${p.url} per ${p.hours} ${plural(p.hours, "ora", "ore")} e informato il nostro cliente.`,
    (p) => `Il materiale su ${p.url} è offline da ora. Il nostro cliente ha ${p.hours} ${plural(p.hours, "ora", "ore")} per rispondere alla vostra segnalazione.`,
  ],
  notOurs: [
    (p) => `Vi ringraziamo per la segnalazione riguardo a ${p.url}. Questo sito non si trova sulla nostra rete, quindi non possiamo intervenire. Eseguite "whois ${siteOf(p)}" per trovare il registrar, poi whois sull'indirizzo IP a cui punta il dominio: il risultato indica il provider di hosting e il suo contatto per gli abusi.`,
    (p) => `Abbiamo controllato ${p.url}, e non è ospitato sulla nostra rete. Una ricerca whois su ${siteOf(p)} mostra il registrar, e una ricerca whois sull'indirizzo IP del sito mostra la rete che lo ospita, di solito con un indirizzo per gli abusi a cui scrivere.`,
    (p) => `Il sito su ${p.url} non è nostro. Per trovare il contatto giusto, cercate ${siteOf(p)} con whois per il registrar, e il suo indirizzo IP con whois per l'ufficio abusi del provider di hosting.`,
  ],
  reject: [
    (p) => `Abbiamo esaminato la vostra segnalazione riguardo a ${p.url}. Non soddisfa i requisiti formali, quindi non intraprenderemo azioni.`,
    (p) => `Vi ringraziamo per il messaggio riguardo a ${p.url}. Dopo la verifica, non vediamo motivi per rimuovere il contenuto.`,
    (p) => `Abbiamo valutato la vostra segnalazione riguardo a ${p.url} e non possiamo darvi seguito nella forma attuale.`,
  ],
  comply: [
    (p) => `Confermiamo la ricezione della vostra richiesta riguardo a ${p.url}. Vi daremo seguito e forniremo le informazioni richieste entro il termine indicato.`,
    (p) => `La vostra richiesta riguardo a ${p.url} è stata ricevuta. Collaboreremo e invieremo le informazioni richieste.`,
    (p) => `Daremo seguito alla vostra richiesta riguardo a ${p.url}. Il nostro team sta preparando la documentazione richiesta.`,
  ],
  object: [
    (p) => `Abbiamo ricevuto la vostra richiesta riguardo a ${p.url}. Ci opponiamo nella forma attuale e chiediamo un ordine del tribunale prima di divulgare dati o rimuovere contenuti.`,
    (p) => `Riguardo a ${p.url}, non possiamo dare seguito senza un ordine del tribunale. Risponderemo ovviamente subito a un ordine di questo tipo.`,
    (p) => `Respingiamo con rispetto la vostra richiesta riguardo a ${p.url}. I dati dei nostri clienti vengono rilasciati solo sulla base di un ordine del tribunale.`,
  ],
  "decline.notOffered": [
    (p) => `Grazie per l'interesse in ${hosting(p)}. Purtroppo al momento non offriamo questo prodotto a ${p.city}, quindi non possiamo accettare il tuo ordine.`,
    (p) => `Grazie per il tuo ordine. Ci dispiace, ma ${p.line} non è ancora disponibile a ${p.city}. Speriamo di poterti aiutare in futuro.`,
    (p) => `Grazie di aver pensato a noi. ${p.line} per ora non fa parte della nostra offerta a ${p.city}, quindi dobbiamo rifiutare questo ordine.`,
  ],
  "decline.noCapacity": [
    (p) => `Grazie per il tuo ordine di ${hosting(p)}. I nostri server a ${p.city} sono al completo al momento, quindi non possiamo configurarlo per te.`,
    (p) => `Ci dispiace, ma al momento non abbiamo capacità libera a ${p.city} e non possiamo accettare il tuo ordine. Speriamo di accoglierti un'altra volta.`,
    (p) => `Grazie di averci scelto. Purtroppo ${p.city} è a piena capacità, e preferiamo rifiutare piuttosto che configurare male ${p.line}.`,
  ],
  "decline.busy": [
    (p) => `Grazie per l'interesse in ${hosting(p)}. Al momento non accettiamo nuovi ordini di questo tipo.`,
    () => "Grazie per il tuo ordine. Purtroppo non possiamo prenderlo in carico in questo momento. Ti auguriamo il massimo successo con il tuo progetto.",
    (p) => `Apprezziamo la tua richiesta per ${hosting(p)}, ma al momento non possiamo accettarla.`,
  ],
  accept: [
    (p) => `Grazie per il tuo ordine. ${hosting(p)} è configurato a ${p.city} e online ${since(p)}, a ${euroCents(Number(p.price))} al mese. I dati di accesso seguono in un'e-mail separata.`,
    (p) => `Benvenuto a bordo! Abbiamo configurato ${hosting(p)} a ${p.city} il ${when(p)}. Il prezzo mensile è di ${euroCents(Number(p.price))}, e i tuoi dati di accesso sono in arrivo.`,
    (p) => `Il tuo ordine è completo: ${hosting(p)} gira a ${p.city} ${since(p)} per ${euroCents(Number(p.price))} al mese. Riceverai a breve i dati di accesso.`,
  ],
  failed: [
    (p) => `Grazie per il tuo ordine. Abbiamo provato a configurare ${hosting(p)}, ma da parte nostra non è stato possibile completarlo. Ci dispiace, e abbiamo annullato l'ordine.`,
    (p) => `Ci dispiace: la configurazione di ${hosting(p)} a ${p.city} è fallita, quindi dobbiamo annullare il tuo ordine. Non ti è stato addebitato nulla.`,
    (p) => `Purtroppo non siamo riusciti a configurare ${hosting(p)} come ordinato. L'ordine è annullato e non verrà fatturato nulla.`,
  ],
  "order.quote": [
    (p) => `Grazie per la richiesta di ${hosting(p)}. Possiamo offrirlo a ${euroCents(Number(p.price))} al mese${setupFee(p)}. Facci sapere se va bene per te.`,
    (p) => `Ecco la nostra offerta per ${hosting(p)} a ${p.city}: ${euroCents(Number(p.price))} al mese${setupFee(p)}. Configuriamo tutto appena confermi.`,
    (p) => `Grazie di averci contattato. Per ${hosting(p)} chiederemmo ${euroCents(Number(p.price))} al mese${setupFee(p)}. Dicci se vuoi procedere.`,
  ],
  "order.invoice": [
    (p) => `Confermiamo il tuo ordine di ${hosting(p)} a ${euroCents(Number(p.price))} al mese. In allegato la fattura ${p.invoice} di ${euroCents(Number(p.total))}. Configuriamo tutto appena viene pagata.`,
    (p) => `Il tuo ordine è confermato: ${hosting(p)} a ${p.city} per ${euroCents(Number(p.price))} al mese. Paga la fattura ${p.invoice} (${euroCents(Number(p.total))}) e ci mettiamo al lavoro.`,
    (p) => `Grazie, l'ordine è confermato. ${hosting(p)} costa ${euroCents(Number(p.price))} al mese; la prima fattura, ${p.invoice}, ammonta a ${euroCents(Number(p.total))}.`,
  ],
  "order.live": [
    (p) => (p.domain
      ? `${domainLine(p)} È online sui nostri server a ${p.city} ${since(p)}. Accedi su panel.${p.host} con il nome utente ${String(p.domain).split(".")[0]}; la password segue in un'e-mail separata. Carica il tuo sito via FTP su ftp.${p.domain}.`
      : `Il tuo ${p.line} a ${p.city} è attivo ${since(p)}. Accedi come root via SSH; indirizzo e password seguono in un'e-mail separata.`),
    (p) => (p.domain
      ? `${domainLine(p)} Il tuo spazio web è pronto ${since(p)}. Il pannello di controllo è su panel.${p.host}, e le tue caselle sono configurate su mail.${p.host}.`
      : `${p.line} è online a ${p.city} ${since(p)}. Il tuo accesso root è in arrivo con un'e-mail separata.`),
    (p) => `Tutto è configurato: ${hosting(p)} gira a ${p.city} ${since(p)}.${p.domain ? ` ${domainLine(p)}` : ""} I tuoi dati di accesso seguono in un'e-mail separata.`,
  ],
};
const LEAD = ["decline.notOffered", "decline.noCapacity", "decline.busy", "accept", "failed", "order.quote", "order.invoice", "order.live"];
const SENDER = ["forward", "takedown", "notOurs", "reject", "comply", "object"];

export default Object.fromEntries(Object.entries(MAILS).flatMap(([what, bodies]) =>
  bodies.map((body, i) => [`reply.${what}.${i}`, (LEAD.includes(what) ? lead : SENDER.includes(what) ? sender : customer)(i, body)]))) as Dict;
