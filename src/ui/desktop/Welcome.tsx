import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { setSoftware } from "../../sim/90-actions/clusters";
import { setCompany } from "../../sim/90-actions/company";
import { CompanyFields } from "../apps/company";
import { KIND_NAME, servesText, SoftwareCards } from "../apps/products/parts";
import { useStore } from "../store";
import { PearMark } from "./Intro";

// The first-time setup: the company's name and logo, then the basement server's control plane.
export function Welcome() {
  const { game, act, closeWelcome } = useStore();
  const [draft, setDraft] = useState(game.company);
  const basement = game.clusters[0];
  const [step, setStep] = useState<"company" | "server">("company");
  const [pick, setPick] = useState<string | null>(null);
  const next = () => (basement && !basement.panel && !basement.platform && !basement.switching ? setStep("server") : closeWelcome());
  const done = () => { if (act((s) => setCompany(s, draft)).ok) next(); };
  const install = () => { if (pick && act((s) => setSoftware(s, basement.id, pick)).ok) closeWelcome(); };

  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === "Escape" && closeWelcome();
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [closeWelcome]);

  return createPortal(
    <div className="alert-backdrop" onPointerDown={(e) => e.stopPropagation()}>
      {step === "company" ? (
        <div className="alert welcome" role="dialog" aria-modal="true" aria-labelledby="welcome-title">
          <PearMark />
          <h2 id="welcome-title">Welcome to Pear</h2>
          <p>Set up the name and logo of your company.</p>
          <CompanyFields company={draft} onChange={(p) => setDraft({ ...draft, ...p })} />
          <div className="alert-actions">
            <button className="btn" onClick={next}>Skip</button>
            <button className="btn primary" disabled={!draft.name.trim()} onClick={done}>Done</button>
          </div>
        </div>
      ) : (
        <div className="alert welcome setup" role="dialog" aria-modal="true" aria-labelledby="welcome-title">
          <h2 id="welcome-title">Control plane for {basement.name}</h2>
          <p>Choose the software your basement server runs. Jonas, Mira and Tobi are waiting for web hosting.</p>
          {(["panel", "cloud"] as const).map((kind) => (
            <section key={kind} className="setup-kind">
              <h3>{KIND_NAME[kind]}<span>{servesText(kind)}</span></h3>
              <SoftwareCards kind={kind} value={pick} onPick={setPick} compact />
            </section>
          ))}
          <div className="alert-actions">
            <button className="btn" onClick={closeWelcome}>Skip</button>
            <button className="btn primary" disabled={!pick} onClick={install}>Install</button>
          </div>
        </div>
      )}
    </div>,
    document.querySelector(".desktop")!,
  );
}
