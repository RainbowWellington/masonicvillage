import type { Config, Context } from '@netlify/functions'
import { readSession } from '../lib/auth.js'
import { getMovie, LookupError, searchMovies, titleFromBarcode } from '../lib/movie-data.js'

export default async (request: Request, context: Context) => {
  if (!(await readSession(context))) return Response.json({ error: 'Please sign in.' }, { status: 401 })
  const url = new URL(request.url)
  try {
    const barcode = url.searchParams.get('barcode')
    if (barcode) {
      const title = await titleFromBarcode(barcode)
      return Response.json({ title, matches: await searchMovies(title) })
    }
    const imdbId = url.searchParams.get('imdbId') || undefined
    const title = url.searchParams.get('title') || undefined
    if (imdbId || url.searchParams.get('details') === 'true') {
      return Response.json(await getMovie(imdbId, title))
    }
    if (!title) return Response.json({ error: 'Enter a movie title.' }, { status: 400 })
    return Response.json({ matches: await searchMovies(title) })
  } catch (error) {
    if (error instanceof LookupError) return Response.json({ error: error.message }, { status: 400 })
    console.error('movie lookup failed', error)
    return Response.json({ error: 'The movie lookup service could not be reached.' }, { status: 502 })
  }
}

export const config: Config = { path: '/api/movie-lookup' }

