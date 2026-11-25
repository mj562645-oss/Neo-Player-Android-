import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { getCountryName } from '../lib/countries';
import {
  fetchArtistUpdates,
  fetchTrendingCharts,
  findLocalLibraryMatch,
  resolveDiscoveryTrackPreview,
} from '../services/discoveryService';
import { previewPlayer, type PreviewPlayerState } from '../services/previewPlayer';
import type {
  ArtistRadarResult,
  DiscoveryNotification,
  DiscoveryTrackItem,
} from '../types/music';
import { useLibrary } from './LibraryContext';
import { usePlayer } from './PlayerContext';
import { useTheme } from './ThemeContext';
import { useToast } from './ToastContext';

const DISCOVERY_STORAGE_KEY = 'neo-player-discovery-cache-v1';

interface StoredDiscoveryCache {
  trendingTracks: DiscoveryTrackItem[];
  trendingSource: string;
  artistUpdates: ArtistRadarResult[];
  notifications: DiscoveryNotification[];
  seenKeys: string[];
  lastSyncedAt: number | null;
}

function loadCachedDiscovery(): StoredDiscoveryCache {
  try {
    const raw = localStorage.getItem(DISCOVERY_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<StoredDiscoveryCache>;
      return {
        trendingTracks: Array.isArray(parsed.trendingTracks) ? parsed.trendingTracks : [],
        trendingSource: parsed.trendingSource || 'Charts',
        artistUpdates: Array.isArray(parsed.artistUpdates) ? parsed.artistUpdates : [],
        notifications: Array.isArray(parsed.notifications) ? parsed.notifications : [],
        seenKeys: Array.isArray(parsed.seenKeys) ? parsed.seenKeys : [],
        lastSyncedAt: typeof parsed.lastSyncedAt === 'number' ? parsed.lastSyncedAt : null,
      };
    }
  } catch {
    // ignore storage errors
  }
  return {
    trendingTracks: [],
    trendingSource: 'Charts',
    artistUpdates: [],
    notifications: [],
    seenKeys: [],
    lastSyncedAt: null,
  };
}

function persistCachedDiscovery(cache: StoredDiscoveryCache): void {
  try {
    localStorage.setItem(DISCOVERY_STORAGE_KEY, JSON.stringify(cache));
  } catch {
    // ignore quota errors
  }
}

interface DiscoveryContextValue {
  trendingTracks: DiscoveryTrackItem[];
  trendingSource: string;
  artistUpdates: ArtistRadarResult[];
  trackedArtists: string[];
  notifications: DiscoveryNotification[];
  unreadCount: number;
  isSyncing: boolean;
  lastSyncedAt: number | null;
  syncError: string | null;
  previewState: PreviewPlayerState;
  refreshRadar: (opts?: { silent?: boolean }) => Promise<void>;
  tuneInToArtist: (artistName: string) => Promise<void>;
  tuneInToTrending: () => Promise<void>;
  playDiscoveryTrack: (
    item: DiscoveryTrackItem,
    contextList?: DiscoveryTrackItem[],
    stationLabel?: string
  ) => Promise<void>;
  togglePreviewPlay: () => Promise<void>;
  nextPreviewTrack: () => Promise<void>;
  prevPreviewTrack: () => Promise<void>;
  stopPreview: () => void;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  clearNotifications: () => void;
  requestOsNotificationPermission: () => Promise<boolean>;
}

const DiscoveryContext = createContext<DiscoveryContextValue | null>(null);

