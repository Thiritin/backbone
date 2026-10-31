import type { Dict } from "../lang";

export default {
  "error.packageProduct": () => "Diese Installation verkauft dieses Produkt nicht.",
  "error.packageName": () => "Paketnamen bestehen aus bis zu 24 Buchstaben, Ziffern, Leerzeichen, Bindestrichen und Unterstrichen.",
  "error.packageTaken": () => "Ein Paket mit diesem Namen existiert bereits.",
  "error.packageSpec": () => "Gib eine CPU-, RAM- und Plattengröße über null an.",
  "error.packageLimit": () => "Eine Installation hält höchstens 12 Pakete.",
  "error.packageInUse": () => "Aktive Konten nutzen dieses Paket noch.",
  "error.packageMissing": () => "Dieses Paket gibt es auf dem gewählten Host nicht.",
  "error.packageTooSmall": () => "Das Paket ist zu klein für den bestellten Tarif.",
  "error.username": () => "Benutzernamen beginnen mit einem Buchstaben und bestehen aus Kleinbuchstaben und Ziffern.",
  "error.usernameTaken": () => "Dieser Benutzername ist bereits vergeben.",
} satisfies Dict;
