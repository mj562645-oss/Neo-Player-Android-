<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/9da97272-edbb-42ed-9d47-9b2718216d02

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Android

After installing dependencies, run `npm run android:sync` to build the web app and register its
Capacitor plugins in Android. Rebuild and reinstall the Android app after syncing native plugins.

YouTube sign-in requires a web OAuth client ID and a matching Android OAuth client in the same
Google Cloud project. The Android client must use package name `com.neoplayer.music` and include
the SHA-1 fingerprints for the signing keys used by your debug and release builds.

After Android audio permission is granted, the app refreshes the device music library on launch.
Imported tracks and library metadata are stored locally. Android MediaStore tracks use native
Media3 playback for background audio; YouTube playback remains subject to YouTube's own background
playback restrictions.
