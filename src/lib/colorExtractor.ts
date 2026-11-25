export interface ArtworkPalette {
  primary: string;
  secondary: string;
  glow: string;
}

const DEFAULT_PALETTE: ArtworkPalette = {
  primary: 'rgba(255, 45, 85, 0.28)',
  secondary: 'rgba(94, 92, 230, 0.24)',
  glow: 'rgba(255, 55, 95, 0.42)',
};

export async function extractPaletteFromUrl(imageUrl: string | null): Promise<ArtworkPalette> {
  if (!imageUrl || typeof document === 'undefined') return DEFAULT_PALETTE;

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const size = 24;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(DEFAULT_PALETTE);
          return;
        }
        ctx.drawImage(img, 0, 0, size, size);
        const data = ctx.getImageData(0, 0, size, size).data;

        let r1 = 0, g1 = 0, b1 = 0, c1 = 0;
        let r2 = 0, g2 = 0, b2 = 0, c2 = 0;

        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const max = Math.max(r, g, b);
          const min = Math.min(r, g, b);
          const sat = max === 0 ? 0 : (max - min) / max;
          const lum = (r + g + b) / 3;

          if (lum > 25 && lum < 235) {
            if (sat > 0.28) {
              r1 += r;
              g1 += g;
              b1 += b;
              c1++;
            } else {
              r2 += r;
              g2 += g;
              b2 += b;
              c2++;
            }
          }
        }

        const p = c1 > 4
          ? [Math.round(r1 / c1), Math.round(g1 / c1), Math.round(b1 / c1)]
          : c2 > 0
            ? [Math.round(r2 / c2), Math.round(g2 / c2), Math.round(b2 / c2)]
            : [255, 45, 85];

        const s = c2 > 4
          ? [Math.round(r2 / c2), Math.round(g2 / c2), Math.round(b2 / c2)]
          : [Math.max(0, p[0] - 40), Math.min(255, p[1] + 20), Math.min(255, p[2] + 60)];

        resolve({
          primary: `rgba(${p[0]}, ${p[1]}, ${p[2]}, 0.38)`,
          secondary: `rgba(${s[0]}, ${s[1]}, ${s[2]}, 0.28)`,
          glow: `rgba(${p[0]}, ${p[1]}, ${p[2]}, 0.55)`,
        });
      } catch {
        resolve(DEFAULT_PALETTE);
      }
    };
    img.onerror = () => resolve(DEFAULT_PALETTE);
    img.src = imageUrl;
  });
}
