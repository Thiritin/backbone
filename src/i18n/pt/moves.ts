import type { Dict } from "../lang";

const DAYS = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];
const clock = (h: unknown) => `${String(h).padStart(2, "0")}:00`;

export default {
  "ticket.migration.offer.subject": (p) => `Migração de ${p.hostname || p.service} para ${p.target}`,
  "ticket.migration.offer.text": (p) => `Gostaríamos de migrar ${p.hostname || p.service} para ${p.target}. Diz-nos se concordas.`,
  "ticket.migration.accept.text": (p) => `Por mim, tudo bem. Faz isso entre as ${clock(p.from)} e as ${clock(p.to)} de ${DAYS[Number(p.day)]}.`,
  "ticket.migration.acceptAny.text": () => "Por mim, tudo bem. Avança quando te der jeito.",
  "ticket.migration.decline.text": () => "Prefiro que fique tudo como está.",
  "ticket.migration.missed.text": () => "A migração nunca aconteceu. Não estou nada satisfeito.",
  "outcome.moved": () => "Migrado",
  "outcome.moveDeclined": () => "Recusado",
  "event.moveAccepted.title": () => "Migração aceite",
  "event.moveAccepted.text": (p) => `${p.name} aceitou a migração de ${p.service}.`,
  "event.moveDeclined.title": () => "Migração recusada",
  "event.moveDeclined.text": (p) => `${p.name} recusou a migração de ${p.service}.`,
  "event.moveWindow.title": () => "Janela de migração aberta",
  "event.moveWindow.text": (p) => `${p.name} espera que ${p.service} seja migrado até às ${clock(p.to)}.`,
  "event.moveDone.title": () => "Serviço migrado",
  "event.moveDone.text": (p) => `${p.service} de ${p.name} foi migrado para ${p.target}.`,
  "event.moveMissed.title": () => "Migração falhada",
  "event.moveMissed.text": (p) => `A migração de ${p.service} de ${p.name} não foi executada.`,
  "error.moveOffered": () => "Este serviço tem uma oferta de migração à espera de resposta.",
  "error.moveTarget": () => "Este serviço não pode migrar para aí.",
  "ledger.moveServer": (p) => `Mudança de ${p.device} para ${p.location}`,
  "error.moveServerOnly": () => "Só um servidor se muda com as suas cargas de trabalho.",
  "error.locationNotReady": () => "O local ainda não está pronto.",
  "error.clusterSpans": () => "O cluster corre em mais servidores do que este.",
} satisfies Dict;
