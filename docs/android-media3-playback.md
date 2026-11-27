# Neo Player Android Media3 playback

Android local audio uses one service-owned AndroidX Media3 ExoPlayer exposed through `MediaSessionService`. The Capacitor `NativeAudio` plugin connects with a `MediaController` for loading media, transport controls, seeking, and playback-state queries. The session publishes system notification and lock-screen metadata and routes headset/Bluetooth media buttons to the app's queue handlers.

The web playback engine remains the non-Android fallback; YouTube tracks continue through the official IFrame player. Android MediaStore and picked-file URIs are passed directly to ExoPlayer, allowing platform-supported MP3, AAC, FLAC, WAV, and OGG decoders. Playback queue, shuffle, repeat, and progress remain controlled by the React playback state and persisted in the existing local database. Native Android audio effects are best-effort because effect support depends on the device/audio session.

## Device validation checklist

Run `npm run android:sync`, build and install on a physical Android device, then verify:

- local MediaStore audio in foreground and background;
- notification and lock-screen play/pause, seek, previous, and next;
- wired headset and Bluetooth AVRCP controls and audio-focus interruptions;
- queue, shuffle, repeat, and playback-position restoration after relaunch;
- switching between local tracks and YouTube IFrame playback without duplicate native players;
- playback speed, supported audio effects, and recovery after an unsupported/corrupt file.

Physical-device checks cannot be performed from the repository automation environment and remain a release validation step.
