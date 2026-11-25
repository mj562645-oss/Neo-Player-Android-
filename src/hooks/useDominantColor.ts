import { useEffect, useState } from 'react';
import { extractPaletteFromUrl, type ArtworkPalette } from '../lib/colorExtractor';
import { db } from '../services/db';

const FALLBACK_PALETTE: ArtworkPalette = {
  primary: 'rgba(255, 45, 85, 0.24)',
  secondary: 'rgba(94, 92, 230, 0.20)',
  glow: 'rgba(255, 55, 95, 0.36)',
};

export function useArtworkUrl(artworkId?: string): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (!artworkId) {
      setUrl(null);
      return;
    }
    db.getArtworkUrl(artworkId).then((resolved) => {
      if (active) setUrl(resolved);
    });
    return () => {
      active = false;
    };
  }, [artworkId]);

  return url;
}

export function useDominantColor(
  artworkId?: string,
  externalArtworkUrl?: string
): {
  artworkUrl: string | null;
  palette: ArtworkPalette;
} {
  const localUrl = useArtworkUrl(artworkId);
  const artworkUrl = localUrl || externalArtworkUrl || null;
  const [palette, setPalette] = useState<ArtworkPalette>(FALLBACK_PALETTE);

  useEffect(() => {
    let active = true;
    if (!localUrl) {
      setPalette(FALLBACK_PALETTE);
      return;
    }
    extractPaletteFromUrl(localUrl).then((res) => {
      if (active) setPalette(res);
    });
    return () => {
      active = false;
    };
  }, [localUrl]);

  return { artworkUrl, palette };
}
