# Meitei Words Audio Workbench

A focused, local-first browser workbench for recording one approved vocabulary item at a time. The original character/sign workbench is a separate repository and is not modified by this project.

## Current vocabulary status

The approved 80-word Academy dataset v1.2.0 was referenced in the planning conversation, but its ZIP attachment is not available in this repository or the connected GitHub files. The reference repository's `public/review-items.json` is a separate character/sign expert-review queue and is not imported here.

To avoid inventing or substituting content, `public/words.json` contains an explicit empty import slot. Add the approved records there using this shape:

```json
{
  "schemaVersion": 1,
  "dataset": "meitei-words-approved-vocabulary",
  "contentStatus": "imported",
  "approval": { "reviewerId": "NG01", "status": "approved_by_content_owner" },
  "words": [
    {
      "id": "word.nature.sun",
      "category": "Nature",
      "english": "Sun",
      "roman": "Numit",
      "meiteiMayek": "ꯅꯨꯃꯤꯠ",
      "alternatives": []
    }
  ]
}
```

Keep stable source IDs and supplied alternatives. Each recording is stored separately from vocabulary data and linked by word ID, MIME type, size, duration, timestamps and recording ID.

## Recording workflow

1. Choose a category or **All categories**.
2. Record, stop, and listen to the draft. Re-recording replaces only the local draft for that word.
3. Confirm to mark the recording complete and advance to the next unconfirmed item.
4. Use Previous and Skip to revisit or move onward. Stopped recordings are saved immediately, so navigation and reloads preserve drafts.

Microphone access requires browser permission and HTTPS (or localhost). Audio, progress and active category remain in this browser's IndexedDB/local storage; no audio is uploaded. Clearing browser data removes locally saved work.

## Future ZIP format

A future export can package:
- `manifest.json` (schema/version, export time and counts)
- `words.json` (the source vocabulary and approval metadata)
- `progress.json` (confirmed state and timestamps)
- `recordings-index.json` (recording IDs, word IDs, MIME type, duration and relative asset paths)
- `audio/<word-id>/<recording-id>.<extension>` (original audio bytes)

ZIP export is intentionally not part of this minimal version.

## Run locally

```sh
npm install
npm run dev
```

Run `npm run build` for a production build. GitHub Pages deployment can be enabled through GitHub Actions in repository settings; the configured site path is `/meitei-words-linguistic-workbench/`.
