import Dexie, { type Table } from 'dexie'

export interface SeedWord {
  id: string
  contentType?: string
  category: string
  englishMeaning: string[]
  romanForm: { text: string; classification?: string }
  meiteiMayek: string | null
  partOfSpeech?: string
  sourceOrder?: number
  notes?: string[]
  [key: string]: unknown
}

export type RecordingStatus = 'draft' | 'confirmed' | 'superseded'

export interface WordRecording {
  id: string
  wordId: string
  blob: Blob
  mimeType: string
  durationMs: number
  createdAt: string
  status: RecordingStatus
  variant: 'normal'
  fileExtension: string
}

export interface WordProgress {
  wordId: string
  status: 'pending' | 'confirmed'
  confirmedRecordingId?: string
  confirmedAt?: string
}

export interface WorkbenchSetting {
  key: string
  value: string
}

class WordsWorkbenchDB extends Dexie {
  words!: Table<SeedWord, string>
  recordings!: Table<WordRecording, string>
  progress!: Table<WordProgress, string>
  settings!: Table<WorkbenchSetting, string>

  constructor() {
    super('meitei-words-audio-workbench')
    this.version(1).stores({
      words: 'id, category',
      recordings: 'id, wordId, status, createdAt',
      progress: '&wordId, status, confirmedAt',
      settings: '&key'
    })
  }
}

export const db = new WordsWorkbenchDB()
