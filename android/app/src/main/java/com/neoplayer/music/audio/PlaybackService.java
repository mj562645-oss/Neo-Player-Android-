package com.neoplayer.music.audio;

import android.app.PendingIntent;
import android.content.Intent;
import android.media.MediaMetadataRetriever;
import android.media.audiofx.Equalizer;
import android.media.audiofx.LoudnessEnhancer;
import android.net.Uri;
import android.os.Build;
import android.util.Base64;
import androidx.annotation.Nullable;
import androidx.media3.common.AudioAttributes;
import androidx.media3.common.C;
import androidx.media3.common.ForwardingPlayer;
import androidx.media3.common.MediaItem;
import androidx.media3.common.MediaMetadata;
import androidx.media3.common.PlaybackParameters;
import androidx.media3.common.Player;
import androidx.media3.exoplayer.ExoPlayer;
import androidx.media3.session.MediaSession;
import androidx.media3.session.MediaSessionService;
import com.neoplayer.music.MainActivity;
import com.neoplayer.music.NativeAudioPlugin;

/**
 * Native background playback service backed by Android Media3 ExoPlayer + MediaSessionService.
 * Automatically surfaces OS notification shade & lockscreen controls with album art,
 * seekbar, play/pause, and previous/next actions synced back to JS.
 */
public class PlaybackService extends MediaSessionService {
    public static final String ACTION_PLAY = "com.neoplayer.music.PLAY_LOCAL";
    public static final String ACTION_PAUSE = "com.neoplayer.music.PAUSE";
    public static final String ACTION_RESUME = "com.neoplayer.music.RESUME";
    public static final String ACTION_SEEK = "com.neoplayer.music.SEEK";
    public static final String ACTION_STOP = "com.neoplayer.music.STOP";
    public static final String ACTION_OPTIONS = "com.neoplayer.music.SET_OPTIONS";
    public static final String ACTION_UPDATE_METADATA = "com.neoplayer.music.UPDATE_METADATA";

    public static volatile boolean playing = false;
    public static volatile boolean ended = false;
    public static volatile long positionMs = 0;
    public static volatile long durationMs = 0;
    public static volatile ExoPlayer activePlayer;

    private ExoPlayer player;
    private MediaSession session;
    private Equalizer equalizer;
    private LoudnessEnhancer loudnessEnhancer;
    private float targetVolume = 0.85f;
    private boolean targetMuted = false;

    @Override
    public void onCreate() {
        super.onCreate();
        player = new ExoPlayer.Builder(this)
            .setWakeMode(C.WAKE_MODE_LOCAL)
            .build();

        AudioAttributes audioAttributes = new AudioAttributes.Builder()
            .setUsage(C.USAGE_MEDIA)
            .setContentType(C.AUDIO_CONTENT_TYPE_MUSIC)
            .build();
        player.setAudioAttributes(audioAttributes, true);
        player.setHandleAudioBecomingNoisy(true);
        activePlayer = player;

        player.addListener(new Player.Listener() {
            @Override
            public void onIsPlayingChanged(boolean value) {
                playing = value;
                if (value) ended = false;
                positionMs = Math.max(0, player.getCurrentPosition());
                durationMs = Math.max(0, player.getDuration());
                // Playback state is the authoritative play/pause signal to JavaScript.
                // Do not also emit mediaAction(play/pause): the UI responds to those actions
                // by issuing another controller command, creating a command-feedback loop.
                NativeAudioPlugin.notifyPlaybackState(value, ended, positionMs, durationMs);
            }

            @Override
            public void onPlaybackStateChanged(int state) {
                durationMs = Math.max(0, player.getDuration());
                positionMs = Math.max(0, player.getCurrentPosition());
                if (state == Player.STATE_ENDED) {
                    playing = false;
                    ended = true;
                    NativeAudioPlugin.notifyPlaybackState(false, true, positionMs, durationMs);
                    NativeAudioPlugin.notifyMediaAction("ended");
                } else if (state == Player.STATE_READY) {
                    ended = false;
                    NativeAudioPlugin.notifyPlaybackState(player.isPlaying(), false, positionMs, durationMs);
                }
            }
        });

        ForwardingPlayer sessionPlayer = new ForwardingPlayer(player) {
            @Override
            public Commands getAvailableCommands() {
                return super.getAvailableCommands().buildUpon()
                    .add(COMMAND_SEEK_TO_NEXT)
                    .add(COMMAND_SEEK_TO_NEXT_MEDIA_ITEM)
                    .add(COMMAND_SEEK_TO_PREVIOUS)
                    .add(COMMAND_SEEK_TO_PREVIOUS_MEDIA_ITEM)
                    .build();
            }

            @Override
            public boolean isCommandAvailable(int command) {
                if (command == COMMAND_SEEK_TO_NEXT ||
                    command == COMMAND_SEEK_TO_NEXT_MEDIA_ITEM ||
                    command == COMMAND_SEEK_TO_PREVIOUS ||
                    command == COMMAND_SEEK_TO_PREVIOUS_MEDIA_ITEM) {
                    return true;
                }
                return super.isCommandAvailable(command);
            }

            @Override
            public boolean hasNextMediaItem() {
                return true;
            }

            @Override
            public boolean hasPreviousMediaItem() {
                return true;
            }

            @Override
            public void seekToNext() {
                NativeAudioPlugin.notifyMediaAction("next");
            }

            @Override
            public void seekToNextMediaItem() {
                NativeAudioPlugin.notifyMediaAction("next");
            }

            @Override
            public void seekToPrevious() {
                NativeAudioPlugin.notifyMediaAction("previous");
            }

            @Override
            public void seekToPreviousMediaItem() {
                NativeAudioPlugin.notifyMediaAction("previous");
            }

            @Override
            public void play() {
                // Let Media3 update playback; onIsPlayingChanged notifies the UI.
                // Emitting a JS play action here loops back into another controller.play().
                super.play();
            }

            @Override
            public void pause() {
                // Let Media3 update playback; onIsPlayingChanged notifies the UI.
                // Emitting a JS pause action here loops back into another controller.pause().
                super.pause();
            }
        };

        Intent openAppIntent = new Intent(this, MainActivity.class);
        openAppIntent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT |
            (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0);
        PendingIntent sessionActivity = PendingIntent.getActivity(this, 0, openAppIntent, flags);

        session = new MediaSession.Builder(this, sessionPlayer)
            .setSessionActivity(sessionActivity)
            .build();
    }

