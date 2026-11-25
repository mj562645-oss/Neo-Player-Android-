import React from 'react';
import { Disc3 } from 'lucide-react';
import { useArtworkUrl } from '../hooks/useDominantColor';
import { cn } from '../lib/utils';

interface AlbumArtworkProps {
  artworkId?: string;
  artworkUrl?: string;
  alt: string;
  fallbackSeed?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'fill';
  rounded?: 'md' | 'lg' | 'xl' | '2xl' | '3xl' | 'theme' | 'full';
  className?: string;
  accentColor?: string;
}

const GRADIENTS = [
  'from-rose-500/25 via-fuchsia-500/15 to-indigo-500/25',
  'from-sky-500/25 via-cyan-500/15 to-emerald-500/25',
  'from-amber-500/25 via-orange-500/15 to-rose-500/25',
  'from-violet-500/25 via-purple-500/15 to-blue-500/25',
  'from-teal-500/25 via-emerald-500/15 to-sky-500/25',
];

function pickGradient(seed?: string): string {
  if (!seed) return GRADIENTS[0];
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  return GRADIENTS[Math.abs(hash) % GRADIENTS.length];
}

function isLetterboxedYouTubeThumb(url: string | null): boolean {
  if (!url) return false;
  return /ytimg\.com\/vi\/[^/]+\/(hqdefault|sddefault|default)\.jpg/i.test(url);
}

export const AlbumArtwork: React.FC<AlbumArtworkProps> = ({
  artworkId,
  artworkUrl,
  alt,
  fallbackSeed,
  size = 'md',
  rounded = 'xl',
  className,
  accentColor,
}) => {
  const localUrl = useArtworkUrl(artworkId);
  const url = localUrl || artworkUrl || null;
  const [imgFailed, setImgFailed] = React.useState(false);

  React.useEffect(() => {
    setImgFailed(false);
  }, [url]);

  const sizeClass =
    size === 'xs'
      ? 'w-10 h-10'
      : size === 'sm'
        ? 'w-12 h-12'
        : size === 'md'
          ? 'w-16 h-16'
          : size === 'lg'
            ? 'w-32 h-32'
            : size === 'xl'
              ? 'w-64 h-64 sm:w-80 sm:h-80'
              : 'w-full h-full';

  const radiusClass =
    rounded === 'full'
      ? 'rounded-full'
      : rounded === 'theme'
        ? 'neo-artwork-radius'
        : rounded === 'md'
          ? 'rounded-lg'
          : rounded === 'lg'
            ? 'rounded-xl'
            : rounded === 'xl'
              ? 'rounded-2xl'
              : rounded === '2xl'
                ? 'rounded-3xl'
                : 'rounded-[28px]';

  const iconSize =
    size === 'xs' || size === 'sm'
      ? 'w-5 h-5'
      : size === 'md'
        ? 'w-7 h-7'
        : size === 'lg'
          ? 'w-10 h-10'
          : 'w-20 h-20';

  const cropBars = isLetterboxedYouTubeThumb(url);

  return (
    <div
      className={cn(
        'relative overflow-hidden shrink-0 select-none bg-black/[0.04] dark:bg-white/[0.06] ring-1 ring-black/8 dark:ring-white/10',
        sizeClass,
        radiusClass,
        className
      )}
    >
      {url && !imgFailed ? (
        <img
          src={url}
          alt={alt}
          referrerPolicy="no-referrer"
          onError={() => setImgFailed(true)}
          className={cn(
            'w-full h-full object-cover object-center transition-transform duration-300',
            cropBars && 'scale-[1.35]'
          )}
          loading="lazy"
        />
      ) : (
        <div
          className={cn(
            'w-full h-full flex items-center justify-center bg-gradient-to-br',
            !accentColor && pickGradient(fallbackSeed || alt)
          )}
          style={
            accentColor
              ? {
                  background: `radial-gradient(circle at 25% 25%, ${accentColor}55, transparent 65%), linear-gradient(135deg, ${accentColor}26, rgba(128,128,140,0.12))`,
                }
              : undefined
          }
        >
          <Disc3
            className={cn('text-[#111216]/35 dark:text-white/40', iconSize)}
            strokeWidth={1.5}
          />
        </div>
      )}
    </div>
  );
};
