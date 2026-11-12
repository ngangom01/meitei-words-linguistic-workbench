import { useEffect, useMemo, useRef, useState } from "react";

type Word = { id: string; category: string; english: string; roman: string; meiteiMayek: string; alternatives?: string[] };
type Recording = { wordId: string; blob: Blob; mimeType: string; durationMs: number; updatedAt: string };
type Progress = { wordId: string; confirmedAt: string };
const DB_NAME = "meitei-words-audio-workbench";
const DB_VERSION = 1;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      db.createObjectStore("recordings", { keyPath: "wordId" });
      db.createObjectStore("progress", { keyPath: "wordId" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
async function readAll<T>(storeName: string): Promise<T[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const request = db.transaction(storeName, "readonly").objectStore(storeName).getAll();
    request.onsuccess = () => resolve(request.result as T[]);
    request.onerror = () => reject(request.error);
  });
}
async function saveRecord(record: Recording): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction("recordings", "readwrite");
    tx.objectStore("recordings").put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
async function saveProgress(progress: Progress): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction("progress", "readwrite");
    tx.objectStore("progress").put(progress);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
const formatTime = (ms: number) => {
  const seconds = Math.floor(ms / 1000);
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
};

export default function App() {
  const [words, setWords] = useState<Word[]>([]);
  const [recordings, setRecordings] = useState<Record<string, Recording>>({});
  const [confirmed, setConfirmed] = useState<Record<string, boolean>>({});
  const [category, setCategory] = useState("all");
  const [wordId, setWordId] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [recording, setRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const startedAt = useRef(0);
  const chunks = useRef<BlobPart[]>([]);
  const audioUrl = useRef<string | null>(null);

  useEffect(() => {
    let alive = true;
    Promise.all([
      fetch(`${import.meta.env.BASE_URL}words.json`).then((r) => {
        if (!r.ok) throw new Error("Vocabulary file could not be loaded.");
        return r.json();
      }),
      readAll<Recording>("recordings"),
      readAll<Progress>("progress"),
    ]).then(([data, saved, progress]) => {
      if (!alive) return;
      const list = (data.words ?? []) as Word[];
      setWords(list);
      setRecordings(Object.fromEntries(saved.map((r) => [r.wordId, r])));
      setConfirmed(Object.fromEntries(progress.map((p) => [p.wordId, true])));
      const storedCategory = localStorage.getItem("meitei-audio-category") ?? "all";
      setCategory(storedCategory);
      setWordId(list.find((w) => !progress.some((p) => p.wordId === w.id))?.id ?? list[0]?.id ?? "");
    }).catch((e: unknown) => setError(e instanceof Error ? e.message : "Could not restore local work."));
    return () => { alive = false; };
  }, []);

  const categories = useMemo(() => [...new Set(words.map((w) => w.category))].sort(), [words]);
  const visible = useMemo(() => words.filter((w) => category === "all" || w.category === category), [words, category]);
  const current = visible.find((w) => w.id === wordId) ?? visible.find((w) => !confirmed[w.id]) ?? visible[0];
  const completedCount = visible.filter((w) => confirmed[w.id]).length;
  const currentRecording = current ? recordings[current.id] : undefined;
  useEffect(() => {
    if (!currentRecording) { setDuration(0); return; }
    setDuration(currentRecording.durationMs);
  }, [current?.id, currentRecording?.updatedAt]);
  useEffect(() => () => { if (audioUrl.current) URL.revokeObjectURL(audioUrl.current); }, []);

  function selectCategory(value: string) {
    setCategory(value);
    localStorage.setItem("meitei-audio-category", value);
    const subset = words.filter((w) => value === "all" || w.category === value);
    setWordId(subset.find((w) => !confirmed[w.id])?.id ?? subset[0]?.id ?? "");
    setHistory([]);
    setMessage("");
  }
  function moveTo(id: string) {
    if (current && current.id !== id) setHistory((old) => [...old, current.id]);
    setWordId(id);
    setMessage("");
  }
  function nextUnconfirmed(afterId = current?.id) {
    const start = Math.max(0, visible.findIndex((w) => w.id === afterId));
    return visible.slice(start + 1).find((w) => !confirmed[w.id])?.id
      ?? visible.slice(0, start + 1).find((w) => !confirmed[w.id])?.id;
  }
  async function startRecording() {
    setError("");
    if (!navigator.mediaDevices?.getUserMedia || !("MediaRecorder" in window)) {
      setError("This browser does not support microphone recording. Try a recent version of Chrome, Edge, Firefox or Safari over HTTPS.");
      return;
    }
    try {
      const live = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.current = live;
      const mime = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find((type) => MediaRecorder.isTypeSupported(type));
      const media = new MediaRecorder(live, mime ? { mimeType: mime } : undefined);
      recorder.current = media;
      chunks.current = [];
      media.ondataavailable = (event) => { if (event.data.size) chunks.current.push(event.data); };
      media.onstop = async () => {
        const blob = new Blob(chunks.current, { type: media.mimeType || "audio/webm" });
        const elapsed = Math.max(1, Date.now() - startedAt.current);
        live.getTracks().forEach((track) => track.stop());
        stream.current = null;
        if (!current) return;
        try {
          const saved: Recording = { wordId: current.id, blob, mimeType: blob.type, durationMs: elapsed, updatedAt: new Date().toISOString() };
          await saveRecord(saved);
          setRecordings((old) => ({ ...old, [current.id]: saved }));
          setDuration(elapsed);
          setMessage("Recording saved on this device. Listen before confirming.");
        } catch { setError("The recording could not be saved. Check available browser storage and try again."); }
      };
      startedAt.current = Date.now();
      media.start();
      setRecording(true);
      setMessage("Recording in progress. Select Stop when you are finished.");
      const tick = window.setInterval(() => setDuration(Date.now() - startedAt.current), 250);
      media.addEventListener("stop", () => window.clearInterval(tick), { once: true });
    } catch (e) {
      const err = e as DOMException;
      setError(err.name === "NotAllowedError" ? "Microphone access was blocked. Allow microphone access in your browser's site settings, then try again."
        : err.name === "NotFoundError" ? "No microphone was found. Connect or enable a microphone and try again."
        : "The microphone could not be started. Check that this page is using HTTPS and that no other app is blocking the microphone.");
    }
  }
  function stopRecording() {
    if (recorder.current && recorder.current.state !== "inactive") recorder.current.stop();
    setRecording(false);
    setMessage("Saving your recording…");
  }
  function playRecording() {
    if (!currentRecording) return;
    if (audioUrl.current) URL.revokeObjectURL(audioUrl.current);
    audioUrl.current = URL.createObjectURL(currentRecording.blob);
    const player = new Audio(audioUrl.current);
    void player.play().catch(() => setError("Playback could not start. Check your device's audio output."));
  }
  async function confirmRecording() {
    if (!current || !currentRecording) return;
    try {
      const progress = { wordId: current.id, confirmedAt: new Date().toISOString() };
      await saveProgress(progress);
      setConfirmed((old) => ({ ...old, [current.id]: true }));
      setMessage("Confirmed. Your recording and progress are saved on this device.");
      const next = nextUnconfirmed(current.id);
      if (next) {
        setHistory((old) => [...old, current.id]);
        setWordId(next);
      }
    } catch { setError("Confirmation could not be saved. Please try again."); }
  }
  function goBack() {
    const previous = history[history.length - 1];
    if (!previous) return;
    setHistory((old) => old.slice(0, -1));
    setWordId(previous);
    setMessage("");
  }
  function skip() {
    const next = nextUnconfirmed(current?.id);
    if (next) moveTo(next);
    else setMessage("No other unconfirmed words in this category.");
  }

  return <main className="page">
    <header className="topbar">
      <a className="brand" href="#" aria-label="Meitei Words Audio Workbench home"><span className="brand-mark">ꯃ</span><span>MEITEI WORDS<small>AUDIO WORKBENCH</small></span></a>
      <div className="local-badge"><span aria-hidden="true">●</span> Saved on this device</div>
    </header>
    <section className="intro">
      <p className="eyebrow">PRONUNCIATION COLLECTION</p>
      <h1>One word.<br /><em>One clear recording.</em></h1>
      <p className="lede">Listen, record, review, and confirm each word at your own pace.</p>
    </section>
    {error && <div className="alert" role="alert">{error}</div>}
    {words.length === 0 ? <section className="empty-card" aria-live="polite">
      <div className="empty-icon" aria-hidden="true">ꯑ</div>
      <p className="eyebrow">READY FOR YOUR VOCABULARY</p>
      <h2>The approved word list is ready to be added</h2>
      <p>This workbench is set up for your NG01-approved vocabulary. Its source package was not available in the connected repositories, so no words have been guessed or substituted.</p>
      <p className="hint">When <code>public/words.json</code> is populated with the documented schema, each word will appear here automatically.</p>
    </section> : <>
      <section className="work-card" aria-label="Vocabulary recording">
        <div className="card-head">
          <div><span className="step-label">WORD IN FOCUS</span><span className="word-count">{completedCount} of {visible.length} confirmed</span></div>
          <div className="progress-track" role="progressbar" aria-label="Category recording progress" aria-valuenow={completedCount} aria-valuemin={0} aria-valuemax={visible.length}><span style={{ width: `${visible.length ? completedCount / visible.length * 100 : 0}%` }} /></div>
        </div>
        {current && <div className="word-content" key={current.id}>
          <p className="category-label">{current.category}</p>
          <div className="glyph" lang="mni">{current.meiteiMayek}</div>
          <p className="roman">{current.roman}</p>
          <p className="meaning">{current.english}</p>
          {current.alternatives?.length ? <p className="alternatives">Also: {current.alternatives.join(" · ")}</p> : null}
        </div>}
        <div className="record-panel">
          <div className="record-info"><span className={recording ? "mic live" : "mic"} aria-hidden="true">{recording ? "●" : "◉"}</span><div><strong>{recording ? "Recording…" : currentRecording ? "Recording ready" : "Your recording"}</strong><span>{recording ? "Speak clearly, then stop" : currentRecording ? "Saved locally · listen or record again" : "Your audio stays on this device"}</span></div></div>
          <span className="duration" aria-live="off">{formatTime(duration)}</span>
          {currentRecording && !recording && <button className="play-button" type="button" onClick={playRecording} aria-label="Play saved recording">▶ <span>Play</span></button>}
        </div>
        <div className="actions">
          {recording ? <button className="button primary stop" type="button" onClick={stopRecording}>■ <span>Stop recording</span></button>
            : <button className="button primary" type="button" onClick={() => void startRecording()}>◉ <span>{currentRecording ? "Record again" : "Record pronunciation"}</span></button>}
          <button className="button confirm" type="button" onClick={() => void confirmRecording()} disabled={!currentRecording || recording} aria-label="Confirm recording and go to next word">Confirm &amp; next <span aria-hidden="true">→</span></button>
        </div>
        <p className="feedback" role="status">{message || "A recording is required before you can confirm this word."}</p>
        <div className="nav-row"><button type="button" className="text-button" onClick={goBack} disabled={!history.length}>← Previous</button><button type="button" className="text-button" onClick={skip}>Skip for now →</button></div>
      </section>
      <section className="category-control">
        <label htmlFor="category">WORD CATEGORY</label>
        <select id="category" value={category} onChange={(e) => selectCategory(e.target.value)}>
          <option value="all">All categories</option>{categories.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
      </section>
      {visible.length > 0 && completedCount === visible.length && <p className="complete" role="status">All words in this view are confirmed. You can still revisit them with Previous or the category menu.</p>}
    </>}
    <footer><span>Meitei Mayek · ꯃꯩꯇꯩ ꯃꯌꯦꯛ</span><span>Private by design. Audio is stored locally.</span></footer>
  </main>;
}