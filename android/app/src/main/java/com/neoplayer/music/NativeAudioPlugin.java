package com.neoplayer.music;

import android.Manifest;
import android.content.ComponentName;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.util.Base64;
import androidx.core.content.ContextCompat;
import androidx.media3.common.MediaItem;
import androidx.media3.common.MediaMetadata;
import androidx.media3.session.MediaController;
import androidx.media3.session.SessionToken;
import com.google.common.util.concurrent.ListenableFuture;
import com.getcapacitor.*;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import com.neoplayer.music.audio.PlaybackService;
import java.io.*;

@CapacitorPlugin(
    name = "NativeAudio",
    permissions = {
        @Permission(alias = "notifications", strings = { Manifest.permission.POST_NOTIFICATIONS })
    }
)
public class NativeAudioPlugin extends Plugin {
    private static volatile NativeAudioPlugin activeInstance;
    private ListenableFuture<MediaController> controllerFuture;

    private interface ControllerAction {
        void run(MediaController controller) throws Exception;
    }

    @Override
    public void load() {
        super.load();
        activeInstance = this;
        connectController();
    }

    private synchronized ListenableFuture<MediaController> connectController() {
        if (controllerFuture != null && !controllerFuture.isCancelled()) return controllerFuture;
        SessionToken token = new SessionToken(
            getContext(), new ComponentName(getContext(), PlaybackService.class)
        );
        controllerFuture = new MediaController.Builder(getContext(), token).buildAsync();
        return controllerFuture;
    }

    private void withController(PluginCall call, ControllerAction action) {
        ListenableFuture<MediaController> future = connectController();
        future.addListener(() -> {
            try {
                action.run(future.get());
            } catch (Exception e) {
                call.reject("Native playback controller is unavailable: " + e.getMessage(), e);
            }
        }, ContextCompat.getMainExecutor(getContext()));
    }

    @Override
    protected void handleOnDestroy() {
        if (activeInstance == this) activeInstance = null;
        ListenableFuture<MediaController> future = controllerFuture;
        controllerFuture = null;
        if (future != null) {
            future.addListener(() -> {
                try { MediaController.releaseFuture(future); } catch (Exception ignored) { }
            }, ContextCompat.getMainExecutor(getContext()));
        }
        super.handleOnDestroy();
    }

    public static void notifyMediaAction(String action) {
        NativeAudioPlugin inst = activeInstance;
        if (inst == null) return;
        JSObject payload = new JSObject();
        payload.put("action", action);
        inst.notifyListeners("mediaAction", payload);
    }

    public static void notifyPlaybackState(boolean isPlaying, boolean ended, long positionMs, long durationMs) {
        NativeAudioPlugin inst = activeInstance;
        if (inst == null) return;
        JSObject payload = new JSObject();
        payload.put("isPlaying", isPlaying);
        payload.put("ended", ended);
        payload.put("positionMs", positionMs);
        payload.put("durationMs", durationMs);
        inst.notifyListeners("playbackState", payload);
    }

    @PluginMethod
    public void saveAudio(PluginCall call) {
        String data = call.getString("base64");
        String id = call.getString("trackId");
        String name = call.getString("fileName", "audio.bin");
        if (data == null || id == null) {
            call.reject("base64 and trackId are required");
            return;
        }
        getBridge().execute(() -> {
            try {
                byte[] bytes = Base64.decode(data, Base64.DEFAULT);
                File dir = new File(getContext().getFilesDir(), "neoplayer_audio");
                if (!dir.exists() && !dir.mkdirs()) throw new IOException("Cannot create audio directory");
                String safe = id.replaceAll("[^A-Za-z0-9_-]", "_");
                int dot = name.lastIndexOf('.');
                String ext = dot > 0
                    ? name.substring(dot + 1).replaceAll("[^A-Za-z0-9]", "").toLowerCase()
                    : "bin";
                File out = new File(dir, safe + "." + ext);
                File tmp = new File(dir, safe + ".tmp");
                try (FileOutputStream stream = new FileOutputStream(tmp)) {
                    stream.write(bytes);
                    stream.getFD().sync();
                }
                if (out.exists() && !out.delete()) throw new IOException("Cannot replace existing audio file");
                if (!tmp.renameTo(out)) throw new IOException("Cannot finalize audio file");
                JSObject result = new JSObject();
                result.put("uri", Uri.fromFile(out).toString());
                result.put("size", out.length());
                call.resolve(result);
            } catch (Exception e) {
                call.reject("Native audio storage failed: " + e.getMessage(), e);
            }
        });
    }

    @PluginMethod
    public void playLocal(PluginCall call) {
        String uri = call.getString("uri");
        if (uri == null) {
            call.reject("uri required");
            return;
        }
        boolean autoplay = call.getBoolean("autoplay", true);
        if (autoplay && Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            getPermissionState("notifications") != PermissionState.GRANTED) {
            requestPermissionForAlias("notifications", call, "notificationPermissionCallback");
            return;
        }
        startLocalPlayback(call, uri);
    }

    @PermissionCallback
    private void notificationPermissionCallback(PluginCall call) {
        String uri = call.getString("uri");
        if (uri == null) {
            call.reject("uri required");
            return;
        }
        startLocalPlayback(call, uri);
    }

