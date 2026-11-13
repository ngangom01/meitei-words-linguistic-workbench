# Meitei Mayek Syllable Audio Workbench

A simple, local-first recording queue dedicated to whole-syllable pronunciation for the Meitei Mayek Academy **Build Syllables** feature.

## Recording queue

The dataset contains **64 recording tasks** sourced directly from the Academy `assets/content/combinations/combinations.json` (schema version 2).

| Pattern | Structure | Tasks | Academy status |
|---|---|---:|---|
| A | Mapung + Cheitap | 32 | 7 published, 25 draft |
| B | Mapung + Lonsum | 27 | 27 draft |
| C | Mapung + Cheitap + Lonsum | 5 | 5 draft |
| **Total** | | **64** | **7 published, 57 draft** |

The explicitly held record `combo.syllable.a.008` (ꯀꯪ *kang*) is excluded because its Nung wording is held for owner confirmation. All other Sprint 5B.7 records are included, including draft candidates.

**Recording is not approval.** Recording a draft combination does not change its Academy status, approvals, publication date or review notes. Each queue item retains the exact original Academy combination record in `sourceRecord`. The audio purpose is `syllable_pronunciation`: the whole assembled syllable, not an individual character's sound or name.

## How to record

1. Open the GitHub Pages app on a device with a microphone.
2. Select Pattern A, B or C from the category dropdown.
3. Read the pattern label, Roman form and Meitei Mayek syllable.
4. Select **Record pronunciation**, then **Stop recording**.
5. Listen to the take.
6. Select **Confirm & next** to save the recording locally and advance.
7. Revisit a completed syllable when a take needs replacement.

## Local storage migration

On first open after dataset version 2.0.0 is deployed, the browser database is migrated to the dedicated 64-item queue:

- The former 80 vocabulary records are removed from the active queue.
- Their browser-stored recordings and progress are removed from this workbench database.
- The seven existing syllable IDs are retained. Any recordings and progress already saved against those IDs are preserved.
- The 57 new Sprint 5B.7 candidates are added with their original Academy status still set to draft.
- The held `kang` draft is not included.
- The previous 80-word recording ZIP remains a separate backup; it is not modified by this migration.

The migration replaces the old vocabulary queue with the 64 syllable tasks. It does not silently approve any Academy record.

## Build Syllables ZIP export

Select **Download Build Syllables ZIP** to export a dedicated package containing only this feature:

```text
Meitei-Academy-Build-Syllables-Audio.zip
├── manifest.json
├── syllables.json
├── academy-combinations.json
├── progress.json
├── recordings-index.json
├── README.txt
└── audio/
    └── <recording-id>.<extension>
```

- `syllables.json`: the workbench recording queue with stable Academy combination IDs and complete source metadata.
- `academy-combinations.json`: original Academy combination records, including unchanged status, approvals, sources and review notes.
- `progress.json`: confirmation records keyed by syllable ID.
- `recordings-index.json`: recording ID, syllable ID, MIME type, duration, timestamp, recording status, audio purpose and archive path.
- `audio/`: original captured audio files.

The ZIP includes draft and published records, but draft recordings remain drafts. Importing audio into the Academy must be a separate reviewed integration step.

## Run locally on Windows

Requirements: Node.js 20+ and npm.

```powershell
git clone https://github.com/ngangom01/meitei-words-linguistic-workbench.git
cd meitei-words-linguistic-workbench
npm install
npm run dev
```

Microphone access is required. For the deployed app, HTTPS and browser microphone permission are required.

## Deploy

GitHub Actions builds and deploys the `dist` folder from `main`.

Application URL:
https://ngangom01.github.io/meitei-words-linguistic-workbench/

## Repository separation

The original `meitei-mayek-linguistic-workbench` is not modified by this project.
