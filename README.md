# raid0

raid0 is a browser management game in which you grow a hosting company from a 2005 basement to your own datacenter.

Play it at [raid0.dev](https://raid0.dev/).

## Download

The desktop app is available for these systems. Download it from the [latest release](https://github.com/Thiritin/raid0/releases/latest).

| Platform | Architecture | Installer |
| --- | --- | --- |
| Windows | x86_64 | [Setup exe](https://github.com/Thiritin/raid0/releases/latest/download/raid0-windows-x64-setup.exe) |
| Linux | x86_64 and arm64 | [AppImage x86_64](https://github.com/Thiritin/raid0/releases/latest/download/raid0-linux-x64.AppImage), [AppImage arm64](https://github.com/Thiritin/raid0/releases/latest/download/raid0-linux-arm64.AppImage) |
| macOS | Apple silicon | [dmg](https://github.com/Thiritin/raid0/releases/latest/download/raid0-macos-aarch64.dmg) |

The app updates itself when a new release is out.

## Inspiration

raid0 takes its inspiration from [Series of Tubes](https://github.com/fjaeckel/seriesoftubes) by Frederic Jung, a cartoon browser game about how the internet really works, from laying fiber and peering at exchanges to billing on the 95th percentile. Its routing model, its parody network names and its project layout shaped this game.

## Running it locally

```bash
npm install
npm run dev
```

The game then runs at http://localhost:5173. `npm test` runs the simulation tests.

## Credits

The world map uses coastlines, city coordinates and submarine cables from [Series of Tubes](https://github.com/fjaeckel/seriesoftubes), released under the MIT licence. Its coastlines are simplified from [Natural Earth](https://www.naturalearthdata.com), which is in the public domain. `scripts/import-world.mjs` turns them into `src/ui/map/world-data.ts`.

The server room recording in `public/sounds/server-room.mp3` is the binaural server room recording 29072 by freesound_community on Pixabay, used under the Pixabay Content License.

## Licence

raid0 is released under the [MIT licence](LICENSE).