    /** Controls the service-owned ExoPlayer. No player is created in the Capacitor plugin. */
    private void startLocalPlayback(PluginCall call, String uri) {
        withController(call, controller -> {
            try {
                MediaMetadata.Builder metadata = new MediaMetadata.Builder()
                    .setTitle(call.getString("title", "Unknown title"))
                    .setArtist(call.getString("artist", "Unknown artist"));
                String album = call.getString("album", "");
                if (album != null && !album.isEmpty()) metadata.setAlbumTitle(album);
                String artwork = call.getString("artworkBase64");
                if (artwork != null && !artwork.isEmpty()) {
                    try {
                        metadata.setArtworkData(Base64.decode(artwork, Base64.DEFAULT), MediaMetadata.PICTURE_TYPE_FRONT_COVER);
                    } catch (Exception ignored) { }
                }
                MediaItem item = new MediaItem.Builder()
                    .setUri(Uri.parse(uri))
                    .setMediaMetadata(metadata.build())
                    .build();
                controller.setMediaItem(item);
                controller.prepare();
                long positionMs = Math.max(0L, call.getLong("positionMs", 0L));
                if (positionMs > 0L) controller.seekTo(positionMs);
                applyOptions(call);
                if (call.getBoolean("autoplay", true)) controller.play(); else controller.pause();
                call.resolve();
            } catch (Exception e) {
                call.reject("Could not start native playback: " + e.getMessage(), e);
            }
        });
    }

    private void applyOptions(PluginCall call) {
        Intent i = new Intent(getContext(), PlaybackService.class).setAction(PlaybackService.ACTION_OPTIONS);
        if (call.hasOption("volume")) i.putExtra("volume", call.getFloat("volume", 0.85f));
        if (call.hasOption("muted")) i.putExtra("muted", call.getBoolean("muted", false));
        if (call.hasOption("playbackRate")) i.putExtra("playbackRate", call.getFloat("playbackRate", 1.0f));
        if (call.hasOption("pauseOnBluetoothDisconnect")) {
            i.putExtra("pauseOnBluetoothDisconnect", call.getBoolean("pauseOnBluetoothDisconnect", true));
        }
        try { getContext().startService(i); } catch (Exception ignored) { }
    }

    @PluginMethod
    public void pause(PluginCall call) {
        withController(call, controller -> { controller.pause(); call.resolve(); });
    }

    @PluginMethod
    public void resume(PluginCall call) {
        withController(call, controller -> { controller.play(); call.resolve(); });
    }

    @PluginMethod
    public void seek(PluginCall call) {
        long position = Math.max(0L, call.getLong("positionMs", 0L));
        withController(call, controller -> { controller.seekTo(position); call.resolve(); });
    }

    @PluginMethod
    public void stop(PluginCall call) {
        withController(call, controller -> {
            controller.stop();
            Intent stop = new Intent(getContext(), PlaybackService.class).setAction(PlaybackService.ACTION_STOP);
            try { getContext().startService(stop); } catch (Exception ignored) { }
            call.resolve();
        });
    }

    @PluginMethod
    public void setPlaybackOptions(PluginCall call) {
        Intent i = new Intent(getContext(), PlaybackService.class).setAction(PlaybackService.ACTION_OPTIONS);
        if (call.hasOption("volume")) i.putExtra("volume", call.getFloat("volume", 0.85f));
        if (call.hasOption("muted")) i.putExtra("muted", call.getBoolean("muted", false));
        if (call.hasOption("playbackRate")) i.putExtra("playbackRate", call.getFloat("playbackRate", 1.0f));
        if (call.hasOption("volumeNormalization")) i.putExtra("volumeNormalization", call.getBoolean("volumeNormalization", false));
        if (call.hasOption("pauseOnBluetoothDisconnect")) {
            i.putExtra("pauseOnBluetoothDisconnect", call.getBoolean("pauseOnBluetoothDisconnect", true));
        }
        if (call.hasOption("eqEnabled")) {
            i.putExtra("eqEnabled", call.getBoolean("eqEnabled", false));
            i.putExtra("eqBass", call.getFloat("eqBass", 0f));
            i.putExtra("eqMid", call.getFloat("eqMid", 0f));
            i.putExtra("eqTreble", call.getFloat("eqTreble", 0f));
        }
        try { getContext().startService(i); call.resolve(); }
        catch (Exception e) { call.reject(e.getMessage(), e); }
    }

    @PluginMethod
    public void updateMetadata(PluginCall call) {
        Intent i = new Intent(getContext(), PlaybackService.class)
            .setAction(PlaybackService.ACTION_UPDATE_METADATA)
            .putExtra("title", call.getString("title", "Unknown title"))
            .putExtra("artist", call.getString("artist", "Unknown artist"))
            .putExtra("album", call.getString("album", ""));
        String artworkBase64 = call.getString("artworkBase64");
        if (artworkBase64 != null && !artworkBase64.isEmpty()) i.putExtra("artworkBase64", artworkBase64);
        try { getContext().startService(i); call.resolve(); }
        catch (Exception e) { call.reject(e.getMessage(), e); }
    }

    @PluginMethod
    public void getStatus(PluginCall call) {
        withController(call, controller -> {
            JSObject result = new JSObject();
            result.put("isPlaying", controller.isPlaying());
            result.put("ended", PlaybackService.ended);
            result.put("positionMs", Math.max(0L, controller.getCurrentPosition()));
            result.put("durationMs", Math.max(0L, controller.getDuration()));
            call.resolve(result);
        });
    }
}
