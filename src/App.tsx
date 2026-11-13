import { useEffect, useMemo, useRef, useState } from 'react'
import JSZip from 'jszip'
import { db, type SeedWord, type WordProgress, type WordRecording } from './db'

const categoryLabels: Record<string, string> = {
  build_syllables_pattern_a: 'Pattern A · Mapung + Cheitap',
  build_syllables_pattern_b: 'Pattern B · Mapung + Lonsum',
  build_syllables_pattern_c: 'Pattern C · Mapung + Cheitap + Lonsum'
}

function categoryName(key: string) {
  return categoryLabels[key] || key.replace(/_/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase())
}

function extensionFor(mimeType: string) {
  if (mimeType.includes('webm')) return 'webm'
  if (mimeType.includes('mp4')) return 'm4a'
  if (mimeType.includes('ogg')) return 'ogg'
  if (mimeType.includes('wav')) return 'wav'
  return 'bin'
}

export default function App() {
  const [words, setWords] = useState<SeedWord[]>([])
  const [progress, setProgress] = useState<Record<string, WordProgress>>({})
  const [recordings, setRecordings] = useState<WordRecording[]>([])
  const [category, setCategory] = useState('all')
  const [selectedId, setSelectedId] = useState('')
  const [recording, setRecording] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('Your syllable recordings are saved in this browser on this device.')
  const [audioUrl, setAudioUrl] = useState('')
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<BlobPart[]>([])
  const startedAtRef = useRef(0)

  const categories = useMemo(() => [...new Set(words.map(word => word.category))], [words])
  const categoryWords = useMemo(
    () => words.filter(word => category === 'all' || word.category === category),
    [words, category]
  )
  const completedCount = categoryWords.filter(word => progress[word.id]?.status === 'confirmed').length
  const countsByCategory = useMemo(() => {
    const counts: Record<string, { reviewed: number; total: number }> = {}
    for (const word of words) {
      counts[word.category] ??= { reviewed: 0, total: 0 }
      counts[word.category].total += 1
      if (progress[word.id]?.status === 'confirmed') counts[word.category].reviewed += 1
    }
    return counts
  }, [words, progress])
  const activeWord = words.find(word => word.id === selectedId) || null
  const activeRecordings = recordings.filter(item => item.wordId === selectedId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const draftRecording = activeRecordings.find(item => item.status === 'draft') || null
  const confirmedRecording = activeRecordings.find(item => item.id === progress[selectedId]?.confirmedRecordingId) || null
  const previewRecording = draftRecording || confirmedRecording
  const position = activeWord ? categoryWords.findIndex(word => word.id === activeWord.id) + 1 : categoryWords.length
  const completedWords = categoryWords.filter(word => progress[word.id]?.status === 'confirmed')

  async function refreshWorkspace() {
    const [wordRows, progressRows, recordingRows] = await Promise.all([
      db.words.toArray(), db.progress.toArray(), db.recordings.toArray()
    ])
    const ordered = wordRows.sort((a, b) => (a.sourceOrder ?? 0) - (b.sourceOrder ?? 0))
    setWords(ordered)
    setProgress(Object.fromEntries(progressRows.map(row => [row.wordId, row])))
    setRecordings(recordingRows)
    setSelectedId(current => current && ordered.some(word => word.id === current)
      ? current
      : ordered.find(word => !progressRows.some(row => row.wordId === word.id && row.status === 'confirmed'))?.id || '')
  }

  useEffect(() => {
    let cancelled = false
    async function initialise() {
      try {
        try {
          if (navigator.storage?.persist) await navigator.storage.persist()
        } catch {
          // Browser storage persistence is best-effort.
        }
        const seeded = await db.settings.get('build-syllables-seed-2.0.0')
        if (!seeded || await db.words.count() === 0) {
          const response = await fetch(import.meta.env.BASE_URL + 'words.json')
          if (!response.ok) throw new Error(`Could not load the Build Syllables recording set (HTTP ${response.status}).`)
          const payload = await response.json() as { metadata?: { datasetVersion?: string; datasetType?: string }, items?: SeedWord[] }
          if (payload.metadata?.datasetVersion !== '2.0.0' || payload.metadata?.datasetType !== 'build_syllables_audio_recording_queue' || !Array.isArray(payload.items) || payload.items.length !== 64) {
            throw new Error('The Build Syllables recording set is not the expected version (2.0.0).')
          }
          const ids = new Set<string>()
          for (const word of payload.items) {
            if (!word.id || ids.has(word.id) || !word.category || !word.romanForm?.text || !Array.isArray(word.englishMeaning)) {
              throw new Error('The syllable set contains an invalid or duplicate record.')
            }
            ids.add(word.id)
          }
          await db.transaction('rw', db.words, db.recordings, db.progress, db.settings, async () => {
            const incomingIds = new Set(payload.items!.map(word => word.id))
            const existingWords = await db.words.toArray()
            const obsoleteIds = existingWords.filter(word => !incomingIds.has(word.id)).map(word => word.id)

            // Keep only Build Syllables items. Remove old vocabulary records, their recordings and progress.
            // Matching syllable IDs and their recordings/progress are deliberately retained.
            const existingRecordings = await db.recordings.toArray()
            const obsoleteRecordingIds = existingRecordings
              .filter(recording => !incomingIds.has(recording.wordId))
              .map(recording => recording.id)
            const existingProgress = await db.progress.toArray()
            const obsoleteProgressIds = existingProgress
              .filter(progress => !incomingIds.has(progress.wordId))
              .map(progress => progress.wordId)

            await db.words.bulkDelete(obsoleteIds)
            await db.recordings.bulkDelete(obsoleteRecordingIds)
            await db.progress.bulkDelete(obsoleteProgressIds)

            for (const [index, word] of payload.items!.entries()) {
              const existing = await db.words.get(word.id)
              await db.words.put({ ...existing, ...word, sourceOrder: index })
            }

            const oldSeedKeys = (await db.settings.toArray())
              .filter(setting => setting.key.startsWith('words-seed-'))
              .map(setting => setting.key)
            await db.settings.bulkDelete(oldSeedKeys)
            await db.settings.put({ key: 'build-syllables-seed-2.0.0', value: String(payload.items!.length) })
          })
        }
        if (!cancelled) await refreshWorkspace()
      } catch (error) {
        if (!cancelled) setMessage(error instanceof Error ? error.message : 'The Build Syllables data could not be loaded.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void initialise()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!previewRecording) {
      setAudioUrl('')
      return
    }
    const url = URL.createObjectURL(previewRecording.blob)
    setAudioUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [previewRecording?.id])

  useEffect(() => () => {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') recorderRef.current.stop()
    streamRef.current?.getTracks().forEach(track => track.stop())
  }, [])

  async function startRecording() {
    if (!activeWord || busy) return
    setDeleteTargetId(null)
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      setMessage('Recording needs a secure HTTPS connection and a current browser with microphone support.')
      return
    }
    setBusy(true)
    setMessage('Allow microphone access when your browser asks.')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })
      streamRef.current = stream
      const formats = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus']
      const mimeType = formats.find(type => MediaRecorder.isTypeSupported(type))
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      const word = activeWord
      chunksRef.current = []
      recorder.ondataavailable = event => { if (event.data.size) chunksRef.current.push(event.data) }
      recorder.onerror = () => setMessage('The browser reported a recording error. Please try again.')
      recorder.onstop = async () => {
        const durationMs = Date.now() - startedAtRef.current
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || mimeType || 'application/octet-stream' })
        stream.getTracks().forEach(track => track.stop())
        streamRef.current = null
        recorderRef.current = null
        setRecording(false)
        setBusy(true)
        try {
          if (blob.size < 500 || durationMs < 400) {
            setMessage('The recording was too short or empty. Please record the syllable again.')
          } else {
            const previous = await db.recordings.where('wordId').equals(word.id).toArray()
            await db.recordings.bulkDelete(previous.filter(item => item.status === 'draft').map(item => item.id))
            await db.recordings.add({
              id: crypto.randomUUID(), wordId: word.id, blob, mimeType: blob.type, durationMs,
              createdAt: new Date().toISOString(), status: 'draft', variant: 'normal',
              fileExtension: extensionFor(blob.type)
            })
            setRecordings(await db.recordings.toArray())
            setMessage('Recording saved on this device. Play it back, then confirm to continue.')
          }
        } catch {
          setMessage('The recording could not be saved. Check browser storage and try again.')
        } finally {
          setBusy(false)
        }
      }
      recorderRef.current = recorder
      startedAtRef.current = Date.now()
      recorder.start()
      setRecording(true)
      setMessage('Recording… select Stop recording when you have finished speaking.')
    } catch (error) {
      streamRef.current?.getTracks().forEach(track => track.stop())
      streamRef.current = null
      const denied = error instanceof DOMException && error.name === 'NotAllowedError'
      setMessage(denied
        ? 'Microphone permission was denied. Allow it in the browser site settings and try again.'
        : 'Could not access the microphone. Check the microphone connection and browser permissions.')
    } finally {
      setBusy(false)
    }
  }

  function stopRecording() {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') recorderRef.current.stop()
  }

  async function deleteRecording(recordingId: string) {
    if (busy || recording) return
    const target = recordings.find(item => item.id === recordingId)
    if (!target) return
    setBusy(true)
    setMessage('Deleting the selected recording…')
    let removedConfirmedRecording = false
    try {
      await db.transaction('rw', db.recordings, db.progress, async () => {
        const currentProgress = await db.progress.get(target.wordId)
        await db.recordings.delete(recordingId)
        if (currentProgress?.confirmedRecordingId === recordingId) {
          await db.progress.put({ wordId: target.wordId, status: 'pending' })
          removedConfirmedRecording = true
        }
      })
      setDeleteTargetId(null)
      await refreshWorkspace()
      setMessage(removedConfirmedRecording
        ? 'Recording deleted from this device and future ZIP backups. This syllable is marked unreviewed again.'
        : 'Draft deleted from this device and future ZIP backups. Your confirmed recording, if any, is unchanged.')
    } catch {
      setMessage('The recording could not be deleted. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  async function confirmAndNext() {
    if (!activeWord || !draftRecording || busy || recording) return
    setDeleteTargetId(null)
    setBusy(true)
    try {
      const confirmedAt = new Date().toISOString()
      await db.transaction('rw', db.recordings, db.progress, async () => {
        const previous = await db.recordings.where('wordId').equals(activeWord.id).toArray()
        for (const item of previous) {
          if (item.status === 'confirmed') await db.recordings.update(item.id, { status: 'superseded' })
        }
        await db.recordings.update(draftRecording.id, { status: 'confirmed' })
        await db.progress.put({ wordId: activeWord.id, status: 'confirmed', confirmedRecordingId: draftRecording.id, confirmedAt })
      })
      await refreshWorkspace()
      const index = categoryWords.findIndex(word => word.id === activeWord.id)
      const later = [...categoryWords.slice(index + 1), ...categoryWords.slice(0, index)]
      const next = later.find(word => progress[word.id]?.status !== 'confirmed')
      setSelectedId(next?.id || '')
      setMessage(next
        ? `Confirmed syllable “${activeWord.romanForm.text}”. Moving to the next syllable.`
        : `Confirmed “${activeWord.romanForm.text}”. All syllables in this category are complete.`)
    } catch {
      setMessage('Confirmation could not be saved. The recording is still available; please try again.')
    } finally {
      setBusy(false)
    }
  }

  function changeCategory(value: string) {
    setDeleteTargetId(null)
    setCategory(value)
    const matching = words.filter(word => value === 'all' || word.category === value)
    setSelectedId(matching.find(word => progress[word.id]?.status !== 'confirmed')?.id || '')
  }

  async function downloadZip() {
    if (busy || loading) return
    setBusy(true)
    setMessage('Preparing your Build Syllables ZIP package…')
    try {
      const [syllableRows, progressRows, recordingRows] = await Promise.all([
        db.words.toArray(), db.progress.toArray(), db.recordings.toArray()
      ])
      const orderedSyllables = syllableRows.sort((a, b) => (a.sourceOrder ?? 0) - (b.sourceOrder ?? 0))
      const exportedAt = new Date().toISOString()
      const zip = new JSZip()

      const patternCounts = orderedSyllables.reduce((counts, syllable) => {
        const pattern = String(syllable.patternId ?? 'unknown')
        counts[pattern] = (counts[pattern] || 0) + 1
        return counts
      }, {} as Record<string, number>)
      const academyStatusCounts = orderedSyllables.reduce((counts, syllable) => {
        const status = String(syllable.academyStatus ?? 'unknown')
        counts[status] = (counts[status] || 0) + 1
        return counts
      }, {} as Record<string, number>)
      const academyRecords = orderedSyllables
        .map(syllable => syllable.sourceRecord)
        .filter((record): record is Record<string, unknown> => record !== null && typeof record === 'object')

      if (academyRecords.length !== orderedSyllables.length) {
        throw new Error('One or more syllables are missing their original Academy combination record.')
      }

      const completedSyllableCount = progressRows.filter(row => row.status === 'confirmed').length
      const activeRecordingCount = recordingRows.filter(row => row.status === 'confirmed').length

      zip.file('manifest.json', JSON.stringify({
        schemaVersion: 1,
        packageType: 'meitei-mayek-academy-build-syllables-audio-submission',
        exportedAt,
        datasetId: 'meitei-mayek-academy-build-syllables',
        datasetVersion: '2.0.0',
        datasetType: 'build_syllables_audio_recording_queue',
        sourceFile: 'assets/content/combinations/combinations.json',
        sourceSchemaVersion: 2,
        audioPurpose: 'syllable_pronunciation',
        syllableCount: orderedSyllables.length,
        confirmedSyllableCount: completedSyllableCount,
        recordingCount: recordingRows.length,
        confirmedRecordingCount: activeRecordingCount,
        patternCounts,
        academyStatusCounts,
        contents: [
          'syllables.json',
          'academy-combinations.json',
          'progress.json',
          'recordings-index.json',
          'audio/'
        ],
        publicationNote: 'Recording a draft combination does not approve or publish it. Original Academy status and review metadata are retained unchanged.'
      }, null, 2))

      zip.file('syllables.json', JSON.stringify({
        metadata: {
          datasetId: 'meitei-mayek-academy-build-syllables',
          datasetVersion: '2.0.0',
          datasetType: 'build_syllables_audio_recording_queue',
          sourceFile: 'assets/content/combinations/combinations.json',
          sourceSchemaVersion: 2,
          audioPurpose: 'syllable_pronunciation',
          exportedAt
        },
        items: orderedSyllables
      }, null, 2))

      zip.file('academy-combinations.json', JSON.stringify({
        schemaVersion: 2,
        kind: 'combination',
        records: academyRecords
      }, null, 2))

      zip.file('progress.json', JSON.stringify(progressRows.map(row => ({
        syllableId: row.wordId,
        status: row.status,
        confirmedRecordingId: row.confirmedRecordingId ?? null,
        confirmedAt: row.confirmedAt ?? null
      })), null, 2))

      const recordingIndex = recordingRows.map(recordingRow => {
        const fileName = `${recordingRow.id}.${recordingRow.fileExtension || extensionFor(recordingRow.mimeType)}`
        const path = `audio/${fileName}`
        zip.file(path, recordingRow.blob, { binary: true, compression: 'STORE' })
        const { blob, wordId, ...metadata } = recordingRow
        return {
          ...metadata,
          syllableId: wordId,
          audioPurpose: 'syllable_pronunciation',
          sizeBytes: blob.size,
          path
        }
      })
      zip.file('recordings-index.json', JSON.stringify(recordingIndex, null, 2))

      zip.file('README.txt', [
        'Meitei Mayek Academy — Build Syllables Audio Package',
        '',
        'This archive contains whole-syllable pronunciation recordings for the Academy Build Syllables feature.',
        'It is not a vocabulary-word audio export.',
        '',
        'syllables.json: workbench records with stable Academy combination IDs and source metadata.',
        'academy-combinations.json: original Academy combination records, including publication and review status.',
        'progress.json: recording confirmation status keyed by syllable ID.',
        'recordings-index.json: audio file metadata, purpose, status and syllable ID mapping.',
        'audio/: original recorded audio files.',
        '',
        'Audio purpose: syllable_pronunciation (whole assembled syllable).',
        'Recording a draft candidate does not approve or publish it in the Academy.',
        'Draft/published status and Academy review metadata are carried through unchanged.',
        ''
      ].join('\n'))

      const archive = await zip.generateAsync({
        type: 'blob',
        mimeType: 'application/zip',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 }
      })
      const url = URL.createObjectURL(archive)
      const link = document.createElement('a')
      link.href = url
      link.download = `meitei-build-syllables-audio-${exportedAt.replace(/[:.]/g, '-')}.zip`
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 10_000)
      setMessage(`Build Syllables ZIP downloaded: ${orderedSyllables.length} syllables and ${recordingRows.length} audio takes.`)
    } catch (error) {
      setMessage(error instanceof Error
        ? error.message
        : 'The Build Syllables ZIP could not be prepared. Check available browser storage and try again.')
    } finally {
      setBusy(false)
    }
  }

  const percent = categoryWords.length ? Math.round((completedCount / categoryWords.length) * 100) : 0
  const complete = categoryWords.length > 0 && completedCount === categoryWords.length

  if (loading) return <main className="shell"><Header /><div className="loading-panel">Loading syllable recording set…</div></main>

  return <main className="shell">
    <Header />
    <div className="status-line" role="status" aria-live="polite">{message}</div>
    <section className="progress-area" aria-label="Recording progress">
      <div className="progress-heading">
        <span>{category === 'all' ? 'All syllables' : categoryName(category)}</span>
        <strong>{completedCount} / {categoryWords.length} confirmed</strong>
      </div>
      <div className="progress-track"><span style={{ width: `${percent}%` }} /></div>
    </section>

    {activeWord ? <section className="word-card" aria-live="polite">
      <div className="word-topline">
        <span className="eyebrow">SYLLABLE {String(position).padStart(2, '0')} OF {String(categoryWords.length).padStart(2, '0')}</span>
        <span className={`state-pill ${progress[activeWord.id]?.status === 'confirmed' ? 'is-done' : ''}`}>
          {progress[activeWord.id]?.status === 'confirmed' ? 'Audio confirmed' : 'Awaiting recording'}
        </span>
      </div>
      <div className="meaning-label">SYLLABLE PATTERN</div>
      <h2 className="meaning">{activeWord.englishMeaning.join(' / ') || 'Meaning not supplied'}</h2>
      <div className="roman-line">{activeWord.romanForm.text}</div>
      <div className="script-line" lang="mni">{activeWord.meiteiMayek || 'Meitei Mayek form not supplied'}</div>
      <div className="record-controls">
        <button className={`record-button ${recording ? 'recording' : ''}`} onClick={() => recording ? stopRecording() : void startRecording()} disabled={busy}>
          <span className="record-symbol" />{recording ? 'Stop recording' : busy ? 'Please wait…' : 'Record pronunciation'}
        </button>
        <button className="confirm-button" onClick={() => void confirmAndNext()} disabled={!draftRecording || recording || busy}>
          Confirm & next <span aria-hidden="true">→</span>
        </button>
      </div>
      {previewRecording && audioUrl ? <div className="playback-area">
        <div className="playback-label">
          <strong>{draftRecording ? 'Listen before confirming' : 'Confirmed recording'}</strong>
          <span>{(previewRecording.durationMs / 1000).toFixed(1)} sec</span>
          <button className="delete-recording-button" type="button" onClick={() => setDeleteTargetId(previewRecording.id)} disabled={busy || recording}>
            Delete take
          </button>
        </div>
        <audio controls preload="metadata" src={audioUrl}>Audio playback is not supported by this browser.</audio>
        {deleteTargetId === previewRecording.id && <div className="delete-confirmation" role="group" aria-label="Confirm recording deletion">
          <p>Delete this take from this device? It will be left out of future ZIP backups.</p>
          <div className="delete-confirmation-actions">
            <button className="keep-recording-button" type="button" onClick={() => setDeleteTargetId(null)} disabled={busy}>Keep take</button>
            <button className="confirm-delete-button" type="button" onClick={() => void deleteRecording(previewRecording.id)} disabled={busy}>
              {busy ? 'Deleting…' : 'Delete take'}
            </button>
          </div>
        </div>}
      </div> : <p className="recording-help">Record the whole syllable clearly. Listen to the recording before confirming it.</p>}
    </section> : <section className="word-card complete-card">
      <div className="complete-symbol">✓</div>
      <h2>{complete ? 'Pattern completed' : 'No syllable selected'}</h2>
      <p>{complete ? `All ${categoryWords.length} syllables in this pattern have confirmed recordings.` : 'Choose a syllable pattern below.'}</p>
    </section>}

    <section className="filter-area">
      <label htmlFor="category-select">Syllable pattern</label>
      <div className="category-tools">
        <select id="category-select" value={category} disabled={recording || busy} onChange={event => changeCategory(event.target.value)}>
          <option value="all">All syllables — {completedCount}/{words.length} confirmed</option>
          {categories.map(value => {
            const counts = countsByCategory[value] || { reviewed: 0, total: 0 }
            return <option key={value} value={value}>{categoryName(value)} — {counts.reviewed}/{counts.total} reviewed</option>
          })}
        </select>
        <button className="export-button" type="button" onClick={() => void downloadZip()} disabled={loading || busy || !words.length}>
          {busy ? 'Preparing ZIP…' : 'Download Build Syllables ZIP'}
        </button>
      </div>
      <p className="category-summary" role="status" aria-live="polite">
        Recorded in {category === 'all' ? 'all patterns' : categoryName(category)}: <strong>{completedCount} / {categoryWords.length}</strong> items
      </p>
    </section>

    {completedWords.length > 0 && <details className="completed-area">
      <summary>Revisit a completed syllable ({completedWords.length})</summary>
      <select aria-label="Choose a completed syllable to revisit" value="" disabled={recording || busy} onChange={event => { setDeleteTargetId(null); setSelectedId(event.target.value) }}>
        <option value="">Select a syllable…</option>
        {completedWords.map(word => <option key={word.id} value={word.id}>{word.englishMeaning.join(' / ')} — {word.romanForm.text}</option>)}
      </select>
    </details>}

    <footer><span>Saved on this device only</span><span>•</span><span>Microphone requires HTTPS</span><span>•</span><span>Build Syllables ZIP export available below</span></footer>
  </main>
}

function Header() {
  return <header className="topbar">
    <img className="brand-mark" src={import.meta.env.BASE_URL + 'favicon.svg'} alt="" />
    <div className="brand-copy">
      <div className="eyebrow">MEITEI MAYEK ACADEMY · BUILD SYLLABLES</div>
      <h1>Meitei Mayek Syllable Audio Workbench</h1>
      <p>Record the whole syllable, check it, and continue.</p>
    </div>
    <div className="local-badge"><span /> Local-first</div>
  </header>
}
