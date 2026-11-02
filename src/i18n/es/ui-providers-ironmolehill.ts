import type { Dict } from "../lang";

export default {
  "providers.ironmolehill.navHome": () => `Resumen`,
  "providers.ironmolehill.navSites": () => `Centros de datos`,
  "providers.ironmolehill.navColo": () => `Colocation`,
  "providers.ironmolehill.navPortal": () => `Centro de cuentas`,
  "providers.ironmolehill.heroEarly": () => `Proteja sus servidores con la empresa que protege sus archivos`,
  "providers.ironmolehill.heroLate": () => `Centros de datos diseñados para el cumplimiento normativo`,
  "providers.ironmolehill.text": (p) => `Centros de datos seguros en ${p.cities}, con vigilantes, cámaras y acceso auditado las 24 horas.`,
  "providers.ironmolehill.cta": () => `Explorar centros de datos`,
  "providers.ironmolehill.pillar1": () => `Seguro`,
  "providers.ironmolehill.pillar1Text": () => `Seguridad física por capas y cadena de custodia en cada visita.`,
  "providers.ironmolehill.pillar2": () => `Conforme`,
  "providers.ironmolehill.pillar2Text": () => `Auditados cada año según las normas que piden sus auditores.`,
  "providers.ironmolehill.pillar3": () => `Conectado`,
  "providers.ironmolehill.pillar3Text": () => `Operadores en el edificio y conexiones cruzadas listas en días.`,
  "providers.ironmolehill.trusted": () => `Auditado según`,
  "providers.ironmolehill.footer": (p) => `© ${p.year} Iron Molehill Inc. Todos los derechos reservados.`,
} satisfies Dict;
