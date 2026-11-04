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

How every game system meets the rooms, close-ups and desktop is decided in `docs/design/world-systems.md`.

| Thing | World | Desktop |
| --- | --- | --- |
| Rack placement, moving racks | Place a rack on a floor tile, turn it, push it | Locations app lists racks and their tiles |
| Installing and removing devices | A rack opens as a close-up with its name and units in use on a label plate: pick a free unit and what fits from that location's storage stands on the floor beside the rack, and a click on one mounts it; pick a device to power it, open its lid or unmount it back to storage | Remote hands job at a datacenter, read-only in the basement |
| Server internals | Lid slides off at the rack, parts go in by hand | Remote hands job at a datacenter, read-only in the basement |
| Cabling | Rack back in the room, cables run along the trays. The turn arrow at the rack's corner shows its back, where a click on a free port takes the cable in hand and a click on a second port plugs it in, also on another rack or the carrier panel shown on every rack's back; the technician PC on a port comes later | Remote hands job at a datacenter, read-only in the basement |
| Deliveries | Every delivery, instant or shipped, lands in the location's storage. A unit that arrived within the last 24 hours and is not mounted is drawn as a parcel by the basement door, as a picture only. The shelf opens drawn large with stored units standing on its boards, each with a paper label | Shop buys, tracking in Storage |
| Post | Letters land in the letterbox of the basement and stay there, with their deadlines running, until the player clicks the letterbox and fetches them; the letterbox shows how many wait, and fetching lays the letters out as paper: the current letter as a DIN A4 sheet, the others stacked beside it to browse by click or the arrow keys, a scan corner on each sheet and a Scan all key below | The Post app lists waiting letters greyed under "In the letterbox"; fetched letters are read, paid and scanned there |
| Scanner | On the desk; it opens with its lid up and the next unscanned letter on the glass, and the button on its front scans it and slides the copy out | The scanned letter appears in DocuWhere, which holds only scanned letters |
| Travel | Walk out the door, pick a destination on the map, watch the drive ([Travel](travel.md)) | Locations app shows where you are and when you arrive |
| Network and power | Cross-connects are cabled on the rack's back; the fuse box opens with its door open, the draw on the meter's display and its breakers on their rails, and its main switch pulls the plug of every unit in the room or boots them all again; the PDU opens with its display and an LED per outlet | The Locations app orders and changes them |
| Desk PC | Opens the desktop | Everything on the desktop |
| Faults | Blinking LED on the rack, the technician PC plugs into a port; a technician working an operation stands at the rack for that hour, the datacenter's remote hands in their provider's colours for the last hour before a job is due, and the rack close-up shows a paper tag on its side with who works there, what and until when | Monitoring, alarms, the port inspector diagram |
| Phone | Hangs by the basement door and in the office reception; rings at night when the player is on call, and picking it up shows the call on a notepad | Support tickets, pager text |
| Everything software | | Billing, mail, consoles, network, products, customers, staff |

Only the desk PC and the NOC desk open the desktop; every other object opens a close-up inside the room: the object itself drawn large over the dimmed room, its parts drawn as what they are and used directly, with a small close plate in the corner.

The rule: if a real sysadmin in 2005 would have had to stand up for it, it is in the world. If they would do it in a browser or terminal, it is on the desktop.

## The basement

The first room is the basement of the player's parents' house in Frankfurt, availability zone fra1. A floor of 9 by 7 tiles in isometric view, tight enough that the house's own things fill it, in raw concrete with faint patches and no tile grid. Two walls rise along the far sides, the left wall along the first column and the right wall along the first row; the near sides are open, so nothing ever hides the player. Every fixed object stands against or hangs on a wall:

- **Desk with the PC.** One wooden desk along the right wall carries the scanner at its left end and the flat screen with its keyboard and a desk lamp at its right end; the beige tower and a crate of beer stand under it, and an office chair stands pushed back in front of it. Using the PC opens the desktop fullscreen. The world keeps running underneath and resumes at the same view. Using the scanner opens the scanner panel with the fetched letters.
- **Door.** A wooden door in the left wall that swings into the room when used. The only exit. Using it opens the map, and picking a destination starts the trip described in [Travel](travel.md). Parcels stack on the floor beside it.
- **Letterbox.** A brass box on the left wall next to the door. Waiting letters stick out of its slot, with their count beside it. Using it moves every letter to the desk and opens the post panel, where each fetched letter can be read and scanned.
- **Storage shelf.** Against the left wall, four boards high, one crate per stored device up to four. Using it opens the storage panel.
- **Shelf and rack tiles.** The metal shelf the company starts with stands on its own tile against the far wall, right of the desk. Two more tiles beside it along the far wall take the two racks the basement holds at most. A rack loaded from a save on a tile that is no longer a rack tile moves to the next free one.
- **Power.** The fuse box on the left wall stands open, with rows of breakers and a meter whose counter shows the power draw and whose disc turns faster as the draw grows. A conduit runs from it up the wall and along the right wall to the racks. A wall socket below it holds the phone line jack, where the line cable from the racks ends.
- **Windows and climate.** Two cellar windows sit high in the right wall, one with a window fan in its pane. A thermometer on the wall shows the room temperature over the outside one.
- **The house.** The gas boiler with its pipes stands in the corner, the washing machine and a drying rack beside it. A mat lies inside the door, a drain sits in the floor and a lamp hangs from the ceiling. None of these do anything when clicked.
- **Light.** The windows and lamps are drawn as objects, with no light falling from them. At night the room turns one step darker and the bulbs of the ceiling lamp and the desk lamp are lit.

