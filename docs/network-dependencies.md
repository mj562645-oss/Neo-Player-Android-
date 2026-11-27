# Network dependency inventory

This inventory records external services found during the Neo Player repository audit on 2026-11-27. It is an initial source inspection, not a complete automated scan of every dependency or URL.

| Category | Host / SDK | Current purpose | Keep / action |
| --- | --- | --- | --- |
| App authentication | Firebase Authentication SDK | Sign-in state in the frontend | Keep; design separation from optional Google service authorisations before changing flows. |
| Google OAuth | `accounts.google.com/gsi/client` | Browser OAuth token flow for YouTube | Keep as an official Google dependency; validate origin, state, account switching and scopes. |
| Android Google auth | `@capawesome/capacitor-google-sign-in` | Native Google sign-in and token acquisition | Existing dependency; review against system-browser OAuth/PKCE requirements before migration. |
| YouTube metadata API | `www.googleapis.com/youtube/v3` | Video search, metadata and user-authorised playlist/channel data | Keep official API; apply quota, scope and error handling. |
| YouTube playback | `www.youtube.com/iframe_api` | Official IFrame Player | Keep. No media stream extraction, proxy, or download. |
| App backend | Express `server.ts` | Discovery and metadata/enrichment endpoints; dev/prod web server | Keep existing endpoints; authenticated production API and Cloud Run deployment are not verified. |
| Music discovery | Apple RSS / iTunes lookup | Public chart, artwork and preview metadata | Existing non-AI optional dependency. Keep unless product policy changes. |
| Metadata | MusicBrainz (`musicbrainz.org`) | Recording metadata | Existing optional enrichment. Respect rate limits/user agent. |
| Artwork | Cover Art Archive (`coverartarchive.org`) | Album art | Existing optional enrichment; server contains a hostname allowlist for cover fetching. |
| Lyrics | LRCLIB (`lrclib.net`) | Plain/synced lyric lookup | Existing optional enrichment. |
| Firebase project config | `neo-player-android` project | Firebase client configuration | Existing project ID in checked-in config. Confirm ownership and intended production project; do not silently replace. |
| AI SDK | `@google/genai` | Dependency present; usage not verified | Search all source/config references before removal. Remove unnecessary integration and client-bundled secrets if confirmed unused. |

## Security review notes

- A Firebase web API key is normally a public client configuration value, not a substitute for Firebase security rules or backend authentication.
- A browser `VITE_*` variable is not a secret. The Android workflow currently passes `VITE_GEMINI_API_KEY`; verify usage and remove unnecessary key injection before production.
- YouTube access tokens are currently acquired/held in frontend memory in the inspected auth service and sent directly to the official API. Server-side refresh-token encryption and token vaulting have not been verified.
- The current `server.ts` contains public metadata/discovery routes. No Firebase ID-token verification was identified in the inspected source. Do not add user-scoped data endpoints until verified identity, ownership checks, rate limits and data deletion are implemented.
- No Cloud Run, Firebase Hosting, Google Cloud Storage, Drive, Secret Manager, Firestore security rules, or deployment IaC was found in inspected configuration.

## Audit follow-up

Run a repository-wide URL and dependency scan during implementation. For each new external service, document owner, data sent, scope, retention, failure mode and whether local playback works without it. Route application-owned authenticated APIs through a configured Neo Player backend endpoint; do not hardcode a temporary development host.
