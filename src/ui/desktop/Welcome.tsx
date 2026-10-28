import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { Resources } from "../../sim/10-catalog/products";
import type { GameState } from "../../sim/50-state";
import { serverTaken } from "../../sim/60-infra/cluster";
import { locationOf } from "../../sim/60-infra/status";
import { addNode, createCluster, createPanelVm, installPanel, PANEL_VM_SIZE, setSoftware } from "../../sim/90-actions/clusters";
import { setCompany } from "../../sim/90-actions/company";
import { BASEMENT_SERVER } from "../../sim/90-actions/start";
import { CompanyFields } from "../apps/company";
import { SizeFields } from "../apps/products/PanelHosts";
import { KIND_NAME, servesText, SoftwareCards } from "../apps/products/parts";
import { useStore } from "../store";
import { PearMark } from "./Intro";

type Step = "company" | "server" | "vm";

// The basement server is still free, or it became a hypervisor that has no panel VM yet.
function setupStep(game: GameState): Step | null {
  if (!serverTaken(game, BASEMENT_SERVER)) return "server";
  const hv = game.clusters.find((c) => c.kind === "cloud" && c.nodes.some((n) => n.deviceId === BASEMENT_SERVER));
  return hv && !game.clusters.some((c) => c.kind === "panel") ? "vm" : null;
}

// The first-time setup: the company's name and logo, then the basement server as a panel server or as a hypervisor
// followed by its first panel VM.
export function Welcome() {
  const { game, act, closeWelcome } = useStore();
  const [draft, setDraft] = useState(game.company);
  const [step, setStep] = useState<Step>("company");
  const [kind, setKind] = useState<"panel" | "cloud">("panel");
  const [pick, setPick] = useState<string | null>(null);
  const [panel, setPanel] = useState<string | null>(null);
  const [size, setSize] = useState<Resources>(PANEL_VM_SIZE);
  const hv = game.clusters.find((c) => c.kind === "cloud" && c.nodes.some((n) => n.deviceId === BASEMENT_SERVER));
  const next = () => { const s = setupStep(game); if (s) setStep(s); else closeWelcome(); };
  const done = () => { if (act((s) => setCompany(s, draft)).ok) next(); };
  const install = () => {
    if (!pick) return;
    if (kind === "panel") {
      if (act((s) => installPanel(s, BASEMENT_SERVER, pick)).ok) closeWelcome();
      return;
    }
    const ok = act((s) => {
      const loc = locationOf(s, s.devices.find((d) => d.id === BASEMENT_SERVER)!)!;
      const c = createCluster(s, loc.id, "Basement 1");
      if (!c.ok) return c;
      const n = addNode(s, c.id!, BASEMENT_SERVER);
      return n.ok ? setSoftware(s, c.id!, pick) : n;
    }).ok;
    if (ok) setStep("vm");
  };
  const createVm = () => { if (hv && panel && act((s) => createPanelVm(s, hv.id, panel, size)).ok) closeWelcome(); };

  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === "Escape" && closeWelcome();
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [closeWelcome]);

  return createPortal(
    <div className="alert-backdrop" onPointerDown={(e) => e.stopPropagation()}>
      {step === "company" && (
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
      )}
      {step === "server" && (
        <div className="alert welcome setup" role="dialog" aria-modal="true" aria-labelledby="welcome-title">
          <h2 id="welcome-title">Basement server</h2>
          <p>Choose what your basement server runs. Jonas, Mira and Tobi are waiting for web hosting.</p>
          <div className="seg" role="group" aria-label="Role">
            <button aria-pressed={kind === "panel"} onClick={() => { setKind("panel"); setPick(null); }}>Panel server</button>
            <button aria-pressed={kind === "cloud"} onClick={() => { setKind("cloud"); setPick(null); }}>Hypervisor</button>
          </div>
          <section className="setup-kind">
            <h3>{KIND_NAME[kind]}<span>{servesText(kind)}</span></h3>
            <SoftwareCards kind={kind} value={pick} onPick={setPick} compact />
          </section>
          <div className="alert-actions">
            <button className="btn" onClick={closeWelcome}>Skip</button>
            <button className="btn primary" disabled={!pick} onClick={install}>{kind === "panel" ? "Install" : "Next"}</button>
          </div>
        </div>
      )}
      {step === "vm" && (
        <div className="alert welcome setup" role="dialog" aria-modal="true" aria-labelledby="welcome-title">
          <h2 id="welcome-title">Panel VM</h2>
          <p>Size the virtual machine that hosts your web spaces and choose its panel.</p>
          <SizeFields value={size} onChange={setSize} />
          <section className="setup-kind">
            <h3>{KIND_NAME.panel}<span>{servesText("panel")}</span></h3>
            <SoftwareCards kind="panel" value={panel} onPick={setPanel} compact />
          </section>
          <div className="alert-actions">
            <button className="btn" onClick={closeWelcome}>Skip</button>
            <button className="btn primary" disabled={!panel || !hv} onClick={createVm}>Create</button>
          </div>
        </div>
      )}
    </div>,
    document.querySelector(".desktop")!,
  );
}
