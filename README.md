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

## Submitting a run

Every week has a challenge with the same seed and twist for everyone. Start it with Weekly challenge on the start screen and play until 1 January 2008. Then open Settings, go to Leaderboard and click Export run, which saves a file named after your company and the seed, ending in `.run.json`.

To submit the run, fork this repository, add the file to the `leaderboard/` folder and open a pull request. Once it is merged, the run is replayed with the version of the game you played, and it appears on the leaderboard with the next deploy when the scores match the ones in the file. A run made on an older version is still checked with that version, and it is listed on that version's board.

To check a run before submitting it, run `npx tsx scripts/replay.ts path/to/run.json` in a checkout of the same version. The script prints the scores and exits with an error when they differ from the file.

## Credits

The world map uses coastlines, city coordinates and submarine cables from [Series of Tubes](https://github.com/fjaeckel/seriesoftubes), released under the MIT licence. Its coastlines are simplified from [Natural Earth](https://www.naturalearthdata.com), which is in the public domain. `scripts/import-world.mjs` turns them into `src/ui/map/world-data.ts`.

The server room recording in `public/sounds/server-room.mp3` is the binaural server room recording 29072 by freesound_community on Pixabay, used under the Pixabay Content License.

## Licence

Backbone is released under the [MIT licence](LICENSE).
