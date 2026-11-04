# Own datacenter

Status: built, with zones, cross-connects and the hub. Part of [Properties](properties.md), [Locations and space](locations-and-space.md) and [The world](the-world.md).

The end game is a hall of your own. A bought building with a floor fitted as a datacenter hall becomes a location with no provider: no provider panel, no remote hands, no aisles rule from a table, because every choice is the player's.

## How it starts

An office building the company owns can have a floor fitted as a hall (refit `hall`, the price and days on the economy page, far above a server room). The first hall holds up to 20 rack positions; a second floor adds 20 more. A separate industrial building type, "Halle", appears in the listings of Frankfurt, Berlin, Düsseldorf and Amsterdam from 2012 for purchase only, with 60 positions per floor and a loading dock.

## What the player lays out

- **Edit mode.** A plan board by the entry door puts the room into edit mode: the same room with a tile grid on the floor. Walls, the doors, the NOC desk, the dock and other fixtures stay where they are. Rows, the player's racks and cooling units can be placed, moved and removed; every edit acts at once and is checked in the sim before it happens.
- **Rows.** The player places rack rows on the grid: a row is a line of positions facing one way, free to lay. Every row needs a free aisle line one tile deep in front and behind it, and two rows may share one. Two rows whose fronts face across one aisle make a cold aisle; a row whose front faces another row's back takes in that row's hot air, so all its positions run hot. A row may not stand on a fixture or in front of a door. Racks are bought per position as everywhere.
- **Moving.** A row with racks can be moved or turned and its racks go with it; a row can be lengthened or shortened while nothing stands on a removed tile. A rack with devices moved to another free position, alone or with its row, is dark for two hours; its cables stay. Only an empty row can be removed. A row with a customer cannot be moved, turned, shortened or removed. A cooling unit moves to another slot free of charge and removing one refunds half its price.
- **Cooling.** Cooling units stand in slots on the far wall and the right wall, two tiles each. Each unit cools the 8 positions nearest to it, units taking their positions in slot order and ties going to the lower position number. A position no unit covers runs hot, with the failure rate the hardware economy page gives for heat, and so does every position of a row in hot air.
- **Power.** A transformer room per floor with a limit, and one extra transformer per floor that raises it again; feed B and a generator are upgrades with a monthly cost and a one-time price; a UPS bridges the generator's start. Over the limit the main breaker trips as in every room; nobody resets it but the player or a technician.
- **Zones.** Runs of positions in one row are set aside as paint on the floor. Open colocation zones take single-rack customers and cost nothing. From 2015 a cage zone of 2 to 8 positions is fenced for a fee per position and takes one customer who rents all of it. One meet-me zone of 1 to 4 positions is fenced for a flat fee; the racks in it are the player's. Zones cannot overlap, a player rack cannot stand in a colocation or cage zone, and a zone nobody rents and no rack stands in can be removed for half the fence back. Positions outside zones are never sold. A zone belongs to its row, so moving a row carries it, and a row cannot be shortened into one.
- **Meet-me.** Carriers build in only once the meet-me zone exists. Their fiber lands on the fiber patch panels in the zone's racks and nowhere else; a 24-fiber panel has 24 jacks and a 48-fiber panel 48. Carriers in the city offer to bring a line into the hall: a one-time build fee per carrier and the uplink prices as at a colocation site.
- **Cross-connects.** Each month a customer may order a cross-connect to a built carrier, up to three, for a monthly fee. It takes the first free jack on a fiber panel in the meet-me zone with the role `customer`, and the label strip names the customer. A full panel means no order and a customer more likely to leave. A leaving customer frees its jacks.
- **Hub.** A hall with 8 customers draws a free carrier of its city now and then. With 3 carriers and 12 customers the city's exchange announces itself and moves its rack onto the first free position of the meet-me zone; a full zone makes it wait. From then on exchange ports and peering book in the hall as at a datacenter with an on-site exchange.
- **Security.** A badge reader at the door, cameras, and from 2015 the cage zones.
- **Colocation customers.** A hall lists its colocation zones in the Sales app as rack space at a price the player sets against the city's going rate; a customer's rack is drawn as a neighbour rack with a lock. Each customer draws 2 to 5 kW per position (a cage per position), which counts toward the transformer limit, warms the hall and is paid for with the hall's power bill. A month in which the breaker tripped makes every customer likelier to leave. A cage customer pays the open rate times the cage length with a markup.

## In the room

The hall is drawn like a suite from the same floor: raised floor, the rows the player laid out, cooling units, the transformer room door, the meet-me room door, the loading dock, a NOC desk with three screens, fluorescent tubes, cable trays the player's cables run along. Empty positions show as marked floor tiles. A hot zone shows the heat shimmer; a tripped floor goes dark.

Zones are painted in edit mode from the parts strip: dragging a zone paint onto a row paints a default run, and a click on the paint arms it so a drag along a row sets the length. Dragging a zone onto the strip removes it. Open colocation is a grey band, cages and the meet-me area are fenced, and the meet-me area has a hatched yellow edge. Customer racks stand locked inside their zone; the exchange's rack carries a plate with its name.

The transformer door opens the transformer room drawn large: the transformer, a plinth for the second one, the feed B switchgear, the UPS cabinet and the generator in the yard. An empty spot carries a paper tag with the price; the tag opens a slip, and signing it buys the part. The meet-me door shows one fiber duct per carrier of the city: a built one runs on to the patch rack, an unbuilt one carries a price tag that builds it in, and without a meet-me zone the tags read "No meet-me area.". On the back of a meet-me rack, customer jacks carry label strips with the customer and the carrier.

The floor plan in the Locations app is read only: rows and zones drawn small, with positions, cooling, kW and carriers.

## Pieces

- Sim: the hall refit and the Halle listing, rows and positions as layout state on the property, cooling and power limits with their upgrades, the carriers' build fees, colocation customers as a product, zones, cross-connects and the hub, trips without provider panel or remote hands, old saves unchanged (a colocation zone appears under each customer and a meet-me zone under the first rack with an uplink).
- Properties tab: the floor plan editor for rows, cooling and power upgrades, carrier build orders, customer rack listings.
- Room: the hall layout from the rows, dragging a row, the fixtures above, customer racks.
- Economy page: all prices.
