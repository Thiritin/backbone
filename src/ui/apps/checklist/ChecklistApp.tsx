import { Check } from "lucide-react";
import { checkDone, tracked } from "../../../sim/checklist";
import { toggleCheck } from "../../../sim/90-actions/checklist";
import { useStore } from "../../store";
import "../customers/customers.css";
import "./checklist.css";

interface Goal { id: string; title: string; text: string }

const STAGES: { name: string; goals: Goal[] }[] = [
  { name: "Basement", goals: [
    { id: "website", title: "Put a product on your website", text: "Switch on a product in Website once a control plane that sells it is installed, so customers can request it." },
    { id: "loan", title: "Take a loan from the Bank", text: "A loan pays for hardware before your first customers pay you." },
    { id: "secondServer", title: "Bring a second server online", text: "Buy a server in the Shop, mount it in your rack, plug in its power, cable it to the switch and add it to a cluster in Locations." },
    { id: "homeLine", title: "Upgrade the home line", text: "Order a line with more upload in Locations once the basement's peak upload reaches the line's limit." },
    { id: "firstCustomer", title: "Win your first customer", text: "Customers rent space on your servers and pay you every month." },
    { id: "ticket", title: "Answer a support ticket", text: "Pick a reply in Support before the ticket runs past its deadline." },
    { id: "payment", title: "Collect your first payment", text: "Billing sends invoices to your customers, and a paid invoice is money in the bank." },
    { id: "reminder", title: "Send a payment reminder", text: "Remind a customer in Billing when an invoice is overdue." },
  ] },
  { name: "Datacenter", goals: [
    { id: "datacenter", title: "Rent space in a datacenter", text: "Locations lists the datacenters where you can rent a rack share or rack positions." },
    { id: "dcServer", title: "Bring a server online in the datacenter", text: "Move a rack there or ship servers to it, then cable them to the carrier panel." },
    { id: "dcCluster", title: "Sell from the datacenter", text: "Create a cluster in the datacenter in Locations, add the server to it and install a hypervisor in Products." },
    { id: "feedB", title: "Add a second power feed", text: "A second feed keeps a rack running when one power circuit fails." },
    { id: "drive", title: "Replace a failed drive", text: "Keep spare parts in storage so you can swap a broken drive quickly." },
    { id: "lease", title: "Lease hardware", text: "A lease spreads the cost of new servers over monthly payments." },
  ] },
  { name: "Products", goals: [
    { id: "webHosting", title: "Launch a web hosting product", text: "Products turns your servers into plans that customers can buy." },
    { id: "vps", title: "Launch a VPS product", text: "Virtual servers let several customers share one machine." },
    { id: "drain", title: "Drain a server for maintenance", text: "Draining moves workloads to other servers so you can work on one without an outage." },
    { id: "backup", title: "Restore a backup", text: "Backups bring a customer's data back after a disk failure." },
    { id: "tenCustomers", title: "Win ten customers", text: "More customers bring more revenue and more work in Support and Billing." },
  ] },
  { name: "Team", goals: [
    { id: "hire", title: "Hire your first employee", text: "Staff hires people who take over a work queue, such as support tickets." },
    { id: "bookkeeper", title: "Hire a bookkeeper", text: "A bookkeeper sends reminders and dunning notices for you." },
    { id: "training", title: "Train an employee", text: "Training raises a skill so the employee works faster and makes fewer mistakes." },
    { id: "autoRemind", title: "Turn on automatic reminders", text: "Billing can remind customers by itself when an invoice is overdue." },
  ] },
  { name: "Network", goals: [
    { id: "transit", title: "Buy transit from a second carrier", text: "A second carrier keeps your sites online when the first one has an outage." },
    { id: "exchange", title: "Join an internet exchange", text: "An exchange lets you peer with other networks and pay less for transit." },
    { id: "ddos", title: "Turn on DDoS protection", text: "Protection keeps an attack from taking your customers offline." },
  ] },
  { name: "Growth", goals: [
    { id: "research", title: "Complete your first training", text: "Research trains your company in new skills with the know-how it earns." },
    { id: "marketing", title: "Run a marketing campaign", text: "Campaigns bring in new customers when demand is low." },
    { id: "secondCity", title: "Open a site in a second city", text: "A second city spreads your servers over more than one region." },
    { id: "cage", title: "Rent a cage", text: "A cage is a locked area in the hall with room for several of your racks." },
    { id: "suite", title: "Rent a private suite", text: "A suite is a room of your own inside a provider's building." },
    { id: "ownDc", title: "Build your own datacenter", text: "Your own building comes with its own power room, generators and carrier room." },
  ] },
];

export function ChecklistApp() {
  const game = useStore((s) => s.game);
  const act = useStore((s) => s.act);
  const all = STAGES.flatMap((st) => st.goals);
  const total = all.filter((g) => checkDone(game, g.id)).length;

  return (
    <div className="chk">
      <header className="chk-head">
        <h2>Checklist</h2>
        <Progress done={total} of={all.length} />
      </header>
      {STAGES.map((st) => (
        <section key={st.name} className="chk-card">
          <h3>{st.name}<Progress done={st.goals.filter((g) => checkDone(game, g.id)).length} of={st.goals.length} /></h3>
          {st.goals.map((g) => {
            const done = checkDone(game, g.id);
            const box = <span className={`chk-box${done ? " done" : ""}`}>{done && <Check />}</span>;
            return (
              <div key={g.id} className={`chk-row${done ? " done" : ""}`}>
                {tracked(g.id) ? box : (
                  <button className="chk-tick" role="checkbox" aria-checked={done} aria-label={g.title} onClick={() => act((s) => toggleCheck(s, g.id))}>{box}</button>
                )}
                <div className="grow">
                  <span className="cus-strong">{g.title}</span>
                  <span className="cus-dim">{g.text}</span>
                </div>
              </div>
            );
          })}
        </section>
      ))}
    </div>
  );
}

function Progress({ done, of }: { done: number; of: number }) {
  return (
    <span className="chk-progress">
      <span className="bar"><i style={{ width: `${(done / of) * 100}%` }} /></span>
      <span className="num">{done} of {of}</span>
    </span>
  );
}
