# Neo Player repository audit and implementation plan

**Audit date:** 2026-11-27  
**Baseline inspected:** `main` at `a985a134a8a46c0d66004991fa2c48af761595ec`  
**Product constraint:** Preserve Neo Player's existing identity, visual direction, and working behaviour. This is an incremental enhancement plan, not a redesign or greenfield rebuild.

## Executive summary

The repository is a React 19 / TypeScript / Vite application packaged for Android with Capacitor 8. It already contains a substantial local music library, IndexedDB persistence, a React playback context, an Android MediaStore plugin, a Media3 `MediaSessionService`, native Google sign-in, Firebase Authentication, YouTube Data API integration, and the official YouTube IFrame Player.

Do not replace these systems wholesale. The immediate work should improve boundaries and close verified gaps while retaining the existing Neo Player visual language. Existing visual themes include Neo, Material, and Windows; they are implemented through shared personalization tokens and existing screens. Avoid claiming five complete systems or adding alternate visual identities until the full app has been audited and the user explicitly wants that expansion.

The latest Android CI run for the MediaController change completed successfully (run 45919322768). The linked earlier run 45890257271 also completed successfully. These are CI results, not a physical-device playback test. No physical device or local execution environment was available during this audit.

## Verified architecture and functionality

| Area | Verified in repository | Audit notes |
| --- | --- | --- |
| Frontend | React, TypeScript, Vite, Tailwind CSS, Motion | `src/App.tsx` provides nested library, YouTube, player, theme and discovery contexts. |
| Android | Capacitor 8; package `com.neoplayer.music` | Native app uses Java plugins and AndroidX Media3 1.11.1. |
| Android playback | `PlaybackService` extends `MediaSessionService`; one service-owned ExoPlayer | Session configures audio focus through ExoPlayer audio attributes and noisy-route handling. Notification/session actions are bridged to the app. |
| Controller bridge | `NativeAudioPlugin` now uses Media3 `MediaController` for local loading, transport, seeking and status | Commit `a985a134` changes the bridge. Settings and metadata still use service intents. Review controller lifecycle, service start/stop, and error mapping before expanding the bridge. |
| Web playback | Singleton `audioEngine` provides the browser fallback; YouTube uses a separate singleton IFrame service | The audio engine constructs two HTML audio decks. Android local MediaStore tracks choose the native path in `PlayerContext`, but it is important to keep the web engine explicitly out of the Android primary path. |
| Queue and persistence | `PlayerContext` owns queue, current index, shuffle, repeat and cross-source selection; IndexedDB stores playback state | Existing state is persisted in the web database. Validate restoration for Android process death and lock-screen operations on real hardware. |
| Local library | `LibraryContext`, IndexedDB, `MediaStorePlugin` and `mediaStore.ts` | Existing import, scan, metadata, artwork, tag-write and cache operations should be preserved. |
| YouTube | `youtubeApi.ts`, `youtubeAuth.ts`, `youtubePlayer.ts`, `YouTubeContext.tsx` | API requests currently go from client code to YouTube Data API. Playback uses the IFrame API, not extracted or proxied streams. |
| Firebase | Firebase client SDK and `firebase-applet-config.json` | The checked-in Firebase web configuration includes a client API key; this is normally a public client identifier, not a server secret. Project currently configured as `neo-player-android`. Do not replace it or invent a new project ID without explicit provisioning and migration planning. |
| Backend | Express app in `server.ts` | Existing routes cover discovery, enrichment, privacy/terms, and static hosting. The inspected server has no Firebase ID-token verification, OAuth token vault, Drive API, Cloud Storage API, or app-specific authenticated account routes. |
| Themes / artwork | Neo, Material and Windows theme tokens; album-art palette/background effects; personalization studio | Existing implementation is already a strong baseline. Preserve its current style and improve deliberately rather than replacing it with a new brand system. |
| CI | `.github/workflows/android-apk.yml` builds and uploads a signed release APK | It uses repository secrets for signing and passes Gemini-related variables to the web build. Reassess the latter and remove only after verifying no legitimate use. Current workflow history contains both successes and a prior failure; inspect job logs when diagnosing a particular failed run. |

## Prioritised findings and risks

### Preserve and build upon

- Native Media3 playback and the existing MediaSession notification/session path.
- The MediaStore import and local offline library.
- The existing player context, queue semantics, IndexedDB persistence and web fallback.
- The official YouTube IFrame Player and YouTube Data API integration.
- The three existing design systems, personalization controls, artwork backgrounds and established Neo Player identity.
- Existing Express metadata/enrichment endpoints and Android build pipeline.

### Gaps to address in small, testable phases

