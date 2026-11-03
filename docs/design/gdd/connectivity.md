# Connectivity

Status: design, first build in progress. Extends [Network and DDoS](network-and-ddos.md) and [Racks, hardware and cabling](racks-hardware-and-cabling.md).

Everything that enters or leaves a rented rack passes through the provider's patch panel. Uplinks, cross-connects and the provider's cabling between your racks all land there; what happens below the panel is yours.

## The provider's patch panel

Every rack the player rents at a datacenter comes with a patch panel from the provider in its top unit. It is not bought, it cannot be removed, and it takes no rack position of the player's own. It has 24 jacks. A jack is either free, an uplink port, a cross-connect, or the end of a provider cable to one of the player's other racks on the same floor. The player cables from the jack down to a router or switch in that rack.

The basement has no provider; the wall socket by the fuse box is its line.

An office server room or closet has no line of its own until the player books a business line from the city's provider in the Network tab. The line ends at a wall socket in the server section, and the office router's WAN port is cabled to it like the basement router is. It is billed monthly at the price of the day it was booked, and a faster line of a later year replaces it on booking.

## Uplinks

An uplink is a line from the provider or a carrier into a jack. It has a speed and a monthly price, and the price covers the line, not the traffic; traffic is billed as [Network and DDoS](network-and-ddos.md) describes. A location can book as many uplinks as it has free jacks and router ports, and every line is paid for. The player chooses between upgrading one line and adding a second one; two lines give redundancy and, bundled on the router, their speeds add.

Speeds on offer follow the years. A speed below the era's floor is not sold any more, and a speed above the era's ceiling does not exist yet.

| Year | Floor | Standard | Ceiling |
| --- | --- | --- | --- |
| 2005 | 10 Mbit/s | 100 Mbit/s | 1 Gbit/s |
| 2010 | 100 Mbit/s | 1 Gbit/s | 10 Gbit/s |
| 2015 | 100 Mbit/s | 1 Gbit/s | 40 Gbit/s |
| 2020 | 1 Gbit/s | 10 Gbit/s | 100 Gbit/s |
| 2025 | 1 Gbit/s | 10 Gbit/s | 400 Gbit/s |
| 2030 | 10 Gbit/s | 100 Gbit/s | 1.6 Tbit/s |

Above 10 Gbit/s a line needs a port and a module that can take it: a switch or router with SFP+, QSFP, QSFP-DD or OSFP ports and the matching module from the Shop. The top end from 2030 is InfiniBand at 1.6 Tbit/s and needs InfiniBand switches and modules. Prices per speed and year live in `economy/connectivity.md`.

## Cross-connects

A cross-connect is a line from a jack to another party in the same building: a carrier, an exchange, or a customer. Booking one is unchanged from [Locations and space](locations-and-space.md); it now lands on a jack of the chosen rack's panel.

## Cables between your racks

In rented rack space the floor belongs to the provider, so cables between the player's racks are run by the provider: the player orders a cable from a jack on one rack's panel to a jack on another rack's panel, the provider charges a one-time fee and installs it after a lead time, and from then on the two jacks are one link. With that a cluster spans several racks and everything comes together in one routing or switching rack.

In the player's own cage or suite the floor is the player's, and cables between racks are run by hand the way cables inside a rack are, with no order and no fee. In an own datacenter the same.

## What the player does

- Books an uplink or a second line in the Network app, choosing the rack and the speed, or from a free jack's tag on the rack back, choosing the carrier and the speed for that jack.
- Starts a connection between two racks by dragging from one rack to the other in the room, or with "New connection from here" on a right-click of a rack or a device and a click on the other rack. Both rack backs then open side by side.
- In that view, drags or clicks a cable from a port or jack on one rack to one on the other. Two provider-side jacks become a provider cable order on a slip showing the fee and the day it is ready, which the player signs; a device port in a share is refused, since the provider runs those cables. In a cage, a suite or an own floor the cable is run by hand.
- Cables jacks down to routers and switches by hand on the rack back.
- Sees the provider panel drawn large above the rack back: every provider-side jack has a label strip with its role (the uplink's speed and carrier, the cross-connect's party, the other rack of a provider cable, or free), a queued order hangs its due day under the strip, and hovering a jack names it. The Network app shows what each uplink costs.
- In a share, the player's other shares in the same datacenter stand beside the rack in the same row.

## Pieces

- Sim: the provider panel on every rented rack, jacks and their roles, uplink products by year and speed, port and module requirements above 10 Gbit/s, provider cable orders with fee and lead time, the free-cabling rule for cage, suite and own datacenter, old saves keep their uplinks.
- Desktop: uplink booking with speed, rack and second line, the panel's jack list in the Locations app.
- Room: the provider panel on the rack back with its jacks labelled, provider cable orders from the back, drag and drop or right-click for new connections between devices across racks.
