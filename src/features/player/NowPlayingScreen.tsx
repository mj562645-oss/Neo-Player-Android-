import React, { useState } from 'react';
import {
  ArrowDown,
  AudioLines,
  Check,
  ChevronDown,
  Clock,
  CloudDownload,
  Edit3,
  ExternalLink,
  Gauge,
  Heart,
  Image as ImageIcon,
  ListEnd,
  ListMusic,
  ListPlus,
  MessageSquareQuote,
  MoreHorizontal,
  MoreVertical,
  Plus,
  Quote,
  Repeat,
  Repeat1,
  Share2,
  Shuffle,
  SlidersHorizontal,
  Sparkles,
  UserCheck,
  UserPlus,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useLibrary } from '../../app/LibraryContext';
import { usePlayer, type SleepTimerMode } from '../../app/PlayerContext';
import { useTheme } from '../../app/ThemeContext';
import { useToast } from '../../app/ToastContext';
import { useArtworkUrl, useDominantColor } from '../../hooks/useDominantColor';
import { formatTime } from '../../lib/format';
import { normalizeUiThemeId, resolveActivePalette } from '../../lib/palettes';
import { cn } from '../../lib/utils';
import { AlbumArtwork } from '../../components/AlbumArtwork';
import { EqualizerPanel } from '../../components/EqualizerPanel';
import { LyricsViewer } from '../../components/LyricsViewer';
import { PlaybackControls } from '../../components/PlaybackControls';
import { ProgressSlider } from '../../components/ProgressSlider';
import { GlassModal } from '../../components/glass/GlassModal';
import { GlassShaderCanvas } from '../../components/glass/GlassShaderCanvas';
import { ProgressiveBlur } from '../../components/glass/ProgressiveBlur';
import { Slider } from '../../components/ui/slider';
import { Switch } from '../../components/ui/switch';
import { TrackMetadataModal } from '../library/TrackMetadataModal';

const PLAYBACK_SPEEDS = [0.75, 1, 1.15, 1.25, 1.5, 2] as const;
const SLEEP_PRESETS: Array<{ mode: SleepTimerMode; label: string }> = [
  { mode: 'off', label: 'Off' },
  { mode: 15, label: '15 min' },
  { mode: 30, label: '30 min' },
  { mode: 45, label: '45 min' },
  { mode: 60, label: '60 min' },
  { mode: 'end_of_track', label: 'End of Track' },
];

