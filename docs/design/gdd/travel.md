# Travel

Status: design, first build in progress. Part of [The world](the-world.md).

Leaving the room is a trip, and a trip is something to watch. The sim already decides how long it takes and sets `player.until`; this document describes what the player sees in between. The static site rule stands: no map or routing service is called while the game runs. All map data ships with the build.

## The sequence

1. **The door.** Using the door in the world opens the map with the current location marked and every reachable location as a pin. Picking one starts the trip through the existing travel action.
2. **Getting in.** A side-view scene drawn in the art direction of the rooms ([World art direction](../world-art.md)): the street outside the current building, the company car at the kerb. The avatar walks to the car, the door opens, the avatar gets in, the door shuts, the engine starts, the car drives off, and the scene fades to black. Each beat has a sound. The scene plays in about four seconds and any key or click skips it.
3. **On the road.** The map, dark and gamey. The route from origin to destination is drawn along real roads and a car marker drives it. The game clock in the corner runs ahead, with the speed multiplier shown, so the player sees how much game time the trip eats. The sim ticks at that speed and everything that happens in the meantime happens: mail arrives, tickets come in, money moves. The animation lasts a fixed stretch of real time scaled gently with distance, roughly six to twelve seconds, and arrives exactly at the game time the sim chose. Any key or click skips to arrival.
4. **Arrival.** Fade from black into the side-view scene at the destination: the car pulls up, the door opens, the avatar gets out and walks through the building door. Then the destination room in the world.

A trip into or out of a country across the sea (London, Dublin) flies, by the table in [Hardware, power and failures](../economy/hardware-power-and-failures.md). A flight follows the same sequence with a taxi in place of the company car in both street scenes: the taxi door shuts, the taxi drives off to the airport, the map shows a plane marker along the great-circle arc between the two places with a dashed trail behind it and a jet rumble under it, and at the far end the taxi pulls up at the destination. Trips to the other continent will fly the same way once those sites are on offer.

## The map

- Land, coast and the game's cities already exist in the Network app's map data. The travel map reuses them with a dark palette: deep blue-grey sea, dark slate land, dim grey roads, the route in the game's accent colour, the car marker bright.
- Roads come from a public-domain world roads dataset, filtered to the countries the game plays in and simplified so the file stays small. They are decoration and orientation; the route itself is a precomputed line.
- Routes between every pair of game cities are precomputed once by a script with an open routing engine and committed as a compact JSON of simplified polylines. The game reads the file and never routes at runtime. Pairs without a road route get a great-circle arc.
- Every place has its own spot in its city: each datacenter, the basement on Kellerweg and each office building. Pins and routes use the place, never the city centre.
- Each game city has its main streets from OpenStreetMap, motorways down to residential streets where the file size allows, one lazily loaded file per city. Whenever streets are on screen the map shows the "© OpenStreetMap contributors" line the licence asks for.
- The picker map opens at street zoom over the current city with every place as a named pin. Hovering a pin shows the trip's hours and fee; a pin that would be a flight has a small plane before its name. Zoomed out, each city shows one pin with the number of places; clicking it zooms into that city.
- A route is the street-level leg out of the origin place (its first 3 km toward the destination city), the simplified city-to-city route, and the leg into the destination place. Drives between two places of one city are stored whole.
- A flight shows the whole arc from the start, with no street phases.
- The drive opens at street level over the origin with the car on its street, slows through the first and last 3 km, eases out to the whole route over the motorways in between and back in to the destination's streets, arriving at the place. The car follows the polyline, rotating with the heading.

## Sounds

Car door, engine start, engine running, engine stop; for a flight a lighter taxi door and a jet rumble loop. The game's sound layer synthesises its sounds in code; the travel sounds follow that unless a free pack fits better. Any pack used is recorded in `public/world/CREDITS.md`.

## Pieces

- Data: the roads file, the routes file, the script that builds them, and the credits entry for the data sources.
- Scenes: the two side-view scenes drawn in code, with the avatar in the style of the room figures and the car drawn flat.
- Map: the dark map, the route, the marker, the clock readout.
- Flow: door, map, scene, map, scene, room, with skip on every stage and the existing travel action and arrival time driving all of it.
