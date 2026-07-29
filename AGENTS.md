# AGENTS.md

## Project overview

Village Cinema Collection is a password-protected DVD catalogue built for easy use by retirement village residents. It supports catalogue search, rich movie details, resident-submitted DVDs, phone barcode scanning, and separate admin controls.

## Architecture

- `src/routes/index.tsx` contains the resident login, catalogue, search, detail modal, add-DVD workflow, barcode scanner, and admin access UI.
- `src/routes/__root.tsx` defines the document shell and metadata.
- `src/styles.css` contains the full responsive visual system and component styling.
- `netlify/functions/auth.mts` manages resident and admin password sessions.
- `netlify/functions/catalogue.mts` provides persistent catalogue CRUD and search.
- `netlify/functions/movie-lookup.mts` provides title, IMDb ID, and barcode lookup.
- `netlify/lib/auth.ts` signs and reads secure session cookies.
- `netlify/lib/movie-data.ts` normalizes OMDb metadata and resolves barcodes through UPCitemdb.
- `db/schema.ts` defines the Drizzle schema for Netlify Database.
- `netlify/database/migrations/` contains the deploy-time database migration and initial 285-DVD import.
- `public/data/dvd-collection-catalog.csv` preserves the supplied source catalogue.

## Conventions

- Use TypeScript and functional React components.
- Keep resident interactions large, clear, keyboard-accessible, and mobile-friendly.
- Use the existing CSS variables and editorial cinema aesthetic rather than introducing a second design system.
- Keep all persistent application state in Netlify Database.
- Keep secrets server-side through `Netlify.env`; never send passwords or API keys to the browser.
- Return JSON errors from functions in the shape `{ error: string }`.
- Use snake_case database column names and camelCase TypeScript properties.

## Non-obvious decisions

- OMDb supplies IMDb-linked metadata because IMDb has no simple public API suitable for this project.
- Existing CSV titles are enriched on demand when opened; admins can persist corrected metadata with an IMDb ID.
- Native browser barcode scanning is progressive enhancement. Manual barcode entry remains available on unsupported devices.
- A resident can add a title without metadata when external lookup is unavailable.
- Password sessions last 12 hours and use an HTTP-only cookie. `SESSION_SECRET` is recommended; configured passwords provide a signing fallback.

## Development

- Use `pnpm install` for dependencies.
- Use `netlify dev --port 8889` for local Netlify emulation.
- Database schema changes require a generated migration under `netlify/database/migrations/`.
- Do not commit populated environment files.
