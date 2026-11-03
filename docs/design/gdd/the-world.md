# The world

Status: design, first demo in progress. Supersedes `docs/design/3d.md` as the plan for the physical side of the game; the 3D note stays as a record of the first-person prototype and the ideas it proved.

Backbone has two surfaces. The desktop is the company: every piece of software, every contract, every customer. The world is the place: the basement, later a cage at a colocation provider, in the end an own hall. The desktop stays the game. The world is where the player's body is, and everything that needs hands lives there.

## Pillars

- **The desktop is the source of truth.** Nothing exists only in the world. Every world interaction calls the same action in `src/sim/90-actions` the desktop would call.
- **The world is a view over the simulation.** `src/sim` never imports anything from the world renderer. The world reads state and calls `act`, like any app.
- **Presence costs time.** Walking to a rack, carrying a server, driving to the datacenter all take game time. The sim already tracks the player with `player: { at, until, doing }`. Presence is what makes the world worth visiting instead of a wallpaper.
- **Isometric, drawn in code.** The world is SVG, like every device front in `src/ui/art`. Tiles, walls, racks, parcels, the player are all drawn with code, so every pun brand keeps one style and nothing needs a sprite sheet.
- **Fake depth where it pays.** Doors swing, lids slide, racks open, walls cut away when the player stands behind them. Each is a drawn object with two or three flat frames swapped in place, so a flat 2D drawing reads as a door opening into the room. No 3D engine.

## What lives where

| Thing | World | Desktop |
| --- | --- | --- |
| Rack placement, moving racks | Place a rack on a floor tile, turn it, push it | Locations app lists racks and their tiles |
| Installing and removing devices | Carry from storage to rack, slide into a unit | Rack front view stays as the detail overlay the world opens |
| Server internals | Lid slides off at the rack, parts go in by hand | The lid view stays, opened from the rack |
| Cabling | Cables run visibly between racks and into the wall | Port inspector, port groups, speeds |
| Deliveries | Parcels arrive at the door; carry them to storage, unbox | Shop buys, tracking in Storage |
| Post | Letters land in the letterbox; walk over, take them, open them at the desk | Reading, filing, DMS |
| Scanner | A desk device turns a paper letter into a document | The document appears in the document app |
| Travel | Walk out the door, pick a destination on the map, arrive after the trip | Locations app shows where you are and when you arrive |
| Faults | Blinking LED on the rack, the technician PC plugs into a port | Monitoring, alarms, the port inspector diagram |
| Phone | Rings on the wall at night when on call | Support tickets, pager text |
| Everything software | | Billing, mail, consoles, network, products, customers, staff |

The rule: if a real sysadmin in 2005 would have had to stand up for it, it is in the world. If they would do it in a browser or terminal, it is on the desktop.

## The basement

The first room is the basement of the player's parents' house in Frankfurt, availability zone fra1. Floor grid of 12 by 9 tiles, isometric, two-to-one diamonds. Only the two far sides have walls, the far-left and the far-right one; the two near sides are open, so nothing ever hides the player. Every fixed object stands against or hangs on a far wall:

- **Desk with the PC.** Against the far-right wall. Walking to the desk and using the PC opens the desktop fullscreen. The world keeps running underneath and resumes where the player stood. The scanner sits on the desk next to the PC.
- **Door.** A doorway with a frame in the far-left wall, dark behind it. The only exit. Using it opens the map, and the trip starts on arrival at a destination. Parcels and letters appear beside it.
- **Letterbox.** On the far-left wall next to the door. Holds unread post, with the count on a small tag above it. Using it moves the letters into the player's hands; the desk opens them.
- **Storage shelf.** Against the far-left wall, open toward the room. Boxes stacked per delivery; the shelf shows how full the storage is. Using it opens the Storage view.
- **Rack slots.** Any free floor tile against a far wall takes a rack. A rack loaded from a save on a tile that is no longer against a wall moves to the next free one. The basement allows a handful, limited by the power the house gives.
- **Power and cooling.** The fuse box on the far-left wall and a window fan in the far-right wall. Tags above them show the power draw and the room temperature from the sim.

Later rooms (colo cage, own hall) are the same renderer with a different layout and a different set of fixed objects. A cage has a locked door, a cross-connect panel in the wall and a shared cold aisle; an own hall has rows, a loading dock and a NOC desk.

## Movement and interaction

The player clicks a tile and walks there along the grid, four or eight directions, avoiding objects. Clicking an object walks to its use tile first and then interacts. One action key does the same for the object the player faces, for keyboard play. Carried items ride in a hand slot above the player and show as a box or a letter.

Interaction opens a small radial or list menu with only what the sim allows: at a rack with a carried server it offers the free units, at a rack with empty hands it offers to open the front, at the door it offers the map. Every entry calls an existing action.

## Rendering

- The look is the early-2000s isometric hotel-chat style: pixel art drawn in code. SVG in React, inside the existing store and i18n.
- Pixel grid. A tile is a 32 by 16 diamond at zoom 1 and every coordinate is a whole number, drawn with crisp edges. Zoom steps are 1, 2 and 3 on the wheel, so pixels stay square; drag pans.
- Flat shading. Every object has three flat tones, the top lightest, the left face mid and the right face darkest, and a one-pixel outline in a dark desaturated navy. No gradients, blur or soft shadows. Colours come from the `DESIGN.md` tokens where one fits and from variables in `world.css` otherwise.
- Walls stand only on the two far sides: thin, with a lit top edge, a skirting line at the floor and flat pastel wallpaper. The floor is a two-tone checker of tiles with a one-pixel grid.
- The tile under the mouse shows a one-pixel white diamond outline. A clicked object's outline lights up for a moment.
- The avatar has a large head and a short body, about 24 pixels tall at zoom 1, drawn facing each of the four diagonal directions, with a two-frame walk that swaps the leg pixels at one tile per 400 ms. The company name rides on a small tag above the head.
- Counts on the letterbox and shelf, the temperature at the fan and the power at the fuse box sit on small tags in the desktop font.
- Objects sort by `x + y` for depth, with the player and carried item in the same sort.
- Racks reuse `RackFront` from `src/ui/art`. A rack is one outlined three-tone box at zoom 1 and shows device fronts at zoom 2 and 3, so a 100-rack hall stays under a few thousand nodes.
- The door panel pivots on its frame with a skew, shut, halfway, then open into the room. Lids slide the same way.
- One `requestAnimationFrame` loop drives walking, the leg frames and LED blink; everything else re-renders from the store like any app.
- If SVG measurably stutters on the own hall, the world layer moves to a WebGL 2D renderer with the same SVG art rasterised into textures. Nothing above that layer changes.

## Switching between surfaces

- The desktop gains **Stand up** in the logo menu and a world button in the Locations app. The world shows the room where the player is.
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

The first demo is the basement with the player walking, the PC that opens the desktop, racks on their tiles that open the rack front view, parcels at the door that open Storage, a letterbox that opens the post, a scanner that opens the document app, a door that swings open and opens the map. Everything opened is the existing app. The sim change is rack tiles. The rest of the table above comes feature by feature.
