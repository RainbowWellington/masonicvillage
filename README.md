# Village Cinema Collection

A simple, accessible DVD catalogue for a retirement village cinema. Residents sign in with a shared password, search the collection by title, genre, director, or cast, open rich movie details, and add DVDs by title or barcode. A separate admin password enables IMDb matching improvements and DVD removal.

## Technology

- TanStack Start, React 19, TypeScript, and Tailwind CSS
- Netlify Functions for authentication, catalogue operations, and movie lookup
- Netlify Database with Drizzle ORM for persistent DVD records
- OMDb for IMDb-linked movie metadata and posters
- UPCitemdb for best-effort DVD barcode-to-title lookup
- Browser `BarcodeDetector` and camera APIs, with manual barcode entry as a fallback

## Local setup

1. Install dependencies with `pnpm install`.
2. Copy `.env.example` to `.env` and fill in each value.
3. Create an OMDb API key for automatic film details.
4. Run `netlify dev --port 8889`.
5. Open the local Netlify URL shown in the terminal.

The first deploy provisions Netlify Database and applies the migration in `netlify/database/migrations`. That migration imports the 285 DVDs supplied in `public/data/dvd-collection-catalog.csv`.

## Environment variables



Do not expose these values in client-side code or commit a populated `.env` file.

## Key workflows

- Residents can browse all DVDs after entering the cinema password.
- Search covers stored titles, directors, genres, and cast members.
- Opening an older CSV record fetches richer details when OMDb is configured.
- Residents can scan supported UPC/EAN barcodes or search by title before adding a DVD.
- If external movie lookup is unavailable, a typed title can still be added without metadata.
- Admins can enter or correct an IMDb title ID, refresh the stored metadata, and remove DVDs.

## Metadata note

IMDb does not provide a simple public catalogue API for this use case. The app uses OMDb, which returns IMDb-linked metadata and IMDb IDs, then links residents directly to the matching IMDb title page.
