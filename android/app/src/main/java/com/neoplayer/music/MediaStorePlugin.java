package com.neoplayer.music;

import android.app.Activity;
import android.content.ContentValues;
import android.Manifest;
import android.content.ContentResolver;
import android.content.ContentUris;
import android.content.Intent;
import android.content.IntentSender;
import android.database.Cursor;
import android.graphics.Bitmap;
import android.media.MediaMetadataRetriever;
import android.net.Uri;
import android.os.Build;
import android.provider.MediaStore;
import android.provider.OpenableColumns;
import android.util.Base64;
import android.util.Size;

import androidx.activity.result.ActivityResult;

import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import org.jaudiotagger.audio.AudioFile;
import org.jaudiotagger.audio.AudioFileIO;
import org.jaudiotagger.tag.FieldKey;
import org.jaudiotagger.tag.Tag;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

@CapacitorPlugin(
    name = "MediaStore",
    permissions = {
        @Permission(
            alias = "audio",
            strings = { Manifest.permission.READ_MEDIA_AUDIO }
        ),
        @Permission(
            alias = "storage",
            strings = { Manifest.permission.READ_EXTERNAL_STORAGE }
        )
    }
)
public class MediaStorePlugin extends Plugin {

    private static final String CACHE_SUBDIR = "neoplayer_media";
    private static final long MAX_CACHE_BYTES = 250L * 1024L * 1024L;

    private String getAudioPermissionAlias() {
        return Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU ? "audio" : "storage";
    }

    private JSObject buildPermissionResult() {
        PermissionState state = getPermissionState(getAudioPermissionAlias());
        JSObject result = new JSObject();
        result.put("granted", state == PermissionState.GRANTED);
        result.put("state", state.toString());
        return result;
    }

    @PluginMethod
    public void checkAudioPermission(PluginCall call) {
        call.resolve(buildPermissionResult());
    }

    @PluginMethod
    public void requestAudioPermission(PluginCall call) {
        String alias = getAudioPermissionAlias();
        if (getPermissionState(alias) == PermissionState.GRANTED) {
            call.resolve(buildPermissionResult());
            return;
        }
        requestPermissionForAlias(alias, call, "audioPermissionsCallback");
    }

    @PermissionCallback
    private void audioPermissionsCallback(PluginCall call) {
        call.resolve(buildPermissionResult());
    }

