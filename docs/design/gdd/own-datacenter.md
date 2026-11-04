# Own datacenter

Status: first build done; the cage option for customers is still to come. Part of [Properties](properties.md), [Locations and space](locations-and-space.md) and [The world](the-world.md).

The end game is a hall of your own. A bought building with a floor fitted as a datacenter hall becomes a location with no provider: no provider panel, no remote hands, no aisles rule from a table, because every choice is the player's.

## How it starts

An office building the company owns can have a floor fitted as a hall (refit `hall`, the price and days on the economy page, far above a server room). The first hall holds up to 20 rack positions; a second floor adds 20 more. A separate industrial building type, "Halle", appears in the listings of larger cities from 2012 for purchase only, with 60 positions per floor and a loading dock.

## What the player lays out

- **Edit mode.** A plan board by the entry door puts the room into edit mode: the same room with a tile grid on the floor. Walls, the doors, the NOC desk, the dock and other fixtures stay where they are. Rows, the player's racks and cooling units can be placed, moved and removed; every edit acts at once and is checked in the sim before it happens.
- **Rows.** The player places rack rows on the grid: a row is a line of positions facing one way, free to lay. Every row needs a free aisle line one tile deep in front and behind it, and two rows may share one. Two rows whose fronts face across one aisle make a cold aisle; a row whose front faces another row's back takes in that row's hot air, so all its positions run hot. A row may not stand on a fixture or in front of a door. Racks are bought per position as everywhere.
- **Moving.** A row with racks can be moved or turned and its racks go with it; a row can be lengthened or shortened while nothing stands on a removed tile. A rack with devices moved to another free position, alone or with its row, is dark for two hours; its cables stay. Only an empty row can be removed. A row with a customer cannot be moved, turned, shortened or removed. A cooling unit moves to another slot free of charge and removing one refunds half its price.
- **Cooling.** Cooling units stand in slots on the far wall and the right wall, two tiles each. Each unit cools the 8 positions nearest to it, units taking their positions in slot order and ties going to the lower position number. A position no unit covers runs hot, with the failure rate the hardware economy page gives for heat, and so does every position of a row in hot air.
- **Power.** A transformer room per floor with a limit, and one extra transformer per floor that raises it again; feed B and a generator are upgrades with a monthly cost and a one-time price; a UPS bridges the generator's start. Over the limit the main breaker trips as in every room; nobody resets it but the player or a technician.
- **Carriers.** Carriers in the city offer to bring a line into the hall through a meet-me room: a one-time build fee per carrier and the uplink prices as at a colocation site. Cross-connects between the player's rooms are free.
- **Security.** A badge reader at the door, cameras, and from 2015 a cage option inside the hall for colocation customers.
- **Colocation customers.** A hall with spare positions lists them in the Sales app as rack space for customers, at a price the player sets against the city's going rate; a customer's rack is drawn as a neighbour rack with a lock, and their lines land on a patch panel the player installs.

## In the room

The hall is drawn like a suite from the same floor: raised floor, the rows the player laid out, cooling units, the transformer room door, the meet-me room door, the loading dock, a NOC desk with three screens, fluorescent tubes, cable trays the player's cables run along. Empty positions show as marked floor tiles. A hot zone shows the heat shimmer; a tripped floor goes dark.

## Pieces

- Sim: the hall refit and the Halle listing, rows and positions as layout state on the property, cooling and power limits with their upgrades, the carriers' build fees, colocation customers as a product, trips without provider panel or remote hands, old saves unchanged.
- Properties tab: the floor plan editor for rows, cooling and power upgrades, carrier build orders, customer rack listings.
- Room: the hall layout from the rows, dragging a row, the fixtures above, customer racks.
- Economy page: all prices.
