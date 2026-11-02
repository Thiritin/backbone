# Research and unlocks

Unlocks cost know-how points plus a one-time launch cost in money. You earn know-how from every active contract each month, so progress comes from running the business, not just from a big bank balance. Some unlocks also need a minimum company level.

**Skills.** Pear Store apps and upgrades are gated by skills the company learns in the Research app, such as Monitoring, Employee management or Market research. Research shows them as a tree in tier columns from left to right, with lines from each skill to the skills it builds on. A skill is learned (filled), in training (with a progress bar and the days left), ready to start, or locked with the skills it still needs. Selecting a skill opens a side panel with its description, cost, training time, prerequisites, what it leads to and what it makes available in the Pear Store.

Starting a training needs every prerequisite learned and enough know-how, which is paid up front. One training runs at a time, and the skill is learned when its training time has passed. The company then gets a notification and a short click-through sheet in the style of the introduction that explains the new feature and points to the Pear Store; the skill's panel reopens it under How it works. The sheet text lives in docs/design/research.md. Costs, durations and the tree are in economy/know-how-and-unlock-costs.md under "Know-how and unlock costs". Product management is a tier 1 skill, so a company that works its first orders by hand can set its own rates per resource in the Products app by the middle of its first year.

Provisioning automation is a tier 2 skill after Product management. It adds Automatic to the setup of an order and a Place orders automatically switch in Settings that runs an accepted order from the customer account to the setup by itself; before it, every order is quoted and set up by hand on a host the player picks.

**Starting kit:** a 24U rack in the basement with one compute server and a small switch, a reseller account for domains, and web hosting, game servers and VPS on your own hardware.

| Branch | Unlock path, in order |
| --- | --- |
| Products | SSL certificates → email → dedicated servers → storage hosting → VPN → CDN → cloud servers → colocation |
| Infrastructure | Rack → second location → cage → private suite → own datacenter; HA clusters; rack templates; auto-cable |
| Network | Transit contracts → internet exchange peering → own network number (ASN) → always-on DDoS protection |
| Business | First hire → status page → market research → cross-selling boosts → review platforms → AI bots |
| Independence | Domain registrar, own control panel and other in-house replacements for bought-in services |

Hardware generations unlock by year, not through research (see Racks, hardware and cabling).
