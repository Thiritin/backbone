# The world

Status: design, first demo in progress. Supersedes `docs/design/3d.md` as the plan for the physical side of the game; the 3D note stays as a record of the first-person prototype and the ideas it proved.

Backbone has two surfaces. The desktop is the company: every piece of software, every contract, every customer. The world is the place: the basement, later a cage at a colocation provider, in the end an own hall. The desktop stays the game. The world is where the player's body is, and everything that needs hands lives there.

## Pillars

- **The desktop is the source of truth.** Nothing exists only in the world. Every world interaction calls the same action in `src/sim/90-actions` the desktop would call.
- **The world is a view over the simulation.** `src/sim` never imports anything from the world renderer. The world reads state and calls `act`, like any app.
- **Presence costs time.** Driving to the datacenter and working on a rack by hand take game time. The sim already tracks the player with `player: { at, until, doing }`. Presence is what makes the world worth visiting instead of a wallpaper.
- **Clean isometric.** The world is SVG drawn entirely in code, like every device front in `src/ui/art`, seen in flat 2:1 isometric. Every object is a few flat boxes in two or three tones of one hue, with no outlines, gradients or pixel art.
- **Fake depth where it pays.** Doors swing, lids slide, racks open. Each is a drawn object with two or three flat frames swapped in place, so a flat 2D drawing reads as a door opening into the room. No 3D engine.

## What lives where

| Thing | World | Desktop |
| --- | --- | --- |
| Rack placement, moving racks | Place a rack on a floor tile, turn it, push it | Locations app lists racks and their tiles |
| Installing and removing devices | A rack opens a close-up panel over the room: pick a free unit to mount a device from the location's storage or the one in your hands, pick a device to power it, open its lid or unmount it back to storage | Cabling and ports stay in the Locations app, opened from the panel |
| Server internals | Lid slides off at the rack, parts go in by hand | The lid view stays, opened from the rack |
| Cabling | Rack back in the room, cables run along the trays. The rack panel flips to the back, where a click on a free port takes the cable in hand and a click on a second port plugs it in, also on another rack or the cross-connect panel; the technician PC on a port comes later | Port inspector, remote hands |
| Deliveries | Parcels arrive at the door of the player's own place; pick one up and carry it to the shelf or straight into a rack. The shelf opens a storage panel in the room listing stored units and parcels at the door, either of which can be picked up. At a datacenter the receiving desk shelves them | Shop buys, tracking in Storage, an "At the door" group |
| Post | Letters land in the letterbox of the basement and stay there, with their deadlines running, until the player clicks the letterbox and fetches them; the letterbox shows how many wait, and fetching opens a post panel in the room where each fetched letter can be read and scanned | The Post app lists waiting letters greyed under "In the letterbox"; fetched letters are read, paid and scanned there |
| Scanner | On the desk; using it opens the same post panel | The scanned letter appears in DocuWhere, which holds only scanned letters |
| Travel | Walk out the door, pick a destination on the map, watch the drive ([Travel](travel.md)) | Locations app shows where you are and when you arrive |
| Network and power | The cross-connect panel opens a panel with the carriers on site and the uplinks with their cross-connects; the PDU and the fuse box open a panel with the power draw and the room temperature | The Locations app orders and changes them |
| Desk PC | Opens the desktop | Everything on the desktop |
| Faults | Blinking LED on the rack, the technician PC plugs into a port | Monitoring, alarms, the port inspector diagram |
| Phone | Rings on the wall at night when on call | Support tickets, pager text |
| Everything software | | Billing, mail, consoles, network, products, customers, staff |

Only the desk PC and the NOC desk open the desktop; every other object opens a panel inside the room.

The rule: if a real sysadmin in 2005 would have had to stand up for it, it is in the world. If they would do it in a browser or terminal, it is on the desktop.

## The basement

The first room is the basement of the player's parents' house in Frankfurt, availability zone fra1. A floor of 9 by 7 diamond tiles in isometric view, tight enough that the house's own things fill it. Two walls rise along the far sides, the left wall along the first column and the right wall along the first row; the near sides are open, so nothing ever hides the player. Every fixed object stands against or hangs on a wall:

