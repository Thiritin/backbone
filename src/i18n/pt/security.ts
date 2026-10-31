import type { Dict, Params } from "../lang";

const VULN: Record<string, string> = {
  mopb: "uma falha de corrupção de memória no motor Zend, uma de trinta encontradas este mês",
  cgi: "uma falha que permite a uma query string passar opções de linha de comandos ao PHP-CGI",
  fpm: "um buffer underflow no PHP-FPM que executa código a partir de um URL forjado",
  argv: "uma injeção de argumentos no PHP-CGI que um hífen suave pode desencadear",
};
const vuln = (p: Params) => VULN[p.name] ?? String(p.name);

export default {
  "event.vuln.announced.title": () => "Vulnerabilidade de segurança no PHP",
  "event.vuln.announced.text": (p) => `Os meios de comunicação noticiam ${vuln(p)}, que afeta o PHP ${p.versions}. O projeto PHP confirma-o, ainda não tem correção e espera um patch a ${p.date}.`,
  "event.vuln.poc.title": () => "Prova de conceito publicada",
  "event.vuln.poc.text": (p) => `Alguém no Twister publicou um exploit funcional para o PHP ${p.versions}, com captura de ecrã e três emojis de fogo. Já foi partilhado 4.000 vezes.`,
  "event.vuln.warning.title": () => "Gabinete federal avisa",
  "event.vuln.warning.text": (p) => `O Bundesamt für Sicherheit in der Informationstechnick reporta varrimentos em massa ao PHP ${p.versions} e aconselha a desligar os sistemas afetados até sair o patch.`,
  "event.vuln.patch.title": () => "Patch do PHP publicado",
  "event.vuln.patch.text": (p) => `O projeto PHP publicou a correção para o PHP ${p.versions} na data anunciada, para surpresa geral.`,
  "event.vuln.hacked.title": () => "Nó comprometido",
  "event.vuln.hacked.text": (p) => {
    const leak = `${p.customers} ${Number(p.customers) === 1 ? "cliente recebeu" : "clientes receberam"} um aviso de fuga de dados.`;
    if (p.kind === "mail") return `Atacantes assumiram o controlo de ${p.device} e enviam spam a partir daí.`;
    const hit = p.kind === "cloud" ? "assumiram o controlo das máquinas virtuais em" : p.kind === "game" ? "assumiram o controlo dos servidores de jogos em" : "vandalizaram os sites em";
    return `Atacantes ${hit} ${p.device} e enviam spam a partir daí. ${leak}`;
  },
  "error.patchPending": () => "O patch desta vulnerabilidade ainda não saiu.",
  "error.sitesOffline": () => "Os sites deste nó já estão offline.",
  "error.sitesOnline": () => "Os sites deste nó já estão online.",
  "error.notHacked": () => "Este nó não está comprometido.",
} satisfies Dict;
