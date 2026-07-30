import type { Config, Context } from '@netlify/functions'
import { and, eq, inArray, isNull } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { dvds } from '../../db/schema.js'
import { readSession } from '../lib/auth.js'
import { getMovie, LookupError, MovieNotFoundError, titlesMatch } from '../lib/movie-data.js'

// Small batches keep each request well inside the function time limit, and the
// catalogue only ever needs backfilling once per title.
const BATCH_LIMIT = 10
const CONCURRENCY = 4

type Row = typeof dvds.$inferSelect

// The CSV import used "Various" as a placeholder for concert and compilation
// discs, so it counts as missing rather than as real data worth keeping.
function missing(value: string | null) {
  return !value || value === 'Various'
}

async function backfill(row: Row) {
  const details = await getMovie(row.imdbId || undefined, row.imdbId ? undefined : row.title)

  // Without an IMDb ID the match was made on title alone, so only trust it when
  // the returned title really is the same film.
  if (!row.imdbId && !titlesMatch(details.title, row.title)) return null

  const updates: Partial<Row> = {}
  if (!row.posterUrl && details.posterUrl) updates.posterUrl = details.posterUrl
  if (!row.imdbId && details.imdbId) updates.imdbId = details.imdbId
  if (!row.year && details.year) updates.year = details.year
  if (!row.plot && details.plot && details.plot !== 'N/A') updates.plot = details.plot
  if (!row.cast && details.cast) updates.cast = details.cast
  if (!row.runtime && details.runtime) updates.runtime = details.runtime
  if (!row.rating && details.rating) updates.rating = details.rating
  if (!row.imdbRating && details.imdbRating) updates.imdbRating = details.imdbRating
  if (missing(row.director) && details.director) updates.director = details.director
  if (missing(row.genre) && details.genre) updates.genre = details.genre
  if (Object.keys(updates).length) updates.detailsSource = details.detailsSource
  return updates
}

export default async (request: Request, context: Context) => {
  if (!(await readSession(context))) return Response.json({ error: 'Please sign in.' }, { status: 401 })
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  let ids: number[] = []
  try {
    const body = (await request.json()) as { ids?: unknown }
    ids = (Array.isArray(body.ids) ? body.ids : [])
      .map(Number)
      .filter((value) => Number.isInteger(value) && value > 0)
      .slice(0, BATCH_LIMIT)
  } catch {
    return Response.json({ error: 'A list of DVD IDs is required.' }, { status: 400 })
  }
  if (!ids.length) return Response.json({ dvds: [] })

  try {
    const rows = await db
      .select()
      .from(dvds)
      .where(and(inArray(dvds.id, ids), isNull(dvds.posterUrl), isNull(dvds.artworkCheckedAt)))
    if (!rows.length) return Response.json({ dvds: [] })

    const updated: Row[] = []
    let unavailable = ''
    const queue = [...rows]

    async function worker() {
      while (queue.length && !unavailable) {
        const row = queue.shift()
        if (!row) return
        let updates: Partial<Row> | null = null
        try {
          updates = await backfill(row)
        } catch (error) {
          // A title the service does not know about is settled: mark it checked
          // so it is never looked up again. Anything else (missing API key, the
          // service being down) must not be recorded as checked.
          if (!(error instanceof MovieNotFoundError)) {
            unavailable = error instanceof LookupError ? error.message : 'The movie service could not be reached.'
            return
          }
        }
        const [saved] = await db
          .update(dvds)
          .set({ ...(updates || {}), artworkCheckedAt: new Date(), updatedAt: new Date() })
          .where(eq(dvds.id, row.id))
          .returning()
        if (saved) updated.push(saved)
      }
    }

    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, queue.length) }, worker))

    // `stop` tells the catalogue to stop asking for the rest of the collection
    // until the next visit, rather than working through hundreds of failures.
    return Response.json(unavailable ? { dvds: updated, stop: true, error: unavailable } : { dvds: updated })
  } catch (error) {
    console.error('artwork backfill failed', error)
    return Response.json({ error: 'Cover artwork could not be updated.', stop: true }, { status: 500 })
  }
}

export const config: Config = { path: '/api/catalogue-artwork' }
