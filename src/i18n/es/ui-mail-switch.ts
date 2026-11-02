import type { Dict } from "../lang";

export default {
  "mailswitch.title": () => "Todavía en este proveedor",
  "mailswitch.mail": (p) => (Number(p.n) === 1 ? "1 mensaje no se ha importado en el nuevo proveedor." : `${p.n} mensajes no se han importado en el nuevo proveedor.`),
  "mailswitch.roles": () => "Un buzón de aquí sigue siendo el buzón principal o recibe correo de ventas, soporte o abuso.",
  "mailswitch.collectors": (p) => (Number(p.n) === 1 ? "1 buzón todavía recoge correo de aquí." : `${p.n} buzones todavía recogen correo de aquí.`),
  "mailswitch.source": () => "Dirección anterior",
  "mailswitch.password": () => "Contraseña",
  "mailswitch.target": () => "En el buzón",
  "mailswitch.start": () => "Iniciar importación",
  "mailswitch.from": () => "De",
  "mailswitch.to": () => "A",
  "mailswitch.status": () => "Estado",
  "mailswitch.running": (p) => `En curso hasta el ${p.date}`,
  "mailswitch.done": (p) => (Number(p.n) === 1 ? "1 mensaje importado" : `${p.n} mensajes importados`),
} satisfies Dict;