    @Nullable
    @Override
    public MediaSession onGetSession(MediaSession.ControllerInfo info) {
        return session;
    }

    @Override
    public int onStartCommand(@Nullable Intent intent, int flags, int startId) {
        if (intent != null && player != null) {
            String action = intent.getAction();
            if (ACTION_PLAY.equals(action)) {
                String raw = intent.getStringExtra("uri");
                if (raw != null && !raw.isEmpty()) {
                    ended = false;
                    Uri parsedUri = Uri.parse(raw);
                    MediaMetadata metadata = buildMetadataFromIntent(intent, parsedUri);
                    MediaItem item = new MediaItem.Builder()
                        .setUri(parsedUri)
                        .setMediaMetadata(metadata)
                        .build();

                    player.setMediaItem(item);
                    player.prepare();
                    long pos = Math.max(0L, intent.getLongExtra("positionMs", 0L));
                    if (pos > 0L) {
                        player.seekTo(pos);
                    }
                    if (intent.hasExtra("volume") || intent.hasExtra("muted")) {
                        targetVolume = intent.getFloatExtra("volume", targetVolume);
                        targetMuted = intent.getBooleanExtra("muted", targetMuted);
                        player.setVolume(targetMuted ? 0f : Math.max(0f, Math.min(1f, targetVolume)));
                    }
                    if (intent.hasExtra("playbackRate")) {
                        float rate = Math.max(0.5f, Math.min(2.0f, intent.getFloatExtra("playbackRate", 1.0f)));
                        player.setPlaybackParameters(new PlaybackParameters(rate));
                    }
                    if (intent.hasExtra("pauseOnBluetoothDisconnect")) {
                        player.setHandleAudioBecomingNoisy(
                            intent.getBooleanExtra("pauseOnBluetoothDisconnect", true)
                        );
                    }
                    boolean autoplay = intent.getBooleanExtra("autoplay", true);
                    if (autoplay) {
                        player.play();
                    } else {
                        player.pause();
                    }
                }
            } else if (ACTION_PAUSE.equals(action)) {
                player.pause();
            } else if (ACTION_RESUME.equals(action)) {
                player.play();
            } else if (ACTION_SEEK.equals(action)) {
                ended = false;
                player.seekTo(Math.max(0L, intent.getLongExtra("positionMs", 0L)));
            } else if (ACTION_OPTIONS.equals(action)) {
                applyPlaybackOptionsIntent(intent);
            } else if (ACTION_UPDATE_METADATA.equals(action)) {
                MediaItem current = player.getCurrentMediaItem();
                if (current != null) {
                    Uri currentUri = current.localConfiguration != null ? current.localConfiguration.uri : null;
                    MediaMetadata metadata = buildMetadataFromIntent(intent, currentUri);
                    player.replaceMediaItem(
                        player.getCurrentMediaItemIndex(),
                        current.buildUpon().setMediaMetadata(metadata).build()
                    );
                }
            } else if (ACTION_STOP.equals(action)) {
                playing = false;
                ended = false;
                player.stop();
                stopSelf();
            }
        }
        return super.onStartCommand(intent, flags, startId);
    }

