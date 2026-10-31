import type { Dict, Params } from "../lang";

const DAYS = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];
const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const clock = (h: unknown) => `${String(h).padStart(2, "0")}:00`;
const day = (p: Params) => `no dia ${p.date} de ${MONTHS[Number(p.month)]} (${DAYS[Number(p.weekday)]})`;
const when = (p: Params) => `${day(p)}, das ${clock(p.from)} às ${clock(p.to)}`;
const name = (p: Params) => p.hostname || p.service;

export default {
  "ticket.maintenance.notice.subject": (p) => `Manutenção planeada em ${name(p)}`,
  "ticket.maintenance.notice.text": (p) => `Vamos realizar uma manutenção ${day(p)}. ${name(p)} ficará indisponível das ${clock(p.from)} às ${clock(p.to)} (${p.hours} horas).`,
  "ticket.maintenance.moved.subject": (p) => `Manutenção em ${name(p)} reagendada`,
  "ticket.maintenance.moved.text": (p) => `A manutenção planeada foi alterada. ${name(p)} ficará agora indisponível ${when(p)} (${p.hours} horas).`,
  "ticket.maintenance.move.subject": (p) => `Janela de manutenção para ${name(p)}`,
  "ticket.maintenance.move.text": () => "Essa é uma altura de muito movimento para nós. Podias fazer a manutenção à noite?",
  "ticket.maintenance.declined.subject": (p) => `Janela de manutenção para ${name(p)}`,
  "ticket.maintenance.declined.text": () => "É uma má noite para nós. Não concordamos com esta janela.",
  "event.maintenanceStart.title": () => "Manutenção iniciada",
  "event.maintenanceStart.text": (p) => `A janela de manutenção de ${p.hours} horas em ${p.where} começou.`,
  "event.maintenanceEnd.title": () => "Janela de manutenção terminada",
  "event.maintenanceEnd.text": (p) => `A janela de manutenção em ${p.where} terminou.`,
  "error.maintenanceTarget": () => "Não é possível planear uma manutenção aqui.",
  "error.maintenanceStart": () => "A janela tem de começar no futuro.",
  "error.maintenanceHours": () => "A janela precisa de uma duração.",
  "error.unknownMaintenance": () => "Esta janela de manutenção não está planeada.",
} satisfies Dict;
