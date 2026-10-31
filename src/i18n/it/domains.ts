import type { Dict } from "../lang";

const s = (n: string | number, one: string, many: string) => (Number(n) === 1 ? one : many);

export default {
  "ledger.registrarSignup": (p) => `Iscrizione presso ${p.name}`,
  "ledger.registrar": (p) => `Canone partner presso ${p.name}`,
  "ledger.certificates": (p) => `${p.count} ${s(p.count, "certificato SSL", "certificati SSL")} presso ${p.name}`,
  "ledger.domains": (p) => `${p.count} ${s(p.count, "dominio", "domini")} presso ${p.name}`,
  "ledger.companyMail": (p) => `E-mail aziendale: ${p.name}, ${p.seats} ${s(p.seats, "casella", "caselle")}`,
  "error.unknownRegistrar": () => "Questo partner registrar non esiste.",
  "error.registrarLater": () => "Questo partner registrar non è ancora sul mercato.",
  "error.registrarCurrent": () => "Hai già un contratto con questo partner.",
  "error.transferBusy": () => "I domini si stanno ancora trasferendo al partner attuale.",
  "error.needsRegistrar": () => "Firma prima un contratto con un registrar.",
  "error.registrarOther": () => "I tuoi domini sono registrati presso un altro partner.",
  "error.domainInvalid": () => "Usa da 3 a 40 lettere, cifre o trattini davanti a un TLD venduto dai registri.",
  "error.companyDomainOwned": () => "L'azienda ha già un dominio.",
  "error.noTransfer": () => "Nessun dominio è in attesa di trasferimento.",
  "error.unknownMailProvider": () => "Questo provider di posta non esiste.",
  "error.mailProviderLater": () => "Questo provider di posta non è ancora sul mercato.",
  "error.noMailServer": () => "Non è installato nessun server di posta.",
  "error.noMailService": () => "L'azienda usa già l'e-mail gratuita.",
  "error.oneMailServer": () => "L'azienda gestisce un solo server di posta.",
  "event.domainsTransferred.title": () => "Domini trasferiti",
  "event.domainsTransferred.text": (p) => `${p.count} ${s(p.count, "dominio è gestito", "domini sono gestiti")} ora da ${p.name}.`,
  "event.registrarTier.title": () => "Tariffa partner migliore",
  "event.registrarTier.text": (p) => `Con ${p.domains} domini, ${p.name} fattura ora i tuoi domini al livello successivo.`,
} satisfies Dict;