export const NowPlayingScreen: React.FC = () => {
  const { playlists, addTracksToPlaylist, downloadLyricsForTrack, enrichTrack } = useLibrary();
  const {
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    shuffle,
    repeat,
    nowPlayingOpen,
    setNowPlayingOpen,
    setQueueOpen,
    togglePlay,
    nextTrack,
    prevTrack,
    seek,
    toggleShuffle,
    cycleRepeat,
    toggleTrackLike,
    playNextInQueue,
    addToQueue,
    sleepTimerMode,
    sleepRemainingSeconds,
    setSleepTimer,
  } = usePlayer();
  const { settings, resolvedTheme, updateSettings, updatePersonalization, isArtistFollowed, toggleFollowArtist } = useTheme();
  const { showToast } = useToast();
  const { artworkUrl: dominantArtUrl, palette } = useDominantColor(
    currentTrack?.artworkId,
    currentTrack?.artworkUrl
  );
  const artworkUrl = useArtworkUrl(currentTrack?.artworkId) || currentTrack?.artworkUrl || null;
  const bgArtworkUrl = artworkUrl || dominantArtUrl || null;
  const p = settings.personalization;
  const uiTheme = normalizeUiThemeId(p.uiTheme);
  const activePalette = resolveActivePalette(p);
  const showArtworkBg = p.nowPlayingArtworkBackground ?? true;
  const isYtLetterbox = Boolean(
    bgArtworkUrl && /ytimg\.com\/vi\/[^/]+\/(hqdefault|sddefault|default)\.jpg/i.test(bgArtworkUrl)
  );

  const [showLyrics, setShowLyrics] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [eqOpen, setEqOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [isEnrichingTrack, setIsEnrichingTrack] = useState(false);
  const [isFetchingLyrics, setIsFetchingLyrics] = useState(false);

  if (!currentTrack) return null;

  const isLocalTrack = currentTrack.source !== 'youtube';
  const followed = isArtistFollowed(currentTrack.artist);
  const hasActiveExtras = sleepTimerMode !== 'off' || settings.playbackRate !== 1;
  const isLossless = /^(flac|alac|wav|aiff|dsd|pcm)$/i.test(currentTrack.format || '');

  const sleepStatusLabel =
    sleepTimerMode === 'end_of_track'
      ? 'Stops after this track'
      : typeof sleepTimerMode === 'number' && sleepRemainingSeconds !== null
        ? `Sleep in ${formatTime(sleepRemainingSeconds)}`
        : null;

  const handleFollowToggle = async () => {
    const nowFollowed = await toggleFollowArtist(currentTrack.artist);
    showToast(
      nowFollowed
        ? `Following ${currentTrack.artist}`
        : `Unfollowed ${currentTrack.artist}`,
      nowFollowed ? 'success' : 'info'
    );
  };

  const handleShareTrack = async () => {
    const shareText = `${currentTrack.title} — ${currentTrack.artist}`;
    const ytUrl = currentTrack.youtubeVideoId
      ? `https://www.youtube.com/watch?v=${currentTrack.youtubeVideoId}`
      : undefined;

    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: currentTrack.title,
          text: shareText,
          ...(ytUrl ? { url: ytUrl } : {}),
        });
        return;
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return;
      }
    }

    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(ytUrl ? `${shareText}\n${ytUrl}` : shareText);
        showToast('Copied track details to clipboard', 'success');
        return;
      } catch {
        // fallback below
      }
    }
    showToast(shareText, 'info');
  };

  const handleFetchLyrics = async () => {
    setIsFetchingLyrics(true);
    try {
      await downloadLyricsForTrack(currentTrack.id, undefined, { track: currentTrack });
      setMoreOpen(false);
      setShowLyrics(true);
    } finally {
      setIsFetchingLyrics(false);
    }
  };

  const handleAutoEnrich = async () => {
    if (!isLocalTrack) return;
    setIsEnrichingTrack(true);
    try {
      await enrichTrack(currentTrack.id);
    } finally {
      setIsEnrichingTrack(false);
    }
  };

  return (
    <AnimatePresence>
      {nowPlayingOpen && (
        <motion.div
          initial={settings.reducedMotion ? { opacity: 1 } : { opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={settings.reducedMotion ? { opacity: 0 } : { opacity: 0, y: 24 }}
          transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
          role="dialog"
          aria-modal="true"
          aria-label="Now Playing"
          className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-[var(--neo-app-bg)] text-[#111216] dark:text-[#F5F5F7]"
        >
          {/* GPU Glassmorphic Fluid Shader Stage */}
          <GlassShaderCanvas
            primaryColor={showArtworkBg ? palette.primary : activePalette.accent}
            secondaryColor={showArtworkBg ? palette.secondary : activePalette.secondary}
            isDark={resolvedTheme === 'dark'}
            variant={uiTheme}
            intensity={showArtworkBg ? 1.15 : 0.85}
            paused={settings.reducedMotion}
            className="absolute inset-0 w-full h-full"
          />

          {/* Full-Bleed Drifting Album Art Layer */}
          {showArtworkBg && bgArtworkUrl && (
            <AnimatePresence mode="sync">
              <motion.img
                key={bgArtworkUrl}
                src={bgArtworkUrl}
                alt=""
                aria-hidden="true"
                referrerPolicy="no-referrer"
                initial={settings.reducedMotion ? { opacity: 1 } : { opacity: 0 }}
                animate={{
                  opacity:
                    resolvedTheme === 'dark'
                      ? uiTheme === 'editorial'
                        ? showLyrics
                          ? 0.36
                          : 0.48
                        : uiTheme === 'material'
                          ? showLyrics
                            ? 0.54
                            : 0.72
                          : p.glassStyle === 'solid'
                            ? 0.28
                            : showLyrics
                              ? 0.52
                              : 0.76
                      : uiTheme === 'editorial'
                        ? showLyrics
                          ? 0.24
                          : 0.36
                        : uiTheme === 'material'
                          ? showLyrics
                            ? 0.38
                            : 0.54
                          : p.glassStyle === 'solid'
                            ? 0.24
                            : showLyrics
                              ? 0.44
                              : 0.64,
                }}
                exit={settings.reducedMotion ? { opacity: 0 } : { opacity: 0 }}
                transition={{ duration: 0.55, ease: 'easeOut' }}
                className={cn(
                  'neo-np-artwork-bg pointer-events-none absolute inset-0 w-full h-full object-cover object-center',
                  isYtLetterbox ? 'scale-[1.36]' : 'scale-110'
                )}
              />
            </AnimatePresence>
          )}

          {/* Theme-Specific Diffusion & System Light/Dark Scrim */}
          <div
            aria-hidden="true"
            className="neo-artwork-backdrop-blur pointer-events-none absolute inset-0 transition-all duration-300"
            style={(() => {
              const isDark = resolvedTheme === 'dark';
              const baseBlur = Math.max(12, Math.min(44, p.glassBlur ?? 28));

              if (!showArtworkBg) {
                return {
                  backgroundColor: isDark
                    ? uiTheme === 'editorial'
                      ? 'rgba(11, 11, 14, 0.58)'
                      : 'rgba(12, 13, 18, 0.56)'
                    : uiTheme === 'editorial'
                      ? 'rgba(250, 248, 244, 0.66)'
                      : 'rgba(247, 247, 250, 0.64)',
                  backdropFilter: `blur(${Math.round(baseBlur * 0.7)}px) saturate(145%)`,
                  WebkitBackdropFilter: `blur(${Math.round(baseBlur * 0.7)}px) saturate(145%)`,
                };
              }

              const backdropBlur =
                uiTheme === 'editorial'
                  ? 42
                  : uiTheme === 'material'
                    ? 54
                    : p.glassStyle === 'solid'
                      ? 16
                      : p.glassStyle === 'clear'
                        ? Math.round(baseBlur * 0.65)
                        : Math.round(baseBlur * 0.95);

              const saturate =
                uiTheme === 'editorial'
                  ? '138%'
                  : uiTheme === 'material'
                    ? '165%'
                    : '180%';

              let bgOverlay: string;
              if (uiTheme === 'editorial') {
                bgOverlay = isDark
                  ? showLyrics
                    ? 'rgba(11, 11, 13, 0.66)'
                    : 'rgba(11, 11, 13, 0.48)'
                  : showLyrics
                    ? 'rgba(250, 248, 244, 0.74)'
                    : 'rgba(250, 248, 244, 0.58)';
              } else if (uiTheme === 'material') {
                bgOverlay = isDark
                  ? showLyrics
                    ? 'rgba(15, 16, 21, 0.54)'
                    : 'rgba(15, 14, 18, 0.34)'
                  : showLyrics
                    ? 'rgba(246, 248, 253, 0.62)'
                    : 'rgba(246, 248, 253, 0.44)';
              } else if (p.glassStyle === 'clear') {
                bgOverlay = isDark
                  ? showLyrics
                    ? 'rgba(9, 10, 14, 0.52)'
                    : 'rgba(9, 10, 14, 0.30)'
                  : showLyrics
                    ? 'rgba(248, 248, 252, 0.58)'
                    : 'rgba(248, 248, 252, 0.38)';
              } else if (p.glassStyle === 'tinted') {
                bgOverlay = isDark
                  ? showLyrics
                    ? 'rgba(12, 13, 20, 0.60)'
                    : 'rgba(12, 13, 20, 0.42)'
                  : showLyrics
                    ? 'rgba(246, 245, 252, 0.66)'
                    : 'rgba(246, 245, 252, 0.48)';
              } else if (p.glassStyle === 'solid') {
                bgOverlay = isDark
                  ? showLyrics
                    ? 'rgba(10, 11, 15, 0.82)'
                    : 'rgba(10, 11, 15, 0.72)'
                  : showLyrics
                    ? 'rgba(247, 247, 250, 0.84)'
                    : 'rgba(247, 247, 250, 0.74)';
              } else {
                bgOverlay = isDark
                  ? showLyrics
                    ? 'rgba(9, 10, 14, 0.56)'
                    : 'rgba(9, 10, 14, 0.38)'
                  : showLyrics
                    ? 'rgba(248, 249, 252, 0.64)'
                    : 'rgba(248, 249, 252, 0.46)';
              }

              return {
                backgroundColor: bgOverlay,
                backdropFilter: `blur(${backdropBlur}px) saturate(${saturate})`,
                WebkitBackdropFilter: `blur(${backdropBlur}px) saturate(${saturate})`,
              };
            })()}
          />

          {/* Contrast Readability Gradient (guarantees AA contrast across bright & dark album covers) */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                resolvedTheme === 'dark'
                  ? 'linear-gradient(180deg, rgba(8,9,13,0.34) 0%, rgba(8,9,13,0.08) 38%, rgba(8,9,13,0.62) 100%)'
                  : 'linear-gradient(180deg, rgba(248,249,253,0.44) 0%, rgba(248,249,253,0.14) 38%, rgba(248,249,253,0.70) 100%)',
            }}
          />

          {/* Top & Bottom Progressive Blur Curtains inside Now Playing Stage (disabled for Material 3) */}
          {uiTheme !== 'material' && (
            <>
              <ProgressiveBlur position="top" className="absolute left-0 right-0 top-0 h-24 z-[4]" maxBlurPx={18} />
              <ProgressiveBlur position="bottom" className="absolute left-0 right-0 bottom-0 h-32 z-[4]" maxBlurPx={22} />
            </>
          )}

          {/* Top Bar */}
          <header className="relative z-10 flex items-center justify-between px-5 sm:px-8 pt-4 sm:pt-6 pb-2 pt-safe shrink-0">
            <button
              type="button"
              onClick={() => setNowPlayingOpen(false)}
              aria-label="Minimize Now Playing"
              className={cn(
                'min-h-[44px] min-w-[44px] flex items-center justify-center transition-all cursor-pointer',
                uiTheme === 'material'
                  ? 'rounded-full m3-tonal-circle'
                  : cn(
                      'liquid-glass-subtle hover:brightness-105',
                      uiTheme === 'editorial' ? 'neo-btn-radius' : 'rounded-full'
                    )
              )}
            >
              {uiTheme === 'material' ? (
                <ArrowDown className="w-5 h-5" />
              ) : (
                <ChevronDown className="w-5 h-5" />
              )}
            </button>

            <div className="text-center min-w-0 px-4">
              <p
                className={cn(
                  'text-xs font-semibold truncate',
                  uiTheme === 'material'
                    ? 'text-[#24242A] dark:text-white/90 text-[13px] font-medium tracking-wide'
                    : 'text-[#3A3A40] dark:text-[#D1D1D6]',
                  uiTheme === 'editorial' && 'font-display italic text-sm tracking-tight'
                )}
              >
                {showLyrics
                  ? 'Synchronized Lyrics'
                  : uiTheme === 'material'
                    ? 'Now Playing'
                    : currentTrack.album}
              </p>
              {sleepStatusLabel && (
                <p className="text-[11px] font-mono-tabular text-[var(--neo-accent)] truncate mt-0.5">
                  {sleepStatusLabel}
                </p>
              )}
            </div>

            {uiTheme === 'material' ? (
              <button
                type="button"
                onClick={() => void toggleTrackLike(currentTrack)}
                aria-label={currentTrack.isFavourite ? 'Unlike track' : 'Like track'}
                className={cn(
                  'min-h-[44px] min-w-[44px] rounded-full m3-tonal-circle flex items-center justify-center active:scale-90 transition-all cursor-pointer',
                  currentTrack.isFavourite && 'text-[#FF2D55] dark:text-[#FF375F]'
                )}
              >
                <Heart
                  className="w-5 h-5"
                  fill={currentTrack.isFavourite ? 'currentColor' : 'none'}
                />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setMoreOpen(true)}
                aria-label="More playback and track options"
                className={cn(
                  'min-h-[44px] min-w-[44px] liquid-glass-subtle flex items-center justify-center hover:brightness-105 transition-colors cursor-pointer relative',
                  uiTheme === 'editorial' ? 'neo-btn-radius' : 'rounded-full',
                  hasActiveExtras && 'text-[var(--neo-accent)]'
                )}
              >
                <MoreHorizontal className="w-5 h-5" />
              </button>
            )}
          </header>

          {/* Main Stage: Toggle between Immersive Center Stage and Split/Overlay Lyrics Stage */}
          <AnimatePresence mode="wait">
            {showLyrics ? (
              <motion.div
                key="lyrics-overlay"
                initial={settings.reducedMotion ? { opacity: 1 } : { opacity: 0, scale: 0.985 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={settings.reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.985 }}
                transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                className="relative z-10 flex-1 min-h-0 flex flex-col lg:grid lg:grid-cols-12 lg:items-center max-w-3xl lg:max-w-6xl w-full mx-auto px-4 sm:px-8 pb-4 sm:pb-6 gap-4 lg:gap-10"
              >
                {/* Left / Top Track Column (Mobile compact header + Desktop full hero artwork & controls) */}
                <div className="lg:col-span-5 flex flex-col justify-center gap-4 lg:gap-5 shrink-0">
                  {/* Mobile Compact Track Header */}
                  <div className="lg:hidden liquid-glass neo-card-radius p-3 sm:px-4 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <AlbumArtwork
                        artworkId={currentTrack.artworkId}
                        artworkUrl={currentTrack.artworkUrl}
                        alt={currentTrack.title}
                        fallbackSeed={`${currentTrack.album}-${currentTrack.artist}`}
                        size="sm"
                        rounded="xl"
                      />
                      <div className="min-w-0">
                        <h2 className="text-sm sm:text-base font-bold tracking-tight font-display truncate">
                          {currentTrack.title}
                        </h2>
                        <p className="text-xs text-[#6E6E73] dark:text-[#AEAEB2] truncate">
                          {currentTrack.artist} · {currentTrack.album}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => void toggleTrackLike(currentTrack)}
                        aria-label={
                          currentTrack.isFavourite ? 'Remove from favourites' : 'Add to favourites'
                        }
                        className={cn(
                          'min-h-[40px] min-w-[40px] rounded-xl liquid-glass-subtle flex items-center justify-center active:scale-90 transition-all cursor-pointer',
                          currentTrack.isFavourite
                            ? 'text-[#FF2D55] dark:text-[#FF375F]'
                            : 'text-[#6E6E73] dark:text-[#AEAEB2]'
                        )}
                      >
                        <Heart
                          className="w-4 h-4"
                          fill={currentTrack.isFavourite ? 'currentColor' : 'none'}
                        />
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowLyrics(false)}
                        aria-label="Close lyrics overlay"
                        className="min-h-[40px] px-3 rounded-xl liquid-glass-subtle flex items-center gap-1.5 text-xs font-medium text-[#111216] dark:text-[#F5F5F7] hover:brightness-105 cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Desktop Immersive Split Artwork & Controls */}
                  <div className="hidden lg:flex flex-col gap-5 w-full max-w-md mx-auto">
                    <motion.div
                      key={`${currentTrack.id}-split`}
                      animate={{ scale: isPlaying ? 1 : 0.96 }}
                      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                      className={cn(
                        'w-[min(26vw,310px)] aspect-square relative overflow-hidden mx-auto',
                        p.artworkStyle === 'vinyl'
                          ? 'rounded-full p-4 bg-[#14151A] ring-4 ring-white/15'
                          : 'neo-artwork-radius'
                      )}
                      style={{
                        boxShadow: isPlaying
                          ? `0 28px 64px -18px ${palette.glow}`
                          : '0 16px 36px -14px rgba(0,0,0,0.28)',
                      }}
                    >
                      <AlbumArtwork
                        artworkId={currentTrack.artworkId}
                        artworkUrl={currentTrack.artworkUrl}
                        alt={`${currentTrack.title} album art`}
                        fallbackSeed={`${currentTrack.album}-${currentTrack.artist}`}
                        size="fill"
                        rounded={p.artworkStyle === 'vinyl' ? 'full' : 'theme'}
                        className={cn(
                          'w-full h-full',
                          p.artworkStyle === 'vinyl' &&
                            !settings.reducedMotion &&
                            (isPlaying ? 'animate-vinyl-spin' : 'animate-vinyl-paused')
                        )}
                      />
                    </motion.div>

                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <h2 className="neo-np-title text-2xl font-bold tracking-tight font-display truncate">
                          {currentTrack.title}
                        </h2>
                        <p className="text-sm text-[#3A3A40] dark:text-[#C7C7CC] truncate mt-1">
                          {currentTrack.artist} · {currentTrack.format}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => void toggleTrackLike(currentTrack)}
                          aria-label={currentTrack.isFavourite ? 'Unlike track' : 'Like track'}
                          className={cn(
                            'min-h-[42px] min-w-[42px] rounded-full liquid-glass-subtle flex items-center justify-center transition-all cursor-pointer',
                            currentTrack.isFavourite
                              ? 'text-[#FF2D55] dark:text-[#FF375F]'
                              : 'text-[#6E6E73] dark:text-[#AEAEB2]'
                          )}
                        >
                          <Heart
                            className="w-4 h-4"
                            fill={currentTrack.isFavourite ? 'currentColor' : 'none'}
                          />
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowLyrics(false)}
                          aria-label="Hide lyrics"
                          className="min-h-[42px] px-3.5 rounded-full liquid-glass-subtle flex items-center gap-1.5 text-xs font-semibold hover:brightness-105 cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                          <span>Hide Lyrics</span>
                        </button>
                      </div>
                    </div>

                    <ProgressSlider
                      currentTime={currentTime}
                      duration={duration || currentTrack.duration}
                      onSeek={seek}
                      showRemaining={settings.showRemainingTime}
                      onToggleRemaining={() =>
                        void updateSettings({ showRemainingTime: !settings.showRemainingTime })
                      }
                    />

                    <PlaybackControls
                      isPlaying={isPlaying}
                      shuffle={shuffle}
                      repeat={repeat}
                      uiTheme={uiTheme}
                      onTogglePlay={() => void togglePlay()}
                      onPrev={() => void prevTrack()}
                      onNext={() => void nextTrack()}
                      onToggleShuffle={toggleShuffle}
                      onCycleRepeat={cycleRepeat}
                    />
                  </div>
                </div>

                {/* Translucent Synced Lyrics Overlay Stage (Single shared instance across Mobile & Desktop) */}
                <div className="lg:col-span-7 flex-1 min-h-0 h-full lg:max-h-[76vh] liquid-glass neo-card-radius p-4 sm:p-6 flex flex-col overflow-hidden">
                  <LyricsViewer track={currentTrack} compact overlay autoFetchOnEmpty />
                </div>

                {/* Mobile Docked Playback Scrubber & Controls */}
                <div className="lg:hidden liquid-glass neo-card-radius px-4 py-3 sm:px-6 sm:py-4 space-y-2.5 shrink-0 pb-safe">
                  <ProgressSlider
                    currentTime={currentTime}
                    duration={duration || currentTrack.duration}
                    onSeek={seek}
                    showRemaining={settings.showRemainingTime}
                    onToggleRemaining={() =>
                      void updateSettings({ showRemainingTime: !settings.showRemainingTime })
                    }
                  />
                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => setEqOpen(true)}
                      aria-label="Audio Equalizer"
                      className={cn(
                        'min-h-[40px] min-w-[40px] rounded-xl flex items-center justify-center transition-colors cursor-pointer',
                        settings.equalizer.enabled
                          ? 'text-[var(--neo-accent)] bg-[var(--neo-accent-soft)]'
                          : 'text-[#6E6E73] dark:text-[#AEAEB2] hover:bg-black/5 dark:hover:bg-white/10'
                      )}
                    >
                      <SlidersHorizontal className="w-4 h-4" />
                    </button>

                    <div className="flex-1">
                      <PlaybackControls
                        size="md"
                        isPlaying={isPlaying}
                        shuffle={shuffle}
                        repeat={repeat}
                        uiTheme={uiTheme}
                        onTogglePlay={() => void togglePlay()}
                        onPrev={() => void prevTrack()}
                        onNext={() => void nextTrack()}
                        onToggleShuffle={toggleShuffle}
                        onCycleRepeat={cycleRepeat}
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => setQueueOpen(true)}
                      aria-label="Playing Queue"
                      className="min-h-[40px] min-w-[40px] rounded-xl flex items-center justify-center text-[#6E6E73] dark:text-[#AEAEB2] hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
                    >
                      <ListMusic className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="artwork-stage"
                initial={settings.reducedMotion ? { opacity: 1 } : { opacity: 0, scale: 0.985 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={settings.reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.985 }}
                transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                className="relative z-10 flex-1 overflow-y-auto px-6 sm:px-10 py-3 sm:py-4 flex items-center justify-center"
              >
                {uiTheme === 'material' ? (
                  <div className="w-full max-w-md mx-auto flex flex-col items-center gap-5">
                    {/* Material UI Signature Feathered Bottom Artwork */}
                    <motion.div
                      key={currentTrack.id}
                      initial={settings.reducedMotion ? false : { scale: 0.96, opacity: 0.85 }}
                      animate={{
                        scale: isPlaying ? 1 : 0.95,
                        opacity: 1,
                      }}
                      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                      className={cn(
                        'w-[min(84vw,375px)] sm:w-[390px] aspect-square relative overflow-hidden shrink-0',
                        p.artworkStyle === 'vinyl'
                          ? 'rounded-full p-5 bg-[#14151A] ring-4 ring-white/15'
                          : 'rounded-[28px] m3-artwork-melt'
                      )}
                    >
                      {p.artworkStyle === 'vinyl' ? (
                        <div
                          className={cn(
                            'w-full h-full rounded-full overflow-hidden relative ring-2 ring-white/15',
                            !settings.reducedMotion &&
                              (isPlaying ? 'animate-vinyl-spin' : 'animate-vinyl-paused')
                          )}
                        >
                          <AlbumArtwork
                            artworkId={currentTrack.artworkId}
                            artworkUrl={currentTrack.artworkUrl}
                            alt={`${currentTrack.title} vinyl art`}
                            fallbackSeed={`${currentTrack.album}-${currentTrack.artist}`}
                            size="fill"
                            rounded="full"
                            className="w-full h-full"
                          />
                          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <div className="w-10 h-10 rounded-full bg-[#14151A] ring-2 ring-white/30" />
                          </div>
                        </div>
                      ) : (
                        <AlbumArtwork
                          artworkId={currentTrack.artworkId}
                          artworkUrl={currentTrack.artworkUrl}
                          alt={`${currentTrack.title} album art`}
                          fallbackSeed={`${currentTrack.album}-${currentTrack.artist}`}
                          size="fill"
                          rounded="theme"
                          className="w-full h-full"
                        />
                      )}
                    </motion.div>

                    {/* Title / Artist Left + Tonal Vertical More Right */}
                    <div className="w-full flex items-center justify-between gap-3 -mt-2">
                      <div className="min-w-0 flex-1">
                        <h2 className="text-[22px] sm:text-2xl font-semibold tracking-tight font-display truncate">
                          {currentTrack.title}
                        </h2>
                        <p className="text-sm sm:text-base text-[#3A3A40] dark:text-white/75 truncate mt-0.5">
                          {currentTrack.artist}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => setMoreOpen(true)}
                        aria-label="More options"
                        className={cn(
                          'min-h-[42px] min-w-[42px] rounded-full m3-tonal-circle flex items-center justify-center active:scale-95 cursor-pointer shrink-0',
                          hasActiveExtras && 'text-[var(--neo-accent)]'
                        )}
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Minimal Scrubber with Centered Format / Lossless Badge */}
                    <ProgressSlider
                      minimal
                      currentTime={currentTime}
                      duration={duration || currentTrack.duration}
                      onSeek={seek}
                      showRemaining={settings.showRemainingTime}
                      onToggleRemaining={() =>
                        void updateSettings({ showRemainingTime: !settings.showRemainingTime })
                      }
                      centerLabel={
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[#3A3A40] dark:text-white/70">
                          <AudioLines className="w-3.5 h-3.5 opacity-80" />
                          <span>{isLossless ? 'Lossless' : currentTrack.format}</span>
                        </span>
                      }
                    />

                    {/* Centered Trio Transport */}
                    <div className="py-1 w-full">
                      <PlaybackControls
                        isPlaying={isPlaying}
                        shuffle={shuffle}
                        repeat={repeat}
                        uiTheme="material"
                        onTogglePlay={() => void togglePlay()}
                        onPrev={() => void prevTrack()}
                        onNext={() => void nextTrack()}
                        onToggleShuffle={toggleShuffle}
                        onCycleRepeat={cycleRepeat}
                      />
                    </div>

                    {/* Bottom 4 Tonal Circular Action Buttons */}
                    <div className="flex items-center justify-center gap-5 sm:gap-7 pt-1 pb-safe">
                      <button
                        type="button"
                        onClick={() => setShowLyrics(true)}
                        aria-label="Open Lyrics"
                        className="w-12 h-12 rounded-full m3-tonal-circle flex items-center justify-center active:scale-90 cursor-pointer"
                      >
                        <MessageSquareQuote className="w-[18px] h-[18px]" />
                      </button>

                      <button
                        type="button"
                        onClick={() => setMoreOpen(true)}
                        aria-label="Add to Playlist & Playback Modes"
                        className="w-12 h-12 rounded-full m3-tonal-circle flex items-center justify-center active:scale-90 cursor-pointer"
                      >
                        <Plus className="w-5 h-5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => setQueueOpen(true)}
                        aria-label="Open Queue"
                        className="w-12 h-12 rounded-full m3-tonal-circle flex items-center justify-center active:scale-90 cursor-pointer"
                      >
                        <ListMusic className="w-[18px] h-[18px]" />
                      </button>

                      <button
                        type="button"
                        onClick={() => setEqOpen(true)}
                        aria-label="Open Equalizer"
                        className={cn(
                          'w-12 h-12 rounded-full flex items-center justify-center active:scale-90 transition-all cursor-pointer',
                          settings.equalizer.enabled
                            ? 'bg-[var(--neo-accent)] text-white shadow-md'
                            : 'm3-tonal-circle'
                        )}
                      >
                        <SlidersHorizontal className="w-[18px] h-[18px]" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="w-full max-w-md lg:max-w-[460px] mx-auto flex flex-col items-center gap-6">
                    <motion.div
                      key={currentTrack.id}
                      initial={settings.reducedMotion ? false : { scale: 0.96, opacity: 0.85 }}
                      animate={{
                        scale: isPlaying ? 1 : 0.95,
                        opacity: 1,
                      }}
                      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                      className={cn(
                        'w-[min(80vw,355px)] sm:w-[375px] md:w-[395px] aspect-square relative overflow-hidden shrink-0',
                        p.artworkStyle === 'vinyl'
                          ? 'rounded-full p-5 bg-[#14151A] ring-4 ring-white/15'
                          : 'neo-artwork-radius'
                      )}
                      style={{
                        boxShadow: isPlaying
                          ? `0 30px 72px -16px ${palette.glow}`
                          : '0 16px 36px -14px rgba(0,0,0,0.28)',
                      }}
                    >
                      {p.artworkStyle === 'vinyl' ? (
                        <div
                          className={cn(
                            'w-full h-full rounded-full overflow-hidden relative ring-2 ring-white/15',
                            !settings.reducedMotion &&
                              (isPlaying ? 'animate-vinyl-spin' : 'animate-vinyl-paused')
                          )}
                        >
                          <AlbumArtwork
                            artworkId={currentTrack.artworkId}
                            artworkUrl={currentTrack.artworkUrl}
                            alt={`${currentTrack.title} vinyl art`}
                            fallbackSeed={`${currentTrack.album}-${currentTrack.artist}`}
                            size="fill"
                            rounded="full"
                            className="w-full h-full"
                          />
                          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <div className="w-10 h-10 rounded-full bg-[#14151A] ring-2 ring-white/30" />
                          </div>
                        </div>
                      ) : (
                        <AlbumArtwork
                          artworkId={currentTrack.artworkId}
                          artworkUrl={currentTrack.artworkUrl}
                          alt={`${currentTrack.title} album art`}
                          fallbackSeed={`${currentTrack.album}-${currentTrack.artist}`}
                          size="fill"
                          rounded="theme"
                          className="w-full h-full"
                        />
                      )}
                    </motion.div>

                    {/* Track Title, Like & More Row */}
                    <div className="w-full flex items-center justify-between gap-2.5">
                      <div className="min-w-0 flex-1">
                        <h2 className="neo-np-title text-xl sm:text-2xl font-bold tracking-tight font-display truncate">
                          {currentTrack.title}
                        </h2>
                        <p className="text-sm sm:text-base text-[#3A3A40] dark:text-[#C7C7CC] truncate mt-1">
                          {currentTrack.artist}
                          <span aria-hidden="true"> · </span>
                          <span>{currentTrack.format}</span>
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => void toggleTrackLike(currentTrack)}
                          aria-label={
                            currentTrack.isFavourite ? 'Unlike track' : 'Like track'
                          }
                          className={cn(
                            'min-h-[44px] min-w-[44px] rounded-full liquid-glass-subtle flex items-center justify-center active:scale-90 transition-all cursor-pointer',
                            currentTrack.isFavourite
                              ? 'text-[#FF2D55] dark:text-[#FF375F]'
                              : 'text-[#6E6E73] dark:text-[#AEAEB2] hover:text-[#111216] dark:hover:text-white'
                          )}
                        >
                          <Heart
                            className="w-5 h-5"
                            fill={currentTrack.isFavourite ? 'currentColor' : 'none'}
                          />
                        </button>

                        <button
                          type="button"
                          onClick={() => setMoreOpen(true)}
                          aria-label="More options"
                          className="min-h-[44px] min-w-[44px] rounded-full liquid-glass-subtle flex items-center justify-center text-[#6E6E73] dark:text-[#AEAEB2] hover:text-[#111216] dark:hover:text-white active:scale-95 transition-all cursor-pointer"
                        >
                          <MoreHorizontal className="w-5 h-5" />
                        </button>
                      </div>
                    </div>

                    {/* Scrubber */}
                    <ProgressSlider
                      currentTime={currentTime}
                      duration={duration || currentTrack.duration}
                      onSeek={seek}
                      showRemaining={settings.showRemainingTime}
                      onToggleRemaining={() =>
                        void updateSettings({ showRemainingTime: !settings.showRemainingTime })
                      }
                    />

                    {/* Transport Controls */}
                    <PlaybackControls
                      isPlaying={isPlaying}
                      shuffle={shuffle}
                      repeat={repeat}
                      uiTheme={uiTheme}
                      onTogglePlay={() => void togglePlay()}
                      onPrev={() => void prevTrack()}
                      onNext={() => void nextTrack()}
                      onToggleShuffle={toggleShuffle}
                      onCycleRepeat={cycleRepeat}
                    />

                    {/* Volume & Bottom Utility Row */}
                    <div className="w-full space-y-4">
                      <div className="flex items-center gap-3 px-1">
                        <button
                          type="button"
                          onClick={() => void updateSettings({ muted: !settings.muted })}
                          aria-label={settings.muted ? 'Unmute' : 'Mute'}
                          className="min-h-[36px] min-w-[36px] flex items-center justify-center text-[#6E6E73] dark:text-[#AEAEB2] hover:text-[#111216] dark:hover:text-white cursor-pointer"
                        >
                          {settings.muted || settings.volume === 0 ? (
                            <VolumeX className="w-4 h-4" />
                          ) : (
                            <Volume2 className="w-4 h-4" />
                          )}
                        </button>
                        <Slider
                          aria-label="Volume"
                          min={0}
                          max={1}
                          step={0.01}
                          value={[settings.muted ? 0 : settings.volume]}
                          onValueChange={(vals) =>
                            void updateSettings({ volume: vals[0] ?? 0.85, muted: false })
                          }
                        />
                      </div>

                      <div className="grid grid-cols-4 gap-2 w-full pb-safe">
                        <button
                          type="button"
                          onClick={() => setShowLyrics(true)}
                          className="min-h-[44px] px-2.5 neo-btn-radius liquid-glass-subtle flex items-center justify-center gap-1.5 text-xs sm:text-sm font-medium text-[#111216] dark:text-[#E5E5EA] hover:brightness-105 transition-colors cursor-pointer"
                        >
                          <Quote className="w-4 h-4 shrink-0" />
                          <span>Lyrics</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setEqOpen(true)}
                          className={cn(
                            'min-h-[44px] px-2.5 neo-btn-radius flex items-center justify-center gap-1.5 text-xs sm:text-sm font-medium transition-colors cursor-pointer',
                            settings.equalizer.enabled
                              ? 'bg-[var(--neo-accent)] text-white'
                              : 'liquid-glass-subtle text-[#111216] dark:text-[#E5E5EA] hover:brightness-105'
                          )}
                        >
                          <SlidersHorizontal className="w-4 h-4 shrink-0" />
                          <span>EQ</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setQueueOpen(true)}
                          className="min-h-[44px] px-2.5 neo-btn-radius liquid-glass-subtle flex items-center justify-center gap-1.5 text-xs sm:text-sm font-medium text-[#111216] dark:text-[#E5E5EA] hover:brightness-105 transition-colors cursor-pointer"
                        >
                          <ListMusic className="w-4 h-4 shrink-0" />
                          <span>Queue</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setMoreOpen(true)}
                          className={cn(
                            'min-h-[44px] px-2.5 neo-btn-radius flex items-center justify-center gap-1.5 text-xs sm:text-sm font-medium transition-colors cursor-pointer',
                            hasActiveExtras
                              ? 'bg-[var(--neo-accent)] text-white'
                              : 'liquid-glass-subtle text-[#111216] dark:text-[#E5E5EA] hover:brightness-105'
                          )}
                        >
                          <MoreHorizontal className="w-4 h-4 shrink-0" />
                          <span>More</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* More Options Sheet Modal */}
          <GlassModal
            open={moreOpen}
            onOpenChange={setMoreOpen}
            title="Track & Playback Options"
            className="max-w-lg"
          >
            <div className="space-y-5 max-h-[70vh] overflow-y-auto pr-1">
              {/* Track Header Card */}
              <div className="flex items-center gap-3 p-3 rounded-2xl liquid-glass-subtle">
                <AlbumArtwork
                  artworkId={currentTrack.artworkId}
                  artworkUrl={currentTrack.artworkUrl}
                  alt={currentTrack.title}
                  fallbackSeed={`${currentTrack.album}-${currentTrack.artist}`}
                  size="sm"
                  rounded="xl"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold truncate">{currentTrack.title}</p>
                  <p className="text-xs text-[#6E6E73] dark:text-[#98989D] truncate">
                    {currentTrack.artist} · {currentTrack.album}
                  </p>
                  <p className="text-[11px] text-[#8E8E93] font-mono-tabular mt-0.5">
                    {currentTrack.format}
                    {currentTrack.duration > 0 ? ` · ${formatTime(currentTrack.duration)}` : ''}
                  </p>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={toggleShuffle}
                  className={cn(
                    'min-h-[44px] px-3.5 rounded-2xl liquid-glass-subtle flex items-center gap-2.5 text-xs font-semibold transition-colors cursor-pointer',
                    shuffle && 'text-[var(--neo-accent)]'
                  )}
                >
                  <Shuffle className="w-4 h-4 shrink-0" />
                  <span>{shuffle ? 'Shuffle: On' : 'Shuffle: Off'}</span>
                </button>

                <button
                  type="button"
                  onClick={cycleRepeat}
                  className={cn(
                    'min-h-[44px] px-3.5 rounded-2xl liquid-glass-subtle flex items-center gap-2.5 text-xs font-semibold transition-colors cursor-pointer',
                    repeat !== 'off' && 'text-[var(--neo-accent)]'
                  )}
                >
                  {repeat === 'one' ? (
                    <Repeat1 className="w-4 h-4 shrink-0" />
                  ) : (
                    <Repeat className="w-4 h-4 shrink-0" />
                  )}
                  <span>
                    {repeat === 'one' ? 'Repeat: One' : repeat === 'all' ? 'Repeat: All' : 'Repeat: Off'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => void toggleTrackLike(currentTrack)}
                  className={cn(
                    'min-h-[44px] px-3.5 rounded-2xl liquid-glass-subtle flex items-center gap-2.5 text-xs font-semibold transition-colors cursor-pointer',
                    currentTrack.isFavourite && 'text-[#FF2D55] dark:text-[#FF375F]'
                  )}
                >
                  <Heart
                    className="w-4 h-4 shrink-0"
                    fill={currentTrack.isFavourite ? 'currentColor' : 'none'}
                  />
                  <span>{currentTrack.isFavourite ? 'Liked' : 'Like Song'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => void handleFollowToggle()}
                  className={cn(
                    'min-h-[44px] px-3.5 rounded-2xl liquid-glass-subtle flex items-center gap-2.5 text-xs font-semibold transition-colors cursor-pointer',
                    followed && 'text-[var(--neo-accent)]'
                  )}
                >
                  {followed ? (
                    <UserCheck className="w-4 h-4 shrink-0" />
                  ) : (
                    <UserPlus className="w-4 h-4 shrink-0" />
                  )}
                  <span className="truncate">{followed ? 'Following Artist' : 'Follow Artist'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    playNextInQueue(currentTrack);
                    setMoreOpen(false);
                  }}
                  className="min-h-[44px] px-3.5 rounded-2xl liquid-glass-subtle flex items-center gap-2.5 text-xs font-semibold hover:brightness-105 cursor-pointer"
                >
                  <ListPlus className="w-4 h-4 shrink-0" />
                  <span>Play Next</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    addToQueue(currentTrack);
                    setMoreOpen(false);
                  }}
                  className="min-h-[44px] px-3.5 rounded-2xl liquid-glass-subtle flex items-center gap-2.5 text-xs font-semibold hover:brightness-105 cursor-pointer"
                >
                  <ListEnd className="w-4 h-4 shrink-0" />
                  <span>Add to Queue</span>
                </button>

                <button
                  type="button"
                  disabled={isFetchingLyrics}
                  onClick={() => void handleFetchLyrics()}
                  className="min-h-[44px] px-3.5 rounded-2xl liquid-glass-subtle flex items-center gap-2.5 text-xs font-semibold hover:brightness-105 disabled:opacity-50 cursor-pointer"
                >
                  <CloudDownload className="w-4 h-4 shrink-0" />
                  <span>{isFetchingLyrics ? 'Fetching...' : 'Fetch Lyrics'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => void handleShareTrack()}
                  className="min-h-[44px] px-3.5 rounded-2xl liquid-glass-subtle flex items-center gap-2.5 text-xs font-semibold hover:brightness-105 cursor-pointer"
                >
                  <Share2 className="w-4 h-4 shrink-0" />
                  <span>Share / Copy</span>
                </button>
              </div>

              {/* Playback Speed */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold flex items-center gap-1.5 text-[#48484A] dark:text-[#AEAEB2]">
                    <Gauge className="w-3.5 h-3.5 text-[var(--neo-accent)]" />
                    <span>Playback Speed</span>
                  </span>
                  <span className="text-xs font-mono-tabular text-[#6E6E73] dark:text-[#98989D]">
                    {settings.playbackRate}x
                  </span>
                </div>
                <div className="grid grid-cols-6 gap-1.5">
                  {PLAYBACK_SPEEDS.map((rate) => {
                    const active = settings.playbackRate === rate;
                    return (
                      <button
                        key={rate}
                        type="button"
                        onClick={() => void updateSettings({ playbackRate: rate })}
                        className={cn(
                          'min-h-[38px] rounded-xl text-xs font-mono-tabular font-semibold transition-all cursor-pointer',
                          active
                            ? 'bg-[var(--neo-accent)] text-white shadow-sm'
                            : 'liquid-glass-subtle text-[#48484A] dark:text-[#AEAEB2] hover:text-[#111216] dark:hover:text-white'
                        )}
                      >
                        {rate}x
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Crossfade */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold flex items-center gap-1.5 text-[#48484A] dark:text-[#AEAEB2]">
                    <AudioLines className="w-3.5 h-3.5 text-[var(--neo-accent)]" />
                    <span>Crossfade</span>
                  </span>
                  <span
                    className={cn(
                      'text-xs font-mono-tabular font-semibold',
                      (settings.crossfadeSeconds || 0) > 0
                        ? 'text-[var(--neo-accent)]'
                        : 'text-[#6E6E73] dark:text-[#98989D]'
                    )}
                  >
                    {(settings.crossfadeSeconds || 0) > 0
                      ? `${settings.crossfadeSeconds}s`
                      : 'Off'}
                  </span>
                </div>
                <div className="flex items-center gap-2.5 rounded-2xl liquid-glass-subtle px-3.5 py-2.5">
                  <span className="text-[11px] font-mono-tabular text-[#8E8E93] shrink-0">Off</span>
                  <Slider
                    aria-label="Crossfade duration in seconds"
                    min={0}
                    max={12}
                    step={1}
                    value={[settings.crossfadeSeconds ?? 0]}
                    onValueChange={(vals) =>
                      void updateSettings({ crossfadeSeconds: vals[0] ?? 0 })
                    }
                    rangeClassName={
                      (settings.crossfadeSeconds || 0) > 0 ? 'bg-[var(--neo-accent)]' : undefined
                    }
                  />
                  <span className="text-[11px] font-mono-tabular text-[#8E8E93] shrink-0">12s</span>
                </div>
              </div>

              {/* Sleep Timer */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold flex items-center gap-1.5 text-[#48484A] dark:text-[#AEAEB2]">
                    <Clock className="w-3.5 h-3.5 text-[var(--neo-accent)]" />
                    <span>Sleep Timer</span>
                  </span>
                  {sleepStatusLabel && (
                    <span className="text-xs font-mono-tabular text-[var(--neo-accent)] font-semibold">
                      {sleepStatusLabel}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {SLEEP_PRESETS.map((preset) => {
                    const active = sleepTimerMode === preset.mode;
                    return (
                      <button
                        key={String(preset.mode)}
                        type="button"
                        onClick={() => setSleepTimer(preset.mode)}
                        className={cn(
                          'min-h-[38px] px-2 rounded-xl text-xs font-semibold transition-all cursor-pointer',
                          active
                            ? 'bg-[#111216] text-white dark:bg-white dark:text-[#0A0B0F] shadow-sm'
                            : 'liquid-glass-subtle text-[#48484A] dark:text-[#AEAEB2] hover:text-[#111216] dark:hover:text-white'
                        )}
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Add to Local Playlist */}
              {isLocalTrack && playlists.length > 0 && (
                <div className="space-y-2">
                  <span className="text-xs font-semibold text-[#48484A] dark:text-[#AEAEB2] block">
                    Add to Playlist
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {playlists.slice(0, 8).map((pl) => {
                      const alreadyIn = pl.trackIds.includes(currentTrack.id);
                      return (
                        <button
                          key={pl.id}
                          type="button"
                          onClick={() => {
                            if (!alreadyIn) {
                              void addTracksToPlaylist(pl.id, [currentTrack.id]);
                            }
                          }}
                          className="min-h-[40px] px-3 rounded-xl liquid-glass-subtle flex items-center justify-between gap-2 text-xs font-medium hover:brightness-105 cursor-pointer text-left"
                        >
                          <span className="truncate">{pl.name}</span>
                          {alreadyIn ? (
                            <Check className="w-3.5 h-3.5 text-[var(--neo-accent)] shrink-0" />
                          ) : (
                            <ListPlus className="w-3.5 h-3.5 text-[#8E8E93] shrink-0" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Now Playing Backdrop Toggle */}
              <div className="flex items-center justify-between gap-3 p-3.5 rounded-2xl liquid-glass-subtle">
                <div className="flex items-center gap-2.5 min-w-0">
                  <ImageIcon className="w-4 h-4 text-[var(--neo-accent)] shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold">Album Art Background</p>
                    <p className="text-[11px] text-[#6E6E73] dark:text-[#98989D] truncate">
                      Harmonized to {resolvedTheme === 'dark' ? 'Dark' : 'Light'} mode &amp; active theme
                    </p>
                  </div>
                </div>
                <Switch
                  checked={showArtworkBg}
                  onCheckedChange={(checked) =>
                    void updatePersonalization({ nowPlayingArtworkBackground: checked })
                  }
                  aria-label="Toggle Now Playing album art background"
                />
              </div>

              {/* Local Metadata Tools or YouTube External Link */}
              <div className="pt-2 border-t border-black/8 dark:border-white/10 space-y-2">
                {isLocalTrack ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button
                      type="button"
                      disabled={isEnrichingTrack}
                      onClick={() => void handleAutoEnrich()}
                      className="min-h-[42px] px-3.5 rounded-2xl liquid-glass-subtle flex items-center justify-center gap-2 text-xs font-semibold hover:brightness-105 disabled:opacity-50 cursor-pointer"
                    >
                      <Sparkles className="w-4 h-4 text-[var(--neo-accent)]" />
                      <span>
                        {isEnrichingTrack ? 'Matching Tags...' : 'Auto-Fix Tags & Cover'}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMoreOpen(false);
                        setEditOpen(true);
                      }}
                      className="min-h-[42px] px-3.5 rounded-2xl liquid-glass-subtle flex items-center justify-center gap-2 text-xs font-semibold hover:brightness-105 cursor-pointer"
                    >
                      <Edit3 className="w-4 h-4" />
                      <span>Edit Track Info</span>
                    </button>
                  </div>
                ) : (
                  currentTrack.youtubeVideoId && (
                    <a
                      href={`https://www.youtube.com/watch?v=${currentTrack.youtubeVideoId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="min-h-[42px] px-3.5 rounded-2xl liquid-glass-subtle flex items-center justify-center gap-2 text-xs font-semibold hover:brightness-105"
                    >
                      <ExternalLink className="w-4 h-4 text-[#FF0000]" />
                      <span>Open on YouTube</span>
                    </a>
                  )
                )}
              </div>
            </div>
          </GlassModal>

          <TrackMetadataModal
            track={currentTrack}
            open={editOpen}
            onOpenChange={setEditOpen}
          />

          <GlassModal
            open={eqOpen}
            onOpenChange={setEqOpen}
            title="Audio Equalizer"
            description="Tune Bass, Mid, and Treble frequencies or pick a sound profile"
            className="max-w-lg"
          >
            <EqualizerPanel compact />
          </GlassModal>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
