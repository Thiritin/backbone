# The world

Status: design, first demo in progress. Supersedes `docs/design/3d.md` as the plan for the physical side of the game; the 3D note stays as a record of the first-person prototype and the ideas it proved.

Backbone has two surfaces. The desktop is the company: every piece of software, every contract, every customer. The world is the place: the basement, later a cage at a colocation provider, in the end an own hall. The desktop stays the game. The world is where the player's body is, and everything that needs hands lives there.

## Pillars

- **The desktop is the source of truth.** Nothing exists only in the world. Every world interaction calls the same action in `src/sim/90-actions` the desktop would call.
- **The world is a view over the simulation.** `src/sim` never imports anything from the world renderer. The world reads state and calls `act`, like any app.
- **Presence costs time.** Walking to a rack, carrying a server, driving to the datacenter all take game time. The sim already tracks the player with `player: { at, until, doing }`. Presence is what makes the world worth visiting instead of a wallpaper.
- **Top-down pixel art.** The world is SVG, like every device front in `src/ui/art`, seen from a three-quarter top-down angle. Floor, walls and furniture are sprites from a purchased datacenter tileset, so every pun brand and the racks keep one style; what the tileset lacks is drawn in code.
- **Fake depth where it pays.** Doors swing, lids slide, racks open, walls cut away when the player stands behind them. Each is a drawn object with two or three flat frames swapped in place, so a flat 2D drawing reads as a door opening into the room. No 3D engine.

## What lives where

| Thing | World | Desktop |
| --- | --- | --- |
| Rack placement, moving racks | Place a rack on a floor tile, turn it, push it | Locations app lists racks and their tiles |
| Installing and removing devices | A rack opens a close-up panel over the room: pick a free unit to mount a device from the location's storage, pick a device to power it, open its lid or unmount it back to storage | Cabling and ports stay in the Locations app, opened from the panel |
| Server internals | Lid slides off at the rack, parts go in by hand | The lid view stays, opened from the rack |
| Cabling | Cables run visibly between racks and into the wall | Port inspector, port groups, speeds |
| Deliveries | Parcels arrive at the door; carry them to storage, unbox | Shop buys, tracking in Storage |
| Post | Letters land in the letterbox; walk over, take them, open them at the desk | Reading, filing, DMS |
| Scanner | A desk device turns a paper letter into a document | The document appears in the document app |
| Travel | Walk out the door, pick a destination on the map, watch the drive ([Travel](travel.md)) | Locations app shows where you are and when you arrive |
| Faults | Blinking LED on the rack, the technician PC plugs into a port | Monitoring, alarms, the port inspector diagram |
| Phone | Rings on the wall at night when on call | Support tickets, pager text |
| Everything software | | Billing, mail, consoles, network, products, customers, staff |

The rule: if a real sysadmin in 2005 would have had to stand up for it, it is in the world. If they would do it in a browser or terminal, it is on the desktop.

## The basement

The first room is the basement of the player's parents' house in Frankfurt, availability zone fra1. Floor grid of 12 by 9 square tiles seen from a three-quarter top-down angle. The far wall runs along the top of the room, with a wall on the left and on the right; the near side is open, so nothing ever hides the player. Every fixed object stands against or hangs on a wall:

- **Desk with the PC.** Against the far wall, with its monitors, chair and a tower PC beside it. Walking to the desk and using the PC opens the desktop fullscreen. The world keeps running underneath and resumes where the player stood. The scanner stands next to the desk.
- **Door.** A glass door against the left wall. The only exit. Using it opens the map, and picking a destination starts the trip described in [Travel](travel.md). Parcels and letters appear beside it.
- **Letterbox.** On the left wall next to the door. Holds unread post; letters stick out of the slot while there are unread ones. Using it moves the letters into the player's hands; the desk opens them.
- **Storage shelf.** Against the left wall. Crates stacked per delivery; the shelf shows how full the storage is. Using it opens the Storage view.
- **Rack slots.** Any free floor tile against a wall takes a rack. A rack loaded from a save on a tile that is no longer against a wall moves to the next free one. The basement allows a handful, limited by the power the house gives.
- **Power and cooling.** The breaker cabinet against the left wall and a cooling unit on the far wall. The cabinet shows the power draw, and a weather display under the cooling unit shows the outside weather and the room temperature from the sim.

## Colocation rooms

Rented space uses the same renderer with its own layout per space kind. The far wall is the cage fence, with cable trays along its top, and the hall's raised floor shows grated panels along the cold aisle in front of the rack fronts. The door is always on the left wall; arriving by a trip puts the player on the tile inside it, and using it opens the map for the trip back. A fire extinguisher stands beside the door.

- **Share.** An 8 by 6 room: one row of four rack tiles facing the cold aisle, a cross-connect panel on the far wall, a cooling unit and a parts shelf.
- **Cage.** A 12 by 8 room: two rows of eight rack tiles facing one cold aisle, a cross-connect panel, two cooling units, a shelf and a floor-standing PDU on the right wall.
- **Suite.** A 16 by 11 room: four rows of ten rack tiles around two cold aisles, a cross-connect panel, a NOC desk, two cooling units, a shelf, a PDU and a loading-dock door in the far wall.

