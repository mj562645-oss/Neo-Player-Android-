# Listening history and analytics

Playback history is stored locally in a separate IndexedDB database and is intentionally independent of the music library database. It records a local playback start after the track has remained in the playing state briefly, groups entries by the device's local day, and derives top artists/genres from the local metadata catalogue. It stores track IDs and timestamps only; it does not upload data or copy audio.

The current UI provides a listening-insights panel. A first play may be recorded only after the short debounce completes. Track playback controls and the Media3 engine are not mounted or recreated by the panel.

Android's system media notification and lock-screen session remain provided by the existing Media3 service. Android and One UI may present eligible sessions in their own media controls / Now Bar surfaces; app code cannot force a Samsung-specific pill shape or wallpaper layout on all device versions. A home-screen widget requires a native AppWidgetProvider and widget layouts and is not included in the web-only analytics increment.

For broader native enhancements, verify device/API/One UI-specific behaviour on hardware, then add MediaSession custom commands for Like/Repeat and an Android home-screen widget as separate native deliverables. Keep transport commands in the service/controller layer; don't implement a second player in a widget.
