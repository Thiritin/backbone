import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { setCompany } from "../../sim/90-actions/company";
import { CompanyFields } from "../apps/company";
import { useStore } from "../store";
import { PearMark } from "./Intro";

// The first-time setup: the company's name and logo.
export function Welcome() {
  const { game, act, closeWelcome } = useStore();
  const [draft, setDraft] = useState(game.company);
  const done = () => { if (act(setCompany, draft).ok) closeWelcome(); };

  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === "Escape" && closeWelcome();
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [closeWelcome]);

  return createPortal(
    <div className="alert-backdrop" onPointerDown={(e) => e.stopPropagation()}>
      <div className="alert welcome" role="dialog" aria-modal="true" aria-labelledby="welcome-title">
        <PearMark />
        <h2 id="welcome-title">Welcome to Pear</h2>
        <p>Set up the name and logo of your company.</p>
        <CompanyFields company={draft} onChange={(p) => setDraft({ ...draft, ...p })} />
        <div className="alert-actions">
          <button className="btn" onClick={closeWelcome}>Skip</button>
          <button className="btn primary" disabled={!draft.name.trim()} onClick={done}>Done</button>
        </div>
      </div>
    </div>,
    document.querySelector(".desktop")!,
  );
}
