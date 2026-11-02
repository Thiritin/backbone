import type { Dict } from "../lang";

const s = (n: string | number, one: string, many: string) => (Number(n) === 1 ? one : many);

export default {
  "ledger.registrarSignup": (p) => `Alta en ${p.name}`,
  "ledger.registrar": (p) => `Cuota de socio en ${p.name}`,
  "ledger.certificates": (p) => `${p.count} ${s(p.count, "certificado SSL", "certificados SSL")} en ${p.name}`,
  "ledger.domains": (p) => `${p.count} ${s(p.count, "dominio", "dominios")} en ${p.name}`,
  "ledger.companyMail": (p) => `Correo de empresa: ${p.name}, ${p.seats} ${s(p.seats, "buzón", "buzones")}`,
  "error.unknownRegistrar": () => "Este registrador asociado no existe.",
  "error.registrarLater": () => "Este registrador asociado aún no está en el mercado.",
  "error.registrarCurrent": () => "Ya tienes un contrato con este socio.",
  "error.transferBusy": () => "Los dominios aún se están trasladando al socio actual.",
  "error.needsRegistrar": () => "Firma primero un contrato con un registrador.",
  "error.registrarOther": () => "Tus dominios están registrados con otro socio.",
  "error.domainInvalid": () => "Usa de 3 a 40 letras, dígitos o guiones delante de un TLD que vendan los registros.",
  "error.nsInvalid": () => "Introduce dos nombres de host distintos, como ns1.example.de.",
  "error.companyDomainOwned": () => "La empresa ya tiene un dominio.",
  "error.noTransfer": () => "No hay dominios esperando traslado.",
  "error.unknownMailProvider": () => "Este proveedor de correo no existe.",
  "error.mailProviderLater": () => "Este proveedor de correo aún no está en el mercado.",
  "error.noMailServer": () => "No hay ningún servidor de correo instalado.",
  "error.noMailService": () => "La empresa ya usa correo electrónico gratuito.",
  "error.oneMailServer": () => "La empresa ejecuta un servidor de correo.",
  "event.domainsTransferred.title": () => "Dominios trasladados",
  "event.domainsTransferred.text": (p) => `${p.count} ${s(p.count, "dominio está", "dominios están")} ahora gestionado${Number(p.count) === 1 ? "" : "s"} por ${p.name}.`,
  "event.registrarTier.title": () => "Mejor tarifa de socio",
  "event.registrarTier.text": (p) => `Con ${p.domains} dominios, ${p.name} factura tus dominios desde ahora en el siguiente nivel.`,
} satisfies Dict;
