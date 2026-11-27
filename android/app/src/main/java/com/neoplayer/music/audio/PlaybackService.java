package com.neoplayer.music.audio;

import android.Manifest;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.media.MediaMetadataRetriever;
import android.media.audiofx.Equalizer;
import android.media.audiofx.LoudnessEnhancer;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.util.Base64;
import android.view.View;
import android.widget.RemoteViews;
import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;
import androidx.core.content.ContextCompat;
import androidx.media3.common.AudioAttributes;
import androidx.media3.common.C;
import androidx.media3.common.ForwardingPlayer;
import androidx.media3.common.MediaItem;
import androidx.media3.common.MediaMetadata;
import androidx.media3.common.PlaybackParameters;
import androidx.media3.common.Player;
import androidx.media3.exoplayer.ExoPlayer;
import androidx.media3.session.CommandButton;
import androidx.media3.session.DefaultMediaNotificationProvider;
import androidx.media3.session.MediaSession;
import androidx.media3.session.MediaSessionService;
import androidx.media3.session.SessionCommand;
import androidx.media3.session.SessionCommands;
import androidx.media3.session.SessionResult;
import com.google.common.collect.ImmutableList;
import com.google.common.util.concurrent.Futures;
import com.google.common.util.concurrent.ListenableFuture;
import com.neoplayer.music.MainActivity;
import com.neoplayer.music.NativeAudioPlugin;
import com.neoplayer.music.R;
import com.neoplayer.music.widget.ArtworkEffects;
import com.neoplayer.music.widget.NeoPlayerWidgetProvider;
import java.util.Arrays;

/**
 * Native background playback service backed by a single service-owned Media3 ExoPlayer + MediaSessionService.
 * Surfaces Android 10+ themed lockscreen & Samsung One UI dynamic Now Bar / Media Pill controls
 * with Like & Repeat custom actions, plus synchronized 4x1 frosted blur widget and album-art live pill notification.
 */
public class PlaybackService extends MediaSessionService {
    public static final String ACTION_PLAY = "com.neoplayer.music.PLAY_LOCAL";
    public static final String ACTION_PAUSE = "com.neoplayer.music.PAUSE";
    public static final String ACTION_RESUME = "com.neoplayer.music.RESUME";
    public static final String ACTION_SEEK = "com.neoplayer.music.SEEK";
    public static final String ACTION_STOP = "com.neoplayer.music.STOP";
    public static final String ACTION_OPTIONS = "com.neoplayer.music.SET_OPTIONS";
    public static final String ACTION_UPDATE_METADATA = "com.neoplayer.music.UPDATE_METADATA";
    public static final String ACTION_PLAY_PAUSE_TOGGLE = "com.neoplayer.music.PLAY_PAUSE_TOGGLE";
    public static final String ACTION_NEXT = "com.neoplayer.music.NEXT";
    public static final String ACTION_PREV = "com.neoplayer.music.PREV";
    public static final String ACTION_TOGGLE_LIKE = "com.neoplayer.music.TOGGLE_LIKE";
    public static final String ACTION_CYCLE_REPEAT = "com.neoplayer.music.CYCLE_REPEAT";
    public static final String ACTION_SYNC_CONTROLS = "com.neoplayer.music.SYNC_CONTROLS";
    public static final String ACTION_PREVIEW_LIVE_PILL = "com.neoplayer.music.PREVIEW_LIVE_PILL";

    private static final SessionCommand COMMAND_TOGGLE_LIKE =
        new SessionCommand("com.neoplayer.music.COMMAND_TOGGLE_LIKE", Bundle.EMPTY);
    private static final SessionCommand COMMAND_CYCLE_REPEAT =
        new SessionCommand("com.neoplayer.music.COMMAND_CYCLE_REPEAT", Bundle.EMPTY);

    private static final String LEGACY_LIVE_PILL_CHANNEL_ID = "neo_live_pill";
    private static final String LIVE_PILL_CHANNEL_ID = "neo_live_pill_v2";
    private static final int LIVE_PILL_NOTIFICATION_ID = 4202;
    private static final String SERVICE_PREFS = "neo_player_service_prefs";
    private static final String KEY_LIVE_PILL_ENABLED = "live_pill_enabled";

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

