import { createFileRoute } from '@tanstack/react-router'
import {
  Barcode,
  Camera,
  Check,
  ChevronRight,
  Clapperboard,
  Film,
  KeyRound,
  LoaderCircle,
  LockKeyhole,
  LogOut,
  MapPin,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Star,
  Trash2,
  UserRound,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'

export const Route = createFileRoute('/')({ component: Home })

type Role = 'resident' | 'admin'

type Dvd = {
  id: number
  title: string
  year: string | null
  director: string | null
  genre: string | null
  cast: string | null
  plot: string | null
  runtime: string | null
  rating: string | null
  imdbRating: string | null
  imdbId: string | null
  posterUrl: string | null
  shelf: string | null
  barcode: string | null
  available: boolean
  detailsSource: string
}

type MovieMatch = {
  title: string
  year?: string
  imdbId: string
  posterUrl?: string
}

type BarcodeDetectorInstance = {
  detect(source: HTMLVideoElement): Promise<Array<{ rawValue: string }>>
}

type BarcodeDetectorConstructor = new (options: { formats: string[] }) => BarcodeDetectorInstance

declare global {
  interface Window {
    BarcodeDetector?: BarcodeDetectorConstructor
  }
}

async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options?.headers },
  })
  const raw = await response.text()
  let body: (T & { error?: string }) | null = null
  try {
    body = raw ? (JSON.parse(raw) as T & { error?: string }) : null
  } catch {
    // A non-JSON body means the function itself failed; fall through to the status below.
  }
  if (!response.ok) throw new Error(body?.error || `The server returned an error (${response.status}).`)
  return (body || ({} as T)) as T
}

function Home() {
  const [role, setRole] = useState<Role | null>(null)
  const [checkingSession, setCheckingSession] = useState(true)

  useEffect(() => {
    api<{ role: Role | null }>('/api/auth')
      .then((result) => setRole(result.role))
      .finally(() => setCheckingSession(false))
  }, [])

  if (checkingSession) return <LoadingScreen />
  if (!role) return <Login onLogin={setRole} />
  return <Catalogue role={role} onRoleChange={setRole} />
}

function LoadingScreen() {
  return (
    <main className="loading-screen">
      <div className="brand-mark"><Film size={34} /></div>
      <LoaderCircle className="spin" size={24} />
      <p>Opening the film library…</p>
    </main>
  )
}

function Login({ onLogin }: { onLogin: (role: Role) => void }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const result = await api<{ role: Role }>('/api/auth', {
        method: 'POST',
        body: JSON.stringify({ password, role: 'resident' }),
      })
      onLogin(result.role)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to sign in.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="login-page">
      <div className="login-glow glow-one" />
      <div className="login-glow glow-two" />
      <section className="login-copy">
        <div className="eyebrow"><Clapperboard size={18} /> Village Cinema Collection</div>
        <h1>Every film on the shelf, <em>ready to discover.</em></h1>
        <p>Search the village DVD collection by title, actor, director or genre. Add a new favourite in a few taps.</p>
        <div className="film-strip" aria-hidden="true"><span /><span /><span /><span /><span /></div>
      </section>
      <section className="login-card">
        <div className="brand-mark"><Film size={34} /></div>
        <p className="card-kicker">Residents’ entrance</p>
        <h2>Welcome to the cinema</h2>
        <p className="muted">Enter the shared village password to browse the collection.</p>
        <form onSubmit={submit}>
          <label htmlFor="resident-password">Cinema password</label>
          <div className="input-with-icon">
            <KeyRound size={21} />
            <input id="resident-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoFocus required />
          </div>
          {error && <p className="form-error">{error}</p>}
          <button className="primary-button full-width" disabled={busy}>
            {busy ? <LoaderCircle className="spin" size={20} /> : <><span>Enter the collection</span><ChevronRight size={20} /></>}
          </button>
        </form>
        <p className="privacy-note"><LockKeyhole size={15} /> For village residents and guests</p>
      </section>
    </main>
  )
}

