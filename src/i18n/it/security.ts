import type { Dict, Params } from "../lang";

const VULN: Record<string, string> = {
  mopb: "un bug di corruzione della memoria nel motore Zend, uno dei trenta trovati questo mese",
  cgi: "un bug che permette a una query string di passare opzioni da riga di comando a PHP-CGI",
  fpm: "un buffer underflow in PHP-FPM che esegue codice da un URL costruito ad arte",
  argv: "un'iniezione di argomenti in PHP-CGI che un trattino morbido può innescare",
};
const vuln = (p: Params) => VULN[p.name] ?? String(p.name);

export default {
  "event.vuln.announced.title": () => "Vulnerabilità di sicurezza in PHP",
  "event.vuln.announced.text": (p) => `I media segnalano ${vuln(p)}, che colpisce PHP ${p.versions}. Il progetto PHP lo conferma, non ha ancora una correzione e prevede una patch per il ${p.date}.`,
  "event.vuln.poc.title": () => "Proof of concept pubblicato",
  "event.vuln.poc.text": (p) => `Qualcuno su Twister ha pubblicato un exploit funzionante per PHP ${p.versions}, con screenshot e tre emoji di fuoco. È stato ricondiviso 4.000 volte.`,
  "event.vuln.warning.title": () => "L'ufficio federale lancia l'allarme",
  "event.vuln.warning.text": (p) => `Il Bundesamt für Sicherheit in der Informationstechnick segnala scansioni di massa su PHP ${p.versions} e consiglia di spegnere i sistemi interessati finché non esce la patch.`,
  "event.vuln.patch.title": () => "Patch di PHP rilasciata",
  "event.vuln.patch.text": (p) => `Il progetto PHP ha rilasciato la correzione per PHP ${p.versions} alla data annunciata, con sorpresa generale.`,
  "event.vuln.hacked.title": () => "Nodo compromesso",
  "event.vuln.hacked.text": (p) => {
    const leak = `${p.customers} ${Number(p.customers) === 1 ? "cliente ha ricevuto" : "clienti hanno ricevuto"} un avviso di fuga di dati.`;
    if (p.kind === "mail") return `Degli attaccanti hanno preso il controllo di ${p.device} e da lì mandano spam.`;
    const hit = p.kind === "cloud" ? "hanno preso il controllo delle macchine virtuali su" : p.kind === "game" ? "hanno preso il controllo dei server di gioco su" : "hanno deturpato i siti su";
    return `Degli attaccanti ${hit} ${p.device} e da lì mandano spam. ${leak}`;
  },
  "error.patchPending": () => "La patch per questa vulnerabilità non è ancora uscita.",
  "error.sitesOffline": () => "I siti su questo nodo sono già offline.",
  "error.sitesOnline": () => "I siti su questo nodo sono già online.",
  "error.notHacked": () => "Questo nodo non è compromesso.",
} satisfies Dict;
