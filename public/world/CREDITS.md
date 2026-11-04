# World art credits

Everything in the rooms is drawn in code. The map uses the data sources below.

| Files | Source | Author | Link | License |
| --- | --- | --- | --- | --- |
| `src/ui/map/roads.ts` | Natural Earth 10m roads | Natural Earth | https://www.naturalearthdata.com/downloads/10m-cultural-vectors/roads/ | Public domain |
| `src/ui/map/routes.ts` | Routes from the Open Source Routing Machine demo server, https://router.project-osrm.org (engine BSD-2-Clause) | OpenStreetMap contributors | https://www.openstreetmap.org/copyright | ODbL |
| `src/ui/map/region/europe.ts` | Major roads, rivers, lakes, urban areas and town names from Natural Earth 10m (roads, rivers, lakes, urban areas, populated places) | Natural Earth | https://www.naturalearthdata.com/downloads/10m-cultural-vectors/ | Public domain |
| `src/ui/map/region/<city>.ts` | Roads, rail, rivers, lakes, urban areas and towns from Natural Earth 10m; forests and parks from the Overpass API, https://overpass-api.de | Natural Earth; OpenStreetMap contributors | https://www.openstreetmap.org/copyright | Public domain; ODbL, attribution "© OpenStreetMap contributors" |
| `src/ui/map/streets/*.ts` | Main streets per city from the Overpass API, https://overpass-api.de | OpenStreetMap contributors | https://www.openstreetmap.org/copyright | ODbL, attribution "© OpenStreetMap contributors" shown on the map |

## Map borders, rivers and lakes

Borders, rivers, lakes and country label points come from Natural Earth (public domain). City water, green areas, major roads and rail come from OpenStreetMap contributors (ODbL).

Regional patches of about 150 km around each European datacenter city and the European national layer are built by `scripts/import-region-geo.mjs`.
