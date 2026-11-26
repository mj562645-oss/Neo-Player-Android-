import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { User } from 'firebase/auth';
import {
  clearYouTubeAccessToken,
  getYouTubeAccessToken,
  initYouTubeAuth,
  signInWithYouTube,
  signOutYouTube,
} from '../services/youtubeAuth';
import {
  fetchMyLikedYouTubeMusic,
  fetchMyYouTubeChannel,
  fetchMyYouTubePlaylists,
  fetchMyYouTubeSubscriptions,
  fetchYouTubeChannelTracks,
  fetchYouTubePlaylistTracks,
  searchYouTubeMusic,
  YouTubeApiError,
} from '../services/youtubeApi';
import { youtubePlayer } from '../services/youtubePlayer';
import type {
  Track,
  YouTubeChannelInfo,
  YouTubePlaylistSummary,
  YouTubeSubscriptionItem,
} from '../types/music';
import { useToast } from './ToastContext';

interface YouTubeContextValue {
  user: User | null;
  isConnected: boolean;
  hasLiveToken: boolean;
  isRestoringSession: boolean;
  needsAuth: boolean;
  isLoggingIn: boolean;
  isLoadingLibrary: boolean;
  isLoadingTracks: boolean;
  isSearching: boolean;
  error: string | null;
  apiDisabledInfo: { message: string; activationUrl: string } | null;
  channel: YouTubeChannelInfo | null;
  playlists: YouTubePlaylistSummary[];
  likedTracks: Track[];
  subscriptions: YouTubeSubscriptionItem[];
  playlistTracksMap: Record<string, Track[]>;
  channelTracksMap: Record<string, Track[]>;
  searchQuery: string;
  searchedQuery: string;
  searchResults: Track[];
  signIn: (forceAccountPicker?: boolean) => Promise<boolean>;
  signOut: () => Promise<void>;
  refreshAll: () => Promise<void>;
  loadPlaylistTracks: (
    playlistId: string,
    playlistTitle?: string,
    force?: boolean
  ) => Promise<Track[]>;
  loadChannelTracks: (
    channelId: string,
    channelTitle: string,
    force?: boolean
  ) => Promise<Track[]>;
  searchMusic: (query: string, force?: boolean) => Promise<Track[]>;
  clearSearch: () => void;
  isYouTubeTrackLiked: (trackId: string, defaultFlag?: boolean) => boolean;
  toggleYouTubeLike: (track: Track) => boolean;
}

const YouTubeContext = createContext<YouTubeContextValue | null>(null);

const YT_LIKED_STORAGE_KEY = 'neo-player-yt-liked-v1';
const YT_UNLIKED_STORAGE_KEY = 'neo-player-yt-unliked-v1';
const YT_LIBRARY_CACHE_PREFIX = 'neo-player-yt-library-v1:';

interface CachedYouTubeLibrary {
  channel: YouTubeChannelInfo | null;
  likesPlaylistId?: string;
  playlists: YouTubePlaylistSummary[];
  remoteLikedTracks: Track[];
  subscriptions: YouTubeSubscriptionItem[];
  playlistTracksMap: Record<string, Track[]>;
  channelTracksMap: Record<string, Track[]>;
  updatedAt: number;
}

