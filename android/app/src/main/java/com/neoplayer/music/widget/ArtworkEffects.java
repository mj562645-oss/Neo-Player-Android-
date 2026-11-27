package com.neoplayer.music.widget;

import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.BitmapShader;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Matrix;
import android.graphics.Paint;
import android.graphics.RectF;
import android.graphics.Shader;
import androidx.annotation.Nullable;

/**
 * Lightweight bitmap decoding, frosted StackBlur, and rounded clipping helpers
 * sized conservatively to keep RemoteViews Binder payloads fast and well under 1 MB.
 */
public final class ArtworkEffects {

    private ArtworkEffects() {}

    @Nullable
    public static Bitmap decodeSampled(@Nullable byte[] data, int maxDim) {
        if (data == null || data.length == 0) return null;
        try {
            BitmapFactory.Options bounds = new BitmapFactory.Options();
            bounds.inJustDecodeBounds = true;
            BitmapFactory.decodeByteArray(data, 0, data.length, bounds);
            if (bounds.outWidth <= 0 || bounds.outHeight <= 0) return null;

            int inSampleSize = 1;
            int maxSide = Math.max(bounds.outWidth, bounds.outHeight);
            while (maxSide / (inSampleSize * 2) >= maxDim) {
                inSampleSize *= 2;
            }

            BitmapFactory.Options opts = new BitmapFactory.Options();
            opts.inSampleSize = inSampleSize;
            opts.inPreferredConfig = Bitmap.Config.ARGB_8888;
            return BitmapFactory.decodeByteArray(data, 0, data.length, opts);
        } catch (Throwable ignored) {
            return null;
        }
    }

    @Nullable
    public static Bitmap decodeSampledFile(@Nullable String path, int maxDim) {
        if (path == null || path.isEmpty()) return null;
        try {
            BitmapFactory.Options bounds = new BitmapFactory.Options();
            bounds.inJustDecodeBounds = true;
            BitmapFactory.decodeFile(path, bounds);
            if (bounds.outWidth <= 0 || bounds.outHeight <= 0) return null;

            int inSampleSize = 1;
            int maxSide = Math.max(bounds.outWidth, bounds.outHeight);
            while (maxSide / (inSampleSize * 2) >= maxDim) {
                inSampleSize *= 2;
            }

            BitmapFactory.Options opts = new BitmapFactory.Options();
            opts.inSampleSize = inSampleSize;
            opts.inPreferredConfig = Bitmap.Config.ARGB_8888;
            return BitmapFactory.decodeFile(path, opts);
        } catch (Throwable ignored) {
            return null;
        }
    }

