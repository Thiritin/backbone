import type { Dict } from "../lang";

export default {
  "shop-downloads.download": () => "Scarica",
  "shop-downloads.file": () => "File",
  "shop-downloads.size": () => "Dimensione",
  "shop-downloads.mb": (p) => `${p.mb} MB`,
  "shop-downloads.licenceNeeded": () => "Per scaricare serve una licenza valida.",
  "shop-downloads.upload": () => "Carica l'archivio nel tuo spazio web ed estrailo nel File Manager nella cartella del sottodominio del portale.",
  "shop-downloads.database": () => "Crea un database MySQL con un utente.",
  "shop-downloads.installer": (p) => `Apri ${p.url} e segui il programma di installazione.`,
  "shop-downloads.activate": (p) => `Attiva ${p.name}`,
} satisfies Dict;
