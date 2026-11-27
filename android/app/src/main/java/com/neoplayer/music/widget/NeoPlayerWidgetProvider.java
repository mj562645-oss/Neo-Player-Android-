package com.neoplayer.music.widget;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.os.Build;
import android.view.View;
import android.widget.RemoteViews;
import androidx.annotation.Nullable;
import com.neoplayer.music.MainActivity;
import com.neoplayer.music.R;
import com.neoplayer.music.audio.PlaybackService;
import java.io.File;
import java.io.FileOutputStream;
import java.util.Arrays;

/**
 * 4x1 frosted blur home screen widget driven entirely by PlaybackService's single ExoPlayer state.
 * Renders a rounded frosted-blurred album art backdrop with Like, Repeat, and transport controls.
 */
public class NeoPlayerWidgetProvider extends AppWidgetProvider {

    public static final String ACTION_WIDGET_PLAY_PAUSE = "com.neoplayer.music.widget.PLAY_PAUSE";
    public static final String ACTION_WIDGET_NEXT = "com.neoplayer.music.widget.NEXT";
    public static final String ACTION_WIDGET_PREV = "com.neoplayer.music.widget.PREV";
    public static final String ACTION_WIDGET_LIKE = "com.neoplayer.music.widget.LIKE";
    public static final String ACTION_WIDGET_REPEAT = "com.neoplayer.music.widget.REPEAT";

    private static final String PREFS_NAME = "neo_player_widget_state";
    private static final String KEY_TITLE = "title";
    private static final String KEY_ARTIST = "artist";
    private static final String KEY_PLAYING = "is_playing";
    private static final String KEY_LIKED = "is_liked";
    private static final String KEY_REPEAT = "repeat_mode";
    private static final String KEY_ARTWORK_PATH = "artwork_path";
    private static final String KEY_ARTWORK_HASH = "artwork_hash";

