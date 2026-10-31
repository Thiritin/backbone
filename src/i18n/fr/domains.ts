import type { Dict } from "../lang";

const s = (n: string | number, one: string, many: string) => (Number(n) < 2 ? one : many);

export default {
  "ledger.registrarSignup": (p) => `Inscription chez ${p.name}`,
  "ledger.registrar": (p) => `Frais de partenaire chez ${p.name}`,
  "ledger.certificates": (p) => `${p.count} ${s(p.count, "certificat SSL", "certificats SSL")} chez ${p.name}`,
  "ledger.domains": (p) => `${p.count} ${s(p.count, "nom de domaine", "noms de domaine")} chez ${p.name}`,
  "ledger.companyMail": (p) => `E-mail d'entreprise : ${p.name}, ${p.seats} ${s(p.seats, "boîte mail", "boîtes mail")}`,
  "error.unknownRegistrar": () => "Ce partenaire registrar n'existe pas.",
  "error.registrarLater": () => "Ce partenaire registrar n'est pas encore sur le marché.",
  "error.registrarCurrent": () => "Tu as déjà un contrat avec ce partenaire.",
  "error.transferBusy": () => "Les noms de domaine sont encore en cours de transfert vers le partenaire actuel.",
  "error.needsRegistrar": () => "Signe d'abord un contrat avec un registrar.",
  "error.registrarOther": () => "Tes noms de domaine sont enregistrés chez un autre partenaire.",
  "error.domainInvalid": () => "Utilise de 3 à 40 lettres, chiffres ou traits d'union devant une extension que les registres vendent.",
  "error.companyDomainOwned": () => "L'entreprise a déjà un nom de domaine.",
  "error.noTransfer": () => "Aucun nom de domaine n'attend de transfert.",
  "error.unknownMailProvider": () => "Ce fournisseur de messagerie n'existe pas.",
  "error.mailProviderLater": () => "Ce fournisseur de messagerie n'est pas encore sur le marché.",
  "error.noMailServer": () => "Aucun serveur de messagerie n'est installé.",
  "error.noMailService": () => "L'entreprise utilise déjà une messagerie gratuite.",
  "error.oneMailServer": () => "L'entreprise fait tourner un seul serveur de messagerie.",
  "event.domainsTransferred.title": () => "Noms de domaine transférés",
  "event.domainsTransferred.text": (p) => `${p.count} ${s(p.count, "nom de domaine est", "noms de domaine sont")} désormais géré${Number(p.count) < 2 ? "" : "s"} par ${p.name}.`,
  "event.registrarTier.title": () => "Meilleur tarif partenaire",
  "event.registrarTier.text": (p) => `Avec ${p.domains} noms de domaine, ${p.name} facture désormais tes domaines au palier suivant.`,
} satisfies Dict;
