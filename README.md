# Meitei Words Audio Workbench

A simple, local-first browser workbench for recording Meitei vocabulary pronunciations.

## Reviewer workflow

1. Read the English meaning, Roman form and Meitei Mayek word.
2. Select **Record pronunciation** and speak the word.
3. Select **Stop recording**, then play the audio to check it.
4. Select **Confirm & next**. The recording is marked confirmed locally and the next unconfirmed word appears.
5. Use the category dropdown to work through a category. Completed words can be revisited.

## Data

The app is seeded from the 80-word Academy learning dataset v1.2.0 in `public/words.json`. It retains stable vocabulary IDs and the supplied English, Roman and Meitei Mayek forms.

Words, recordings and confirmation state are stored locally in the browser using IndexedDB. Audio is not uploaded to GitHub or any server. Microphone access requires HTTPS (or localhost) and browser permission. Browser data can be cleared, so preserve this device's browser data until ZIP export is added.

## ZIP export (future version)

The data model is prepared for a portable ZIP containing `manifest.json`, `words.json`, `progress.json`, `recordings-index.json` and original files under `audio/`. ZIP export is not included in this first minimal release.

## Run locally (Windows)

```powershell
git clone https://github.com/ngangom01/meitei-words-linguistic-workbench.git
cd meitei-words-linguistic-workbench
npm install
npm run dev
```

Build with `npm run build`.

## GitHub Pages

The GitHub Actions workflow deploys the `main` branch. In repository **Settings → Pages → Build and deployment**, select **GitHub Actions**.

The intended app URL is https://ngangom01.github.io/meitei-words-linguistic-workbench/

## Repository separation

This repository shares implementation patterns and visual identity with `meitei-mayek-linguistic-workbench`, but it is separate. Do not push changes to the original character/sign workbench from this repository.
