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

async function omdb(params: URLSearchParams) {
  const apiKey = Netlify.env.get('OMDB_API_KEY')
  if (!apiKey) throw new Error('Movie lookup is not configured yet.')
  params.set('apikey', apiKey)
  const response = await fetch(`https://www.omdbapi.com/?${params}`)
  if (!response.ok) throw new Error('The movie service could not be reached.')
  return (await response.json()) as OmdbResult
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
  else throw new Error('A title or IMDb ID is required.')
  const result = await omdb(params)
  if (result.Response === 'False') throw new Error(result.Error || 'No matching movie was found.')
  return normalize(result)
}

export async function titleFromBarcode(barcode: string) {
  const response = await fetch(`https://api.upcitemdb.com/prod/trial/lookup?upc=${encodeURIComponent(barcode)}`)
  if (!response.ok) throw new Error('The barcode service could not be reached.')
  const result = (await response.json()) as { items?: Array<{ title?: string }> }
  const title = result.items?.[0]?.title
  if (!title) throw new Error('No DVD title was found for that barcode.')
  return title.replace(/\s*(DVD|Blu-ray|Widescreen|Special Edition).*$/i, '').trim()
}