    @PluginMethod
    public void scanAudioTracks(PluginCall call) {
        String alias = getAudioPermissionAlias();
        if (getPermissionState(alias) != PermissionState.GRANTED) {
            call.reject("Audio library permission has not been granted.");
            return;
        }

        final long minDurationMs = call.getLong("minDurationMs", 5000L);
        final boolean includeArtwork = call.getBoolean("includeArtwork", true);

        getBridge().execute(() -> {
            try {
                ContentResolver resolver = getContext().getContentResolver();
                Map<Long, String> genreByAudioId = loadGenreMap(resolver);
                Map<Long, String> albumArtCache = new HashMap<>();
                JSArray tracksArray = new JSArray();

                List<String> projectionList = new ArrayList<>(Arrays.asList(
                    MediaStore.Audio.Media._ID,
                    MediaStore.Audio.Media.TITLE,
                    MediaStore.Audio.Media.ARTIST,
                    MediaStore.Audio.Media.ALBUM,
                    MediaStore.Audio.Media.ALBUM_ID,
                    MediaStore.Audio.Media.DURATION,
                    MediaStore.Audio.Media.TRACK,
                    MediaStore.Audio.Media.YEAR,
                    MediaStore.Audio.Media.MIME_TYPE,
                    MediaStore.Audio.Media.SIZE,
                    MediaStore.Audio.Media.DISPLAY_NAME,
                    MediaStore.Audio.Media.DATE_ADDED,
                    MediaStore.Audio.Media.DATA
                ));

                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                    projectionList.add(MediaStore.Audio.AudioColumns.ALBUM_ARTIST);
                }

                String[] projection = projectionList.toArray(new String[0]);
                String selection = MediaStore.Audio.Media.IS_MUSIC + " != 0 AND " +
                    MediaStore.Audio.Media.DURATION + " >= ?";
                String[] selectionArgs = new String[] { String.valueOf(Math.max(0L, minDurationMs)) };
                String sortOrder = MediaStore.Audio.Media.DATE_ADDED + " DESC";

                try (Cursor cursor = resolver.query(
                    MediaStore.Audio.Media.EXTERNAL_CONTENT_URI,
                    projection,
                    selection,
                    selectionArgs,
                    sortOrder
                )) {
                    if (cursor != null) {
                        int idCol = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media._ID);
                        int titleCol = cursor.getColumnIndex(MediaStore.Audio.Media.TITLE);
                        int artistCol = cursor.getColumnIndex(MediaStore.Audio.Media.ARTIST);
                        int albumCol = cursor.getColumnIndex(MediaStore.Audio.Media.ALBUM);
                        int albumIdCol = cursor.getColumnIndex(MediaStore.Audio.Media.ALBUM_ID);
                        int durationCol = cursor.getColumnIndex(MediaStore.Audio.Media.DURATION);
                        int trackCol = cursor.getColumnIndex(MediaStore.Audio.Media.TRACK);
                        int yearCol = cursor.getColumnIndex(MediaStore.Audio.Media.YEAR);
                        int mimeCol = cursor.getColumnIndex(MediaStore.Audio.Media.MIME_TYPE);
                        int sizeCol = cursor.getColumnIndex(MediaStore.Audio.Media.SIZE);
                        int nameCol = cursor.getColumnIndex(MediaStore.Audio.Media.DISPLAY_NAME);
                        int addedCol = cursor.getColumnIndex(MediaStore.Audio.Media.DATE_ADDED);
                        int dataCol = cursor.getColumnIndex(MediaStore.Audio.Media.DATA);
                        int albumArtistCol = Build.VERSION.SDK_INT >= Build.VERSION_CODES.R
                            ? cursor.getColumnIndex(MediaStore.Audio.AudioColumns.ALBUM_ARTIST)
                            : -1;

                        while (cursor.moveToNext()) {
                            long id = cursor.getLong(idCol);
                            Uri contentUri = ContentUris.withAppendedId(
                                MediaStore.Audio.Media.EXTERNAL_CONTENT_URI,
                                id
                            );

                            String fileName = safeCursorString(cursor, nameCol, "track_" + id + ".mp3");
                            String title = normalizeUnknown(safeCursorString(cursor, titleCol, ""), stripExtension(fileName));
                            String artist = normalizeUnknown(safeCursorString(cursor, artistCol, ""), "Unknown Artist");
                            String album = normalizeUnknown(safeCursorString(cursor, albumCol, ""), "Single");
                            String albumArtist = albumArtistCol >= 0
                                ? normalizeUnknown(safeCursorString(cursor, albumArtistCol, ""), artist)
                                : artist;

                            long albumId = albumIdCol >= 0 ? cursor.getLong(albumIdCol) : -1L;
                            long durationMs = durationCol >= 0 ? cursor.getLong(durationCol) : 0L;
                            int rawTrack = trackCol >= 0 ? cursor.getInt(trackCol) : 0;
                            int trackNumber = rawTrack > 0 ? (rawTrack % 1000) : 0;
                            int year = yearCol >= 0 ? cursor.getInt(yearCol) : 0;
                            String mimeType = safeCursorString(cursor, mimeCol, "audio/mpeg");
                            long fileSize = sizeCol >= 0 ? cursor.getLong(sizeCol) : 0L;
                            long addedSec = addedCol >= 0 ? cursor.getLong(addedCol) : (System.currentTimeMillis() / 1000L);
                            String filePath = safeCursorString(cursor, dataCol, "");
                            String genre = genreByAudioId.getOrDefault(id, "Unclassified");

                            JSObject item = new JSObject();
                            item.put("id", String.valueOf(id));
                            item.put("contentUri", contentUri.toString());
                            item.put("title", title);
                            item.put("artist", artist);
                            item.put("album", album);
                            item.put("albumArtist", albumArtist);
                            item.put("genre", genre);
                            if (year > 1900) item.put("year", year);
                            if (trackNumber > 0) item.put("trackNumber", trackNumber);
                            item.put("duration", durationMs / 1000.0);
                            item.put("fileName", fileName);
                            item.put("mimeType", mimeType);
                            item.put("fileSize", fileSize);
                            item.put("format", detectFormat(fileName, mimeType));
                            item.put("addedAt", addedSec * 1000L);
                            if (!filePath.isEmpty()) item.put("filePath", filePath);

                            if (includeArtwork) {
                                String artBase64 = resolveAlbumArtworkBase64(resolver, contentUri, albumId, albumArtCache);
                                if (artBase64 != null) {
                                    item.put("artworkBase64", artBase64);
                                    item.put("artworkMimeType", "image/jpeg");
                                }
                            }

                            tracksArray.put(item);
                        }
                    }
                }

                JSObject res = new JSObject();
                res.put("tracks", tracksArray);
                res.put("totalCount", tracksArray.length());
                call.resolve(res);
            } catch (Exception ex) {
                call.reject("Failed to scan Android MediaStore: " + ex.getMessage(), ex);
            }
        });
    }

    @PluginMethod
    public void pickAudioFiles(PluginCall call) {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType("audio/*");
        intent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
        intent.addFlags(
            Intent.FLAG_GRANT_READ_URI_PERMISSION |
            Intent.FLAG_GRANT_WRITE_URI_PERMISSION |
            Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION
        );
        startActivityForResult(call, intent, "audioFilesPicked");
    }

    @ActivityCallback
    private void audioFilesPicked(PluginCall call, ActivityResult result) {
        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null) {
            JSObject empty = new JSObject();
            empty.put("tracks", new JSArray());
            empty.put("totalCount", 0);
            call.resolve(empty);
            return;
        }

        Intent resultData = result.getData();
        int permissionFlags = resultData.getFlags() &
            (Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
        List<Uri> selectedUris = new ArrayList<>();
        if (resultData.getClipData() != null) {
            for (int i = 0; i < resultData.getClipData().getItemCount(); i++) {
                Uri uri = resultData.getClipData().getItemAt(i).getUri();
                if (uri != null) selectedUris.add(uri);
            }
        } else if (resultData.getData() != null) {
            selectedUris.add(resultData.getData());
        }

        getBridge().execute(() -> {
            try {
                ContentResolver resolver = getContext().getContentResolver();
                JSArray tracks = new JSArray();
                for (Uri uri : selectedUris) {
                    resolver.takePersistableUriPermission(uri, permissionFlags);
                    tracks.put(readPickedAudioMetadata(resolver, uri));
                }
                JSObject response = new JSObject();
                response.put("tracks", tracks);
                response.put("totalCount", tracks.length());
                call.resolve(response);
            } catch (Exception ex) {
                call.reject("Unable to read the selected audio files: " + ex.getMessage(), ex);
            }
        });
    }

    @PluginMethod
    public void writeTrackTags(PluginCall call) {
        String contentUri = call.getString("contentUri");
        String source = call.getString("source");
        if (contentUri == null || contentUri.isEmpty()) {
            call.reject("Missing audio file URI.");
            return;
        }
        if (!"document".equals(source) && !"mediastore".equals(source)) {
            call.reject("This audio file was not selected with writable Android access.");
            return;
        }
        if ("mediastore".equals(source)) {
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) {
                call.reject("For this Android version, re-import this track with Pick Editable Files before editing tags.");
                return;
            }
            try {
                Uri uri = Uri.parse(contentUri);
                IntentSender writeRequest = MediaStore.createWriteRequest(
                    getContext().getContentResolver(),
                    java.util.Collections.singletonList(uri)
                ).getIntentSender();
                Intent intent = new Intent(getContext(), IntentSenderActivity.class);
                intent.putExtra(IntentSenderActivity.EXTRA_INTENT_SENDER, writeRequest);
                startActivityForResult(call, intent, "mediaStoreWriteAccessGranted");
                return;
            } catch (Exception ex) {
                call.reject("Unable to request write access for this audio file: " + ex.getMessage(), ex);
                return;
            }
        }
        writeTagsForCall(call);
    }

    @ActivityCallback
    private void mediaStoreWriteAccessGranted(PluginCall call, ActivityResult result) {
        if (result.getResultCode() != Activity.RESULT_OK) {
            call.reject("Write access was not granted; the original audio file was not changed.");
            return;
        }
        writeTagsForCall(call);
    }

    private void writeTagsForCall(PluginCall call) {
        getBridge().execute(() -> {
            File originalFile = null;
            File editedFile = null;
            boolean sourceWriteAttempted = false;
            try {
                Uri uri = Uri.parse(call.getString("contentUri"));
                ContentResolver resolver = getContext().getContentResolver();
                String fileName = getDisplayName(resolver, uri);
                String extension = getExtension(fileName);
                if (!isWritableTagFormat(extension)) {
                    throw new IllegalArgumentException(
                        "Embedded tag editing is not supported for ." + extension + " files."
                    );
                }

                File tempDirectory = new File(getContext().getCacheDir(), "tag_edits");
                if (!tempDirectory.exists() && !tempDirectory.mkdirs()) {
                    throw new IllegalStateException("Unable to create a temporary tag-edit directory.");
                }
                String tempId = UUID.randomUUID().toString();
                originalFile = new File(tempDirectory, tempId + ".original." + extension);
                editedFile = new File(tempDirectory, tempId + ".edited." + extension);
                try (
                    InputStream input = resolver.openInputStream(uri);
                    FileOutputStream output = new FileOutputStream(originalFile)
                ) {
                    if (input == null) throw new IllegalStateException("Unable to open the selected audio file.");
                    byte[] buffer = new byte[32 * 1024];
                    int count;
                    while ((count = input.read(buffer)) != -1) output.write(buffer, 0, count);
                    output.getFD().sync();
                }

                copyFile(originalFile, editedFile);
                AudioFile audioFile = AudioFileIO.read(editedFile);
                Tag tag = audioFile.getTagOrCreateAndSetDefault();
                JSObject tags = call.getObject("tags");
                if (tags == null) throw new IllegalArgumentException("Missing edited tag values.");
                setTagField(tag, FieldKey.TITLE, jsonString(tags, "title"));
                setTagField(tag, FieldKey.ARTIST, jsonString(tags, "artist"));
                setTagField(tag, FieldKey.ALBUM, jsonString(tags, "album"));
                setTagField(tag, FieldKey.ALBUM_ARTIST, jsonString(tags, "albumArtist"));
                setTagField(tag, FieldKey.GENRE, jsonString(tags, "genre"));
                setTagField(tag, FieldKey.YEAR, jsonString(tags, "year"));
                setTagField(tag, FieldKey.TRACK, jsonString(tags, "trackNumber"));
                audioFile.commit();

                sourceWriteAttempted = true;
                writeFileToUri(resolver, uri, editedFile);
                if ("mediastore".equals(call.getString("source"))) {
                    updateMediaStoreMetadata(resolver, uri, tags);
                }
                sourceWriteAttempted = false;
                call.resolve();
            } catch (Exception ex) {
                if (sourceWriteAttempted && originalFile != null && originalFile.exists()) {
                    try {
                        writeFileToUri(
                            getContext().getContentResolver(),
                            Uri.parse(call.getString("contentUri")),
                            originalFile
                        );
                    } catch (Exception restoreException) {
                        ex.addSuppressed(restoreException);
                    }
                }
                call.reject("Failed to write tags to the original audio file: " + ex.getMessage(), ex);
            } finally {
                if (originalFile != null && originalFile.exists()) {
                    //noinspection ResultOfMethodCallIgnored
                    originalFile.delete();
                }
                if (editedFile != null && editedFile.exists()) {
                    //noinspection ResultOfMethodCallIgnored
                    editedFile.delete();
                }
            }
        });
    }

    private static void copyFile(File source, File destination) throws Exception {
        try (
            InputStream input = new java.io.FileInputStream(source);
            FileOutputStream output = new FileOutputStream(destination)
        ) {
            byte[] buffer = new byte[32 * 1024];
            int count;
            while ((count = input.read(buffer)) != -1) output.write(buffer, 0, count);
            output.getFD().sync();
        }
    }

    private static void writeFileToUri(ContentResolver resolver, Uri uri, File source) throws Exception {
        try (
            InputStream input = new java.io.FileInputStream(source);
            OutputStream output = resolver.openOutputStream(uri, "rwt")
        ) {
            if (output == null) throw new IllegalStateException("Unable to write the selected audio file.");
            byte[] buffer = new byte[32 * 1024];
            int count;
            while ((count = input.read(buffer)) != -1) output.write(buffer, 0, count);
            output.flush();
        }
    }

    private JSObject readPickedAudioMetadata(ContentResolver resolver, Uri uri) throws Exception {
        String fileName = getDisplayName(resolver, uri);
        String mimeType = resolver.getType(uri);
        MediaMetadataRetriever retriever = new MediaMetadataRetriever();
        try {
            retriever.setDataSource(getContext(), uri);
            String title = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_TITLE);
            String artist = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_ARTIST);
            String album = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_ALBUM);
            String albumArtist = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_ALBUMARTIST);
            String genre = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_GENRE);
            String yearValue = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_YEAR);
            String trackValue = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_CD_TRACK_NUMBER);
            String durationValue = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION);

            JSObject item = new JSObject();
            item.put("id", uri.toString());
            item.put("contentUri", uri.toString());
            item.put("title", normalizeUnknown(title, stripExtension(fileName)));
            item.put("artist", normalizeUnknown(artist, "Unknown Artist"));
            item.put("album", normalizeUnknown(album, "Single"));
            item.put("albumArtist", normalizeUnknown(albumArtist, normalizeUnknown(artist, "Unknown Artist")));
            item.put("genre", normalizeUnknown(genre, "Unclassified"));
            int year = parseLeadingNumber(yearValue);
            if (year > 1900) item.put("year", year);
            int trackNumber = parseLeadingNumber(trackValue);
            if (trackNumber > 0) item.put("trackNumber", trackNumber);
            item.put("duration", parseLeadingNumber(durationValue) / 1000.0);
            item.put("fileName", fileName);
            item.put("mimeType", mimeType == null ? "audio/mpeg" : mimeType);
            item.put("fileSize", getFileSize(resolver, uri));
            item.put("format", detectFormat(fileName, mimeType));
            item.put("addedAt", System.currentTimeMillis());
            return item;
        } finally {
            retriever.release();
        }
    }

    private static String getDisplayName(ContentResolver resolver, Uri uri) {
        try (Cursor cursor = resolver.query(
            uri,
            new String[] { OpenableColumns.DISPLAY_NAME },
            null,
            null,
            null
        )) {
            if (cursor != null && cursor.moveToFirst()) {
                int nameColumn = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME);
                if (nameColumn >= 0) {
                    String name = cursor.getString(nameColumn);
                    if (name != null && !name.trim().isEmpty()) return name;
                }
            }
        } catch (Exception ignored) {
            // Fall back to the URI path if the document provider omits display metadata.
        }
        String segment = uri.getLastPathSegment();
        return segment == null || segment.trim().isEmpty() ? "audio.mp3" : segment;
    }

    private static long getFileSize(ContentResolver resolver, Uri uri) {
        try (Cursor cursor = resolver.query(
            uri,
            new String[] { OpenableColumns.SIZE },
            null,
            null,
            null
        )) {
            if (cursor != null && cursor.moveToFirst()) {
                int sizeColumn = cursor.getColumnIndex(OpenableColumns.SIZE);
                if (sizeColumn >= 0 && !cursor.isNull(sizeColumn)) return cursor.getLong(sizeColumn);
            }
        } catch (Exception ignored) {
            // The picker provider may not expose a file size.
        }
        return 0L;
    }

    private static int parseLeadingNumber(String value) {
        if (value == null) return 0;
        String leadingNumber = value.trim().split("[/\\\\]", 2)[0].replaceAll("[^0-9].*$", "");
        try {
            return Integer.parseInt(leadingNumber);
        } catch (NumberFormatException ignored) {
            return 0;
        }
    }

    private static boolean isWritableTagFormat(String extension) {
        String ext = extension.toLowerCase(Locale.ROOT);
        return "mp3".equals(ext) || "m4a".equals(ext) || "mp4".equals(ext) ||
            "flac".equals(ext) || "ogg".equals(ext) || "wav".equals(ext);
    }

    private static void setTagField(Tag tag, FieldKey key, String value) throws Exception {
        if (value == null || value.trim().isEmpty()) {
            tag.deleteField(key);
        } else {
            tag.setField(key, value.trim());
        }
    }

    private static String jsonString(JSObject object, String key) {
        Object value = object.opt(key);
        return value == null ? null : value.toString();
    }

    private static void updateMediaStoreMetadata(ContentResolver resolver, Uri uri, JSObject tags) {
        ContentValues values = new ContentValues();
        values.put(MediaStore.Audio.Media.TITLE, jsonString(tags, "title"));
        values.put(MediaStore.Audio.Media.ARTIST, jsonString(tags, "artist"));
        values.put(MediaStore.Audio.Media.ALBUM, jsonString(tags, "album"));
        String year = jsonString(tags, "year");
        String trackNumber = jsonString(tags, "trackNumber");
        if (year == null || year.trim().isEmpty()) values.putNull(MediaStore.Audio.Media.YEAR);
        else values.put(MediaStore.Audio.Media.YEAR, parseLeadingNumber(year));
        if (trackNumber == null || trackNumber.trim().isEmpty()) values.putNull(MediaStore.Audio.Media.TRACK);
        else values.put(MediaStore.Audio.Media.TRACK, parseLeadingNumber(trackNumber));
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            values.put(MediaStore.Audio.AudioColumns.ALBUM_ARTIST, jsonString(tags, "albumArtist"));
        }
        resolver.update(uri, values, null, null);
    }

    @PluginMethod
    public void resolvePlayableFile(PluginCall call) {
        final String id = call.getString("id", "track");
        final String contentUriStr = call.getString("contentUri");
        final String fileName = call.getString("fileName", "audio.mp3");

        if (contentUriStr == null || contentUriStr.isEmpty()) {
            call.reject("Missing contentUri.");
            return;
        }

        getBridge().execute(() -> {
            try {
                Uri contentUri = Uri.parse(contentUriStr);
                ContentResolver resolver = getContext().getContentResolver();

                // 1. Try direct file path if readable by the app process
                try (Cursor c = resolver.query(
                    contentUri,
                    new String[] { MediaStore.Audio.Media.DATA },
                    null,
                    null,
                    null
                )) {
                    if (c != null && c.moveToFirst()) {
                        int dataIdx = c.getColumnIndex(MediaStore.Audio.Media.DATA);
                        if (dataIdx >= 0) {
                            String rawPath = c.getString(dataIdx);
                            if (rawPath != null && !rawPath.isEmpty()) {
                                File directFile = new File(rawPath);
                                if (directFile.exists() && directFile.canRead() && directFile.length() > 0) {
                                    JSObject out = new JSObject();
                                    out.put("filePath", directFile.getAbsolutePath());
                                    out.put("cached", false);
                                    call.resolve(out);
                                    return;
                                }
                            }
                        }
                    }
                } catch (Exception ignored) {
                    // Fall back to cache copy under scoped storage
                }

                // 2. Copy stream from MediaStore content:// URI to deterministic app cache for WebView streaming
                File cacheDir = new File(getContext().getCacheDir(), CACHE_SUBDIR);
                if (!cacheDir.exists()) {
                    //noinspection ResultOfMethodCallIgnored
                    cacheDir.mkdirs();
                }

                String ext = getExtension(fileName);
                String safeId = id.replaceAll("[^a-zA-Z0-9_-]", "_");
                File targetFile = new File(cacheDir, safeId + "." + ext);

                if (!targetFile.exists() || targetFile.length() == 0) {
                    trimCacheDirectory(cacheDir);
                    File tempFile = new File(cacheDir, safeId + "." + ext + ".tmp");
                    try (
                        InputStream in = resolver.openInputStream(contentUri);
                        FileOutputStream out = new FileOutputStream(tempFile)
                    ) {
                        if (in == null) {
                            call.reject("Unable to open audio stream from MediaStore.");
                            return;
                        }
                        byte[] buf = new byte[16 * 1024];
                        int read;
                        while ((read = in.read(buf)) != -1) {
                            out.write(buf, 0, read);
                        }
                        out.flush();
                    }
                    if (!tempFile.renameTo(targetFile)) {
                        //noinspection ResultOfMethodCallIgnored
                        tempFile.delete();
                        call.reject("Failed to finalize cached audio stream.");
                        return;
                    }
                } else {
                    // Touch lastModified to maintain LRU order
                    //noinspection ResultOfMethodCallIgnored
                    targetFile.setLastModified(System.currentTimeMillis());
                }

                JSObject out = new JSObject();
                out.put("filePath", targetFile.getAbsolutePath());
                out.put("cached", true);
                call.resolve(out);
            } catch (Exception ex) {
                call.reject("Failed to resolve playable MediaStore track: " + ex.getMessage(), ex);
            }
        });
    }

    @PluginMethod
    public void clearMediaCache(PluginCall call) {
        getBridge().execute(() -> {
            File cacheDir = new File(getContext().getCacheDir(), CACHE_SUBDIR);
            long clearedBytes = 0L;
            if (cacheDir.exists() && cacheDir.isDirectory()) {
                File[] files = cacheDir.listFiles();
                if (files != null) {
                    for (File file : files) {
                        clearedBytes += file.length();
                        //noinspection ResultOfMethodCallIgnored
                        file.delete();
                    }
                }
            }
            JSObject out = new JSObject();
            out.put("clearedBytes", clearedBytes);
            call.resolve(out);
        });
    }

    private void trimCacheDirectory(File cacheDir) {
        File[] files = cacheDir.listFiles();
        if (files == null || files.length == 0) return;

        long totalBytes = 0L;
        for (File f : files) totalBytes += f.length();
        if (totalBytes <= MAX_CACHE_BYTES) return;

        Arrays.sort(files, Comparator.comparingLong(File::lastModified));
        for (File f : files) {
            if (totalBytes <= MAX_CACHE_BYTES * 0.75) break;
            long len = f.length();
            if (f.delete()) {
                totalBytes -= len;
            }
        }
    }

    private Map<Long, String> loadGenreMap(ContentResolver resolver) {
        Map<Long, String> map = new HashMap<>();
        try (Cursor genreCursor = resolver.query(
            MediaStore.Audio.Genres.EXTERNAL_CONTENT_URI,
            new String[] { MediaStore.Audio.Genres._ID, MediaStore.Audio.Genres.NAME },
            null,
            null,
            null
        )) {
            if (genreCursor == null) return map;
            int idCol = genreCursor.getColumnIndex(MediaStore.Audio.Genres._ID);
            int nameCol = genreCursor.getColumnIndex(MediaStore.Audio.Genres.NAME);
            while (genreCursor.moveToNext()) {
                long genreId = idCol >= 0 ? genreCursor.getLong(idCol) : -1L;
                String genreName = nameCol >= 0 ? genreCursor.getString(nameCol) : null;
                if (genreId < 0 || genreName == null || genreName.trim().isEmpty()) continue;

                Uri membersUri = MediaStore.Audio.Genres.Members.getContentUri("external", genreId);
                try (Cursor memberCursor = resolver.query(
                    membersUri,
                    new String[] { MediaStore.Audio.Genres.Members.AUDIO_ID },
                    null,
                    null,
                    null
                )) {
                    if (memberCursor != null) {
                        int audioIdCol = memberCursor.getColumnIndex(MediaStore.Audio.Genres.Members.AUDIO_ID);
                        while (memberCursor.moveToNext()) {
                            if (audioIdCol >= 0) {
                                long audioId = memberCursor.getLong(audioIdCol);
                                map.putIfAbsent(audioId, genreName.trim());
                            }
                        }
                    }
                } catch (Exception ignored) {
                    // Ignore restricted genre member queries
                }
            }
        } catch (Exception ignored) {
            // Ignore genre query issues on older ROMs
        }
        return map;
    }

    private String resolveAlbumArtworkBase64(
        ContentResolver resolver,
        Uri trackUri,
        long albumId,
        Map<Long, String> albumArtCache
    ) {
        if (albumId > 0 && albumArtCache.containsKey(albumId)) {
            return albumArtCache.get(albumId);
        }

        String encoded = null;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            try {
                Bitmap thumb = resolver.loadThumbnail(trackUri, new Size(512, 512), null);
                if (thumb != null) {
                    ByteArrayOutputStream baos = new ByteArrayOutputStream();
                    thumb.compress(Bitmap.CompressFormat.JPEG, 82, baos);
                    thumb.recycle();
                    encoded = Base64.encodeToString(baos.toByteArray(), Base64.NO_WRAP);
                }
            } catch (Exception ignored) {
                // Fall back to embedded picture below
            }
        }

        if (encoded == null) {
            MediaMetadataRetriever retriever = new MediaMetadataRetriever();
            try {
                retriever.setDataSource(getContext(), trackUri);
                byte[] picture = retriever.getEmbeddedPicture();
                if (picture != null && picture.length > 0) {
                    encoded = Base64.encodeToString(picture, Base64.NO_WRAP);
                }
            } catch (Exception ignored) {
                // No embedded art
            } finally {
                try {
                    retriever.release();
                } catch (Exception ignored) {
                    // Ignore release failure
                }
            }
        }

        if (albumId > 0) {
            albumArtCache.put(albumId, encoded);
        }
        return encoded;
    }

    private static String safeCursorString(Cursor cursor, int colIndex, String fallback) {
        if (colIndex < 0) return fallback;
        String val = cursor.getString(colIndex);
        return (val == null || val.trim().isEmpty()) ? fallback : val.trim();
    }

    private static String normalizeUnknown(String value, String fallback) {
        if (value == null || value.trim().isEmpty() || "<unknown>".equalsIgnoreCase(value.trim())) {
            return fallback;
        }
        return value.trim();
    }

    private static String stripExtension(String fileName) {
        int idx = fileName.lastIndexOf('.');
        return idx > 0 ? fileName.substring(0, idx) : fileName;
    }

    private static String getExtension(String fileName) {
        int idx = fileName.lastIndexOf('.');
        if (idx > 0 && idx < fileName.length() - 1) {
            String ext = fileName.substring(idx + 1).toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]", "");
            if (!ext.isEmpty()) return ext;
        }
        return "mp3";
    }

    private static String detectFormat(String fileName, String mimeType) {
        String ext = getExtension(fileName).toUpperCase(Locale.ROOT);
        if (!ext.isEmpty() && !"MP3".equals(ext)) return ext;
        if (mimeType != null) {
            String lower = mimeType.toLowerCase(Locale.ROOT);
            if (lower.contains("flac")) return "FLAC";
            if (lower.contains("mp4") || lower.contains("m4a")) return "M4A";
            if (lower.contains("aac")) return "AAC";
            if (lower.contains("ogg") || lower.contains("opus")) return "OGG";
            if (lower.contains("wav")) return "WAV";
        }
        return "MP3";
    }
}