1. **Playback adapter boundary:** `PlayerContext` coordinates `NativeAudio`, `audioEngine`, and `youtubePlayer` directly in many branches. Introduce a narrow shared adapter/controller facade incrementally, then migrate call sites without changing visible behaviour or instantiating players during React renders/layout changes.
2. **Native service state:** Ensure service-owned ExoPlayer remains the only Android native audio player. Exercise MediaController reconnection after WebView/activity recreation and verify that player errors, interruptions, queue actions and current position are reflected correctly.
3. **Queue semantics in the OS session:** React owns the app's cross-source queue while the native session exposes next/previous actions through bridge events. This is a legitimate hybrid design, but must be tested when the WebView is backgrounded or recreated; decide explicitly whether to mirror only local items into the native timeline or keep event-driven queue navigation.
4. **Authentication separation:** Current `youtubeAuth.ts` combines Firebase sign-in with acquiring a YouTube access token. The broader request calls for distinct Neo Player identity and optional YouTube/Drive authorisations. Design this migration before changing auth: avoid silently changing account identity, breaking existing users, or adding server token storage without a backend, consent flow and migration plan.
5. **OAuth token handling:** The current client keeps a YouTube access token in memory, and inspected code calls YouTube APIs directly. No server-side refresh-token vault was found in the inspected server. Before introducing refresh tokens, define supported OAuth clients, callback URIs, PKCE/state verification, encryption, consent scopes, revocation, retention and account isolation. Do not claim refresh-token protection exists today.
6. **Cloud infrastructure:** No Firebase Hosting, Cloud Run, Firestore rules, Cloud Storage bucket policy, Secret Manager setup, Drive integration or infrastructure-as-code was found in the inspected root/configuration files. These require explicit project owner access, project/billing/API enablement, regions, IAM and credentials. Do not create a cloud project or expose tokens as a code change without the owner's provisioning choices.
7. **Build configuration:** CI passes `GEMINI_API_KEY` and `VITE_GEMINI_API_KEY` to the frontend build. Any `VITE_` variable referenced by browser code can become part of the client bundle. Determine whether this dependency is used; remove unnecessary AI-provider integration and build secrets only after checking application references and lockfiles. Never put private credentials in `VITE_*` variables.
8. **Operational testing:** CI proves the configured build pipeline completed. It does not prove installation, playback codecs on device, background restrictions, Bluetooth AVRCP, notification permission behaviour, audio-focus recovery or process-death restoration.

## Network and external service inventory

Inventory is based on the source files inspected, not a claim that every repository reference has been exhaustively enumerated.

| Service | Observed use | Treatment |
| --- | --- | --- |
| Firebase Authentication / Firebase client SDK | App account sign-in and auth state in `youtubeAuth.ts` | Preserve; separate app identity from optional YouTube/Drive grants as a planned auth phase. |
| Google Identity Services (`accounts.google.com/gsi/client`) | Browser YouTube token flow | Preserve required Google OAuth path; validate authorized origins, state and client setup. |
| Google Sign-In Capacitor plugin | Native account selection and credential flow | Preserve pending native OAuth review; user request's system-browser/PKCE flow may require a deliberate migration. |
| YouTube Data API (`googleapis.com/youtube/v3`) | Search, channel, playlist and liked-media metadata | Official API; preserve quota/error handling and scope discipline. |
| YouTube IFrame API (`youtube.com/iframe_api`) | Official YouTube playback | Preserve. Do not proxy, extract, or download streams. |
| Existing Express app | Discovery, metadata/enrichment and privacy routes | Preserve; production auth and deployment are not verified. |
| Apple/iTunes RSS and lookup | Discovery and preview metadata | Existing third-party discovery source; not an AI provider. |
| MusicBrainz, Cover Art Archive, LRCLIB | Metadata, artwork and lyrics enrichment | Existing optional enrichment dependencies; preserve unless product requirements change. |
| Gemini / AI provider | `@google/genai` dependency and Gemini build environment variables exist | Actual runtime use was not established in this audit. Verify references before removal; do not make app functionality depend on it. |

## Baseline verification

- Repository owner/name and default branch verified: `mj562645-oss/Neo-Player-Android-`, `main`.
- Android package verified: `com.neoplayer.music`.
- Media3 dependencies verified in `android/app/build.gradle`.
- Linked Actions run `45890257271`: completed successfully.
- Latest inspected Actions run `45919322768` for commit `a985a134`: completed successfully.
- No local frontend, Gradle, or device test was run as part of this source audit. No physical-device test is claimed.

## Recommended implementation sequence

1. Add automated source-level checks for the native adapter bridge and document a physical-device regression checklist; resolve any current CI/bridge edge cases.
2. Map all player operations in `PlayerContext`; introduce one stable facade with Native Media3, browser fallback and official YouTube adapters, preserving public React context methods and the current design.
3. Add focused native playback state/error integration and ensure queue actions remain correct across app backgrounding, WebView recreation and source switching.
4. Create an authentication threat model and account/data migration design before separating Firebase identity from YouTube/Drive connections.
5. Establish environment-driven deployment configuration and backend auth middleware before any user data or OAuth tokens are stored server-side.
6. Provision Firebase/Google Cloud only with the developer's confirmed project and permissions; add least-privilege storage, token encryption, deletion and deployment workflows.
7. Improve responsive layouts, accessibility and existing theme coverage without changing Neo Player's original design identity.
8. Run frontend/build/Android CI, then physical-device tests for codecs, focus/interruption, notification/lock screen, Bluetooth, process death, queue restoration, and switching local/YouTube playback.

## External setup still required

The repository alone cannot provision developer-owned Google Cloud resources or prove user consent settings. The owner must confirm the existing `neo-player-android` project versus a new project, billing and required APIs, OAuth web and Android client registrations, authorized origins/redirects, signing fingerprints, deployment regions, any Firebase/Cloud Run domain, and secret-management permissions. The requested example project ID is only a suggestion; it must not be assumed available or created automatically.
