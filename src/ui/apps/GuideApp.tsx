import { Check } from "lucide-react";
import { checkDone, TUTORIAL } from "../../sim/checklist";
import { useStore } from "../store";
import "./customers/customers.css";
import "./checklist/checklist.css";

const STEPS: Record<(typeof TUTORIAL)[number], [string, string]> = {
  buyServer: ["Buy a server", "Buy a server in the Shop."],
  mountServer: ["Mount and power it", "Open the basement in Locations, mount the server in the rack and plug in its power."],
  internet: ["Add internet", "Order a home line in Locations and cable the server to the home router. The line connects after its installation days."],
  setup: ["Install software", "Use Add Software on the server to install a panel, or a hypervisor with a panel VM."],
  domain: ["Register your domain", "Sign a registrar contract and register your domain in Network, Domains."],
  website: ["Switch on a product", "Switch on web hosting in Website so customers can request it."],
  email: ["Set up company email", "Set up company email in Settings, Email."],
  firstCustomer: ["Win your first customer", "Your friends move their websites to the panel, and paying customers follow."],
};

export function GuideApp() {
  const game = useStore((s) => s.game);
  return (
    <article className="guide">
      <h2>Getting started</h2>
      <p>It is January 2005. You run a small hosting company from a basement with an empty rack and 3,500 € of savings. Your goal is to grow it into your own datacenter by automating your own jobs.</p>
      <h3>Your first server</h3>
      <p>Your friends Jonas, Mira and Tobi are waiting for web hosting. Each step is checked off once it is done.</p>
      <ol className="guide-steps">
        {TUTORIAL.map((id) => {
          const done = checkDone(game, id);
          return (
            <li key={id} className={`chk-row${done ? " done" : ""}`}>
              <span className={`chk-box${done ? " done" : ""}`}>{done && <Check />}</span>
              <div className="grow">
                <span className="cus-strong">{STEPS[id][0]}</span>
                <span className="cus-dim">{STEPS[id][1]}</span>
              </div>
            </li>
          );
        })}
      </ol>
      <p>When the server fills up, the Bank app lends you the money for the next one. The Checklist tracks the goals after these steps.</p>
      <h3>Time</h3>
      <p>The clock starts paused. Press <kbd>Space</kbd> to start or pause it, and <kbd>1</kbd> to <kbd>4</kbd> to switch between 1×, 2×, 4× and 8× speed. The buttons in the menu bar do the same.</p>
      <h3>Apps and windows</h3>
      <p>Open apps from the dock at the bottom. Drag a window by its title bar and resize it from any edge. The three buttons on the left of a window close, minimize and zoom it.</p>
      <h3>Notifications</h3>
      <p>Banners appear at the top right, and clicking one opens its app. The bell in the menu bar opens the history. Settings controls which apps may notify you.</p>
      <h3>Saving</h3>
      <p>The game saves itself in this browser. The logo menu at the far left of the menu bar exports your save to a file, imports a save, and deletes your progress.</p>
    </article>
  );
}
