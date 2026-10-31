import type { Dict } from "../lang";

export default {
  "error.packageProduct": () => "Questa installazione non vende quel prodotto.",
  "error.packageName": () => "I nomi dei pacchetti usano fino a 24 lettere, cifre, spazi, trattini e trattini bassi.",
  "error.packageTaken": () => "Esiste già un pacchetto con questo nome.",
  "error.packageSpec": () => "Indica una dimensione di CPU, RAM e disco maggiore di zero.",
  "error.packageLimit": () => "Un'installazione contiene al massimo 12 pacchetti.",
  "error.packageInUse": () => "Alcuni account attivi usano ancora questo pacchetto.",
  "error.packageMissing": () => "Questo pacchetto non esiste sull'host scelto.",
  "error.packageTooSmall": () => "Il pacchetto è troppo piccolo per il piano ordinato.",
  "error.username": () => "I nomi utente iniziano con una lettera e usano minuscole e cifre.",
  "error.usernameTaken": () => "Questo nome utente è già in uso.",
} satisfies Dict;