## Colocation rooms

Rented space uses the same renderer with a hall per space kind. Every datacenter floor is uniform raised-floor tiles in one tone with a fine grid; the basement keeps its concrete. The door is a normal steel datacenter door with a badge reader in the left wall; arriving by a trip puts the player on the tile inside it, and using it opens the map for the trip back. Every hall has cable trays with cables along both far walls, fluorescent tubes under the ceiling above the racks with a faint cool wash on the floor, two cooling units on the far wall, a floor-standing PDU at a row's end, a fire extinguisher, a parts shelf and a parts cart.

Hot and cold aisles are a property of the datacenter. With aisles, rack rows face each other across a one-tile cold aisle and stand back to back across the hot one; without them, every row faces the near side with a one-tile walkway in front. The player's racks always stand in the rows nearest the viewer, so no other rack hides them.

- **Share.** A 12 by 8 slice of the hall with three rack rows. The player's share is one rack in the nearest row, the bottom section of the provider's full-height cabinet, with other tenants' racks on both sides and in the rows behind. There is no fence.
- **Cage.** A 14 by 11 hall with four rack rows. A mesh fence on square posts stands one tile clear around the player's positions in the two nearest rows (one row of four, two rows of four or two rows of eight), with a mesh door, a lock and a badge reader in its near side. Other tenants' racks fill the rows behind and the rest of the cage's rows outside the fence.
- **Suite.** A 16 by 11 room of the player's own: four rows of ten rack tiles, a NOC desk in front of the rows and a loading-dock door in the far wall. No other tenant's rack stands in it.

Every rack on a datacenter floor has a closed mesh door on the face in view: a front door over the rack's front, or a rear door over its power strips and cable bundle. Other tenants' racks are scenery from the layout, muted and slightly dimmed, with a few LEDs and a blank label plate; they cannot be clicked. The player's racks show their LEDs, and from zoom 2 the rack front art, through a lighter mesh, and open the rack popup.

No wall carries a cross-connect panel. The site's carrier panel appears on the back of every rack of the location, beside its patch panel, and a cross-connect is cabled there in the rack popup. A cable from a rack to the carrier panel runs along the tray to the player's first rack, which holds the panel. The NOC desk opens the desktop, the PDU shows the power draw and the room temperature, and the shelf shows the storage. A rack loaded from a save on a tile that is no longer one of the player's rack tiles moves to the next free one.

## Office

A rented or bought office is a location from its first section on, a destination on the map, and its room is built from the property's sections. Each floor the company holds is one room, 7 tiles deep, its sections side by side, each a block of 6 by 7 tiles. The floor of the first section starts with a reception strip 4 tiles wide; every floor has the hallway door in the left wall with a mat and a light switch, and when the company holds more than one floor a stairwell door with a floor sign switches between them. The floor is carpet, and raised tiles in a server room.

- **Reception strip.** The kitchenette in the corner with a sink, a coffee machine and wall cabinets, the printer, the letterbox by the door, the reception counter with the company's name plate, a plant, and the player's own desk with the PC, which opens the desktop.
- **Desk section.** Two islands of two desks facing each other, each desk with a flat screen, keyboard, phone and paper tray and a swivel chair; a window with the city outside, a whiteboard with scribbles, a plant and a bin.
- **Server section.** A glass partition with a code-lock door, four rack tiles in a row facing a cold aisle, a cooling unit, a cable tray, a PDU and an extinguisher.
- **Section under refit.** Paint buckets, a ladder and a toolbox on a dust sheet; a server room keeps its rack tiles.

Fluorescent tubes hang over every block and are lit during office hours, weekdays 9 to 18; outside them the room is one flat step darker. The staff assigned to desks in the office sit at their desks during office hours, facing their screens, with a small idle head tilt and typing hands. Each arrives in the first half hour at a time of their own, appearing at the door and walking the grid to the desk, and leaves in the last half hour the same way back. The figures cannot be clicked; pointing at one shows a name card on the desk. Arriving by car shows the office building with the company's plate beside its glass door.

## Own datacenter

A floor of an owned building fitted as a hall, or a bought Halle, is its own location and room, drawn from the rows the player laid out ([Own datacenter](own-datacenter.md)). The room is a raised floor wide enough for one cooling unit per 8 positions along the far wall and two tiles deeper for every ten positions. The left wall holds the entrance with its badge reader, the transformer room door, the meet-me room door and an extinguisher; a camera hangs in the far corner; a Halle has its loading dock on the far wall beside the cooling units. The NOC desk with three screens stands on the near row. Each row's positions show as dashed floor marks until a rack stands there; the floor between two rows facing each other is tinted as the cold aisle; cable trays run just above the rack tops along every row, with the tubes above them. Colocation customers' racks stand on their positions as closed neighbour racks with a padlock. While the hall carries heat, the racks past the cooled positions shimmer, and a tripped hall goes dark. Dragging an empty row's floor mark moves the row.