Every fixture with a desktop counterpart opens it: the cross-connect panel opens the location's Network tab and shows the carriers on site as labels beside it, the PDU opens the location with its power meter, the shelf opens Storage, and the NOC desk opens the desktop. A rack loaded from a save on a tile that is no longer a rack tile moves to the next free one.

## Movement and interaction

The player clicks a tile and walks there along the grid, four or eight directions, avoiding objects. Clicking an object walks to its use tile first and then interacts. One action key does the same for the object the player faces, for keyboard play. Carried items ride in a hand slot above the player and show as a box or a letter.

Interaction opens a small radial or list menu with only what the sim allows: at a rack with a carried server it offers the free units, at a rack with empty hands it offers to open the front, at the door it offers the map. Every entry calls an existing action.

## Rendering

- The look is three-quarter top-down pixel art on 48 by 48 tiles. SVG in React, inside the existing store and i18n.
- Sprites. `scripts/world-atlas.mjs` crops the tiles the room uses out of the tileset's sheets, which stay outside the repository, into `public/world/atlas.png` and writes `public/world/sprites.json`, a map from sprite name to its rect in source pixels. The `Sprite` component draws one by name, its bottom-left corner on the tile's bottom-left, scaled with `image-rendering: pixelated`. Names: `floor`, `floor-alt`, `wall`, `wall-base`, `door-closed`, `door-half`, `door-open`, `desk`, `pc`, `scanner`, `shelf`, `fan`, `fusebox`, `rack-closed`, `rack-open`, and drawn in code `crate`, `letterbox`, `weather` and `player-<down|up|left|right>-<0|1>`. An unknown name draws nothing and logs once.
- Walls. The far wall is a face two tiles tall along the top; a flat dark grey band marks the top edge of the far wall and the left and right walls, and the backdrop shows beyond it. The floor and the wall face each fill one rect with a repeating pattern, so no seams show at any zoom.
- Camera. The room opens fitted into the window with a small margin on a flat dark blue-grey backdrop. The wheel zooms smoothly around the pointer between 1 and 3; drag pans. Standing up again shows the room at the zoom and position it was left at.
- The tile under the mouse is filled with a soft accent tint. An object under the mouse or just clicked glows in the accent colour.
- The avatar is a front-facing figure about one tile tall, drawn facing each of the four directions, with a two-frame walk at one tile per 400 ms. Clicking a tile walks there; arrow keys and WASD step tile by tile with the same collision, and a held key keeps walking. Keys do nothing while a dialog or menu is open.
- No text floats in the room; every number sits on an object. The weather display shows the outside sky and temperature over the room temperature in the desktop font, the breaker cabinet shows the power draw, unread letters stick out of the letterbox, and the shelf holds one crate per stored device, up to four.
- Objects sort by their row for depth, with the player in the same sort, so a nearer object overlaps a farther one.
- Racks are one tile wide and two tall. Zoomed out a rack shows its closed door with one LED per device; from zoom 2 it shows the open rack with the game's `RackFront` art scaled onto its front, so the real contents show.
- The door shows closed, half and open frames in turn.
- One `requestAnimationFrame` loop drives walking, the leg frames and LED blink; everything else re-renders from the store like any app.
- If SVG measurably stutters on the own hall, the world layer moves to a WebGL 2D renderer with the same atlas. Nothing above that layer changes.

## Switching between surfaces

- The desktop shows the room the player is in as a button in the menu bar next to the time controls and as a desktop icon in the top right; both open the world. **Stand up** in the logo menu and a world button in the Locations app do the same. The world shows the room where the player is.
- In the world, using the PC returns to the desktop. Escape in the world also returns.
- Both surfaces share the store. The current surface is UI state and is not saved; a load starts on the desktop.
- Notifications still slide in while the world is open, so the world is never a blind spot.

## Simulation pieces the world needs

Each is its own feature with a seeded test and lands before the world depends on it.

- **Rack tiles.** Every rack in a location has a tile and a facing. New racks take the next free wall tile. An action moves a rack. Old saves get tiles assigned on load.
- **Presence rules.** Which hardware actions need the player in the room. The sim already knows where the player is; the world is where that rule becomes visible.
- **Parcels at the door.** Arrived deliveries wait at the door until carried to storage, which is what makes a late unbox cost time.
- **Post in the box.** Letters arrive in the letterbox and stay unread until fetched. The scanner turns a paper letter into a document.
- **Carrying.** A hand slot in the sim so a carried server is not also in storage.

## Multiplayer, later

Friends running their own companies in the same market is a later layer, and it is a sync question first. The sim is deterministic from a seed and every change goes through an action, so two saves can replay the same action log. The static site rule stands: no server of ours. Options in order of cost are a shared leaderboard (exists), trading hardware through an exported file, and a peer-to-peer session over WebRTC with a public signalling service. Each needs its own design before any code.

## Demo scope

The first demo is the basement with the player walking, the PC that opens the desktop, racks on their tiles that open a close-up of the rack inside the room, where devices are mounted, removed and opened, parcels at the door that open Storage, a letterbox that opens the post, a scanner that opens the document app, a door that swings open and opens the map. Everything else opened is the existing app. The sim change is rack tiles. The rest of the table above comes feature by feature.
