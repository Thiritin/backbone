import { KeyRound } from "lucide-react";
import { create } from "zustand";
import { t } from "../i18n/en";
import type { GameState } from "../sim/50-state";
import { rememberLogin } from "../sim/90-actions/store";
import { useStore } from "./store";

// A login typed by hand that the Browser offers to save in KeePassive.
interface Offer { site: string; host: string; values: string[] }
const useOffer = create<{ offer: Offer | null }>(() => ({ offer: null }));

const owned = (game: GameState) => game.installed.includes("keepassive");

// What a login form starts with: the saved values once KeePassive is installed, empty fields otherwise.
export const savedLogin = (game: GameState, site: string, fields: number): string[] =>
  (owned(game) && game.logins[site]) || Array<string>(fields).fill("");

// After a login went through: offer to save values KeePassive does not have yet.
export function offerLogin(game: GameState, site: string, host: string, values: string[]): void {
  if (owned(game) && game.logins[site]?.join("\n") !== values.join("\n")) useOffer.setState({ offer: { site, host, values } });
}

export function VaultOffer() {
  const act = useStore((s) => s.act), offer = useOffer((s) => s.offer);
  if (!offer) return null;
  const close = () => useOffer.setState({ offer: null });
  return (
    <div className="br-vault" role="dialog" aria-label="KeePassive">
      <KeyRound aria-hidden />
      <span>{t("misc1.browser.vault.ask", { host: offer.host })}</span>
      <button className="btn primary" onClick={() => { act(rememberLogin, offer.site, offer.values); close(); }}>{t("misc1.browser.vault.save")}</button>
      <button className="btn" onClick={close}>{t("misc1.browser.vault.notNow")}</button>
    </div>
  );
}
