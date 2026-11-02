import type { Dict } from "../lang";

export default {
  "providers.arubaba.navHome": () => "Home",
  "providers.arubaba.navSites": () => "Data center",
  "providers.arubaba.navOrder": () => "Colocation",
  "providers.arubaba.clientArea": () => "Area clienti",
  "providers.arubaba.heroEarly": () => "Colocation nel nostro data center italiano",
  "providers.arubaba.heroLate": () => "I tuoi server nel data center Arubaba",
  "providers.arubaba.text": (p) => `Porta i tuoi server in ${p.name} a ${p.city}: un data center certificato con alimentazione ridondata, impianto antincendio e personale presente giorno e notte.`,
  "providers.arubaba.discover": () => "Scopri il data center",
  "providers.arubaba.from": (p) => `da ${p.price}`,
  "providers.arubaba.perMonth": () => "al mese + IVA",
  "providers.arubaba.buy": () => "Acquista",
  "providers.arubaba.vat": () => "I prezzi si intendono IVA esclusa.",
  "providers.arubaba.footer": (p) => `© ${p.year} Arubaba S.p.A.`,
} satisfies Dict;