function Catalogue({ role, onRoleChange }: { role: Role; onRoleChange: (role: Role | null) => void }) {
  const [dvds, setDvds] = useState<Dvd[]>([])
  const [total, setTotal] = useState(0)
  const [query, setQuery] = useState('')
  const [genre, setGenre] = useState('All genres')
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Dvd | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [showAdmin, setShowAdmin] = useState(false)
  const [notice, setNotice] = useState('')

  async function loadCatalogue() {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (query) params.set('q', query)
      if (genre !== 'All genres') params.set('genre', genre)
      const result = await api<{ dvds: Dvd[]; total: number }>(`/api/catalogue?${params}`)
      setDvds(result.dvds)
      setTotal(result.total)
    } catch (caught) {
      setNotice(caught instanceof Error ? caught.message : 'The catalogue could not be loaded.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const timeout = window.setTimeout(loadCatalogue, 250)
    return () => window.clearTimeout(timeout)
  }, [query, genre])

  const genres = useMemo(() => {
    const values = new Set<string>()
    dvds.forEach((dvd) => dvd.genre?.split(/[,/]/).forEach((value) => values.add(value.trim())))
    return ['All genres', ...Array.from(values).filter(Boolean).sort()]
  }, [dvds])

  async function logout() {
    await api('/api/auth', { method: 'DELETE' })
    onRoleChange(null)
  }

  function added(dvd: Dvd) {
    setShowAdd(false)
    setNotice(`“${dvd.title}” was added to the collection.`)
    loadCatalogue()
  }

  function updated(dvd?: Dvd) {
    setSelected(dvd || null)
    loadCatalogue()
  }

  return (
    <main className="catalogue-page">
      <header className="site-header">
        <button className="wordmark" onClick={() => { setQuery(''); setGenre('All genres') }}>
          <span className="brand-mark small"><Film size={25} /></span>
          <span><strong>Village Cinema</strong><small>DVD COLLECTION</small></span>
        </button>
        <nav>
          <button className="text-button" onClick={() => setShowAdmin(true)}><ShieldCheck size={18} /> {role === 'admin' ? 'Admin portal' : 'Admin'}</button>
          <button className="icon-button" aria-label="Sign out" onClick={logout}><LogOut size={20} /></button>
        </nav>
      </header>

      <section className="hero-search">
        <div className="hero-copy">
          <span className="eyebrow"><span className="status-dot" /> {total} DVDs in the collection</span>
          <h1>What would you like to <em>watch?</em></h1>
          <p>Search by title, genre, director or starring actor.</p>
        </div>
        <div className="search-panel">
          <div className="search-field">
            <Search size={24} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Try “Audrey Hepburn” or “comedy”…" aria-label="Search the DVD catalogue" />
            {query && <button onClick={() => setQuery('')} aria-label="Clear search"><X size={19} /></button>}
          </div>
          <select value={genre} onChange={(event) => setGenre(event.target.value)} aria-label="Filter by genre">
            {genres.map((item) => <option key={item}>{item}</option>)}
          </select>
          <button className="primary-button add-button" onClick={() => setShowAdd(true)}><Plus size={21} /> Add a DVD</button>
        </div>
      </section>

      <section className="collection-section">
        <div className="section-heading">
          <div><p className="section-kicker">Now showing</p><h2>{query ? `Results for “${query}”` : genre !== 'All genres' ? genre : 'The full collection'}</h2></div>
          <p>{loading ? 'Searching…' : `${dvds.length} ${dvds.length === 1 ? 'title' : 'titles'} shown`}</p>
        </div>

        {notice && <button className="notice" onClick={() => setNotice('')}><Check size={18} /> {notice}<X size={16} /></button>}

        {loading ? <CatalogueSkeleton /> : dvds.length ? (
          <div className="movie-grid">
            {dvds.map((dvd, index) => <MovieCard key={dvd.id} dvd={dvd} index={index} onClick={() => setSelected(dvd)} />)}
          </div>
        ) : (
          <div className="empty-state"><Search size={38} /><h3>No films found</h3><p>Try a different title, performer, director or genre.</p><button className="secondary-button" onClick={() => { setQuery(''); setGenre('All genres') }}>Show all DVDs</button></div>
        )}
      </section>

      <footer><span>Village Cinema Collection</span><span>Made for easy browsing, from the comfort of home.</span></footer>

      {selected && <MovieDetails dvd={selected} role={role} onClose={() => setSelected(null)} onUpdated={updated} />}
      {showAdd && <AddDvd onClose={() => setShowAdd(false)} onAdded={added} />}
      {showAdmin && <AdminAccess role={role} onClose={() => setShowAdmin(false)} onAdmin={() => { onRoleChange('admin'); setShowAdmin(false) }} />}
    </main>
  )
}