    @Nullable
    public static Bitmap createFrostedBackdrop(
        @Nullable Bitmap source,
        int outWidth,
        int outHeight,
        float cornerRadiusPx,
        int blurRadius
    ) {
        if (source == null || outWidth <= 0 || outHeight <= 0) return null;
        try {
            int workW = Math.max(48, Math.min(120, outWidth / 2));
            int workH = Math.max(24, Math.min(60, outHeight / 2));
            Bitmap cropped = centerCrop(source, workW, workH);
            if (cropped == null) return null;

            Bitmap blurred = fastBoxBlur(cropped, Math.max(3, Math.min(18, blurRadius)));
            if (cropped != source && cropped != blurred) {
                cropped.recycle();
            }
            if (blurred == null) return null;

            Bitmap out = Bitmap.createBitmap(outWidth, outHeight, Bitmap.Config.ARGB_8888);
            Canvas canvas = new Canvas(out);
            Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG | Paint.FILTER_BITMAP_FLAG);
            BitmapShader shader = new BitmapShader(blurred, Shader.TileMode.CLAMP, Shader.TileMode.CLAMP);
            Matrix matrix = new Matrix();
            matrix.setScale((float) outWidth / blurred.getWidth(), (float) outHeight / blurred.getHeight());
            shader.setLocalMatrix(matrix);
            paint.setShader(shader);

            RectF rect = new RectF(0f, 0f, outWidth, outHeight);
            canvas.drawRoundRect(rect, cornerRadiusPx, cornerRadiusPx, paint);

            if (blurred != source) {
                blurred.recycle();
            }
            return out;
        } catch (Throwable ignored) {
            return null;
        }
    }

    @Nullable
    public static Bitmap createRoundedCover(@Nullable Bitmap source, int sizePx, float cornerRadiusPx) {
        if (source == null || sizePx <= 0) return null;
        try {
            Bitmap square = centerCrop(source, sizePx, sizePx);
            if (square == null) return null;

            Bitmap out = Bitmap.createBitmap(sizePx, sizePx, Bitmap.Config.ARGB_8888);
            Canvas canvas = new Canvas(out);
            Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG | Paint.FILTER_BITMAP_FLAG);
            paint.setShader(new BitmapShader(square, Shader.TileMode.CLAMP, Shader.TileMode.CLAMP));
            canvas.drawRoundRect(new RectF(0f, 0f, sizePx, sizePx), cornerRadiusPx, cornerRadiusPx, paint);
            if (square != source) {
                square.recycle();
            }
            return out;
        } catch (Throwable ignored) {
            return null;
        }
    }

    /** Samples an artwork bitmap to compute a vivid dark-safe accent tint for Android media/pill notifications. */
    public static int extractAccentColor(@Nullable Bitmap source, int fallbackColor) {
        if (source == null || source.getWidth() <= 0 || source.getHeight() <= 0) {
            return fallbackColor;
        }
        try {
            Bitmap tiny = Bitmap.createScaledBitmap(source, 16, 16, true);
            int w = tiny.getWidth();
            int h = tiny.getHeight();
            long rSum = 0;
            long gSum = 0;
            long bSum = 0;
            int count = 0;
            for (int y = 0; y < h; y++) {
                for (int x = 0; x < w; x++) {
                    int pixel = tiny.getPixel(x, y);
                    int alpha = Color.alpha(pixel);
                    if (alpha < 128) continue;
                    int r = Color.red(pixel);
                    int g = Color.green(pixel);
                    int b = Color.blue(pixel);
                    int max = Math.max(r, Math.max(g, b));
                    int min = Math.min(r, Math.min(g, b));
                    int weight = (max - min) > 24 ? 3 : 1;
                    rSum += (long) r * weight;
                    gSum += (long) g * weight;
                    bSum += (long) b * weight;
                    count += weight;
                }
            }
            if (tiny != source) {
                tiny.recycle();
            }
            if (count == 0) return fallbackColor;
            int avgColor = Color.rgb(
                (int) Math.min(255, rSum / count),
                (int) Math.min(255, gSum / count),
                (int) Math.min(255, bSum / count)
            );
            float[] hsv = new float[3];
            Color.colorToHSV(avgColor, hsv);
            hsv[1] = Math.max(hsv[1], 0.45f);
            hsv[2] = Math.max(0.42f, Math.min(0.86f, hsv[2]));
            return Color.HSVToColor(hsv);
        } catch (Throwable ignored) {
            return fallbackColor;
        }
    }

    @Nullable
    private static Bitmap centerCrop(Bitmap src, int targetW, int targetH) {
        int srcW = src.getWidth();
        int srcH = src.getHeight();
        if (srcW <= 0 || srcH <= 0) return null;

        float scale = Math.max((float) targetW / srcW, (float) targetH / srcH);
        float scaledW = srcW * scale;
        float scaledH = srcH * scale;
        float dx = (targetW - scaledW) * 0.5f;
        float dy = (targetH - scaledH) * 0.5f;

        Bitmap out = Bitmap.createBitmap(targetW, targetH, Bitmap.Config.ARGB_8888);
        Canvas canvas = new Canvas(out);
        Matrix matrix = new Matrix();
        matrix.postScale(scale, scale);
        matrix.postTranslate(dx, dy);
        Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG | Paint.FILTER_BITMAP_FLAG);
        canvas.drawBitmap(src, matrix, paint);
        return out;
    }

    /** Two-pass separable box blur approximating a rich Gaussian frosted blur in ~1ms. */
    @Nullable
    private static Bitmap fastBoxBlur(Bitmap src, int radius) {
        int w = src.getWidth();
        int h = src.getHeight();
        if (w <= 1 || h <= 1) return src;

        int[] pix = new int[w * h];
        int[] temp = new int[w * h];
        src.getPixels(pix, 0, w, 0, 0, w, h);

        for (int pass = 0; pass < 2; pass++) {
            // Horizontal pass
            for (int y = 0; y < h; y++) {
                int row = y * w;
                for (int x = 0; x < w; x++) {
                    int rSum = 0, gSum = 0, bSum = 0, aSum = 0, count = 0;
                    int minX = Math.max(0, x - radius);
                    int maxX = Math.min(w - 1, x + radius);
                    for (int kx = minX; kx <= maxX; kx++) {
                        int c = pix[row + kx];
                        aSum += (c >>> 24) & 0xFF;
                        rSum += (c >>> 16) & 0xFF;
                        gSum += (c >>> 8) & 0xFF;
                        bSum += c & 0xFF;
                        count++;
                    }
                    temp[row + x] = ((aSum / count) << 24)
                        | ((rSum / count) << 16)
                        | ((gSum / count) << 8)
                        | (bSum / count);
                }
            }
            // Vertical pass
            for (int x = 0; x < w; x++) {
                for (int y = 0; y < h; y++) {
                    int rSum = 0, gSum = 0, bSum = 0, aSum = 0, count = 0;
                    int minY = Math.max(0, y - radius);
                    int maxY = Math.min(h - 1, y + radius);
                    for (int ky = minY; ky <= maxY; ky++) {
                        int c = temp[ky * w + x];
                        aSum += (c >>> 24) & 0xFF;
                        rSum += (c >>> 16) & 0xFF;
                        gSum += (c >>> 8) & 0xFF;
                        bSum += c & 0xFF;
                        count++;
                    }
                    pix[y * w + x] = ((aSum / count) << 24)
                        | ((rSum / count) << 16)
                        | ((gSum / count) << 8)
                        | (bSum / count);
                }
            }
        }

        Bitmap out = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888);
        out.setPixels(pix, 0, w, 0, 0, w, h);
        return out;
    }
}
