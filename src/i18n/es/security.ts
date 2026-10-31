import type { Dict, Params } from "../lang";

const VULN: Record<string, string> = {
  mopb: "un fallo de corrupción de memoria en el motor Zend, uno de los treinta encontrados este mes",
  cgi: "un fallo que permite pasar opciones de línea de comandos a PHP-CGI mediante una cadena de consulta",
  fpm: "un desbordamiento de búfer por defecto en PHP-FPM que ejecuta código desde una URL manipulada",
  argv: "una inyección de argumentos en PHP-CGI que puede provocar un guion blando",
};
const vuln = (p: Params) => VULN[p.name] ?? String(p.name);

export default {
  "event.vuln.announced.title": () => "Vulnerabilidad de seguridad en PHP",
  "event.vuln.announced.text": (p) => `Los medios informan de ${vuln(p)}, que afecta a PHP ${p.versions}. El proyecto PHP lo confirma, aún no tiene parche y espera publicarlo el ${p.date}.`,
  "event.vuln.poc.title": () => "Prueba de concepto publicada",
  "event.vuln.poc.text": (p) => `Alguien en Twister ha publicado un exploit que funciona para PHP ${p.versions}, con captura de pantalla y tres emojis de fuego. Lo han compartido 4.000 veces.`,
  "event.vuln.warning.title": () => "La oficina federal avisa",
  "event.vuln.warning.text": (p) => `El Bundesamt für Sicherheit in der Informationstechnick informa de escaneos masivos de PHP ${p.versions} y aconseja desconectar los sistemas afectados hasta que salga el parche.`,
  "event.vuln.patch.title": () => "Parche de PHP publicado",
  "event.vuln.patch.text": (p) => `El proyecto PHP publicó la corrección para PHP ${p.versions} en la fecha anunciada, para sorpresa general.`,
  "event.vuln.hacked.title": () => "Nodo comprometido",
  "event.vuln.hacked.text": (p) => {
    const leak = `${p.customers} ${Number(p.customers) === 1 ? "cliente recibió" : "clientes recibieron"} un aviso de filtración de datos.`;
    if (p.kind === "mail") return `Unos atacantes tomaron el control de ${p.device} y envían spam desde allí.`;
    const hit = p.kind === "cloud" ? "tomaron el control de las máquinas virtuales de" : p.kind === "game" ? "tomaron el control de los servidores de juegos de" : "desfiguraron los sitios de";
    return `Unos atacantes ${hit} ${p.device} y envían spam desde allí. ${leak}`;
  },
  "error.patchPending": () => "El parche de esta vulnerabilidad aún no ha salido.",
  "error.sitesOffline": () => "Los sitios de este nodo ya están fuera de línea.",
  "error.sitesOnline": () => "Los sitios de este nodo ya están en línea.",
  "error.notHacked": () => "Este nodo no está comprometido.",
} satisfies Dict;
