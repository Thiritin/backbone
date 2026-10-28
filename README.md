# Backbone

Backbone is a browser management game in which you grow a hosting company from a 2005 basement to your own datacenter.

Play it at [thiritin.github.io/backbone](https://thiritin.github.io/backbone/).

## Inspiration

Backbone takes its inspiration from [Series of Tubes](https://github.com/fjaeckel/seriesoftubes) by Frederic Jung, a cartoon browser game about how the internet really works, from laying fiber and peering at exchanges to billing on the 95th percentile. Its routing model, its parody network names and its project layout shaped this game.

## Running it locally

```bash
npm install
npm run dev
```

The game then runs at http://localhost:5173. `npm test` runs the simulation tests.

## Credits

The world map uses coastlines, city coordinates and submarine cables from [Series of Tubes](https://github.com/fjaeckel/seriesoftubes), released under the MIT licence. Its coastlines are simplified from [Natural Earth](https://www.naturalearthdata.com), which is in the public domain. `scripts/import-world.mjs` turns them into `src/ui/map/world-data.ts`.

## Licence

Backbone is released under the [MIT licence](LICENSE).