- **Desk with the PC.** One wooden desk along the right wall carries the scanner at its left end and the flat screen with its keyboard and a desk lamp at its right end; the beige tower and a crate of beer stand under it, and an office chair stands pushed back in front of it. Using the PC opens the desktop fullscreen. The world keeps running underneath and resumes at the same view. Using the scanner opens the scanner panel with the fetched letters.
- **Door.** A wooden door in the left wall that swings into the room when used. The only exit. Using it opens the map, and picking a destination starts the trip described in [Travel](travel.md). Parcels stack on the floor beside it.
- **Letterbox.** A brass box on the left wall next to the door. Waiting letters stick out of its slot, with their count beside it. Using it moves every letter to the desk and opens the post panel, where each fetched letter can be read and scanned.
- **Storage shelf.** Against the left wall, four boards high, one crate per stored device up to four. Using it opens the storage panel, or puts down a carried unit.
- **Rack slots.** Any free floor tile against a wall takes a rack. A rack loaded from a save on a tile that is no longer against a wall moves to the next free one. The basement allows a handful, limited by the power the house gives.
- **Power.** The fuse box on the left wall stands open, with rows of breakers and a meter whose counter shows the power draw and whose disc turns faster as the draw grows. A conduit runs from it up the wall and along the right wall to the racks. A wall socket below it holds the phone line jack, where the line cable from the racks ends.
- **Windows and climate.** Two cellar windows sit high in the right wall, one with a window fan in its pane. A thermometer on the wall shows the room temperature over the outside one.
- **The house.** The gas boiler with its pipes stands in the corner, the washing machine and a drying rack beside it. A mat lies inside the door, a drain sits in the floor and a lamp hangs from the ceiling. None of these do anything when clicked.
- **Light.** Daylight falls from the windows across the floor, warm and long in the morning and evening and short and white at noon. At night the room darkens and the ceiling lamp and the desk lamp throw warm pools.

## Colocation rooms

Rented space uses the same renderer with its own layout per space kind. A cage fence of wire mesh between metal posts stands along both far walls with a cable tray above it, and the hall's raised floor shows lighter grated panels with a fine grid along the cold aisle in front of the rack fronts. The door is a mesh cage door in the left wall; arriving by a trip puts the player on the tile inside it, and using it opens the map for the trip back. A fire extinguisher stands beside the door.

- **Share.** An 8 by 6 room: one row of four rack tiles facing the cold aisle, a cross-connect panel on the far wall, a cooling unit and a parts shelf.
- **Cage.** A 12 by 8 room: two rows of eight rack tiles facing one cold aisle, a cross-connect panel, two cooling units, a shelf and a floor-standing PDU on the right wall.
- **Suite.** A 16 by 11 room: four rows of ten rack tiles around two cold aisles, a cross-connect panel, a NOC desk in front of the rack rows, two cooling units, a shelf, a PDU and a loading-dock door in the far wall.

The NOC desk opens the desktop. Every other fixture opens a panel in the room: the cross-connect panel shows the carriers on site, which are also on a plate beside it, and the uplinks with their cross-connects; the PDU shows the power draw and the room temperature; the shelf shows the storage. A rack loaded from a save on a tile that is no longer a rack tile moves to the next free one.

## Movement and interaction

The room is played like a tycoon game. There is no figure to walk around: the player looks at the room and clicks objects directly, and a click acts at once. The arrow keys and WASD pan the view, the wheel zooms and a drag pans. Keys do nothing while a dialog or menu is open.

Presence stays a sim rule: the room on screen is the one the player is at, the door starts the trip, and arriving shows the destination room.

Parcels are carried with the hand cursor. Clicking a parcel at the door picks it up, and it follows the pointer as a small box. Clicking the shelf puts it in storage, and clicking a rack opens the rack panel with the carried unit offered for the free units it fits. Escape with a parcel in hand puts it on the shelf.

Every click calls an existing action. Only the desk PC and the NOC desk open the desktop; every other object opens a slide-up panel in the room.

Staff may later appear in rooms as figures at their desks, the way tycoon games show employees.

## Rendering