## Movement and interaction

The room is played like a tycoon game. There is no figure to walk around: the player looks at the room and clicks objects directly, and a click acts at once. The arrow keys and WASD pan the view, the wheel zooms and a drag pans. Keys do nothing while a dialog or menu is open.

Presence stays a sim rule: the room on screen is the one the player is at, the door starts the trip, and arriving shows the destination room.

Deliveries go straight into storage, and a free unit in the rack panel offers every stored unit at that location that fits.

Every click calls an existing action. Only the desk PC and the NOC desk open the desktop; every other object opens a slide-up panel in the room.

**Phone.** A wall phone hangs beside the basement door and in the office reception: a beige corded set in 2005, a cordless handset in its wall base from 2010. Between 21:00 and 06:00 the player is on call for every location with no technician on call or on shift. A part failing there, or an attack saturating its links, rings the phone: the handset shakes and a bell rings every few seconds while a room with a phone is on screen, and the inbox gets the page as before. Clicking the phone answers. The close-up shows the phone with its handset off the hook and a notepad with the site, what happened and when; for a failed part the notepad opens the rack close-up when the player is at the site, or offers going there in person and remote hands when away. A call left ringing for 30 minutes is missed and costs every active customer 5 happiness.

A technician who takes an operation stands in front of the rack of its device for that hour, facing it, with a hand reaching into it every few seconds; they walk in from the door over the first minutes and back out over the last. The on-call technician appears the same way when called out at night, so the basement stays empty unless someone is called out there. A remote hands job brings the provider's technician, in the provider's colour with a small badge, for the last hour before it is due. A person hidden behind a rack row shows through as a faint outline. Pointing at a standing figure shows the name on a small plate on the floor at its feet, the provider's name for their technician. The player is never drawn.

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
- In the world, clicking the desk PC or the NOC PC opens the desktop. Escape in the world closes an open panel and stays in the room.
- A clock in the top left corner of the world shows the game date and time and holds the same speed buttons as the menu bar, so the player can pause and resume from the first second.
- The desktop shows the room the player is in as a button in the menu bar next to the time controls and as a desktop icon in the top right; both return to the world. **Stand up** in the logo menu and a world button in the Locations app do the same.
- Sheets that greet the player on the desktop (Early Access, what's new, system and game updates) wait until the desktop opens.
- Both surfaces share the store. The current surface is UI state and is not saved.
- Notifications still slide in while the world is open, so the world is never a blind spot.

## Simulation pieces the world needs

Each is its own feature with a seeded test and lands before the world depends on it.

- **Rack tiles.** Every rack in a location has a tile and a facing. New racks take the next free wall tile. An action moves a rack. Old saves get tiles assigned on load.
- **Presence rules.** Hands-on work (mounting, unmounting and moving a unit in its rack, adding, removing and swapping parts, plugging cables and power cords) needs hands at the location. When the player stands there, the player's own hands do it at once. From afar every hands-on action shows its ways as separate buttons: "<Action> · Selbst" queues the work for the player's own hands, starts the drive there and does it on arrival at no fee, waiting if the player leaves first; at a datacenter a second button "<Action> · Remote Hands <fee> · <wait>" queues a remote hands job, billed at the datacenter's hourly rate for 30 minutes to mount, 15 minutes to cable and an hour for parts when it is done after the response time. Both jobs are cancellable until they run, and the unit shows a queued own job with the badge "Selbst · bei Ankunft". The basement has no remote hands, so from afar it offers only the own hands button. Carrying is always the player's own hands.
- **Deliveries.** Arrivals land in the location's storage and keep their arrival hour (`arrivedAt` on the unit, null for old saves). The room draws units that arrived within the last 24 hours and are not mounted as parcels by the door. Old saves move units at the door or in the player's hands into storage.
- **Post in the box.** Each letter knows whether it waits in a letterbox or lies at the desk, and whether it is scanned. Delivery puts it in the basement letterbox; fetching needs the player there and takes all of them. A letter in the letterbox cannot be read, and its bill is due all the same. Scanning a desk letter once files it in DocuWhere. Old saves keep their letters at the desk and filed.

## Multiplayer, later

Friends running their own companies in the same market is a later layer, and it is a sync question first. The sim is deterministic from a seed and every change goes through an action, so two saves can replay the same action log. The static site rule stands: no server of ours. Options in order of cost are a shared leaderboard (exists), trading hardware through an exported file, and a peer-to-peer session over WebRTC with a public signalling service. Each needs its own design before any code.

## Demo scope

The first demo is the basement played by direct clicks, the PC that opens the desktop, racks on their tiles that open a close-up of the rack inside the room, where devices are mounted, removed and opened, parcels drawn by the door for a fresh delivery, a shelf, letterbox and scanner that open their panels in the room, a door that swings open and opens the map, and cabling by hand at the rack back with cables between racks drawn along the trays. The sim change is rack tiles. The rest of the table above comes feature by feature.
