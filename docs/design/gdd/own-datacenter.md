# Own datacenter

Status: built, with zones, cross-connects and the hub. Part of [Properties](properties.md), [Locations and space](locations-and-space.md) and [The world](the-world.md).

The end game is a hall of your own. A bought building with a floor fitted as a datacenter hall becomes a location with no provider: no provider panel, no remote hands, no aisles rule from a table, because every choice is the player's.

## How it starts

An office building the company owns can have a floor fitted as a hall (refit `hall`, the price and days on the economy page, far above a server room). The first hall holds up to 20 rack positions; a second floor adds 20 more. A separate industrial building type, "Halle", appears in the listings of Frankfurt, Berlin, Düsseldorf and Amsterdam from 2012 for purchase only, with 60 positions per floor and a loading dock.

## What the player lays out

- **Edit mode.** A plan board by the entry door puts the room into edit mode: the same room with a tile grid on the floor. Walls, the doors and the fixtures stay where they are. Racks, zones and every item can be placed, moved, turned in 90 degree steps and removed; every edit acts at once and is checked in the sim as one transaction over the whole next layout. A group move with a rotation applies all of it or none.
- **Free placement.** There are no rows. Every rack, zone tile and item stands on a tile with a facing inside an area, and a rack keeps a stable position number that no longer says where it stands. Rack spots (racks, customers, the exchange and every empty zone tile) are limited to the hall's capacity.
- **Areas.** The hall area takes racks, zones, cooling units, vents, containment and NOC desks. A transformer room on its right side takes transformers, switchgear and generators; a battery room below it takes UPS units and battery cabinets; a NOC room is built below the hall's near side for a fee and takes NOC desks and wall screens. Each room joins the hall by one doorway.
- **Placement rules.** Everything must lie inside an area that accepts it, and bodies do not overlap each other, zone tiles, fixtures or the tile inside a door or doorway. Every rack, zone tile and body item keeps the tile in front of it free of bodies (its clearance), and every clearance tile must have a way on foot to the entry door. Racks may stand with their back to a wall or to another rack; two racks facing each other share one clearance tile. A vent and a containment may share a tile but never lie under a body. A rack with devices cannot be removed, one that was moved is dark for two hours and keeps its cables, a rack linked to the meet-me zone cannot leave it, and the last NOC desk stays.
- **Cooling.** Cooling units are bodies placed anywhere in the hall. Until the airflow model lands, each working unit cools 40 kW and nothing marks a rack hot.
- **Power.** The limit is the sum of the placed transformers, at most two per hall floor; the refit places one per floor for free. Switchgear B (one per hall) opens feed B on every rack. A UPS carries the room and a generator follows it. Over the limit the main breaker trips as in every room; nobody resets it but the player or a technician. A refit item refunds nothing; a bought item refunds half its price.
- **Zones.** A zone is a line of tiles on the floor with a facing. Open colocation zones take single-rack customers and cost nothing. From 2015 a cage zone of 2 to 8 positions is fenced for a fee per position and takes one customer who rents all of it. One meet-me zone of 1 to 4 positions is fenced for a flat fee; the racks standing on it are the player's and take its facing. Zones cannot overlap, a player rack cannot stand on a colocation or cage zone, and a zone with a rack or customer on it cannot be moved or removed. An empty zone moves, turns and, removed, refunds half the fence.
- **Delivered racks.** A rack bought from the desktop into a hall or moved there arrives without a tile and stands crated at the entry. It counts as moving, draws no power and is placed from the parts strip for free.
- **Meet-me.** Carriers build in only once the meet-me zone exists. Their fiber lands on the fiber patch panels in the zone's racks and nowhere else; a 24-fiber panel has 24 jacks and a 48-fiber panel 48. Carriers in the city offer to bring a line into the hall: a one-time build fee per carrier and the uplink prices as at a colocation site.
- **Cross-connects.** Each month a customer may order a cross-connect to a built carrier, up to three, for a monthly fee. It takes the first free jack on a fiber panel in the meet-me zone with the role `customer`, and the label strip names the customer. A full panel means no order and a customer more likely to leave. A leaving customer frees its jacks.
- **Hub.** A hall with 8 customers draws a free carrier of its city now and then. With 3 carriers and 12 customers the city's exchange announces itself and moves its rack onto the first free tile of the meet-me zone; a full zone makes it wait. From then on exchange ports and peering book in the hall as at a datacenter with an on-site exchange.
- **Security.** A badge reader at the door, cameras, and from 2015 the cage zones.
- **Colocation customers.** A hall lists its colocation zones in the Sales app as rack space at a price the player sets against the city's going rate; a customer's rack is drawn as a neighbour rack with a lock and stands on the first free tile of the lowest zone. Each customer draws 2 to 5 kW per position (a cage per position), which counts toward the transformer limit, warms the hall and is paid for with the hall's power bill. A month in which the breaker tripped makes every customer likelier to leave. A cage customer pays the open rate times the cage length with a markup.

## In the room

The hall is drawn like a suite from the same floor: raised floor, the racks and zones the player placed, cooling units, the meet-me room door, the loading dock, the main distribution board in the transformer room, the NOC desk, fluorescent tubes. A tripped floor goes dark.

Zones are painted in edit mode from the parts strip: dragging a zone onto the floor places a default run, and R turns it before the drop. Dragging a zone onto the strip removes it. Open colocation is a grey band, cages and the meet-me area are fenced. Customer racks stand locked inside their zone; the exchange's rack carries a plate with its name. The meet-me door shows one fiber duct per carrier of the city: a built one runs on to the patch rack, an unbuilt one carries a price tag that builds it in.

The floor plan in the Locations app is read only: racks and zones drawn small, with positions, cooling, kW and carriers.

## Pieces

- Sim: the hall refit and the Halle listing, tiles, facings and areas as layout state on the property, one validator and one edit action, power limits from the placed items, the carriers' build fees, colocation customers as a product, zones, cross-connects and the hub, trips without provider panel or remote hands, old saves unchanged (rows become tiles, upgrades become items, a colocation zone appears under each customer and a meet-me zone under the first rack with an uplink).
- Properties tab: the floor plan, carrier build orders, customer rack listings.
- Room: the hall layout from the tiles, dragging racks, zones and cooling units, the fixtures above, customer racks.
- Economy page: all prices.