export const DiscoveryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { tracks, artists, isLoading: libraryLoading } = useLibrary();
  const { playTrack } = usePlayer();
  const { settings, settingsLoaded } = useTheme();
  const { showToast } = useToast();

  const initialCache = useMemo(() => loadCachedDiscovery(), []);
  const [trendingTracks, setTrendingTracks] = useState<DiscoveryTrackItem[]>(
    initialCache.trendingTracks
  );
  const [trendingSource, setTrendingSource] = useState<string>(initialCache.trendingSource);
  const [artistUpdates, setArtistUpdates] = useState<ArtistRadarResult[]>(
    initialCache.artistUpdates
  );
  const [notifications, setNotifications] = useState<DiscoveryNotification[]>(
    initialCache.notifications
  );
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(initialCache.lastSyncedAt);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [previewState, setPreviewState] = useState<PreviewPlayerState>(() =>
    previewPlayer.getState()
  );

  const seenKeysRef = useRef<Set<string>>(new Set(initialCache.seenKeys));
  const autoSyncedOnceRef = useRef(false);

  useEffect(() => {
    return previewPlayer.subscribe(setPreviewState);
  }, []);

  // Combine explicitly followed artists + top artists from user's local library
  const trackedArtists = useMemo(() => {
    const map = new Map<string, string>();
    for (const name of settings.followedArtists || []) {
      const clean = name.trim();
      if (clean && clean.toLowerCase() !== 'unknown artist') {
        map.set(clean.toLowerCase(), clean);
      }
    }

    if (map.size < 6) {
      // Score artists in user's local library by plays + favourites + track count
      const scored = artists
        .filter((a) => a.name.toLowerCase() !== 'unknown artist')
        .map((a) => {
          const artistTracks = tracks.filter((t) => a.trackIds.includes(t.id));
          const plays = artistTracks.reduce((sum, t) => sum + (t.playCount || 0), 0);
          const favs = artistTracks.filter((t) => t.isFavourite).length;
          return {
            name: a.name,
            score: plays * 3 + favs * 4 + artistTracks.length,
          };
        })
        .sort((a, b) => b.score - a.score);

      for (const item of scored) {
        if (map.size >= 6) break;
        const key = item.name.toLowerCase();
        if (!map.has(key)) map.set(key, item.name);
      }
    }

    return Array.from(map.values()).slice(0, 8);
  }, [settings.followedArtists, artists, tracks]);

  const sendOsNotification = useCallback(
    (title: string, body: string, icon?: string) => {
      if (!settings.osNotificationsEnabled) return;
      if (typeof window === 'undefined' || !('Notification' in window)) return;
      if (Notification.permission !== 'granted') return;
      try {
        new Notification(title, { body, icon });
      } catch {
        // Ignore Notification errors on restricted webviews
      }
    },
    [settings.osNotificationsEnabled]
  );

  const refreshRadar = useCallback(
    async (opts?: { silent?: boolean }) => {
      const silent = Boolean(opts?.silent);
      setIsSyncing(true);
      setSyncError(null);

      try {
        const country = settings.discoveryCountry || 'us';
        const [trendingRes, artistsRes] = await Promise.allSettled([
          fetchTrendingCharts(country, 25),
          trackedArtists.length > 0
            ? fetchArtistUpdates(trackedArtists, country)
            : Promise.resolve({ artists: [], updatedAt: Date.now() }),
        ]);

        let nextTrending = trendingTracks;
        let nextSource = trendingSource;
        let nextArtists = artistUpdates;

        if (trendingRes.status === 'fulfilled') {
          nextTrending = trendingRes.value.tracks;
          nextSource = trendingRes.value.source;
          setTrendingTracks(nextTrending);
          setTrendingSource(nextSource);
        }

        if (artistsRes.status === 'fulfilled') {
          nextArtists = artistsRes.value.artists;
          setArtistUpdates(nextArtists);
        }

        if (trendingRes.status === 'rejected' && artistsRes.status === 'rejected') {
          throw new Error('Unable to reach music discovery feeds right now.');
        }

        const newAlerts: DiscoveryNotification[] = [];
        const seen = seenKeysRef.current;
        const notificationsActive = settings.discoveryNotificationsEnabled !== false;

        // 1. Detect top trending highlights we haven't notified yet
        if (notificationsActive && settings.notifyTrending !== false && nextTrending.length > 0) {
          const topBreakout = nextTrending.slice(0, 3);
          for (const item of topBreakout) {
            const key = `trend:${country}:${item.id}`;
            if (!seen.has(key)) {
              seen.add(key);
              newAlerts.push({
                id: `notif_${key}_${Date.now()}`,
                type: 'trending',
                title: `#${item.rank || 1} Trending: ${item.title}`,
                message: `${item.artist} is charting in ${getCountryName(country)} Top Songs.`,
                artist: item.artist,
                artworkUrl: item.artworkUrl,
                previewTrack: item,
                createdAt: Date.now(),
                read: false,
              });
            }
          }
        }

        // 2. Detect releases from followed / top library artists
        if (
          notificationsActive &&
          settings.notifyFavoriteArtists !== false &&
          nextArtists.length > 0
        ) {
          for (const ar of nextArtists) {
            const rel = ar.latestRelease;
            if (!rel) continue;
            const key = `artist:${ar.artistName.toLowerCase()}:${rel.id}`;
            if (!seen.has(key)) {
              seen.add(key);
              const yearLabel = rel.releaseDate
                ? new Date(rel.releaseDate).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })
                : 'Latest Release';
              const playablePreview = ar.topTracks.find((t) => Boolean(t.previewUrl)) || ar.topTracks[0];
              newAlerts.push({
                id: `notif_${key}_${Date.now()}`,
                type: 'artist-release',
                title: `${ar.artistName}: ${rel.title}`,
                message: `Latest release (${yearLabel}) ready to tune in.`,
                artist: ar.artistName,
                artworkUrl: rel.artworkUrl || ar.artworkUrl,
                previewTrack: playablePreview,
                createdAt: Date.now(),
                read: false,
              });
            }
          }
        }

        const mergedNotifications =
          newAlerts.length > 0
            ? [...newAlerts.slice(0, 6), ...notifications].slice(0, 30)
            : notifications;

        if (newAlerts.length > 0) {
          setNotifications(mergedNotifications);
          const lead = newAlerts[0];
          showToast(`${lead.title} — ${lead.message}`, 'info');
          sendOsNotification(lead.title, lead.message, lead.artworkUrl);
        } else if (!silent) {
          showToast('Music Radar & artist releases are up to date.', 'success');
        }

        const syncedAt = Date.now();
        setLastSyncedAt(syncedAt);
        persistCachedDiscovery({
          trendingTracks: nextTrending,
          trendingSource: nextSource,
          artistUpdates: nextArtists,
          notifications: mergedNotifications,
          seenKeys: Array.from(seen).slice(-120),
          lastSyncedAt: syncedAt,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to refresh Music Radar.';
        setSyncError(msg);
        if (!silent) showToast(msg, 'error');
      } finally {
        setIsSyncing(false);
      }
    },
    [
      settings.discoveryCountry,
      settings.discoveryNotificationsEnabled,
      settings.notifyTrending,
      settings.notifyFavoriteArtists,
      trackedArtists,
      trendingTracks,
      trendingSource,
      artistUpdates,
      notifications,
      showToast,
      sendOsNotification,
    ]
  );

  // Initial background sync (respects 30-min cache TTL so reloads don't spam upstream APIs)
  useEffect(() => {
    if (!settingsLoaded || libraryLoading || autoSyncedOnceRef.current) return;
    autoSyncedOnceRef.current = true;
    const stale = !lastSyncedAt || Date.now() - lastSyncedAt > 30 * 60 * 1000;
    if (stale || trendingTracks.length === 0) {
      void refreshRadar({ silent: true });
    }
  }, [settingsLoaded, libraryLoading, lastSyncedAt, trendingTracks.length, refreshRadar]);

  const playDiscoveryTrack = useCallback(
    async (
      item: DiscoveryTrackItem,
      contextList?: DiscoveryTrackItem[],
      stationLabel = 'Music Radar'
    ) => {
      // 1. If the user owns this track locally offline, play the full local file!
      const localMatch = findLocalLibraryMatch(item, tracks);
      if (localMatch) {
        previewPlayer.stop();
        await playTrack(localMatch, [localMatch], stationLabel);
        showToast(`Playing full local copy: ${localMatch.title}`, 'success');
        return;
      }

      // 2. Otherwise stream the official 30s preview (resolving preview URL on-demand if needed)
      let target = item;
      if (!target.previewUrl) {
        const extra = await resolveDiscoveryTrackPreview(
          target,
          settings.discoveryCountry || 'us'
        );
        if (extra.previewUrl) {
          target = {
            ...target,
            previewUrl: extra.previewUrl,
            album: extra.album || target.album,
            artworkUrl: extra.artworkUrl || target.artworkUrl,
          };
          setTrendingTracks((prev) =>
            prev.map((t) => (t.id === target.id ? { ...t, ...extra } : t))
          );
        }
      }

      if (!target.previewUrl) {
        showToast(`No stream preview available for "${item.title}"`, 'info');
        return;
      }

      const list = (contextList && contextList.length > 0 ? contextList : [target]).map((t) =>
        t.id === target.id ? target : t
      );
      const startIndex = Math.max(
        0,
        list.findIndex((t) => t.id === target.id)
      );
      const ok = await previewPlayer.playStation(list, startIndex, stationLabel);
      if (!ok) {
        showToast('Preview audio stream could not start.', 'error');
      }
    },
    [tracks, playTrack, settings.discoveryCountry, showToast]
  );

  const tuneInToArtist = useCallback(
    async (artistName: string) => {
      // First check if local library has tracks by this artist -> play offline mix if >= 2 tracks
      const norm = artistName.trim().toLowerCase();
      const localTracks = tracks.filter((t) => t.artist.trim().toLowerCase() === norm);
      const remoteArtist = artistUpdates.find(
        (a) => a.artistName.trim().toLowerCase() === norm
      );

      if (remoteArtist && remoteArtist.topTracks.some((t) => Boolean(t.previewUrl))) {
        const ok = await previewPlayer.playStation(
          remoteArtist.topTracks,
          0,
          `${remoteArtist.artistName} Radio`
        );
        if (ok) {
          showToast(`Tuned into ${remoteArtist.artistName} station`, 'success');
          return;
        }
      }

      if (localTracks.length > 0) {
        previewPlayer.stop();
        await playTrack(localTracks[0], localTracks, `${artistName} Mix`);
        showToast(`Tuned into your offline ${artistName} library mix`, 'success');
        return;
      }

      // On-demand fetch for an artist not yet cached in artistUpdates
      setIsSyncing(true);
      try {
        const res = await fetchArtistUpdates([artistName], settings.discoveryCountry || 'us');
        const found = res.artists[0];
        if (found) {
          setArtistUpdates((prev) => {
            const without = prev.filter(
              (a) => a.artistName.toLowerCase() !== found.artistName.toLowerCase()
            );
            return [found, ...without];
          });
          const ok = await previewPlayer.playStation(
            found.topTracks,
            0,
            `${found.artistName} Radio`
          );
          if (ok) {
            showToast(`Tuned into ${found.artistName} station`, 'success');
            return;
          }
        }
        showToast(`No playable previews found for ${artistName}`, 'info');
      } catch {
        showToast(`Could not load station for ${artistName}`, 'error');
      } finally {
        setIsSyncing(false);
      }
    },
    [tracks, artistUpdates, playTrack, settings.discoveryCountry, showToast]
  );

  const tuneInToTrending = useCallback(async () => {
    const playable = trendingTracks.filter((t) => Boolean(t.previewUrl));
    if (playable.length > 0) {
      const ok = await previewPlayer.playStation(playable, 0, 'Trending Charts Radio');
      if (ok) {
        showToast('Tuned into Trending Charts Radio', 'success');
        return;
      }
    }
    if (trendingTracks[0]) {
      await playDiscoveryTrack(trendingTracks[0], trendingTracks, 'Trending Charts');
    } else {
      showToast('Refresh Music Radar first to load trending charts.', 'info');
    }
  }, [trendingTracks, playDiscoveryTrack, showToast]);

  const markNotificationRead = useCallback((id: string) => {
    setNotifications((prev) => {
      const next = prev.map((n) => (n.id === id ? { ...n, read: true } : n));
      persistCachedDiscovery({
        trendingTracks,
        trendingSource,
        artistUpdates,
        notifications: next,
        seenKeys: Array.from(seenKeysRef.current),
        lastSyncedAt,
      });
      return next;
    });
  }, [trendingTracks, trendingSource, artistUpdates, lastSyncedAt]);

  const markAllNotificationsRead = useCallback(() => {
    setNotifications((prev) => {
      const next = prev.map((n) => ({ ...n, read: true }));
      persistCachedDiscovery({
        trendingTracks,
        trendingSource,
        artistUpdates,
        notifications: next,
        seenKeys: Array.from(seenKeysRef.current),
        lastSyncedAt,
      });
      return next;
    });
  }, [trendingTracks, trendingSource, artistUpdates, lastSyncedAt]);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
    persistCachedDiscovery({
      trendingTracks,
      trendingSource,
      artistUpdates,
      notifications: [],
      seenKeys: Array.from(seenKeysRef.current),
      lastSyncedAt,
    });
  }, [trendingTracks, trendingSource, artistUpdates, lastSyncedAt]);

  const requestOsNotificationPermission = useCallback(async (): Promise<boolean> => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      showToast('System notifications are not supported in this browser.', 'info');
      return false;
    }
    if (Notification.permission === 'granted') return true;
    const perm = await Notification.requestPermission();
    if (perm === 'granted') {
      showToast('Device alerts enabled for trending & favourite artist releases', 'success');
      return true;
    }
    showToast('Notification permission was declined.', 'info');
    return false;
  }, [showToast]);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications]
  );

  return (
    <DiscoveryContext.Provider
      value={{
        trendingTracks,
        trendingSource,
        artistUpdates,
        trackedArtists,
        notifications,
        unreadCount,
        isSyncing,
        lastSyncedAt,
        syncError,
        previewState,
        refreshRadar,
        tuneInToArtist,
        tuneInToTrending,
        playDiscoveryTrack,
        togglePreviewPlay: () => previewPlayer.togglePlay(),
        nextPreviewTrack: () => previewPlayer.next(),
        prevPreviewTrack: () => previewPlayer.prev(),
        stopPreview: () => previewPlayer.stop(),
        markNotificationRead,
        markAllNotificationsRead,
        clearNotifications,
        requestOsNotificationPermission,
      }}
    >
      {children}
    </DiscoveryContext.Provider>
  );
};

export function useDiscovery(): DiscoveryContextValue {
  const ctx = useContext(DiscoveryContext);
  if (!ctx) throw new Error('useDiscovery must be used within DiscoveryProvider');
  return ctx;
}
