export type MovieDetails = {
  title: string
  year?: string
  director?: string
  genre?: string
  cast?: string
  plot?: string
  runtime?: string
  rating?: string
  imdbRating?: string
  imdbId?: string
  posterUrl?: string
  detailsSource: string
}

type OmdbResult = Record<string, string> & { Response: 'True' | 'False'; Error?: string }

function normalize(result: OmdbResult): MovieDetails {
  return {
    title: result.Title,
    year: result.Year,
    director: result.Director,
    genre: result.Genre,
    cast: result.Actors,
    plot: result.Plot,
    runtime: result.Runtime,
    rating: result.Rated,
    imdbRating: result.imdbRating,
    imdbId: result.imdbID,
    posterUrl: result.Poster && result.Poster !== 'N/A' ? result.Poster : undefined,
    detailsSource: 'OMDb / IMDb',
  }
}

// Errors that are safe and useful to show a resident or admin.
export class LookupError extends Error {}

// A title the movie service simply does not know about, as opposed to the
// service being unreachable or misconfigured.
export class MovieNotFoundError extends LookupError {}

function comparable(title: string) {
  return title
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/^(the|a|an)\s+/, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

// Wording a shelf label may carry that a film's real title does not.
const EDITION_WORDS = new Set([
  'dvd', 'dvds', 'disc', 'disk', 'bluray', 'blu', 'ray', 'widescreen', 'fullscreen', 'special', 'limited',
  'collector', 'collectors', 'edition', 'anniversary', 'remastered', 'restored', 'uncut', 'unrated',
  'extended', 'director', 'directors', 'cut', 'version', 'the', 'a', 'an', 'movie', 'film', 'feature',
  'complete', 'collection', 'box', 'set', 'volume', 'vol', 'part', 'series', 'season',
])

function onlyEditionWords(text: string) {
  const words = text.split(' ').filter(Boolean)
  return words.length > 0 && words.every((word) => EDITION_WORDS.has(word) || /^\d+$/.test(word))
}

// Guards the automatic poster backfill: OMDb answers a loose title query with
// its closest guess, and a confidently wrong cover is worse than none at all.
// A result is trusted when it is the same title, when it merely adds a subtitle
// to the catalogue title, or when the catalogue title only adds edition wording.
export function titlesMatch(found: string, catalogued: string) {
  const result = comparable(found)
  const shelf = comparable(catalogued)
  if (!result || !shelf) return false
  if (result === shelf) return true
  if (result.startsWith(`${shelf} `)) return shelf.length >= result.length / 2
  if (shelf.startsWith(`${result} `)) return onlyEditionWords(shelf.slice(result.length + 1))
  return false
}

// OMDb emails the key inside a sample request URL, so the configured value is
// often the whole URL rather than the bare key. Accept either form.
function resolveApiKey() {
  const configured = Netlify.env.get('OMDB_API_KEY')?.trim()
  if (!configured) return ''
  const fromUrl = /[?&]apikey=([^&\s]+)/i.exec(configured)?.[1]
  return (fromUrl || configured).trim()
}

async function omdb(params: URLSearchParams) {
  const apiKey = resolveApiKey()
  if (!apiKey) throw new LookupError('Movie lookup is not configured yet. Add an OMDb API key to OMDB_API_KEY.')
  params.set('apikey', apiKey)
  const response = await fetch(`https://www.omdbapi.com/?${params}`)
  if (!response.ok) throw new LookupError('The movie service could not be reached.')
  const result = (await response.json()) as OmdbResult
  if (result.Response === 'False' && /api key/i.test(result.Error || '')) {
    throw new LookupError('The movie service rejected the OMDb API key. Check the OMDB_API_KEY value.')
  }
  return result
}

export async function searchMovies(title: string) {
  const result = await omdb(new URLSearchParams({ s: title }))
  if (result.Response === 'False') return []
  return ((result as unknown as { Search: Array<Record<string, string>> }).Search || []).map((movie) => ({
    title: movie.Title,
    year: movie.Year,
    imdbId: movie.imdbID,
    posterUrl: movie.Poster !== 'N/A' ? movie.Poster : undefined,
  }))
}

export async function getMovie(imdbId?: string, title?: string) {
  const params = new URLSearchParams({ plot: 'full' })
  if (imdbId) params.set('i', imdbId)
  else if (title) params.set('t', title)
  else throw new LookupError('A title or IMDb ID is required.')
  const result = await omdb(params)
  if (result.Response === 'False') throw new MovieNotFoundError(result.Error || 'No matching movie was found.')
  return normalize(result)
}

export async function titleFromBarcode(barcode: string) {
  const response = await fetch(`https://api.upcitemdb.com/prod/trial/lookup?upc=${encodeURIComponent(barcode)}`)
  if (!response.ok) throw new LookupError('The barcode service could not be reached.')
  const result = (await response.json()) as { items?: Array<{ title?: string }> }
  const title = result.items?.[0]?.title
  if (!title) throw new LookupError('No DVD title was found for that barcode.')
  return title.replace(/\s*(DVD|Blu-ray|Widescreen|Special Edition).*$/i, '').trim()
}
