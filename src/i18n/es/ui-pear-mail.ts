import type { Dict } from "../lang";

export default {
  "apps.about.Pear Mail": () => "Lee y envía el correo de todas las cuentas que añadas.",
  "pearMail.build": (p) => `Pear Mail ${p.version}`,
  "pearMail.welcome.title": () => "Bienvenido a Pear Mail",
  "pearMail.welcome.add": () => "Añadir tu primera cuenta",
  "pearMail.activity.checked": (p) => `Correo comprobado para ${p.account}: ${p.count} nuevos`,
  "core.notify.newMail": () => "Correo nuevo",
  "event.newMail.title": () => "Correo nuevo",
  "event.newMail.text": (p) => `Ha llegado un mensaje nuevo a ${p.account}.`,
  "event.newMailMore.title": () => "Correo nuevo",
  "event.newMailMore.text": (p) => `Han llegado ${p.count} mensajes nuevos más a ${p.account}.`,
  "error.mailNoBox": () => "No hay ningún buzón con esta dirección en el servidor.",
  "error.mailAuth": () => "El servidor ha rechazado la contraseña.",
  "error.mailExternal": () => "El servidor no permite conectarse a este programa de correo.",
  "error.mailDown": () => "El servidor de correo no responde.",
  "error.mailDns": () => "El correo del dominio no llega a este servidor.",
  "error.mailClosed": () => "Este buzón se ha cerrado.",
  "error.mailPoll": () => "El servidor ha rechazado una comprobación tan poco después de la anterior.",
} satisfies Dict;