    private boolean currentLiked = false;
    private String currentRepeatMode = "off";
    private boolean livePillNotificationEnabled = true;
    private boolean previewPillActive = false;

    @Nullable private String currentTitle;
    @Nullable private String currentArtist;
    @Nullable private byte[] currentArtworkBytes;
    private int cachedPillArtHash = 0;
    @Nullable private Bitmap cachedPillBlurredBg;
    @Nullable private Bitmap cachedPillCover;

    @Override
    public void onCreate() {
        super.onCreate();
        SharedPreferences prefs = getSharedPreferences(SERVICE_PREFS, Context.MODE_PRIVATE);
        livePillNotificationEnabled = prefs.getBoolean(KEY_LIVE_PILL_ENABLED, true);

        DefaultMediaNotificationProvider notificationProvider =
            new DefaultMediaNotificationProvider.Builder(this).build();
        notificationProvider.setSmallIcon(R.drawable.ic_media_note);
        setMediaNotificationProvider(notificationProvider);

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
                NativeAudioPlugin.notifyPlaybackState(value, ended, positionMs, durationMs);
                syncSurfaces();
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
                    syncSurfaces();
                } else if (state == Player.STATE_READY) {
                    ended = false;
                    NativeAudioPlugin.notifyPlaybackState(player.isPlaying(), false, positionMs, durationMs);
                    syncSurfaces();
                }
            }

            @Override
            public void onMediaItemTransition(@Nullable MediaItem mediaItem, int reason) {
                captureMediaItemSnapshot(mediaItem);
                syncSurfaces();
            }

            @Override
            public void onMediaMetadataChanged(MediaMetadata mediaMetadata) {
                captureMetadataSnapshot(mediaMetadata, player.getCurrentMediaItem());
                syncSurfaces();
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
                super.play();
            }

            @Override
            public void pause() {
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
            .setCallback(new MediaSession.Callback() {
                @Override
                public MediaSession.ConnectionResult onConnect(
                    MediaSession mediaSession,
                    MediaSession.ControllerInfo controller
                ) {
                    SessionCommands sessionCommands =
                        MediaSession.ConnectionResult.DEFAULT_SESSION_COMMANDS.buildUpon()
                            .add(COMMAND_TOGGLE_LIKE)
                            .add(COMMAND_CYCLE_REPEAT)
                            .build();
                    return new MediaSession.ConnectionResult.AcceptedResultBuilder(mediaSession)
                        .setAvailableSessionCommands(sessionCommands)
                        .setCustomLayout(buildCustomLayout())
                        .build();
                }

                @Override
                public ListenableFuture<SessionResult> onCustomCommand(
                    MediaSession mediaSession,
                    MediaSession.ControllerInfo controller,
                    SessionCommand customCommand,
                    Bundle args
                ) {
                    if (COMMAND_TOGGLE_LIKE.customAction.equals(customCommand.customAction)) {
                        toggleLikeFromService();
                        return Futures.immediateFuture(new SessionResult(SessionResult.RESULT_SUCCESS));
                    }
                    if (COMMAND_CYCLE_REPEAT.customAction.equals(customCommand.customAction)) {
                        cycleRepeatFromService();
                        return Futures.immediateFuture(new SessionResult(SessionResult.RESULT_SUCCESS));
                    }
                    return MediaSession.Callback.super.onCustomCommand(mediaSession, controller, customCommand, args);
                }
            })
            .build();
    }

    private ImmutableList<CommandButton> buildCustomLayout() {
        CommandButton likeButton = new CommandButton.Builder(
                currentLiked ? CommandButton.ICON_HEART_FILLED : CommandButton.ICON_HEART_UNFILLED
            )
            .setDisplayName(currentLiked ? "Unlike" : "Like")
            .setSessionCommand(COMMAND_TOGGLE_LIKE)
            .setCustomIconResId(currentLiked ? R.drawable.ic_media_heart_filled : R.drawable.ic_media_heart_outline)
            .setEnabled(true)
            .build();

        int repeatIcon = "one".equals(currentRepeatMode)
            ? CommandButton.ICON_REPEAT_ONE
            : ("all".equals(currentRepeatMode)
                ? CommandButton.ICON_REPEAT_ALL
                : CommandButton.ICON_REPEAT_OFF);
        int repeatRes = "one".equals(currentRepeatMode)
            ? R.drawable.ic_media_repeat_one
            : ("all".equals(currentRepeatMode)
                ? R.drawable.ic_media_repeat_all
                : R.drawable.ic_media_repeat_off);
        String repeatLabel = "one".equals(currentRepeatMode)
            ? "Repeat One"
            : ("all".equals(currentRepeatMode) ? "Repeat All" : "Repeat Off");

        CommandButton repeatButton = new CommandButton.Builder(repeatIcon)
            .setDisplayName(repeatLabel)
            .setSessionCommand(COMMAND_CYCLE_REPEAT)
            .setCustomIconResId(repeatRes)
            .setEnabled(true)
            .build();

        return ImmutableList.of(likeButton, repeatButton);
    }

    private void refreshSessionCustomLayout() {
        if (session != null) {
            session.setCustomLayout(buildCustomLayout());
        }
    }

    private void toggleLikeFromService() {
        currentLiked = !currentLiked;
        refreshSessionCustomLayout();
        syncSurfaces();
        NativeAudioPlugin.notifyMediaAction("like");
    }

    private void cycleRepeatFromService() {
        currentRepeatMode = "off".equals(currentRepeatMode)
            ? "all"
            : ("all".equals(currentRepeatMode) ? "one" : "off");
        refreshSessionCustomLayout();
        syncSurfaces();
        NativeAudioPlugin.notifyMediaAction("repeat");
    }

    private void applyControlFlagsFromIntent(Intent intent) {
        boolean changed = false;
        if (intent.hasExtra("isFavourite")) {
            boolean liked = intent.getBooleanExtra("isFavourite", currentLiked);
            if (liked != currentLiked) {
                currentLiked = liked;
                changed = true;
            }
        }
        if (intent.hasExtra("repeatMode")) {
            String rep = normalizeRepeatMode(intent.getStringExtra("repeatMode"));
            if (!rep.equals(currentRepeatMode)) {
                currentRepeatMode = rep;
                changed = true;
            }
        }
        if (intent.hasExtra("livePillNotification")) {
            boolean enabled = intent.getBooleanExtra("livePillNotification", livePillNotificationEnabled);
            if (enabled != livePillNotificationEnabled) {
                livePillNotificationEnabled = enabled;
                getSharedPreferences(SERVICE_PREFS, Context.MODE_PRIVATE)
                    .edit()
                    .putBoolean(KEY_LIVE_PILL_ENABLED, enabled)
                    .apply();
                changed = true;
            }
        }
        if (changed) {
            refreshSessionCustomLayout();
            syncSurfaces();
        }
    }

    private static String normalizeRepeatMode(@Nullable String mode) {
        if ("all".equals(mode) || "one".equals(mode)) return mode;
        return "off";
    }

    private void captureMediaItemSnapshot(@Nullable MediaItem item) {
        if (item == null) {
            currentTitle = null;
            currentArtist = null;
            currentArtworkBytes = null;
            return;
        }
        captureMetadataSnapshot(item.mediaMetadata, item);
    }

    private void captureMetadataSnapshot(MediaMetadata metadata, @Nullable MediaItem item) {
        CharSequence titleSeq = metadata.title;
        CharSequence artistSeq = metadata.artist;
        currentTitle = titleSeq != null ? titleSeq.toString() : null;
        currentArtist = artistSeq != null ? artistSeq.toString() : null;

        byte[] artworkBytes = metadata.artworkData;
        if ((artworkBytes == null || artworkBytes.length == 0)
            && item != null
            && item.localConfiguration != null) {
            artworkBytes = extractEmbeddedPicture(item.localConfiguration.uri);
        }
        currentArtworkBytes = artworkBytes;
    }

    @Nullable
    private byte[] extractEmbeddedPicture(@Nullable Uri sourceUri) {
        if (sourceUri == null) return null;
        MediaMetadataRetriever retriever = new MediaMetadataRetriever();
        try {
            retriever.setDataSource(this, sourceUri);
            return retriever.getEmbeddedPicture();
        } catch (Exception ignored) {
            return null;
        } finally {
            try {
                retriever.release();
            } catch (Exception ignored) {
                // ignore
            }
        }
    }

    private void syncSurfaces() {
        boolean isPlayingNow = player != null && player.isPlaying();
        NeoPlayerWidgetProvider.saveSnapshotAndRefresh(
            this,
            currentTitle,
            currentArtist,
            isPlayingNow,
            currentLiked,
            currentRepeatMode,
            currentArtworkBytes
        );
        updateLivePillNotification(isPlayingNow);
    }

    private void updateLivePillNotification(boolean isPlayingNow) {
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;

        boolean hasActiveItem = player != null && player.getMediaItemCount() > 0;
        if (!livePillNotificationEnabled
            || (!hasActiveItem && !previewPillActive)
            || currentTitle == null
            || currentTitle.isEmpty()) {
            nm.cancel(LIVE_PILL_NOTIFICATION_ID);
            return;
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
            && ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS)
                != PackageManager.PERMISSION_GRANTED) {
            return;
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            if (nm.getNotificationChannel(LEGACY_LIVE_PILL_CHANNEL_ID) != null) {
                nm.deleteNotificationChannel(LEGACY_LIVE_PILL_CHANNEL_ID);
            }
            NotificationChannel channel = nm.getNotificationChannel(LIVE_PILL_CHANNEL_ID);
            if (channel == null) {
                channel = new NotificationChannel(
                    LIVE_PILL_CHANNEL_ID,
                    getString(R.string.notification_channel_name),
                    NotificationManager.IMPORTANCE_DEFAULT
                );
                channel.setDescription("Live album-art media pill in the phone notification center");
                channel.setSound(null, null);
                channel.enableVibration(false);
                channel.setShowBadge(false);
                channel.setLockscreenVisibility(NotificationCompat.VISIBILITY_PUBLIC);
                nm.createNotificationChannel(channel);
            }
        }

        ensurePillBitmaps();

        RemoteViews pill = new RemoteViews(getPackageName(), R.layout.notification_live_pill);
        pill.setTextViewText(R.id.pill_title, currentTitle);
        pill.setTextViewText(
            R.id.pill_subtitle,
            currentArtist != null && !currentArtist.isEmpty() ? currentArtist : getString(R.string.app_name)
        );
        pill.setImageViewResource(
            R.id.pill_btn_play_pause,
            isPlayingNow ? R.drawable.ic_media_pause : R.drawable.ic_media_play
        );
        pill.setImageViewResource(
            R.id.pill_btn_like,
            currentLiked ? R.drawable.ic_media_heart_filled : R.drawable.ic_media_heart_outline
        );
        pill.setImageViewResource(
            R.id.pill_btn_repeat,
            "one".equals(currentRepeatMode)
                ? R.drawable.ic_media_repeat_one
                : ("all".equals(currentRepeatMode) ? R.drawable.ic_media_repeat_all : R.drawable.ic_media_repeat_off)
        );

        if (cachedPillBlurredBg != null) {
            pill.setImageViewBitmap(R.id.pill_bg_art, cachedPillBlurredBg);
            pill.setViewVisibility(R.id.pill_bg_art, View.VISIBLE);
        } else {
            pill.setImageViewBitmap(R.id.pill_bg_art, null);
            pill.setViewVisibility(R.id.pill_bg_art, View.INVISIBLE);
        }

        if (cachedPillCover != null) {
            pill.setViewPadding(R.id.pill_album_art, 0, 0, 0, 0);
            pill.setImageViewBitmap(R.id.pill_album_art, cachedPillCover);
        } else {
            int pad = Math.round(9f * getResources().getDisplayMetrics().density);
            pill.setViewPadding(R.id.pill_album_art, pad, pad, pad, pad);
            pill.setImageViewResource(R.id.pill_album_art, R.drawable.ic_media_note);
        }

        pill.setOnClickPendingIntent(
            R.id.pill_btn_like,
            createWidgetBroadcastPendingIntent(NeoPlayerWidgetProvider.ACTION_WIDGET_LIKE, 201)
        );
        pill.setOnClickPendingIntent(
            R.id.pill_btn_prev,
            createWidgetBroadcastPendingIntent(NeoPlayerWidgetProvider.ACTION_WIDGET_PREV, 202)
        );
        pill.setOnClickPendingIntent(
            R.id.pill_btn_play_pause,
            createWidgetBroadcastPendingIntent(NeoPlayerWidgetProvider.ACTION_WIDGET_PLAY_PAUSE, 203)
        );
        pill.setOnClickPendingIntent(
            R.id.pill_btn_next,
            createWidgetBroadcastPendingIntent(NeoPlayerWidgetProvider.ACTION_WIDGET_NEXT, 204)
        );
        pill.setOnClickPendingIntent(
            R.id.pill_btn_repeat,
            createWidgetBroadcastPendingIntent(NeoPlayerWidgetProvider.ACTION_WIDGET_REPEAT, 205)
        );

        Intent openApp = new Intent(this, MainActivity.class);
        openApp.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT
            | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0);
        PendingIntent contentIntent = PendingIntent.getActivity(this, 200, openApp, flags);

        int accentColor = ArtworkEffects.extractAccentColor(cachedPillCover, 0xFFFF2D55);
        Bundle liveExtras = new Bundle();
        liveExtras.putBoolean("android.requestPromotedOngoing", true);

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, LIVE_PILL_CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_media_note)
            .setContentTitle(currentTitle)
            .setContentText(currentArtist)
            .setSubText(isPlayingNow ? "Playing" : "Paused")
            .setContentIntent(contentIntent)
            .setStyle(new NotificationCompat.DecoratedCustomViewStyle())
            .setCustomContentView(pill)
            .setCustomBigContentView(pill)
            .setCategory(NotificationCompat.CATEGORY_TRANSPORT)
            .setColor(accentColor)
            .setColorized(true)
            .setOngoing(isPlayingNow || previewPillActive)
            .setSilent(true)
            .setOnlyAlertOnce(true)
            .setShowWhen(false)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .addExtras(liveExtras);

        nm.notify(LIVE_PILL_NOTIFICATION_ID, builder.build());
    }

    private void ensurePillBitmaps() {
        if (currentArtworkBytes == null || currentArtworkBytes.length == 0) {
            cachedPillArtHash = 0;
            cachedPillBlurredBg = null;
            cachedPillCover = null;
            return;
        }
        int hash = Arrays.hashCode(currentArtworkBytes);
        if (hash == cachedPillArtHash && cachedPillBlurredBg != null && cachedPillCover != null) {
            return;
        }
        Bitmap decoded = ArtworkEffects.decodeSampled(currentArtworkBytes, 256);
        if (decoded == null) {
            cachedPillArtHash = 0;
            cachedPillBlurredBg = null;
            cachedPillCover = null;
            return;
        }
        float density = getResources().getDisplayMetrics().density;
        cachedPillBlurredBg = ArtworkEffects.createFrostedBackdrop(decoded, 340, 100, Math.min(56f, 28f * density), 11);
        cachedPillCover = ArtworkEffects.createRoundedCover(decoded, 112, Math.min(20f, 10f * density));
        cachedPillArtHash = hash;
        decoded.recycle();
    }

    private PendingIntent createWidgetBroadcastPendingIntent(String action, int requestCode) {
        Intent intent = new Intent(this, NeoPlayerWidgetProvider.class).setAction(action);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT
            | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0);
        return PendingIntent.getBroadcast(this, requestCode, intent, flags);
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
                previewPillActive = false;
                String raw = intent.getStringExtra("uri");
                if (raw != null && !raw.isEmpty()) {
                    ended = false;
                    Uri parsedUri = Uri.parse(raw);
                    MediaMetadata metadata = buildMetadataFromIntent(intent, parsedUri);
                    MediaItem item = new MediaItem.Builder()
                        .setUri(parsedUri)
                        .setMediaMetadata(metadata)
                        .build();

                    applyControlFlagsFromIntent(intent);
                    captureMetadataSnapshot(metadata, item);

                    player.setMediaItem(item);
                    player.prepare();
                    long pos = Math.max(0L, intent.getLongExtra("positionMs", 0L));
                    if (pos > 0L) {
                        player.seekTo(pos);
                    }
                    applyPlaybackOptionsIntent(intent);
                    boolean autoplay = intent.getBooleanExtra("autoplay", true);
                    if (autoplay) {
                        player.play();
                    } else {
                        player.pause();
                    }
                    syncSurfaces();
                }
            } else if (ACTION_PAUSE.equals(action)) {
                player.pause();
            } else if (ACTION_RESUME.equals(action)) {
                player.play();
            } else if (ACTION_PLAY_PAUSE_TOGGLE.equals(action)) {
                if (player.isPlaying()) {
                    player.pause();
                } else if (player.getMediaItemCount() > 0) {
                    player.play();
                }
            } else if (ACTION_NEXT.equals(action)) {
                NativeAudioPlugin.notifyMediaAction("next");
            } else if (ACTION_PREV.equals(action)) {
                NativeAudioPlugin.notifyMediaAction("previous");
            } else if (ACTION_TOGGLE_LIKE.equals(action)) {
                toggleLikeFromService();
            } else if (ACTION_CYCLE_REPEAT.equals(action)) {
                cycleRepeatFromService();
            } else if (ACTION_SYNC_CONTROLS.equals(action)) {
                applyControlFlagsFromIntent(intent);
            } else if (ACTION_SEEK.equals(action)) {
                ended = false;
                player.seekTo(Math.max(0L, intent.getLongExtra("positionMs", 0L)));
            } else if (ACTION_OPTIONS.equals(action)) {
                applyPlaybackOptionsIntent(intent);
                applyControlFlagsFromIntent(intent);
            } else if (ACTION_UPDATE_METADATA.equals(action)) {
                applyControlFlagsFromIntent(intent);
                MediaItem current = player.getCurrentMediaItem();
                if (current != null) {
                    Uri currentUri = current.localConfiguration != null ? current.localConfiguration.uri : null;
                    MediaMetadata metadata = buildMetadataFromIntent(intent, currentUri);
                    captureMetadataSnapshot(metadata, current);
                    player.replaceMediaItem(
                        player.getCurrentMediaItemIndex(),
                        current.buildUpon().setMediaMetadata(metadata).build()
                    );
                    syncSurfaces();
                }
            } else if (ACTION_PREVIEW_LIVE_PILL.equals(action)) {
                livePillNotificationEnabled = true;
                getSharedPreferences(SERVICE_PREFS, Context.MODE_PRIVATE)
                    .edit()
                    .putBoolean(KEY_LIVE_PILL_ENABLED, true)
                    .apply();
                applyControlFlagsFromIntent(intent);
                if (player.getMediaItemCount() == 0 || currentTitle == null || currentTitle.isEmpty()) {
                    previewPillActive = true;
                    String previewTitle = intent.getStringExtra("title");
                    String previewArtist = intent.getStringExtra("artist");
                    currentTitle = (previewTitle != null && !previewTitle.isEmpty())
                        ? previewTitle
                        : getString(R.string.app_name);
                    currentArtist = (previewArtist != null && !previewArtist.isEmpty())
                        ? previewArtist
                        : "Live Notification Pill";
                    String artworkBase64 = intent.getStringExtra("artworkBase64");
                    if (artworkBase64 != null && !artworkBase64.isEmpty()) {
                        try {
                            currentArtworkBytes = Base64.decode(artworkBase64, Base64.DEFAULT);
                        } catch (Exception ignored) { }
                    }
                    NeoPlayerWidgetProvider.saveSnapshotAndRefresh(
                        this,
                        currentTitle,
                        currentArtist,
                        intent.getBooleanExtra("isPlaying", true),
                        currentLiked,
                        currentRepeatMode,
                        currentArtworkBytes
                    );
                }
                updateLivePillNotification(
                    player.getMediaItemCount() > 0 ? player.isPlaying() : intent.getBooleanExtra("isPlaying", true)
                );
            } else if (ACTION_STOP.equals(action)) {
                playing = false;
                ended = false;
                previewPillActive = false;
                currentTitle = null;
                currentArtist = null;
                currentArtworkBytes = null;
                player.stop();
                syncSurfaces();
                stopSelf();
            }
        }
        return super.onStartCommand(intent, flags, startId);
    }

    private MediaMetadata buildMetadataFromIntent(Intent intent, @Nullable Uri sourceUri) {
        MediaMetadata.Builder builder = new MediaMetadata.Builder()
            .setTitle(intent.getStringExtra("title"))
            .setArtist(intent.getStringExtra("artist"))
            .setIsPlayable(true);

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
            artworkBytes = extractEmbeddedPicture(sourceUri);
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
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) {
            nm.cancel(LIVE_PILL_NOTIFICATION_ID);
        }
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