- The look is flat 2:1 isometric drawn in code: SVG in React, inside the existing store and i18n. A tile is a 64 by 32 diamond at zoom 1.
- [World art direction](../world-art.md) sets how every object, material and light in a room is drawn.
- Style. Each object is built from boxes drawn by one shared helper: a top, a left and a right face in two or three tones of one hue, with a thin edge in a darker tone of the same hue where faces meet. No outlines, gradients or pixel art. Flat things on a wall, such as the letterbox, the breaker cabinet and the cross-connect panel, are drawn on the wall's plane.
- Walls. Only the two far walls are drawn, in a light neutral with a lit top edge and a skirting line along the floor. The backdrop is a flat dark blue-grey.
- Camera. The room opens fitted to fill the window at any screen density. The wheel zooms smoothly around the pointer between 0.75 and 3; drag pans. Standing up again or returning from a trip shows each room at the zoom and position it was left at.
- An object under the mouse or just clicked glows in the accent colour.
- No text floats in the room; every number sits on an object, in the desktop font. The thermometer shows the room temperature over the outside one, the breaker cabinet and the PDU show the power draw, the letterbox shows its waiting letters, a parcel stack shows its count and the cross-connect panel has a plate with the carriers on site.
- Objects sort by x + y for depth, so a nearer object overlaps a farther one. A fixture several tiles wide sorts by its farthest tile.
- A rack is a dark box with a lit top. Zoomed out a front facing the camera shows one LED per device; from zoom 2 it shows the game's `RackFront` art scaled to fit the front face, so the real contents show. Clicking a rack opens the rack panel with the full art.
- The door swings shut, halfway, then into the room in turn.
- One `requestAnimationFrame` loop drives key panning and LED blink; everything else re-renders from the store like any app.
- If SVG measurably stutters on the own hall, the world layer moves to a WebGL 2D renderer drawing the same shapes. Nothing above that layer changes.

## Switching between surfaces

- The world is the first screen. A new game and a loaded game both open in the room where the player is.
- In the world, clicking the desk PC or the NOC PC opens the desktop. Escape in the world closes an open panel or puts down a carried parcel and stays in the room.
- A clock in the top left corner of the world shows the game date and time and holds the same speed buttons as the menu bar, so the player can pause and resume from the first second.
- The desktop shows the room the player is in as a button in the menu bar next to the time controls and as a desktop icon in the top right; both return to the world. **Stand up** in the logo menu and a world button in the Locations app do the same.
- Sheets that greet the player on the desktop (Early Access, what's new, system and game updates) wait until the desktop opens.
- Both surfaces share the store. The current surface is UI state and is not saved.
- Notifications still slide in while the world is open, so the world is never a blind spot.

## Simulation pieces the world needs

Each is its own feature with a seeded test and lands before the world depends on it.

- **Rack tiles.** Every rack in a location has a tile and a facing. New racks take the next free wall tile. An action moves a rack. Old saves get tiles assigned on load.
- **Presence rules.** Which hardware actions need the player in the room. The sim already knows where the player is; the world is where that rule becomes visible.
- **Parcels at the door.** Arrived deliveries wait at the door (`door` on the unit) until carried to the shelf or into a rack. A door item is outside storage, so the desktop cannot mount, sell or ship it. A datacenter location shelves arrivals itself so remote hands keep working.
- **Post in the box.** Each letter knows whether it waits in a letterbox or lies at the desk, and whether it is scanned. Delivery puts it in the basement letterbox; fetching needs the player there and takes all of them. A letter in the letterbox cannot be read, and its bill is due all the same. Scanning a desk letter once files it in DocuWhere. Old saves keep their letters at the desk and filed.
- **Carrying.** `player.carrying` holds one unit, which is then in no store. `pickUp`, `putDown` and `installCarried` (90-actions/carry.ts) need the player in the unit's room; picking up and putting down cost no time, and the player cannot travel while carrying.

## Multiplayer, later

Friends running their own companies in the same market is a later layer, and it is a sync question first. The sim is deterministic from a seed and every change goes through an action, so two saves can replay the same action log. The static site rule stands: no server of ours. Options in order of cost are a shared leaderboard (exists), trading hardware through an exported file, and a peer-to-peer session over WebRTC with a public signalling service. Each needs its own design before any code.

## Demo scope

The first demo is the basement played by direct clicks, the PC that opens the desktop, racks on their tiles that open a close-up of the rack inside the room, where devices are mounted, removed and opened, parcels at the door that go into the hand, a shelf, letterbox and scanner that open their panels in the room, a door that swings open and opens the map, and cabling by hand at the rack back with cables between racks drawn along the trays. The sim change is rack tiles. The rest of the table above comes feature by feature.
