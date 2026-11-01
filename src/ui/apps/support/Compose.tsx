import { useState } from "react";
import { t } from "../../../i18n/en";
import { sendMail } from "../../../sim/90-actions/paperwork";
import { useStore } from "../../store";

// A new email with one desktop document attached.
export function Compose({ onClose }: { onClose: () => void }) {
  const game = useStore((s) => s.game), act = useStore((s) => s.act);
  const files = game.docs.filter((d) => d.kind === "form");
  const [to, setTo] = useState(""), [subject, setSubject] = useState(""), [attach, setAttach] = useState(files[0]?.id ?? "");
  return (
    <form className="sup-detail sup-compose" onSubmit={(e) => { e.preventDefault(); if (act(sendMail, to, subject, attach || null).ok) onClose(); }}>
      <div className="d-head"><div className="top"><h2>{t("paperwork.mail.new")}</h2></div></div>
      <label><span>{t("paperwork.mail.to")}</span><input className="field" type="email" required value={to} onChange={(e) => setTo(e.target.value)} /></label>
      <label><span>{t("paperwork.mail.subject")}</span><input className="field" value={subject} onChange={(e) => setSubject(e.target.value)} /></label>
      <label><span>{t("paperwork.mail.attachment")}</span>
        <select className="field" value={attach} onChange={(e) => setAttach(e.target.value)}>
          <option value="">{t("paperwork.mail.none")}</option>
          {files.map((d) => <option key={d.id} value={d.id}>{d.title}</option>)}
        </select>
      </label>
      <div className="sup-compose-act">
        <button type="button" className="btn" onClick={onClose}>{t("misc.cancel")}</button>
        <button type="submit" className="btn primary">{t("paperwork.mail.send")}</button>
      </div>
    </form>
  );
}