function MovieCard({ dvd, index, onClick }: { dvd: Dvd; index: number; onClick: () => void }) {
  return (
    <button className="movie-card" style={{ animationDelay: `${Math.min(index, 12) * 45}ms` }} onClick={onClick}>
      <div className="poster-wrap">
        {dvd.posterUrl ? <img src={dvd.posterUrl} alt={`Poster for ${dvd.title}`} /> : <PosterPlaceholder title={dvd.title} />}
        <span className={`availability ${dvd.available ? '' : 'unavailable'}`}>{dvd.available ? 'On shelf' : 'Unavailable'}</span>
      </div>
      <div className="movie-card-copy">
        <p className="movie-meta">{dvd.year || 'DVD'} {dvd.genre ? `• ${dvd.genre.split(',')[0]}` : ''}</p>
        <h3>{dvd.title}</h3>
        <p className="director">{dvd.director && dvd.director !== 'Various' ? `Directed by ${dvd.director}` : dvd.shelf || 'Village collection'}</p>
        <span className="shelf-label"><MapPin size={14} /> {dvd.shelf || 'Ask at the cinema'}<ChevronRight size={17} /></span>
      </div>
    </button>
  )
}

function PosterPlaceholder({ title }: { title: string }) {
  const initials = title.split(' ').filter((word) => word.length > 2).slice(0, 2).map((word) => word[0]).join('') || title.slice(0, 2)
  return <div className="poster-placeholder"><Film size={34} /><strong>{initials}</strong><span>VILLAGE CINEMA</span></div>
}

function CatalogueSkeleton() {
  return <div className="movie-grid">{Array.from({ length: 8 }, (_, index) => <div className="movie-card skeleton-card" key={index}><div className="skeleton poster-skeleton" /><div className="skeleton line short" /><div className="skeleton line" /><div className="skeleton line medium" /></div>)}</div>
}