    private static volatile int cachedArtHash = 0;
    private static volatile Bitmap cachedBlurredBackdrop = null;
    private static volatile Bitmap cachedRoundedThumb = null;

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int widgetId : appWidgetIds) {
            RemoteViews views = buildRemoteViews(context);
            appWidgetManager.updateAppWidget(widgetId, views);
        }
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        super.onReceive(context, intent);
        if (intent == null || intent.getAction() == null) return;
        String action = intent.getAction();

        if (ACTION_WIDGET_PLAY_PAUSE.equals(action)) {
            if (PlaybackService.activePlayer != null) {
                dispatchToRunningService(context, PlaybackService.ACTION_PLAY_PAUSE_TOGGLE);
            } else {
                launchMainActivity(context);
            }
        } else if (ACTION_WIDGET_NEXT.equals(action)) {
            if (PlaybackService.activePlayer != null) {
                dispatchToRunningService(context, PlaybackService.ACTION_NEXT);
            } else {
                launchMainActivity(context);
            }
        } else if (ACTION_WIDGET_PREV.equals(action)) {
            if (PlaybackService.activePlayer != null) {
                dispatchToRunningService(context, PlaybackService.ACTION_PREV);
            } else {
                launchMainActivity(context);
            }
        } else if (ACTION_WIDGET_LIKE.equals(action)) {
            SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            boolean nextLiked = !prefs.getBoolean(KEY_LIKED, false);
            prefs.edit().putBoolean(KEY_LIKED, nextLiked).apply();
            updateAllWidgets(context);
            if (PlaybackService.activePlayer != null) {
                dispatchToRunningService(context, PlaybackService.ACTION_TOGGLE_LIKE);
            }
        } else if (ACTION_WIDGET_REPEAT.equals(action)) {
            SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            String cur = prefs.getString(KEY_REPEAT, "off");
            String nextRepeat = "off".equals(cur) ? "all" : ("all".equals(cur) ? "one" : "off");
            prefs.edit().putString(KEY_REPEAT, nextRepeat).apply();
            updateAllWidgets(context);
            if (PlaybackService.activePlayer != null) {
                dispatchToRunningService(context, PlaybackService.ACTION_CYCLE_REPEAT);
            }
        }
    }

    public static void saveSnapshotAndRefresh(
        Context context,
        @Nullable String title,
        @Nullable String artist,
        boolean isPlaying,
        boolean isLiked,
        @Nullable String repeatMode,
        @Nullable byte[] artworkBytes
    ) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        SharedPreferences.Editor editor = prefs.edit();
        editor.putString(KEY_TITLE, title != null && !title.isEmpty() ? title : context.getString(R.string.app_name));
        editor.putString(KEY_ARTIST, artist != null && !artist.isEmpty() ? artist : context.getString(R.string.widget_idle_subtitle));
        editor.putBoolean(KEY_PLAYING, isPlaying);
        editor.putBoolean(KEY_LIKED, isLiked);
        editor.putString(KEY_REPEAT, normalizeRepeat(repeatMode));

        if (artworkBytes != null && artworkBytes.length > 0) {
            int hash = Arrays.hashCode(artworkBytes);
            int prevHash = prefs.getInt(KEY_ARTWORK_HASH, 0);
            File artFile = new File(context.getCacheDir(), "neo_widget_artwork.jpg");
            if (hash != prevHash || !artFile.exists()) {
                try (FileOutputStream fos = new FileOutputStream(artFile)) {
                    fos.write(artworkBytes);
                    fos.getFD().sync();
                } catch (Exception ignored) { }
                editor.putInt(KEY_ARTWORK_HASH, hash);
                editor.putString(KEY_ARTWORK_PATH, artFile.getAbsolutePath());
                prepareArtworkBitmaps(context, artworkBytes, hash);
            }
        } else {
            editor.remove(KEY_ARTWORK_PATH);
            editor.putInt(KEY_ARTWORK_HASH, 0);
            cachedArtHash = 0;
            cachedBlurredBackdrop = null;
            cachedRoundedThumb = null;
        }
        editor.apply();
        updateAllWidgets(context);
    }

    public static void updateAllWidgets(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        if (manager == null) return;
        ComponentName component = new ComponentName(context, NeoPlayerWidgetProvider.class);
        int[] ids = manager.getAppWidgetIds(component);
        if (ids == null || ids.length == 0) return;
        RemoteViews views = buildRemoteViews(context);
        manager.updateAppWidget(ids, views);
    }

    private static RemoteViews buildRemoteViews(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        String title = prefs.getString(KEY_TITLE, context.getString(R.string.app_name));
        String artist = prefs.getString(KEY_ARTIST, context.getString(R.string.widget_idle_subtitle));
        boolean isPlaying = prefs.getBoolean(KEY_PLAYING, false);
        boolean isLiked = prefs.getBoolean(KEY_LIKED, false);
        String repeatMode = normalizeRepeat(prefs.getString(KEY_REPEAT, "off"));
        int artHash = prefs.getInt(KEY_ARTWORK_HASH, 0);
        String artPath = prefs.getString(KEY_ARTWORK_PATH, null);

        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_neo_player_4x1);
        views.setTextViewText(R.id.widget_title, title);
        views.setTextViewText(R.id.widget_artist, artist);
        views.setImageViewResource(
            R.id.widget_btn_play_pause,
            isPlaying ? R.drawable.ic_media_pause : R.drawable.ic_media_play
        );
        views.setImageViewResource(
            R.id.widget_btn_like,
            isLiked ? R.drawable.ic_media_heart_filled : R.drawable.ic_media_heart_outline
        );
        views.setImageViewResource(
            R.id.widget_btn_repeat,
            "one".equals(repeatMode)
                ? R.drawable.ic_media_repeat_one
                : ("all".equals(repeatMode) ? R.drawable.ic_media_repeat_all : R.drawable.ic_media_repeat_off)
        );

        ensureArtworkBitmapsLoaded(context, artPath, artHash);
        if (cachedBlurredBackdrop != null) {
            views.setImageViewBitmap(R.id.widget_bg_art, cachedBlurredBackdrop);
            views.setViewVisibility(R.id.widget_bg_art, View.VISIBLE);
        } else {
            views.setImageViewBitmap(R.id.widget_bg_art, null);
            views.setViewVisibility(R.id.widget_bg_art, View.INVISIBLE);
        }

        if (cachedRoundedThumb != null) {
            views.setViewPadding(R.id.widget_album_art, 0, 0, 0, 0);
            views.setImageViewBitmap(R.id.widget_album_art, cachedRoundedThumb);
        } else {
            int pad = Math.round(10f * context.getResources().getDisplayMetrics().density);
            views.setViewPadding(R.id.widget_album_art, pad, pad, pad, pad);
            views.setImageViewResource(R.id.widget_album_art, R.drawable.ic_media_note);
        }

        views.setOnClickPendingIntent(R.id.widget_info_container, createOpenAppPendingIntent(context));
        views.setOnClickPendingIntent(R.id.widget_btn_play_pause, createBroadcastPendingIntent(context, ACTION_WIDGET_PLAY_PAUSE, 101));
        views.setOnClickPendingIntent(R.id.widget_btn_next, createBroadcastPendingIntent(context, ACTION_WIDGET_NEXT, 102));
        views.setOnClickPendingIntent(R.id.widget_btn_prev, createBroadcastPendingIntent(context, ACTION_WIDGET_PREV, 103));
        views.setOnClickPendingIntent(R.id.widget_btn_like, createBroadcastPendingIntent(context, ACTION_WIDGET_LIKE, 104));
        views.setOnClickPendingIntent(R.id.widget_btn_repeat, createBroadcastPendingIntent(context, ACTION_WIDGET_REPEAT, 105));
        return views;
    }

    private static synchronized void prepareArtworkBitmaps(Context context, byte[] artworkBytes, int hash) {
        if (hash != 0 && hash == cachedArtHash && cachedBlurredBackdrop != null && cachedRoundedThumb != null) {
            return;
        }
        Bitmap decoded = ArtworkEffects.decodeSampled(artworkBytes, 256);
        applyDecodedBitmaps(context, decoded, hash);
    }

    private static synchronized void ensureArtworkBitmapsLoaded(
        Context context,
        @Nullable String artPath,
        int hash
    ) {
        if (hash == 0 || artPath == null) return;
        if (hash == cachedArtHash && cachedBlurredBackdrop != null && cachedRoundedThumb != null) return;
        Bitmap decoded = ArtworkEffects.decodeSampledFile(artPath, 256);
        applyDecodedBitmaps(context, decoded, hash);
    }

    private static void applyDecodedBitmaps(Context context, @Nullable Bitmap decoded, int hash) {
        if (decoded == null) {
            cachedArtHash = 0;
            cachedBlurredBackdrop = null;
            cachedRoundedThumb = null;
            return;
        }
        float density = context.getResources().getDisplayMetrics().density;
        float bgCorner = Math.min(48f, 24f * density);
        float thumbCorner = Math.min(24f, 12f * density);
        cachedBlurredBackdrop = ArtworkEffects.createFrostedBackdrop(decoded, 320, 108, bgCorner, 10);
        cachedRoundedThumb = ArtworkEffects.createRoundedCover(decoded, 128, thumbCorner);
        cachedArtHash = hash;
        decoded.recycle();
    }

    private static String normalizeRepeat(@Nullable String mode) {
        if ("all".equals(mode) || "one".equals(mode)) return mode;
        return "off";
    }

    private static PendingIntent createBroadcastPendingIntent(Context context, String action, int requestCode) {
        Intent intent = new Intent(context, NeoPlayerWidgetProvider.class).setAction(action);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT
            | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0);
        return PendingIntent.getBroadcast(context, requestCode, intent, flags);
    }

    private static PendingIntent createOpenAppPendingIntent(Context context) {
        Intent intent = new Intent(context, MainActivity.class);
        intent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_NEW_TASK);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT
            | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0);
        return PendingIntent.getActivity(context, 100, intent, flags);
    }

    private static void dispatchToRunningService(Context context, String action) {
        Intent serviceIntent = new Intent(context, PlaybackService.class).setAction(action);
        try {
            context.startService(serviceIntent);
        } catch (Exception ignored) { }
    }

    private static void launchMainActivity(Context context) {
        Intent launch = new Intent(context, MainActivity.class);
        launch.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        try {
            context.startActivity(launch);
        } catch (Exception ignored) { }
    }
}
