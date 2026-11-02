import { t } from "../../../../../i18n/en";
import { Actions, Facts, LoginForm, useSoftware, type PanelProps } from "../PanelBase";
import "./postfixitadmin.css";

// docs/design/plans/webmail-server.md, 5.2: a PHP page of plain tables. The mailbox and alias screens come with milestone 2.
export function PostfixitAdmin(p: PanelProps) {
  const sw = useSoftware(p.game, p.c, p.f);
  const logo = <h1 className="pfa-logo">{t("mailserver.pfa.title")}</h1>;
  if (!p.signedIn) return (
    <div className="pfa">
      <LoginForm className="pfa-card" onLogin={p.login} button={t("mailserver.pfa.login")}>{logo}</LoginForm>
    </div>
  );
  return (
    <div className="pfa">
      {logo}
      <nav className="pfa-menu"><a href="#out" onClick={(e) => { e.preventDefault(); p.logout(); }}>{t("mailserver.pfa.logout")}</a></nav>
      <Facts facts={sw.facts} />
      <Actions actions={sw.actions}>{sw.note && <span className="cx-note">{sw.note}</span>}</Actions>
      {sw.panel}
      <footer>{t("mailserver.pfa.footer", { host: p.host })}</footer>
    </div>
  );
}
