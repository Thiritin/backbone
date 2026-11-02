import type { Dict } from "../lang";

const s = (n: string | number, one: string, many: string) => (Number(n) === 1 ? one : many);

export default {
  "ledger.registrarSignup": (p) => `Anmeldung bei ${p.name}`,
  "ledger.registrar": (p) => `Partnergebühr bei ${p.name}`,
  "ledger.certificates": (p) => `${p.count} SSL-${s(p.count, "Zertifikat", "Zertifikate")} bei ${p.name}`,
  "ledger.domains": (p) => `${p.count} ${s(p.count, "Domain", "Domains")} bei ${p.name}`,
  "ledger.companyMail": (p) => `Firmen-E-Mail: ${p.name}, ${p.seats} ${s(p.seats, "Postfach", "Postfächer")}`,
  "error.unknownRegistrar": () => "Diesen Registrar-Partner gibt es nicht.",
  "error.registrarLater": () => "Dieser Registrar-Partner ist noch nicht am Markt.",
  "error.registrarCurrent": () => "Du hast bereits einen Vertrag mit diesem Partner.",
  "error.transferBusy": () => "Die Domains ziehen noch zum aktuellen Partner um.",
  "error.needsRegistrar": () => "Schließe zuerst einen Registrar-Vertrag ab.",
  "error.registrarOther": () => "Deine Domains sind bei einem anderen Partner registriert.",
  "error.domainInvalid": () => "Verwende 3 bis 40 Buchstaben, Ziffern oder Bindestriche vor einer TLD, die die Registries verkaufen.",
  "error.nsInvalid": () => "Gib zwei verschiedene Hostnamen wie ns1.example.de ein.",
  "error.companyDomainOwned": () => "Das Unternehmen hat bereits eine Domain.",
  "error.noTransfer": () => "Es warten keine Domains auf den Umzug.",
  "error.unknownMailProvider": () => "Diesen Mail-Anbieter gibt es nicht.",
  "error.mailProviderLater": () => "Dieser Mail-Anbieter ist noch nicht am Markt.",
  "error.noMailServer": () => "Es ist kein Mailserver installiert.",
  "error.noMailService": () => "Das Unternehmen nutzt bereits kostenlose E-Mail.",
  "error.oneMailServer": () => "Das Unternehmen betreibt einen Mailserver.",
  "event.domainsTransferred.title": () => "Domains umgezogen",
  "event.domainsTransferred.text": (p) => `${p.count} ${s(p.count, "Domain wird", "Domains werden")} jetzt von ${p.name} verwaltet.`,
  "event.registrarTier.title": () => "Besserer Partnertarif",
  "event.registrarTier.text": (p) => `Bei ${p.domains} Domains rechnet ${p.name} deine Domains ab jetzt in der nächsten Stufe ab.`,
} satisfies Dict;
