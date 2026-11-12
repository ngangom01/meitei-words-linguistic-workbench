# Meitei Words Audio Workbench

A deliberately simple, local-first browser workbench for recording the pronunciation of the Meitei vocabulary used by Meitei Mayek Academy.

**New repository:** `ngangom01/meitei-words-linguistic-workbench`  
**Independent from:** `ngangom01/meitei-mayek-linguistic-workbench`

The existing character/sign linguistic workbench is a read-only reference for this project. Its repository is not changed by this project.

## What the reviewer does

1. Open the GitHub Pages app on a device with a microphone.
2. Read the English meaning, Roman form and Meitei Mayek word.
3. Select **Record pronunciation** and speak the word.
4. Select **Stop recording**.
5. Play the captured audio to check it.
6. Select **Confirm & next**. The app saves the confirmation locally and advances to the next unconfirmed word.
7. Use the category dropdown to work through a particular category. Completed words can be revisited from the collapsed list.

## Current dataset

The app loads the 80 vocabulary records from the Academy learning seed v1.2.0 (`public/words.json`). It preserves the source word IDs, English meanings, Roman forms, Meitei Mayek forms, categories and source metadata. It does not alter the linguistic content.

The category dropdown includes all categories present in that dataset, including pronouns and demonstratives. Where the source has no Meitei Mayek form, the app displays “Meitei Mayek form not supplied”; it does not infer one.

## Local data and recordings

- React + TypeScript + Vite, following the existing Workbench stack.
- Dexie / IndexedDB stores words, recording blobs and confirmation progress in the browser on the current device.
- The microphone stream is accessed only after the reviewer selects the recording button.
- Audio is captured in the browser's supported recording format and stored as a binary Blob. It is not uploaded to GitHub or a server.
- Confirmation is separate from recording: an audio take is initially a draft and is marked confirmed only after **Confirm & next**.
- Re-recording creates a new draft. Confirming it makes the new take active and preserves earlier takes locally as superseded history.
- Browser storage may be cleared by the user or device. The future ZIP export is intended to contain the word snapshot, recording index, confirmation metadata and original audio files. Until ZIP export is implemented, do not clear browser data or change devices if recordings must be preserved.

## ZIP export – planned format

ZIP export is intentionally not part of this first minimal version. The data model is already suitable for it. The planned portable archive will contain:

```text
manifest.json
words.json
progress.json
recordings-index.json
audio/<recording-id>.<extension>
```

The recordings index will keep stable word IDs, recording IDs, MIME types, durations, timestamps, status and variant labels. Audio binaries remain separate from JSON. This supports later ZIP backup/export and future mapping to the Academy audio registry without embedding audio as base64 in vocabulary records.

## Run locally on Windows

Requirements: Node.js 20+ and npm.

```powershell
git clone https://github.com/ngangom01/meitei-words-linguistic-workbench.git
cd meitei-words-linguistic-workbench
npm install
npm run dev
```

Open the local URL shown by Vite. Browser microphone permission is required. Local development on `localhost` is treated as a secure context by modern browsers.

Build and preview:

```powershell
npm run build
npm run preview
```

## GitHub Pages deployment

The repository includes a GitHub Actions workflow that builds and deploys the `dist` folder from `main`.

In GitHub, open **Settings → Pages → Build and deployment** and select **GitHub Actions** as the source. The deployment URL will be:

https://ngangom01.github.io/meitei-words-linguistic-workbench/

Microphone recording on the deployed app requires HTTPS and browser permission. Use a current version of Chrome, Edge or Safari.

## Repository separation rule

Do not push changes to `meitei-mayek-linguistic-workbench` from this project. This new repository shares patterns and the open-book/audio visual identity only. Its IndexedDB database name, vocabulary dataset, app title, GitHub Pages base path and deployment workflow are independent.
