# Releasing raid0

Merging to main deploys nothing. The website, the desktop installers and the Discord post all come from one GitHub release. This page is complete enough to cut a release without any other context.

## Bump rules

Agents choose only `patch` or `minor`. An agent never chooses `major`, never passes `--user-approved-major` on its own, and stops to ask the user when the changes seem to call for a major release. A major release happens only when the user explicitly asks for it in the current conversation.

- `patch`: the changes since the last release are only fixes and polish.
- `minor`: the changes add features or content.
- `major`: the user decides.

The next version is computed from the highest `vX.Y.Z` tag. Tags that are not strict `vX.Y.Z` are ignored. The one exception to the major rule is the first stable release: the user chose `1.0.0`, and while the latest release is still `0.x` the explicit version `1.0.0` is accepted without the flag. Every other bump that raises the major number needs `--user-approved-major`.

Versions are plain semver. The tag is `vX.Y.Z`, the release title is `raid0 X.Y.Z`, and the desktop app version is `X.Y.Z`.

## Preconditions

- You are on `main`, the working tree is clean and `main` equals `origin/main`.
- `CHANGELOG.md` has bullets added since the previous release (the pull request rule already adds them).
- `gh` is signed in with write access to `Thiritin/raid0`.

`npm run release` checks all of these and refuses to continue when one fails.

## Cut a release

1. Preview it. This runs every check, including `npm run typecheck` and `npm test`, and prints the version and notes without creating anything.

   ```
   npm run release -- patch --dry
   ```

   Replace `patch` with `minor`. The first stable release is cut with `npm run release -- 1.0.0 --dry` and then `npm run release -- 1.0.0`.

2. Create it.

   ```
   npm run release -- patch
   ```

   The script creates the GitHub release `vX.Y.Z` on the current `origin/main` commit with the notes shown in the preview. Publishing the release starts the Release workflow.

3. Watch the run.

   ```
   gh run watch $(gh run list --workflow release.yml --limit 1 --json databaseId --jq '.[0].databaseId')
   ```

Worked example. The latest release is `v0.5.0`. `npm run release -- 1.0.0` creates `v1.0.0` with the notes added since `v0.5.0`. After that, `npm run release -- patch` creates `v1.0.1` with the notes added since `v1.0.0`, and `npm run release -- minor` would create `v1.1.0`. `npm run release -- major` is refused with a message naming `--user-approved-major`.

To write the notes by hand, put them in a file and add `--notes-file <path>` to the command. The notes are Markdown with the bullets under `## YYYY-MM-DD` day headings, newest day first; the desktop update sheet reads them in that shape.

## What the workflow does

`.github/workflows/release.yml` runs these jobs for the release tag.

1. `gate` checks that the tag is `vX.Y.Z`, runs `npm run typecheck` and `npm test` at the tagged commit, and fills the release notes from the `CHANGELOG.md` bullets added since the previous release when the release body is empty.
2. `desktop` (`desktop.yml`) builds the macOS (Apple silicon only), Windows and Linux installers at the tagged commit, signs the update bundles, and attaches the installers, signatures and `latest.json` to the release. The release notes become the notes in `latest.json`.
3. `pages` (`pages.yml`) builds the site at the tagged commit and deploys it to GitHub Pages.
4. `discord` posts the release notes to the changelog channel after the other jobs pass. It uploads a `discord-posted.txt` file to the release, and a run that finds the file does not post again.

`desktop` and `pages` run in parallel. Installed desktop apps check `https://github.com/Thiritin/raid0/releases/latest/download/latest.json` on launch.

## Verify

After the run is green, confirm each of these.

- `gh release view vX.Y.Z --json assets --jq '.assets[].name'` lists the macOS (`.dmg` and `.app.tar.gz`), Windows (`.exe`), Linux (`.AppImage`, `.deb`, `.rpm`) installers with their `.sig` files, and `latest.json`.
- `curl -sL https://github.com/Thiritin/raid0/releases/latest/download/latest.json | jq -r .version` prints `X.Y.Z`.
- `curl -s https://raid0.dev/version.json | jq '.changelog[0]'` shows the newest day of the release notes.
- The release has a `discord-posted.txt` asset.

Report anything you cannot confirm to the user.

## When a run fails

A failed run publishes nothing further, but the GitHub release itself already exists and is public. The `latest.json` file is attached by the desktop job, so installed apps see the new version only once that job has uploaded it.

| Symptom | Fix |
| --- | --- |
| One job failed for a passing reason (network, runner) | `gh run rerun <run id> --failed` |
| The run cannot be rerun (too old) or the release was edited | `gh workflow run release.yml -f tag=vX.Y.Z` |
| Only the installers need rebuilding | `gh workflow run desktop.yml -f tag=vX.Y.Z` |
| `gate` failed on typecheck or tests | The tagged commit is broken. Delete the release, fix on main, cut a new patch. |
| The release is bad (wrong code, wrong notes that cannot be edited) | `gh release delete vX.Y.Z --cleanup-tag --yes`, fix on main, cut the next patch. Do not reuse the version. |
| `pages` fails with a branch or tag protection error | Do the one-time Pages setup below. |
| Discord post failed | Rerun the failed job. The post is skipped when `discord-posted.txt` exists, so delete that asset only to force a repost. |

Reruns upload installers with the same names over the old ones, and the Discord post is guarded, so a retry is safe.

## One-time setup

The `github-pages` environment only deploys from listed branches. It must also allow release tags:

```
gh api -X POST repos/Thiritin/raid0/environments/github-pages/deployment-branch-policies -f name='v*' -f type=tag
```

## Secrets

Add these in the repository settings under Secrets and variables, Actions.

| Secret | Purpose and source |
| --- | --- |
| `TAURI_SIGNING_PRIVATE_KEY` | Signs update bundles, from `npx tauri signer generate`. The public half is in `src-tauri/tauri.conf.json`. If this key is lost, installed apps cannot update to builds signed with a new key. |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | Password of that key, empty if the key has none. |
| `APPLE_CERTIFICATE` | Base64 of the Developer ID Application certificate (`.p12`) exported from Keychain Access. The certificate expires after five years. |
| `APPLE_CERTIFICATE_PASSWORD` | Password chosen when exporting the `.p12`. |
| `APPLE_SIGNING_IDENTITY` | Certificate name, for example `Developer ID Application: Name (TEAMID)`. |
| `APPLE_ID` | Apple ID used for notarization. |
| `APPLE_PASSWORD` | App-specific password of that Apple ID, created at appleid.apple.com. Apple revokes it when the Apple ID password changes. |
| `APPLE_TEAM_ID` | Apple developer team id. |
| `DISCORD_CHANGELOG_WEBHOOK` | Webhook URL of the changelog channel, created in the channel's integration settings. |

Windows and Linux installers are unsigned.

## Needs a human

Stop and ask the user for any of these.

- A major version bump.
- Rotating or replacing a secret, including an expired Apple password or certificate.
- Deciding to sign the Windows installer.
- A failure the table above does not cover, or a verification step you cannot confirm.