function MovieDetails({ dvd, role, onClose, onUpdated }: { dvd: Dvd; role: Role; onClose: () => void; onUpdated: (dvd?: Dvd) => void }) {
  const [details, setDetails] = useState(dvd)
  const [imdbInput, setImdbInput] = useState(dvd.imdbId || '')
  const [titleInput, setTitleInput] = useState(dvd.title)
  const [matches, setMatches] = useState<MovieMatch[]>([])
  const [loadingDetails, setLoadingDetails] = useState(!dvd.plot)
  const [busy, setBusy] = useState(false)
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState('')

  useEffect(() => {
    if (dvd.plot) return
    api<Partial<Dvd>>(`/api/movie-lookup?title=${encodeURIComponent(dvd.title)}&details=true`)
      .then((result) => setDetails((current) => ({ ...current, ...result } as Dvd)))
      .catch(() => undefined)
      .finally(() => setLoadingDetails(false))
  }, [dvd.id])

  function applyUpdate(updated: Dvd, message: string) {
    setDetails(updated)
    setTitleInput(updated.title)
    setImdbInput(updated.imdbId || '')
    setMatches([])
    setSaved(message)
    onUpdated(updated)
  }

  async function patch(body: Record<string, unknown>, message: string) {
    setBusy(true); setError(''); setSaved('')
    try {
      const result = await api<{ dvd: Dvd }>(`/api/catalogue?id=${dvd.id}`, { method: 'PATCH', body: JSON.stringify(body) })
      applyUpdate(result.dvd, message)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The change could not be saved.')
    } finally { setBusy(false) }
  }

  function saveTitle() {
    if (!titleInput.trim()) { setError('Enter a title before saving.'); return }
    return patch({ title: titleInput }, 'Title saved.')
  }

  function pullFromImdb() {
    return patch(
      imdbInput.trim() ? { refresh: true, imdbId: imdbInput } : { refresh: true, title: titleInput },
      'Details pulled from IMDb.',
    )
  }

  async function searchImdb() {
    if (!titleInput.trim()) { setError('Enter a title to search for.'); return }
    setSearching(true); setError(''); setSaved(''); setMatches([])
    try {
      const result = await api<{ matches: MovieMatch[] }>(`/api/movie-lookup?title=${encodeURIComponent(titleInput)}`)
      setMatches(result.matches)
      if (!result.matches.length) setError('No IMDb matches were found. Try a shorter title.')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The IMDb search failed.')
    } finally { setSearching(false) }
  }

  async function removeDvd() {
    if (!window.confirm(`Remove “${dvd.title}” from the collection?`)) return
    setBusy(true)
    try {
      await api(`/api/catalogue?id=${dvd.id}`, { method: 'DELETE' })
      onUpdated()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The DVD could not be removed.')
      setBusy(false)
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <article className="details-modal" onMouseDown={(event) => event.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Close"><X /></button>
        <div className="details-poster">
          {details.posterUrl ? <img src={details.posterUrl} alt={`Poster for ${details.title}`} /> : <PosterPlaceholder title={details.title} />}
        </div>
        <div className="details-copy">
          <p className="section-kicker">{details.genre || 'Village cinema DVD'}</p>
          <h2>{details.title}</h2>
          <div className="detail-badges"><span>{details.year || 'Year unknown'}</span>{details.runtime && <span>{details.runtime}</span>}{details.rating && <span>{details.rating}</span>}{details.imdbRating && <span className="rating"><Star size={15} fill="currentColor" /> {details.imdbRating}</span>}</div>
          {loadingDetails ? <div className="detail-loading"><LoaderCircle className="spin" /> Finding movie details…</div> : <p className="plot">{details.plot && details.plot !== 'N/A' ? details.plot : 'A full synopsis is not available for this title yet.'}</p>}
          <dl>
            <div><dt>Director</dt><dd>{details.director || 'Not listed'}</dd></div>
            <div><dt>Starring</dt><dd>{details.cast || 'Not listed'}</dd></div>
            <div><dt>Genre</dt><dd>{details.genre || 'Not listed'}</dd></div>
            <div><dt>Find it</dt><dd><MapPin size={16} /> {details.shelf || 'Ask at the cinema'}</dd></div>
          </dl>
          <div className="details-actions">
            {details.imdbId && <a className="primary-button" href={`https://www.imdb.com/title/${details.imdbId}/`} target="_blank" rel="noreferrer">View on IMDb <ChevronRight size={18} /></a>}
            <button className="secondary-button" onClick={onClose}>Back to catalogue</button>
          </div>

          {role === 'admin' && (
            <section className="admin-panel">
              <p className="admin-panel-heading"><ShieldCheck size={17} /> Admin tools</p>

              <label htmlFor="admin-title">Title</label>
              <div className="admin-field">
                <input
                  id="admin-title"
                  value={titleInput}
                  onChange={(event) => setTitleInput(event.target.value)}
                  onKeyDown={(event) => { if (event.key === 'Enter') searchImdb() }}
                  placeholder="Movie title"
                />
                <button onClick={searchImdb} disabled={busy || searching}>
                  {searching ? <LoaderCircle className="spin" size={16} /> : <Search size={16} />} Search IMDb
                </button>
                <button onClick={saveTitle} disabled={busy || searching || titleInput.trim() === details.title}>
                  <Check size={16} /> Save title
                </button>
              </div>
              <p className="admin-hint">Correct the title, then search IMDb and choose the right film to pull in the year, director, cast, synopsis and poster.</p>

              <label htmlFor="admin-imdb">IMDb ID <span>(optional)</span></label>
              <div className="admin-field">
                <input id="admin-imdb" value={imdbInput} onChange={(event) => setImdbInput(event.target.value)} placeholder="e.g. tt0059742" />
                <button onClick={pullFromImdb} disabled={busy || searching}>
                  <RefreshCw className={busy ? 'spin' : ''} size={16} /> Pull details from IMDb
                </button>
              </div>

              {matches.length > 0 && (
                <div className="match-list admin-matches">
                  <p className="match-heading">Choose the correct film</p>
                  {matches.map((match) => (
                    <button key={match.imdbId} onClick={() => patch({ refresh: true, imdbId: match.imdbId }, `Details updated from “${match.title}”.`)} disabled={busy}>
                      {match.posterUrl ? <img src={match.posterUrl} alt="" /> : <span className="tiny-poster"><Film /></span>}
                      <span><strong>{match.title}</strong><small>{match.year || 'Year unknown'}</small></span>
                      <Check size={20} />
                    </button>
                  ))}
                </div>
              )}

              <button className="admin-remove danger" onClick={removeDvd} disabled={busy}><Trash2 size={16} /> Remove this DVD</button>
            </section>
          )}
          {saved && <p className="form-success"><Check size={16} /> {saved}</p>}
          {error && <p className="form-error">{error}</p>}
        </div>
      </article>
    </div>
  )
}

function AddDvd({ onClose, onAdded }: { onClose: () => void; onAdded: (dvd: Dvd) => void }) {
  const [mode, setMode] = useState<'search' | 'scan'>('search')
  const [title, setTitle] = useState('')
  const [barcode, setBarcode] = useState('')
  const [matches, setMatches] = useState<MovieMatch[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [scanning, setScanning] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  useEffect(() => () => streamRef.current?.getTracks().forEach((track) => track.stop()), [])

  async function search(titleOverride?: string) {
    const value = titleOverride || title
    if (!value.trim()) return
    setBusy(true); setError(''); setMatches([])
    try {
      const result = await api<{ matches: MovieMatch[] }>(`/api/movie-lookup?title=${encodeURIComponent(value)}`)
      setMatches(result.matches)
      if (!result.matches.length) setError('No close matches were found. Try a shorter title.')
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Search failed.') }
    finally { setBusy(false) }
  }

  async function lookupBarcode(value: string) {
    setBusy(true); setError(''); setMatches([])
    try {
      const result = await api<{ title: string; matches: MovieMatch[] }>(`/api/movie-lookup?barcode=${encodeURIComponent(value)}`)
      setTitle(result.title); setMatches(result.matches)
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Barcode lookup failed.') }
    finally { setBusy(false) }
  }

  async function startScanner() {
    setError('')
    if (!window.BarcodeDetector) {
      setError('Live barcode scanning is not supported by this browser. Enter the barcode number below instead.')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      streamRef.current = stream
      setScanning(true)
      window.setTimeout(async () => {
        const video = videoRef.current
        if (!video) return
        video.srcObject = stream
        await video.play()
        const Detector = window.BarcodeDetector
        if (!Detector) return
        const detector = new Detector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e'] })
        const scan = async () => {
          if (!streamRef.current || !videoRef.current) return
          const codes = await detector.detect(videoRef.current)
          if (codes[0]?.rawValue) {
            setBarcode(codes[0].rawValue)
            stream.getTracks().forEach((track) => track.stop())
            streamRef.current = null
            setScanning(false)
            await lookupBarcode(codes[0].rawValue)
            return
          }
          window.setTimeout(scan, 350)
        }
        scan()
      }, 50)
    } catch { setError('Camera access was not available. Enter the barcode number below instead.') }
  }

  async function add(match: MovieMatch) {
    setBusy(true); setError('')
    try {
      const result = await api<{ dvd: Dvd }>('/api/catalogue', { method: 'POST', body: JSON.stringify({ imdbId: match.imdbId, barcode: barcode || undefined }) })
      onAdded(result.dvd)
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'The DVD could not be added.'); setBusy(false) }
  }

  async function addWithoutMatch() {
    if (!title.trim()) return
    setBusy(true); setError('')
    try {
      const result = await api<{ dvd: Dvd }>('/api/catalogue', { method: 'POST', body: JSON.stringify({ title, barcode: barcode || undefined }) })
      onAdded(result.dvd)
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'The DVD could not be added.'); setBusy(false) }
  }

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <article className="add-modal" onMouseDown={(event) => event.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Close"><X /></button>
        <p className="section-kicker">Grow the collection</p><h2>Add a DVD</h2><p className="muted">Scan the case or search for the title. Movie details fill in automatically.</p>
        <div className="tab-list"><button className={mode === 'search' ? 'active' : ''} onClick={() => setMode('search')}><Search size={18} /> Search title</button><button className={mode === 'scan' ? 'active' : ''} onClick={() => setMode('scan')}><Barcode size={19} /> Scan barcode</button></div>
        {mode === 'search' ? <div className="lookup-box"><label htmlFor="movie-title">Movie title</label><div className="lookup-row"><input id="movie-title" value={title} onChange={(event) => setTitle(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') search() }} placeholder="Enter a title…" autoFocus /><button className="primary-button" onClick={() => search()} disabled={busy}>{busy ? <LoaderCircle className="spin" size={19} /> : <Search size={19} />} Find movie</button></div></div> : <div className="scanner-box">{scanning ? <><video ref={videoRef} playsInline muted /><div className="scan-line" /><p><LoaderCircle className="spin" size={18} /> Hold the barcode steady inside the frame</p></> : <><div className="camera-icon"><Camera size={35} /></div><h3>Scan the barcode on the DVD case</h3><p>Your camera is only used while scanning.</p><button className="primary-button" onClick={startScanner}><Camera size={19} /> Open camera</button></>}<div className="manual-barcode"><span>or enter the number</span><div className="lookup-row"><input value={barcode} onChange={(event) => setBarcode(event.target.value)} inputMode="numeric" placeholder="e.g. 5051892012345" /><button className="secondary-button" disabled={busy || !barcode} onClick={() => lookupBarcode(barcode)}>Look up</button></div></div></div>}
        {error && <><p className="form-error">{error}</p>{title.trim() && <button className="secondary-button full-width manual-add" onClick={addWithoutMatch} disabled={busy}><Plus size={18} /> Add “{title}” without movie details</button>}</>}
        {matches.length > 0 && <div className="match-list"><p className="match-heading">Choose the correct edition</p>{matches.map((match) => <button key={match.imdbId} onClick={() => add(match)} disabled={busy}>{match.posterUrl ? <img src={match.posterUrl} alt="" /> : <span className="tiny-poster"><Film /></span>}<span><strong>{match.title}</strong><small>{match.year || 'Year unknown'}</small></span><Plus size={20} /></button>)}</div>}
      </article>
    </div>
  )
}

function AdminAccess({ role, onClose, onAdmin }: { role: Role; onClose: () => void; onAdmin: () => void }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  if (role === 'admin') return <div className="modal-backdrop" onMouseDown={onClose}><article className="admin-modal" onMouseDown={(event) => event.stopPropagation()}><button className="modal-close" onClick={onClose}><X /></button><div className="admin-shield"><ShieldCheck size={34} /></div><p className="section-kicker">Admin portal</p><h2>Admin mode is active</h2><p className="muted">Open any DVD to edit its title, pull fresh details from IMDb, or remove it from the catalogue.</p><button className="primary-button full-width" onClick={onClose}>Return to collection</button></article></div>

  async function submit(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError('')
    try {
      await api('/api/auth', { method: 'POST', body: JSON.stringify({ role: 'admin', password }) })
      onAdmin()
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Admin sign-in failed.'); setBusy(false) }
  }

  return <div className="modal-backdrop" onMouseDown={onClose}><article className="admin-modal" onMouseDown={(event) => event.stopPropagation()}><button className="modal-close" onClick={onClose}><X /></button><div className="admin-shield"><ShieldCheck size={34} /></div><p className="section-kicker">Admin portal</p><h2>Collection management</h2><p className="muted">Enter the separate admin password to edit and remove DVDs.</p><form onSubmit={submit}><label htmlFor="admin-password">Admin password</label><div className="input-with-icon"><LockKeyhole size={20} /><input id="admin-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoFocus required /></div>{error && <p className="form-error">{error}</p>}<button className="primary-button full-width" disabled={busy}>{busy ? <LoaderCircle className="spin" size={20} /> : <><UserRound size={19} /> Enter admin portal</>}</button></form></article></div>
}
