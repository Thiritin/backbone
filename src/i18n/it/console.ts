import type { Dict } from "../lang";

export default {
  "error.unknownOs": () => "Questo sistema operativo non esiste.",
  "error.otherMedia": () => "Il supporto di installazione contiene un altro sistema operativo.",
  "error.noImage": () => "Scarica prima l'ISO di questo sistema operativo dal suo sito web.",
  "error.stickIn": () => "La chiavetta USB è già inserita in questo server.",
  "error.stickAway": () => "Estrai prima la chiavetta USB dal server.",
  "error.stickOut": () => "La chiavetta USB non è inserita.",
  "error.stickInstalling": () => "Il server sta installando dalla chiavetta USB.",
  "ipmi.log.stickIn": () => "Chiavetta USB inserita",
  "error.noOs": () => "Installa prima un sistema operativo su questa macchina.",
  "error.osNotUp": () => "Il sistema operativo della macchina non è in esecuzione.",
  "error.noUpgrade": () => "Non è ancora uscita una versione più recente di questo sistema operativo.",
  "error.notVmwhere": () => "L'App Suite è venduta per i cluster VMwhere.",
  "error.noAppSuite": () => "Questo cluster non ha l'App Suite.",
  "error.hasAppSuite": () => "Questo cluster ha già l'App Suite.",
  "error.noDownload": () => "Il programma di installazione non è riuscito a scaricare il pacchetto.",
  "error.noMirror": () => "Il mirror dell'archivio Debiant indicato non è raggiungibile.",
} satisfies Dict;