function readCachedLibrary(uid: string): CachedYouTubeLibrary | null {
  try {
    const raw = localStorage.getItem(`${YT_LIBRARY_CACHE_PREFIX}${uid}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CachedYouTubeLibrary>;
    return {
      channel: parsed.channel || null,
      likesPlaylistId: parsed.likesPlaylistId,
      playlists: Array.isArray(parsed.playlists) ? parsed.playlists : [],
      remoteLikedTracks: Array.isArray(parsed.remoteLikedTracks) ? parsed.remoteLikedTracks : [],
      subscriptions: Array.isArray(parsed.subscriptions) ? parsed.subscriptions : [],
      playlistTracksMap:
        parsed.playlistTracksMap && typeof parsed.playlistTracksMap === 'object'
          ? parsed.playlistTracksMap
          : {},
      channelTracksMap:
        parsed.channelTracksMap && typeof parsed.channelTracksMap === 'object'
          ? parsed.channelTracksMap
          : {},
      updatedAt: typeof parsed.updatedAt === 'number' ? parsed.updatedAt : Date.now(),
    };
  } catch {
    return null;
  }
}

function writeCachedLibrary(uid: string, snapshot: CachedYouTubeLibrary): void {
  try {
    // Keep cache compact by storing up to the 20 most recent playlists/channels track lists
    const trimRecord = (rec: Record<string, Track[]>, maxKeys = 20) => {
      const entries = Object.entries(rec).slice(-maxKeys);
      return Object.fromEntries(entries);
    };
    const payload: CachedYouTubeLibrary = {
      ...snapshot,
      playlistTracksMap: trimRecord(snapshot.playlistTracksMap),
      channelTracksMap: trimRecord(snapshot.channelTracksMap),
      updatedAt: Date.now(),
    };
    localStorage.setItem(`${YT_LIBRARY_CACHE_PREFIX}${uid}`, JSON.stringify(payload));
  } catch {
    // ignore storage quota errors
  }
}

function removeCachedLibrary(uid: string): void {
  try {
    localStorage.removeItem(`${YT_LIBRARY_CACHE_PREFIX}${uid}`);
  } catch {
    // ignore
  }
}

function readStoredLikedTracks(): Record<string, Track> {
  try {
    const raw = localStorage.getItem(YT_LIKED_STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, Track>;
  } catch {
    return {};
  }
}

function readStoredUnlikedIds(): string[] {
  try {
    const raw = localStorage.getItem(YT_UNLIKED_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export const YouTubeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { showToast } = useToast();

  const [user, setUser] = useState<User | null>(null);
  const [hasLiveToken, setHasLiveToken] = useState(false);
  const [isRestoringSession, setIsRestoringSession] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isLoadingLibrary, setIsLoadingLibrary] = useState(false);
  const [isLoadingTracks, setIsLoadingTracks] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [apiDisabledInfo, setApiDisabledInfo] = useState<{
    message: string;
    activationUrl: string;
  } | null>(null);

  const [channel, setChannel] = useState<YouTubeChannelInfo | null>(null);
  const [likesPlaylistId, setLikesPlaylistId] = useState<string | undefined>(undefined);
  const [playlists, setPlaylists] = useState<YouTubePlaylistSummary[]>([]);
  const [remoteLikedTracks, setRemoteLikedTracks] = useState<Track[]>([]);
  const [localLikedMap, setLocalLikedMap] = useState<Record<string, Track>>(readStoredLikedTracks);
  const [unlikedIds, setUnlikedIds] = useState<string[]>(readStoredUnlikedIds);
  const [subscriptions, setSubscriptions] = useState<YouTubeSubscriptionItem[]>([]);
  const [playlistTracksMap, setPlaylistTracksMap] = useState<Record<string, Track[]>>({});
  const [channelTracksMap, setChannelTracksMap] = useState<Record<string, Track[]>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [searchedQuery, setSearchedQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Track[]>([]);

  const userRef = useRef<User | null>(null);
  userRef.current = user;
  const playlistTracksRef = useRef(playlistTracksMap);
  playlistTracksRef.current = playlistTracksMap;
  const channelTracksRef = useRef(channelTracksMap);
  channelTracksRef.current = channelTracksMap;
  const channelRef = useRef(channel);
  channelRef.current = channel;
  const likesPlaylistIdRef = useRef(likesPlaylistId);
  likesPlaylistIdRef.current = likesPlaylistId;
  const playlistsRef = useRef(playlists);
  playlistsRef.current = playlists;
  const remoteLikedRef = useRef(remoteLikedTracks);
  remoteLikedRef.current = remoteLikedTracks;
  const subscriptionsRef = useRef(subscriptions);
  subscriptionsRef.current = subscriptions;

  const searchSeqRef = useRef(0);
  const hydratedUidRef = useRef<string | null>(null);

  // Keeping the user's Google session persistent across opens:
  // `isConnected` is true whenever Firebase remembers the signed-in Google account.
  const isConnected = Boolean(user);
  const needsAuth = !user;

  const persistSnapshotForCurrentUser = useCallback(
    (patch?: Partial<CachedYouTubeLibrary>) => {
      const uid = userRef.current?.uid;
      if (!uid) return;
      writeCachedLibrary(uid, {
        channel: patch?.channel !== undefined ? patch.channel : channelRef.current,
        likesPlaylistId:
          patch?.likesPlaylistId !== undefined ? patch.likesPlaylistId : likesPlaylistIdRef.current,
        playlists: patch?.playlists !== undefined ? patch.playlists : playlistsRef.current,
        remoteLikedTracks:
          patch?.remoteLikedTracks !== undefined ? patch.remoteLikedTracks : remoteLikedRef.current,
        subscriptions:
          patch?.subscriptions !== undefined ? patch.subscriptions : subscriptionsRef.current,
        playlistTracksMap:
          patch?.playlistTracksMap !== undefined
            ? patch.playlistTracksMap
            : playlistTracksRef.current,
        channelTracksMap:
          patch?.channelTracksMap !== undefined ? patch.channelTracksMap : channelTracksRef.current,
        updatedAt: Date.now(),
      });
    },
    []
  );

  const unlikedSet = useMemo(() => new Set(unlikedIds), [unlikedIds]);
  const remoteLikedSet = useMemo(
    () => new Set(remoteLikedTracks.map((t) => t.id)),
    [remoteLikedTracks]
  );

  const likedTracks = useMemo(() => {
    const merged: Track[] = [];
    const seen = new Set<string>();
    for (const t of Object.values(localLikedMap)) {
      if (unlikedSet.has(t.id) || seen.has(t.id)) continue;
      seen.add(t.id);
      merged.push({ ...t, isFavourite: true });
    }
    for (const t of remoteLikedTracks) {
      if (unlikedSet.has(t.id) || seen.has(t.id)) continue;
      seen.add(t.id);
      merged.push({ ...t, isFavourite: true });
    }
    return merged;
  }, [localLikedMap, remoteLikedTracks, unlikedSet]);

  const isYouTubeTrackLiked = useCallback(
    (trackId: string, defaultFlag?: boolean): boolean => {
      if (unlikedSet.has(trackId)) return false;
      if (localLikedMap[trackId]) return true;
      if (remoteLikedSet.has(trackId)) return true;
      return Boolean(defaultFlag);
    },
    [unlikedSet, localLikedMap, remoteLikedSet]
  );

  const toggleYouTubeLike = useCallback(
    (track: Track): boolean => {
      const currentlyLiked = isYouTubeTrackLiked(track.id, track.isFavourite);
      const nextLiked = !currentlyLiked;

      if (nextLiked) {
        setUnlikedIds((prev) => {
          const next = prev.filter((id) => id !== track.id);
          try {
            localStorage.setItem(YT_UNLIKED_STORAGE_KEY, JSON.stringify(next));
          } catch {
            // ignore
          }
          return next;
        });
        setLocalLikedMap((prev) => {
          const next = { ...prev, [track.id]: { ...track, isFavourite: true } };
          try {
            localStorage.setItem(YT_LIKED_STORAGE_KEY, JSON.stringify(next));
          } catch {
            // ignore
          }
          return next;
        });
        showToast(`Liked "${track.title}"`, 'success');
      } else {
        setLocalLikedMap((prev) => {
          if (!prev[track.id]) return prev;
          const next = { ...prev };
          delete next[track.id];
          try {
            localStorage.setItem(YT_LIKED_STORAGE_KEY, JSON.stringify(next));
          } catch {
            // ignore
          }
          return next;
        });
        setUnlikedIds((prev) => {
          const next = prev.includes(track.id) ? prev : [...prev, track.id];
          try {
            localStorage.setItem(YT_UNLIKED_STORAGE_KEY, JSON.stringify(next));
          } catch {
            // ignore
          }
          return next;
        });
        showToast(`Removed "${track.title}" from Liked`, 'info');
      }

      return nextLiked;
    },
    [isYouTubeTrackLiked, showToast]
  );

  const handleApiError = useCallback(
    (err: unknown, fallbackMessage: string, opts?: { silent?: boolean }) => {
      if (err instanceof YouTubeApiError && err.isAuthError) {
        clearYouTubeAccessToken();
        setHasLiveToken(false);
        setApiDisabledInfo(null);
        if (!opts?.silent) {
          setError('Live sync paused — tap Sync to refresh your latest YouTube changes.');
        }
        return;
      }
      if (err instanceof YouTubeApiError && err.isApiDisabled) {
        const activationUrl =
          err.activationUrl ||
          'https://console.cloud.google.com/apis/library/youtube.googleapis.com';
        setApiDisabledInfo({
          message: err.message,
          activationUrl,
        });
        setError('YouTube Data API v3 is not enabled yet on this Google Cloud project.');
        if (!opts?.silent) {
          showToast('Enable YouTube Data API v3 in Google Cloud Console to continue.', 'error');
        }
        return;
      }
      const msg = err instanceof Error ? err.message : fallbackMessage;
      setError(msg);
      if (!opts?.silent) {
        showToast(msg, 'error');
      }
    },
    [showToast]
  );

  const fetchAccountData = useCallback(
    async (token: string, opts?: { silent?: boolean }) => {
      setIsLoadingLibrary(true);
      setError(null);
      setApiDisabledInfo(null);
      try {
        const channelRes = await fetchMyYouTubeChannel(token);
        setChannel(channelRes.channel);
        setLikesPlaylistId(channelRes.likesPlaylistId);

        const [plRes, likedRes, subsRes] = await Promise.allSettled([
          fetchMyYouTubePlaylists(token),
          fetchMyLikedYouTubeMusic(token, channelRes.likesPlaylistId),
          fetchMyYouTubeSubscriptions(token),
        ]);

        let nextPlaylists = playlistsRef.current;
        if (plRes.status === 'fulfilled') {
          nextPlaylists = plRes.value;
          setPlaylists(nextPlaylists);
        } else if (plRes.reason instanceof YouTubeApiError && plRes.reason.isAuthError) {
          throw plRes.reason;
        }

        let nextLiked = remoteLikedRef.current;
        if (likedRes.status === 'fulfilled') {
          nextLiked = likedRes.value;
          setRemoteLikedTracks(nextLiked);
        } else if (likedRes.reason instanceof YouTubeApiError && likedRes.reason.isAuthError) {
          throw likedRes.reason;
        }

        let nextSubs = subscriptionsRef.current;
        if (subsRes.status === 'fulfilled') {
          nextSubs = subsRes.value;
          setSubscriptions(nextSubs);
        } else if (subsRes.reason instanceof YouTubeApiError && subsRes.reason.isAuthError) {
          throw subsRes.reason;
        }

        const nextPlaylistTracksMap = { ...playlistTracksRef.current };
        if (nextLiked.length > 0) {
          nextPlaylistTracksMap['LM'] = nextLiked;
          if (channelRes.likesPlaylistId) {
            nextPlaylistTracksMap[channelRes.likesPlaylistId] = nextLiked;
          }
          setPlaylistTracksMap(nextPlaylistTracksMap);
        }

        persistSnapshotForCurrentUser({
          channel: channelRes.channel,
          likesPlaylistId: channelRes.likesPlaylistId,
          playlists: nextPlaylists,
          remoteLikedTracks: nextLiked,
          subscriptions: nextSubs,
          playlistTracksMap: nextPlaylistTracksMap,
        });
      } catch (err) {
        handleApiError(err, 'Failed to load YouTube Music library.', opts);
      } finally {
        setIsLoadingLibrary(false);
      }
    },
    [handleApiError, persistSnapshotForCurrentUser]
  );

  useEffect(() => {
    const unsubscribe = initYouTubeAuth({
      onUserRestored: (authUser, existingToken) => {
        setUser(authUser);
        setHasLiveToken(Boolean(existingToken));
        setIsRestoringSession(false);

        if (hydratedUidRef.current !== authUser.uid) {
          hydratedUidRef.current = authUser.uid;
          const cached = readCachedLibrary(authUser.uid);
          if (cached) {
            setChannel(cached.channel);
            setLikesPlaylistId(cached.likesPlaylistId);
            setPlaylists(cached.playlists);
            setRemoteLikedTracks(cached.remoteLikedTracks);
            setSubscriptions(cached.subscriptions);
            setPlaylistTracksMap(cached.playlistTracksMap);
            setChannelTracksMap(cached.channelTracksMap);
          }
        }
      },
      onTokenObtained: (authUser, token) => {
        setUser(authUser);
        setHasLiveToken(true);
        setIsRestoringSession(false);
        setError(null);
        void fetchAccountData(token, { silent: true });
      },
      onTokenUnavailable: (authUser) => {
        setUser(authUser);
        setHasLiveToken(false);
        setIsRestoringSession(false);
      },
      onSignedOut: () => {
        hydratedUidRef.current = null;
        setUser(null);
        setHasLiveToken(false);
        setIsRestoringSession(false);
      },
    });
    return unsubscribe;
  }, [fetchAccountData]);

  const signIn = useCallback(
    async (forceAccountPicker = false): Promise<boolean> => {
      setIsLoggingIn(true);
      setError(null);
      try {
        const { user: authUser, accessToken } = await signInWithYouTube(forceAccountPicker);
        setUser(authUser);
        setHasLiveToken(true);
        setIsRestoringSession(false);
        showToast('Connected to YouTube Music', 'success');
        await fetchAccountData(accessToken);
        return true;
      } catch (err) {
        const rawMsg = err instanceof Error ? err.message : '';
        const signInCanceled =
          (typeof err === 'object' &&
            err !== null &&
            'code' in err &&
            err.code === 'SIGN_IN_CANCELED') ||
          rawMsg.toLowerCase().includes('activity cancelled by user');
        const msg = signInCanceled
          ? 'Google sign-in was canceled. If this happened after selecting your account, verify the Android OAuth client matches com.neoplayer.music and the SHA-1 signing certificate for this installed build. If the OAuth consent screen is in testing, add this Google account as a test user, then retry and approve YouTube access.'
          : rawMsg.includes('popup-closed')
          ? 'Google sign-in was cancelled.'
          : rawMsg.includes('popup-blocked')
            ? 'Browser blocked the Google window — tap Sync once more to confirm permissions.'
            : rawMsg || 'Failed to connect Google account.';
        setError(msg);
        showToast(msg, 'error');
        return false;
      } finally {
        setIsLoggingIn(false);
      }
    },
    [fetchAccountData, showToast]
  );

  const signOut = useCallback(async () => {
    youtubePlayer.pause();
    const prevUid = userRef.current?.uid;
    await signOutYouTube();
    if (prevUid) {
      removeCachedLibrary(prevUid);
    }
    hydratedUidRef.current = null;
    setUser(null);
    setHasLiveToken(false);
    setIsRestoringSession(false);
    setChannel(null);
    setLikesPlaylistId(undefined);
    setPlaylists([]);
    setRemoteLikedTracks([]);
    setSubscriptions([]);
    setPlaylistTracksMap({});
    setChannelTracksMap({});
    setSearchResults([]);
    setSearchQuery('');
    setSearchedQuery('');
    setError(null);
    setApiDisabledInfo(null);
    showToast('Disconnected from YouTube Music', 'info');
  }, [showToast]);

  const refreshAll = useCallback(async () => {
    const token = getYouTubeAccessToken();
    if (!token) {
      // Explicit user tap on Sync: refresh OAuth cleanly with login_hint (no forced consent)
      await signIn(false);
      return;
    }
    await fetchAccountData(token);
  }, [fetchAccountData, signIn]);

  const loadPlaylistTracks = useCallback(
    async (playlistId: string, playlistTitle = 'YouTube Playlist', force = false) => {
      if (!force && playlistTracksRef.current[playlistId]?.length) {
        return playlistTracksRef.current[playlistId];
      }

      const token = getYouTubeAccessToken();
      const isPrivateLikes = playlistId === 'LM' || playlistId === likesPlaylistId;
      if (!token && isPrivateLikes) {
        if (playlistTracksRef.current[playlistId]) {
          return playlistTracksRef.current[playlistId];
        }
        return [];
      }

      setIsLoadingTracks(true);
      setError(null);
      try {
        const loaded =
          isPrivateLikes && token
            ? await fetchMyLikedYouTubeMusic(token, likesPlaylistId)
            : await fetchYouTubePlaylistTracks(token, playlistId, playlistTitle);
        setPlaylistTracksMap((prev) => {
          const next = { ...prev, [playlistId]: loaded };
          persistSnapshotForCurrentUser({ playlistTracksMap: next });
          return next;
        });
        return loaded;
      } catch (err) {
        if (playlistTracksRef.current[playlistId]?.length) {
          return playlistTracksRef.current[playlistId];
        }
        // When browsing without an active OAuth token, private playlists return 401/403/404;
        // let the inline "Load Playlist" card handle re-sync cleanly without a global error banner.
        if (
          !token &&
          err instanceof YouTubeApiError &&
          (err.isAuthError || err.status === 403 || err.status === 404)
        ) {
          return [];
        }
        handleApiError(err, 'Failed to load YouTube playlist tracks.');
        return [];
      } finally {
        setIsLoadingTracks(false);
      }
    },
    [likesPlaylistId, handleApiError, persistSnapshotForCurrentUser]
  );

  const loadChannelTracks = useCallback(
    async (channelId: string, channelTitle: string, force = false) => {
      if (!force && channelTracksRef.current[channelId]?.length) {
        return channelTracksRef.current[channelId];
      }

      const token = getYouTubeAccessToken();
      setIsLoadingTracks(true);
      setError(null);
      try {
        const loaded = await fetchYouTubeChannelTracks(token, channelId, channelTitle);
        setChannelTracksMap((prev) => {
          const next = { ...prev, [channelId]: loaded };
          persistSnapshotForCurrentUser({ channelTracksMap: next });
          return next;
        });
        return loaded;
      } catch (err) {
        if (channelTracksRef.current[channelId]?.length) {
          return channelTracksRef.current[channelId];
        }
        handleApiError(err, 'Failed to load channel tracks.');
        return [];
      } finally {
        setIsLoadingTracks(false);
      }
    },
    [handleApiError, persistSnapshotForCurrentUser]
  );

  const searchMusic = useCallback(
    async (query: string, force = false) => {
      const trimmed = query.trim();
      setSearchQuery(query);
      if (!trimmed) {
        searchSeqRef.current += 1;
        setSearchResults([]);
        setSearchedQuery('');
        return [];
      }
      if (!force && trimmed === searchedQuery && searchResults.length > 0) {
        return searchResults;
      }

      const token = getYouTubeAccessToken();
      const seq = ++searchSeqRef.current;
      setIsSearching(true);
      setError(null);
      setApiDisabledInfo(null);

      try {
        // Uses live OAuth Bearer token when present, or public YouTube API key immediately
        const items = await searchYouTubeMusic(token, trimmed);
        if (seq === searchSeqRef.current) {
          setSearchResults(items);
          setSearchedQuery(trimmed);
          setApiDisabledInfo(null);
        }
        return items;
      } catch (err) {
        if (seq === searchSeqRef.current) {
          handleApiError(err, 'YouTube Music search failed.');
        }
        return [];
      } finally {
        if (seq === searchSeqRef.current) {
          setIsSearching(false);
        }
      }
    },
    [handleApiError, searchedQuery, searchResults]
  );

  const clearSearch = useCallback(() => {
    searchSeqRef.current += 1;
    setSearchQuery('');
    setSearchedQuery('');
    setSearchResults([]);
  }, []);

  return (
    <YouTubeContext.Provider
      value={{
        user,
        isConnected,
        hasLiveToken,
        isRestoringSession,
        needsAuth,
        isLoggingIn,
        isLoadingLibrary,
        isLoadingTracks,
        isSearching,
        error,
        apiDisabledInfo,
        channel,
        playlists,
        likedTracks,
        subscriptions,
        playlistTracksMap,
        channelTracksMap,
        searchQuery,
        searchedQuery,
        searchResults,
        signIn,
        signOut,
        refreshAll,
        loadPlaylistTracks,
        loadChannelTracks,
        searchMusic,
        clearSearch,
        isYouTubeTrackLiked,
        toggleYouTubeLike,
      }}
    >
      {children}
    </YouTubeContext.Provider>
  );
};

export function useYouTube(): YouTubeContextValue {
  const ctx = useContext(YouTubeContext);
  if (!ctx) throw new Error('useYouTube must be used within YouTubeProvider');
  return ctx;
}
