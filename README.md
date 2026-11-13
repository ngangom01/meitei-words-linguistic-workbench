# Meitei Words Audio Workbench

A simple, local-first recording queue dedicated to whole-syllable pronunciation for the Meitei Mayek Academy Build Syllables feature.

## Recording queue

The current dataset contains **64 syllable recording tasks** sourced from the Academy's combinations.json:

| Pattern | Structure | Tasks | Academy status |
|---|---|---:|---|
| A | Mapung + Cheitap | 32 | 7 published, 25 draft |
| B | Mapung + Lonsum | 27 | 27 draft |
| C | Mapung + Cheitap + Lonsum | 5 | 5 draft |
| **Total** | | **64** | **7 published, 57 draft** |

The explicitly held draft combo.syllable.a.008 (ꯀꯪ kang) is excluded. All other Sprint 5B.7 combination records are included for recording, including draft candidates.

**Recording is not approval.** Recording a draft combination does not change its Academy status, approvals, publication date or review notes. The original Academy record is preserved in each item's sourceRecord field. The audio purpose for every task is syllable_pronunciation (the whole assembled syllable), not the sound or name of an individual character.

## How to use

1. Open the GitHub Pages app on a device with a microphone.
2. Select a category: Build Syllables Pattern A, B or C.
3. Read the English pattern description, Roman form and Meitei Mayek syllable.
4. Select Record pronunciation, then Stop recording.
5. Listen to the recording.
6. Select Confirm & next to save it locally and advance.
7. Use the completed-word list to revisit and replace a take if needed.

## Local storage migration

On first open after dataset version 2.0.0 is deployed, the browser database is migrated to this dedicated 64-item queue:

- The former 80 vocabulary records are removed from the active queue.
- Their browser-stored recordings and progress are removed from this workbench database.
- The seven existing syllable IDs are retained. Any recordings/progress already saved against those IDs are preserved.
- The 57 new Sprint 5B.7 candidates are added with their source status still set to draft.
- No application UI or recording controls are changed by this content refresh.

The previous 80-word recording export is separate and remains available as a backup. Do not delete that archive unless you no longer need it.

## Data and future ZIP export

- public/words.json is the only active recording-task dataset.
- Dexie / IndexedDB stores recording blobs and progress locally on this browser/device.
- Every task uses the stable Academy combination ID (for example, combo.syllable.a.001).
- The future ZIP export is intended to contain only this Build Syllables collection: source combination records, recording index, confirmation metadata and audio files.
- ZIP export is not implemented in this release.

Planned archive structure:

    Meitei-Academy-Build-Syllables-Audio.zip
      manifest.json
      combinations.json
      recordings-index.json
      audio/
        <combination-id>.<extension>

## Run locally on Windows

Requirements: Node.js 20+ and npm.

    git clone https://github.com/ngangom01/meitei-words-linguistic-workbench.git
    cd meitei-words-linguistic-workbench
    npm install
    npm run dev

Open the local URL shown by Vite. Microphone access is required. For the deployed app, HTTPS and browser microphone permission are required.

## Deploy

GitHub Actions builds and deploys the dist folder from main.

Application URL:
https://ngangom01.github.io/meitei-words-linguistic-workbench/

## Repository separation

The original meitei-mayek-linguistic-workbench is not modified by this project.
