# Desktop app

The game ships as an installable desktop app built with Tauri v2. It wraps the same static `dist` build the website uses, so there is no server. All desktop code does nothing in a normal browser.

## Run it locally

You need Node and a Rust toolchain.

- `npm run desktop:dev` starts Vite on port 5173 and opens the app window on it.
- `npm run desktop:build` builds the site and produces an installer for your platform in `src-tauri/target/release/bundle/`.

The update offer never appears in `desktop:dev`.

## Release flow

1. A push to main that adds CHANGELOG.md bullets runs `release.yml`, which creates or edits the day's GitHub release (tag `2026.11.04`).
2. `release.yml` then starts `desktop.yml`. A release published by hand starts it too.
3. `desktop.yml` builds macOS (arm64 and x64), Windows and Linux installers, signs the update bundles, and attaches the installers, signatures and `latest.json` to the release.
4. The app checks `https://github.com/Thiritin/backbone/releases/latest/download/latest.json` on launch. It shows the existing update sheet with the release bullets, and accepting downloads, installs and restarts the app.

The tag has leading zeros, so the build converts it to semver (`2026.11.4`) and writes it into `tauri.conf.json` and `Cargo.toml` at build time. The committed files keep version `0.1.0`.

A second release on the same day keeps the same app version, so installed apps pick it up the next day.

## Secrets

Add these in the repository settings under Secrets and variables, Actions.

| Secret | Purpose |
| --- | --- |
| `TAURI_SIGNING_PRIVATE_KEY` | Signs update bundles. The public half is in `tauri.conf.json`. |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | Password of that key (empty if the key has none). |
| `APPLE_CERTIFICATE` | Base64 of the Developer ID Application certificate (`.p12`). |
| `APPLE_CERTIFICATE_PASSWORD` | Password of the `.p12`. |
| `APPLE_SIGNING_IDENTITY` | Certificate name, for example `Developer ID Application: Name (TEAMID)`. |
| `APPLE_ID` | Apple ID used for notarization. |
| `APPLE_PASSWORD` | App-specific password of that Apple ID. |
| `APPLE_TEAM_ID` | Apple developer team id. |

Windows and Linux installers are unsigned.

If the updater key is lost, installed apps cannot update to builds signed with a new key.

## Saves

Saves live in the webview's local storage, which persists between launches. Exporting a save opens a native save dialog; importing uses the normal file picker.
