# Desktop app

The game ships as an installable desktop app built with Tauri v2. It wraps the same static `dist` build the website uses, so there is no server. All desktop code does nothing in a normal browser.

## Run it locally

You need Node and a Rust toolchain.

- `npm run desktop:dev` starts Vite on port 5173 and opens the app window on it.
- `npm run desktop:build` builds the site and produces an installer for your platform in `src-tauri/target/release/bundle/`.

The update offer never appears in `desktop:dev`.

## Releases

Installers, the updater manifest and the update offer come from the Release workflow. Cutting a release, the secrets it needs and fixing a failed run are described in [release.md](release.md).

Installed apps check `https://github.com/Thiritin/raid0/releases/latest/download/latest.json` on launch and show the update sheet with the release notes. Accepting downloads, installs and restarts the app.

The committed `tauri.conf.json` and `Cargo.toml` keep version `0.1.0`; the build writes the release version into them.

## Saves

Saves live in the webview's local storage, which persists between launches. Exporting a save opens a native save dialog; importing uses the normal file picker.
