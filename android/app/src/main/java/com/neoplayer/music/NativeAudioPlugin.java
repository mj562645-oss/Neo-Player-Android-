package com.neoplayer.music;

import android.Manifest;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.util.Base64;
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

    @Override
    public void load() {
        super.load();
        activeInstance = this;
    }

    @Override
    protected void handleOnDestroy() {
        if (activeInstance == this) {
            activeInstance = null;
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
                if (!dir.exists() && !dir.mkdirs()) {
                    throw new IOException("Cannot create audio directory");
                }
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
                if (out.exists() && !out.delete()) {
                    throw new IOException("Cannot replace existing audio file");
                }
                if (!tmp.renameTo(out)) {
                    throw new IOException("Cannot finalize audio file");
                }
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
        if (autoplay &&
            Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
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

    private void startLocalPlayback(PluginCall call, String uri) {
        boolean autoplay = call.getBoolean("autoplay", true);
        Intent i = new Intent(getContext(), PlaybackService.class)
            .setAction(PlaybackService.ACTION_PLAY)
            .putExtra("uri", uri)
            .putExtra("title", call.getString("title", "Unknown title"))
            .putExtra("artist", call.getString("artist", "Unknown artist"))
            .putExtra("album", call.getString("album", ""))
            .putExtra("positionMs", call.getLong("positionMs", 0L))
            .putExtra("autoplay", autoplay);

        String artworkBase64 = call.getString("artworkBase64");
        if (artworkBase64 != null && !artworkBase64.isEmpty()) {
            i.putExtra("artworkBase64", artworkBase64);
        }
        if (call.hasOption("volume")) {
            i.putExtra("volume", call.getFloat("volume", 0.85f));
        }
        if (call.hasOption("muted")) {
            i.putExtra("muted", call.getBoolean("muted", false));
        }
        if (call.hasOption("playbackRate")) {
            i.putExtra("playbackRate", call.getFloat("playbackRate", 1.0f));
        }
        if (call.hasOption("pauseOnBluetoothDisconnect")) {
            i.putExtra("pauseOnBluetoothDisconnect", call.getBoolean("pauseOnBluetoothDisconnect", true));
        }

        try {
            if (autoplay) {
                androidx.core.content.ContextCompat.startForegroundService(getContext(), i);
            } else {
                getContext().startService(i);
            }
            call.resolve();
        } catch (Exception e) {
            call.reject("Could not start playback service: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void pause(PluginCall call) {
        command(PlaybackService.ACTION_PAUSE, 0, call);
    }

    @PluginMethod
    public void resume(PluginCall call) {
        Intent i = new Intent(getContext(), PlaybackService.class).setAction(PlaybackService.ACTION_RESUME);
        try {
            androidx.core.content.ContextCompat.startForegroundService(getContext(), i);
            call.resolve();
        } catch (Exception e) {
            call.reject(e.getMessage(), e);
        }
    }

    @PluginMethod
    public void seek(PluginCall call) {
        command(PlaybackService.ACTION_SEEK, call.getLong("positionMs", 0L), call);
    }

    @PluginMethod
    public void stop(PluginCall call) {
        command(PlaybackService.ACTION_STOP, 0, call);
    }

    @PluginMethod
    public void setPlaybackOptions(PluginCall call) {
        Intent i = new Intent(getContext(), PlaybackService.class).setAction(PlaybackService.ACTION_OPTIONS);
        if (call.hasOption("volume")) i.putExtra("volume", call.getFloat("volume", 0.85f));
        if (call.hasOption("muted")) i.putExtra("muted", call.getBoolean("muted", false));
        if (call.hasOption("playbackRate")) i.putExtra("playbackRate", call.getFloat("playbackRate", 1.0f));
        if (call.hasOption("volumeNormalization")) {
            i.putExtra("volumeNormalization", call.getBoolean("volumeNormalization", false));
        }
        if (call.hasOption("pauseOnBluetoothDisconnect")) {
            i.putExtra("pauseOnBluetoothDisconnect", call.getBoolean("pauseOnBluetoothDisconnect", true));
        }
        if (call.hasOption("eqEnabled")) {
            i.putExtra("eqEnabled", call.getBoolean("eqEnabled", false));
            i.putExtra("eqBass", call.getFloat("eqBass", 0f));
            i.putExtra("eqMid", call.getFloat("eqMid", 0f));
            i.putExtra("eqTreble", call.getFloat("eqTreble", 0f));
        }
        try {
            getContext().startService(i);
            call.resolve();
        } catch (Exception e) {
            call.reject(e.getMessage(), e);
        }
    }

    @PluginMethod
    public void updateMetadata(PluginCall call) {
        Intent i = new Intent(getContext(), PlaybackService.class)
            .setAction(PlaybackService.ACTION_UPDATE_METADATA)
            .putExtra("title", call.getString("title", "Unknown title"))
            .putExtra("artist", call.getString("artist", "Unknown artist"))
            .putExtra("album", call.getString("album", ""));
        String artworkBase64 = call.getString("artworkBase64");
        if (artworkBase64 != null && !artworkBase64.isEmpty()) {
            i.putExtra("artworkBase64", artworkBase64);
        }
        try {
            getContext().startService(i);
            call.resolve();
        } catch (Exception e) {
            call.reject(e.getMessage(), e);
        }
    }

    private void command(String action, long pos, PluginCall call) {
        try {
            Intent i = new Intent(getContext(), PlaybackService.class)
                .setAction(action)
                .putExtra("positionMs", pos);
            getContext().startService(i);
            call.resolve();
        } catch (Exception e) {
            call.reject(e.getMessage(), e);
        }
    }

    @PluginMethod
    public void getStatus(PluginCall call) {
        JSObject o = new JSObject();
        o.put("isPlaying", PlaybackService.playing);
        o.put("ended", PlaybackService.ended);
        o.put(
            "positionMs",
            PlaybackService.activePlayer == null
                ? 0
                : Math.max(0, PlaybackService.activePlayer.getCurrentPosition())
        );
        o.put(
            "durationMs",
            PlaybackService.activePlayer == null
                ? 0
                : Math.max(0, PlaybackService.activePlayer.getDuration())
        );
        call.resolve(o);
    }
}
