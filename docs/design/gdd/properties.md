# Properties

Status: design, first build in progress. Part of [The world](the-world.md) and [Locations and space](locations-and-space.md).

A property is where the company lives. Racks live in locations; people live in properties. The two meet in an office with a server room, and until then the company lives in a basement.

## The start

The company is founded at the parents' house in Frankfurt. The address is fixed: Kellerweg 3, 60311 Frankfurt am Main. It is rent-free, holds the player's desk and whatever racks the house's power allows, and it is a home, so nobody can be employed to work there. Every letterhead, the website and the post use this address until the company moves.

The city of the first property is always Frankfurt and the first address is never chosen; it comes with the game. The player chooses a city only when the company grows into a second property.

## Properties

| Kind | What it is | Desks | Racks |
| --- | --- | --- | --- |
| Basement | The parents' house, the start | The player's own | A few, limited by the house's power |
| Small office | One floor section in an office building in the company's city | 4 per section | None, or a server closet with 1 rack if the section is fitted as one |
| Server closet | A desk section with a lockable metal cupboard in its far corner; the four desks stay | 4 per section | 1 rack on the section's own 2 kW circuit, no cooling unit |
| Office building | Several sections on one or more floors of one building; the company expands section by section | 4 per section | A section fitted as a server room holds 4 racks with proper power and cooling |
| Own building | Bought outright; sections are free to fit out, no rent, upkeep instead | as above | as above |

A section is about 40 square metres. Each section is fitted as desks (four desks, a meeting corner, a kitchenette on the first one) or as a server room (racks, a small cooling unit, a PDU, a fire extinguisher, a door with a code lock). Refitting a section costs money and takes days.

Renting a section costs a monthly rent, a deposit of three months, and a notice period of three months. Buying a building costs its price and from then on upkeep per section per month. Numbers live in `economy/properties.md`.

## Listings

The Locations app gains a Properties tab: listings in the company's city, each with the building's name, street, sections free, rent per section, buy price when the building is for sale, and a floor plan showing which sections are taken by other tenants. Renting a first section in a building makes it the company's office; renting further sections in the same building expands it. Only one office at a time until the company is large; a second office in another city is a later feature.

## The address follows the property

Moving into an office moves the company's address to it. The post arrives at the office letterbox, the letterhead and website update on the day of the move, and the basement stays a location for its racks. Every letter is addressed to the company's address on the day it is sent. For one month after the move, letters sent before it still arrive at the basement letterbox while new ones arrive at the office; after that month everything lands at the office. Letters already in the basement letterbox stay there until fetched.

## Staff need desks

Hiring is limited by free desks: staff count never exceeds desks across all properties. The basement has none. Each employee is assigned a desk in a section and works there during office hours, 9 to 18 on weekdays; technicians work at the location of their job instead and come back when done. The room shows the people who are in: they arrive in the morning, sit at their desks, leave in the evening. Nobody appears in the basement.

## The office room

The office is a room in the world, one per floor, built from its sections as described in [The world](the-world.md), "Office": a reception strip on the first section's floor with the kitchenette, printer, letterbox, reception counter and the player's own desk whose PC opens the desktop; desk sections with four desks in two islands; server sections behind a glass partition with a code-lock door; sections under refit bare with tools and paint. The staff sit at their desks during office hours, walking in during the first half hour and out during the last. Every object follows the art direction in `docs/design/world-art.md`.

## Pieces

- Sim: properties and sections, listings per city and era, rent, deposit, notice, buy and upkeep, refits, the address that follows, desks and the hiring limit, office hours and who is in.
- Locations app: the Properties tab with listings, floor plans, rent, expand, refit, give notice, buy.
- World: the office room kind with its fixtures, staff figures at desks arriving and leaving, the letterbox at reception.
- Travel: the office as a destination on the map.
