# World art direction

How the rooms of the 2D world are drawn. Every object in `src/ui/world/draw.tsx` follows this; a new fixture is checked against it before it lands. The product's colour tokens live in `DESIGN.md`; this file says how the world uses them.

## Look in one sentence

A clean flat isometric miniature of a real place, drawn with care and full of the small things that make a room believable, lit by what is actually there.

## Projection and scale

- 2:1 isometric, 64 by 32 tiles at zoom 1. Walls on the two far sides only, 96 px tall at zoom 1, so a 42U rack reaches about two thirds of the wall.
- One tile is about one metre. A rack is 0.6 by 1.0 tiles and 2 m tall, a desk 2 by 0.8 tiles, a person-sized door 0.9 tiles wide. Objects are drawn to these sizes, never scaled to fit a label.
- Rooms are tight. A basement is 9 by 7 tiles: room for four racks against the walls, the desk, the shelf and the house's own clutter, and not much floor left. A colocation share is smaller still. Empty floor is a smell.

## Shapes and shading

- Flat fills, two or three tones per object: a lit top, a mid left face, a darker right face. The light comes from the upper left, the same in every room.
- Edges where faces meet get a one-pixel line in a darker tone of the same hue. No black outlines, no outer strokes.
- No gradients on faces. The only gradients in a room are light overlays (below).
- Corners are square. Rounded corners only on things that are round in life: pipes, fans, chair seats, lamp shades.
- Small details are drawn, not implied: handles, hinges, screws on a fuse box, vents, LEDs, a label plate, the seam of a cardboard box. If a thing has a visible feature in a photo of it, it has one here.

## Materials

| Material | Tones | Used for |
| --- | --- | --- |
| Painted plaster | the window and sidebar tokens from the product | basement and office walls |
| Raw concrete | cool grey with faint blotches drawn as a few lighter patches | basement floor |
| Raised floor tiles | lighter cool grey with a fine grid | datacenter floors |
| Dark metal | the product's metal tokens | racks, PDUs, the fuse box door |
| Light metal | warm light grey | shelves, cooling units, cable trays, pipes |
| Wood | two warm browns | the desk, the basement door, crates of beer |
| Cardboard | sand with a darker seam | parcels, storage boxes |
| Glass | the accent-soft token at low opacity with a white highlight stroke | windows, cage doors, monitor screens |

## Light

- Every room has a light source that is drawn: cellar windows high on the far wall in the basement, fluorescent tubes in a datacenter, a desk lamp on the desk.
- Light shows as overlays: a soft shaft from each window across the floor and up the near objects, a warm pool under a lamp, a faint cool wash from fluorescent tubes. Overlays are low-opacity gradients on top of the room, never baked into faces, so they move when the light changes.
- The time of day drives the window light: warm and long in the morning and evening, white at noon, gone at night when the ceiling lamp takes over with a warm pool and the rest of the room drops a step darker. Rack LEDs glow a touch more at night.

## Detail density

- Every wall segment carries something: a pipe run, a conduit from the fuse box to the racks, a cable tray, a poster, a calendar, a switch plate, a hook with a coat, a hygrometer.
- Floors have the marks of use: a drain, a floor mat at the door, a cable crossing to a rack under a rubber bridge, a crate of beer, a bucket.
- The era shows. In 2005 the PC is a beige tower with a CRT or an early flat screen, the modem is a Fritz!Bocks on a shelf, the phone on the wall has a cord. Later eras swap these in the same slots.
- Clutter is placed, not random: boxes stack where a person would stack them, the chair stands where someone pushed it back from the desk.

## What a room must have

Basement: two cellar windows with light shafts, the fuse box with breakers and a meter with a spinning disc, a conduit from it to the racks, the boiler with pipes to the ceiling, a washing machine and a drying rack (it is the parents' house), the desk with PC, screen, keyboard, scanner and a desk lamp, an office chair, the shelf with boxes, the door with a mat, the letterbox beside it, a ceiling lamp, a hygrometer on the wall, a floor drain, a crate of beer, and racks where the player put them.

Rack space (share): the player's racks stand in one row among other tenants' racks on the open datacenter floor. Every rack, the player's and the neighbours', has a mesh front door with the servers visible behind it; neighbour racks are drawn closed and dimmed and cannot be clicked. The room has a normal datacenter door and no fence.

Cage: the same floor with a mesh fence and a mesh door around the player's area only, and a badge reader at the door.

Suite: a room of its own with the NOC desk, three screens and a loading-dock door.

In every datacenter room: hot and cold aisles are a property of the datacenter, not of the room kind. With aisles, rack rows face each other across an aisle; without them, rows face the same way. The floor is uniform raised-floor tiles everywhere, with no different tiles in front of racks. No wall carries a cross-connect panel with carrier names; cross-connects live in the rack's patch panel and on the desktop. Every room keeps cable trays with cables in them, fluorescent tubes, cooling units with status LEDs, a PDU, an extinguisher, a parts shelf and a cart.

## What not to do

- No outlines, no pixel art, no sprites, no drop shadows.
- No floating text. Numbers live on a device's display or a label plate.
- No symbols standing in for objects. A fan is a fan with blades and a grille, not a circle with a cross.
- No empty walls and no empty floors.
- No real brand names; every logo or label uses the game's pun names.