    private MediaMetadata buildMetadataFromIntent(Intent intent, @Nullable Uri sourceUri) {
        MediaMetadata.Builder builder = new MediaMetadata.Builder()
            .setTitle(intent.getStringExtra("title"))
            .setArtist(intent.getStringExtra("artist"));

        String album = intent.getStringExtra("album");
        if (album != null && !album.isEmpty()) {
            builder.setAlbumTitle(album);
        }

        byte[] artworkBytes = null;
        String artworkBase64 = intent.getStringExtra("artworkBase64");
        if (artworkBase64 != null && !artworkBase64.isEmpty()) {
            try {
                artworkBytes = Base64.decode(artworkBase64, Base64.DEFAULT);
            } catch (Exception ignored) {
                artworkBytes = null;
            }
        }
        if ((artworkBytes == null || artworkBytes.length == 0) && sourceUri != null) {
            MediaMetadataRetriever retriever = new MediaMetadataRetriever();
            try {
                retriever.setDataSource(this, sourceUri);
                artworkBytes = retriever.getEmbeddedPicture();
            } catch (Exception ignored) {
                artworkBytes = null;
            } finally {
                try {
                    retriever.release();
                } catch (Exception ignored) {
                    // ignore
                }
            }
        }
        if (artworkBytes != null && artworkBytes.length > 0) {
            builder.setArtworkData(artworkBytes, MediaMetadata.PICTURE_TYPE_FRONT_COVER);
        }
        return builder.build();
    }

    private void applyPlaybackOptionsIntent(Intent intent) {
        if (player == null) return;
        if (intent.hasExtra("volume") || intent.hasExtra("muted")) {
            targetVolume = intent.getFloatExtra("volume", targetVolume);
            targetMuted = intent.getBooleanExtra("muted", targetMuted);
            player.setVolume(targetMuted ? 0f : Math.max(0f, Math.min(1f, targetVolume)));
        }
        if (intent.hasExtra("playbackRate")) {
            float rate = Math.max(0.5f, Math.min(2.0f, intent.getFloatExtra("playbackRate", 1.0f)));
            player.setPlaybackParameters(new PlaybackParameters(rate));
        }
        if (intent.hasExtra("pauseOnBluetoothDisconnect")) {
            player.setHandleAudioBecomingNoisy(
                intent.getBooleanExtra("pauseOnBluetoothDisconnect", true)
            );
        }
        int audioSessionId = player.getAudioSessionId();
        if (audioSessionId != C.AUDIO_SESSION_ID_UNSET && audioSessionId != 0) {
            if (intent.hasExtra("volumeNormalization")) {
                boolean norm = intent.getBooleanExtra("volumeNormalization", false);
                try {
                    if (loudnessEnhancer == null) {
                        loudnessEnhancer = new LoudnessEnhancer(audioSessionId);
                    }
                    loudnessEnhancer.setTargetGain(norm ? 350 : 0);
                    loudnessEnhancer.setEnabled(norm);
                } catch (Exception ignored) {
                    // Ignore unsupported audiofx devices
                }
            }
            if (intent.hasExtra("eqEnabled")) {
                boolean eqEnabled = intent.getBooleanExtra("eqEnabled", false);
                float bassDb = intent.getFloatExtra("eqBass", 0f);
                float midDb = intent.getFloatExtra("eqMid", 0f);
                float trebleDb = intent.getFloatExtra("eqTreble", 0f);
                try {
                    if (equalizer == null) {
                        equalizer = new Equalizer(0, audioSessionId);
                    }
                    equalizer.setEnabled(eqEnabled);
                    if (eqEnabled) {
                        short bands = equalizer.getNumberOfBands();
                        short[] range = equalizer.getBandLevelRange();
                        for (short b = 0; b < bands; b++) {
                            int centerHz = equalizer.getCenterFreq(b) / 1000;
                            float db = centerHz < 300 ? bassDb : (centerHz < 2500 ? midDb : trebleDb);
                            short mB = (short) Math.max(range[0], Math.min(range[1], Math.round(db * 100f)));
                            equalizer.setBandLevel(b, mB);
                        }
                    }
                } catch (Exception ignored) {
                    // Ignore unsupported audiofx devices
                }
            }
        }
    }

    @Override
    public void onTaskRemoved(Intent rootIntent) {
        if (player == null || !player.isPlaying()) {
            stopSelf();
        }
    }

    @Override
    public void onDestroy() {
        playing = false;
        ended = false;
        activePlayer = null;
        if (equalizer != null) {
            try { equalizer.release(); } catch (Exception ignored) {}
            equalizer = null;
        }
        if (loudnessEnhancer != null) {
            try { loudnessEnhancer.release(); } catch (Exception ignored) {}
            loudnessEnhancer = null;
        }
        if (session != null) {
            session.release();
            session = null;
        }
        if (player != null) {
            player.release();
            player = null;
        }
        super.onDestroy();
    }
}
