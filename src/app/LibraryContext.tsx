import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { parseLrc } from '../lib/lrcParser';
import { sanitizeText } from '../lib/format';
import { createId } from '../lib/utils';
import { MediaStore, isNativeMediaStoreAvailable } from '../plugins/mediaStore';
import { db } from '../services/db';
import {
  enrichTrackOnline,
  fetchBestLyrics,
  type LyricsCandidate,
  type TrackEnrichmentOptions,
} from '../services/enrichmentService';
import {
  calculateStorageBreakdown,
  deriveAlbums,
  deriveArtists,
  importAudioFiles,
  importMediaStoreTracks,
  removeTrackArtwork,
  replaceTrackArtwork,
  updateTrackInfo,
} from '../services/libraryService';
import type {
  Album,
  Artist,
  LyricsDocument,
  Playlist,
  SmartPlaylistDraft,
  StorageBreakdown,
  Track,
} from '../types/music';
import { useToast } from './ToastContext';

interface ImportProgress {
  active: boolean;
  done: number;
  total: number;
  currentFile: string;
}

interface EnrichProgress {
  active: boolean;
  done: number;
  total: number;
  currentTitle: string;
}

interface LibraryContextValue {
  tracks: Track[];
  albums: Album[];
  artists: Artist[];
  playlists: Playlist[];
  lyricsMap: Record<string, LyricsDocument>;
  isLoading: boolean;
  isScanningMediaStore: boolean;
  importProgress: ImportProgress;
  enrichProgress: EnrichProgress;
  importFiles: (files: FileList | File[]) => Promise<Track[]>;
  scanDeviceMediaStore: () => Promise<Track[]>;
  downloadLyricsForTrack: (
    trackId: string,
    candidate?: LyricsCandidate,
    options?: { silent?: boolean; track?: Track }
  ) => Promise<'synced' | 'plain' | null>;
  enrichTrack: (
    trackId: string,
    options?: Partial<TrackEnrichmentOptions>
  ) => Promise<boolean>;
  enrichTracksBatch: (
    trackIds?: string[],
    options?: Partial<TrackEnrichmentOptions>
  ) => Promise<{ updatedCount: number }>;
  cancelBatchEnrich: () => void;
  toggleFavourite: (trackId: string) => Promise<void>;
  batchFavourite: (trackIds: string[], favourite: boolean) => Promise<void>;
  updateTrack: (
    trackId: string,
    patch: Partial<
      Pick<
        Track,
        'title' | 'artist' | 'album' | 'albumArtist' | 'genre' | 'year' | 'trackNumber' | 'moodTags'
      >
    >
  ) => Promise<void>;
  updateTrackArtwork: (trackId: string, imageFile: File) => Promise<void>;
  deleteTrackArtwork: (trackId: string) => Promise<void>;
  deleteTracks: (trackIds: string[]) => Promise<void>;
  recordTrackPlay: (trackId: string) => Promise<void>;
  saveTrackPosition: (trackId: string, position: number) => Promise<void>;
  createPlaylist: (input: {
    name: string;
    description?: string;
    moodCategoryId?: string;
    smartKey?: string;
    initialTrackIds?: string[];
  }) => Promise<Playlist>;
  upsertSmartPlaylist: (draft: SmartPlaylistDraft, silent?: boolean) => Promise<Playlist>;
  generateSmartMixes: (drafts: SmartPlaylistDraft[]) => Promise<Playlist[]>;
  updatePlaylist: (
    playlistId: string,
    patch: Partial<Pick<Playlist, 'name' | 'description' | 'moodCategoryId'>>
  ) => Promise<void>;
  setPlaylistArtwork: (playlistId: string, imageFile: File) => Promise<void>;
  deletePlaylist: (playlistId: string) => Promise<void>;
  addTracksToPlaylist: (playlistId: string, trackIds: string[]) => Promise<void>;
  removeTrackFromPlaylist: (playlistId: string, trackIndex: number) => Promise<void>;
  reorderPlaylistTracks: (playlistId: string, fromIndex: number, toIndex: number) => Promise<void>;
  saveLyrics: (
    trackId: string,
    rawContent: string,
    source?: 'manual' | 'imported',
    options?: { silent?: boolean }
  ) => Promise<LyricsDocument>;
  deleteLyrics: (trackId: string) => Promise<void>;
  getStorageBreakdown: () => Promise<StorageBreakdown>;
  exportLibraryMetadata: () => string;
  clearPlayHistory: () => Promise<void>;
  clearAllLibrary: () => Promise<void>;
}

const LibraryContext = createContext<LibraryContextValue | null>(null);

export const LibraryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { showToast } = useToast();
  const [tracks, setTracks] = useState<Track[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [lyricsMap, setLyricsMap] = useState<Record<string, LyricsDocument>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isScanningMediaStore, setIsScanningMediaStore] = useState(false);
  const [importProgress, setImportProgress] = useState<ImportProgress>({
    active: false,
    done: 0,
    total: 0,
    currentFile: '',
  });
  const [enrichProgress, setEnrichProgress] = useState<EnrichProgress>({
    active: false,
    done: 0,
    total: 0,
    currentTitle: '',
  });

  const tracksRef = useRef<Track[]>(tracks);
  tracksRef.current = tracks;
  const playlistsRef = useRef<Playlist[]>(playlists);
  playlistsRef.current = playlists;
  const lyricsMapRef = useRef<Record<string, LyricsDocument>>(lyricsMap);
  lyricsMapRef.current = lyricsMap;
  const enrichCancelRef = useRef(false);

  useEffect(() => {
    let active = true;
    Promise.all([db.getAllTracks(), db.getAllPlaylists(), db.getAllLyrics()])
      .then(([loadedTracks, loadedPlaylists, loadedLyrics]) => {
        if (!active) return;
        setTracks(loadedTracks.sort((a, b) => b.addedAt - a.addedAt));
        setPlaylists(loadedPlaylists.sort((a, b) => b.updatedAt - a.updatedAt));
        const map: Record<string, LyricsDocument> = {};
        for (const doc of loadedLyrics) {
          map[doc.trackId] = doc;
        }
        setLyricsMap(map);
      })
      .catch(() => {
        if (active) showToast('Failed to read local music library from IndexedDB.', 'error');
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [showToast]);

  const albums = useMemo(() => deriveAlbums(tracks), [tracks]);
  const artists = useMemo(() => deriveArtists(tracks), [tracks]);

  const importFiles = useCallback(
    async (input: FileList | File[]) => {
      const files = Array.from(input);
      if (files.length === 0) return [];

      setImportProgress({ active: true, done: 0, total: files.length, currentFile: files[0].name });
      const result = await importAudioFiles(files, tracks, (done, total, currentFile) => {
        setImportProgress({ active: done < total, done, total, currentFile });
      });
      setImportProgress({ active: false, done: 0, total: 0, currentFile: '' });

      if (result.importedTracks.length > 0) {
        setTracks((prev) => [...result.importedTracks, ...prev].sort((a, b) => b.addedAt - a.addedAt));
        const allLyrics = await db.getAllLyrics();
        const nextMap: Record<string, LyricsDocument> = {};
        for (const doc of allLyrics) nextMap[doc.trackId] = doc;
        setLyricsMap(nextMap);
        showToast(
          `Imported ${result.importedTracks.length} track${result.importedTracks.length === 1 ? '' : 's'} offline`,
          'success'
        );
      }

      if (result.quotaError) {
        showToast(result.quotaError, 'error');
      } else if (result.skippedFiles.length > 0 && result.importedTracks.length === 0) {
        showToast(
          `Skipped ${result.skippedFiles.length} file(s): ${result.skippedFiles[0].reason}`,
          'info'
        );
      } else if (result.skippedFiles.length > 0) {
        showToast(`Skipped ${result.skippedFiles.length} duplicate or unsupported file(s)`, 'info');
      }

      if (result.importedTracks.length > 0) {
        try {
          const currentSettings = await db.getSettings();
          if (currentSettings.autoEnrichOnImport) {
            void runBatchEnrichment(
              result.importedTracks.map((t) => t.id),
              {
                mode: 'missing-only',
                fetchMetadata: true,
                fetchCover: true,
                fetchLyrics: true,
              },
              result.importedTracks
            );
          }
        } catch {
          // Ignore settings lookup errors
        }
      }

      return result.importedTracks;
    },
    [tracks, showToast]
  );

  const scanDeviceMediaStore = useCallback(async () => {
    if (!isNativeMediaStoreAvailable()) {
      showToast('MediaStore device scanning requires the compiled Android app.', 'info');
      return [];
    }

    setIsScanningMediaStore(true);
    try {
      let perm = await MediaStore.checkAudioPermission();
      if (!perm.granted) {
        perm = await MediaStore.requestAudioPermission();
      }
      if (!perm.granted) {
        showToast('Audio permission is required to scan music on this Android device.', 'error');
        return [];
      }

      setImportProgress({
        active: true,
        done: 0,
        total: 1,
        currentFile: 'Scanning Android MediaStore...',
      });

      const scanResult = await MediaStore.scanAudioTracks({
        minDurationMs: 5000,
        includeArtwork: true,
      });

      if (!scanResult.tracks || scanResult.tracks.length === 0) {
        setImportProgress({ active: false, done: 0, total: 0, currentFile: '' });
        showToast('No music tracks found in Android MediaStore.', 'info');
        return [];
      }

      const result = await importMediaStoreTracks(
        scanResult.tracks,
        tracks,
        (done, total, currentFile) => {
          setImportProgress({ active: done < total, done, total, currentFile });
        }
      );

      setImportProgress({ active: false, done: 0, total: 0, currentFile: '' });

      if (result.importedTracks.length > 0) {
        setTracks((prev) =>
          [...result.importedTracks, ...prev].sort((a, b) => b.addedAt - a.addedAt)
        );
        showToast(
          `Added ${result.importedTracks.length} track${result.importedTracks.length === 1 ? '' : 's'} from Android MediaStore`,
          'success'
        );
        try {
          const currentSettings = await db.getSettings();
          if (currentSettings.autoEnrichOnImport) {
            void runBatchEnrichment(
              result.importedTracks.map((t) => t.id),
              {
                mode: 'missing-only',
                fetchMetadata: true,
                fetchCover: true,
                fetchLyrics: true,
              },
              result.importedTracks
            );
          }
        } catch {
          // Ignore settings lookup errors
        }
      } else if (result.quotaError) {
        showToast(result.quotaError, 'error');
      } else {
        showToast('Device music library is already up to date.', 'info');
      }

      return result.importedTracks;
    } catch (err) {
      setImportProgress({ active: false, done: 0, total: 0, currentFile: '' });
      showToast(
        err instanceof Error ? err.message : 'Failed to scan Android MediaStore.',
        'error'
      );
      return [];
    } finally {
      setIsScanningMediaStore(false);
    }
  }, [tracks, showToast]);

  const toggleFavourite = useCallback(async (trackId: string) => {
    setTracks((prev) =>
      prev.map((t) => {
        if (t.id !== trackId) return t;
        const updated = { ...t, isFavourite: !t.isFavourite };
        void db.putTrack(updated);
        return updated;
      })
    );
  }, []);

  const batchFavourite = useCallback(async (trackIds: string[], favourite: boolean) => {
    const idSet = new Set(trackIds);
    setTracks((prev) =>
      prev.map((t) => {
        if (!idSet.has(t.id)) return t;
        const updated = { ...t, isFavourite: favourite };
        void db.putTrack(updated);
        return updated;
      })
    );
  }, []);

  const updateTrack = useCallback(
    async (
      trackId: string,
      patch: Partial<
        Pick<
          Track,
          'title' | 'artist' | 'album' | 'albumArtist' | 'genre' | 'year' | 'trackNumber' | 'moodTags'
        >
      >
    ) => {
      const target = tracks.find((t) => t.id === trackId);
      if (!target) return;
      const updated = await updateTrackInfo(target, patch);
      setTracks((prev) => prev.map((t) => (t.id === trackId ? updated : t)));
      showToast('Track information saved', 'success');
    },
    [tracks, showToast]
  );

  const updateTrackArtwork = useCallback(
    async (trackId: string, imageFile: File) => {
      const target = tracks.find((t) => t.id === trackId);
      if (!target) return;
      const updated = await replaceTrackArtwork(target, imageFile, tracks, playlists);
      setTracks((prev) => prev.map((t) => (t.id === trackId ? updated : t)));
      showToast('Album artwork updated', 'success');
    },
    [tracks, playlists, showToast]
  );

  const deleteTrackArtwork = useCallback(
    async (trackId: string) => {
      const target = tracks.find((t) => t.id === trackId);
      if (!target) return;
      const updated = await removeTrackArtwork(target, tracks, playlists);
      setTracks((prev) => prev.map((t) => (t.id === trackId ? updated : t)));
      showToast('Album artwork removed', 'info');
    },
    [tracks, playlists, showToast]
  );

  const deleteTracks = useCallback(
    async (trackIds: string[]) => {
      if (trackIds.length === 0) return;
      const idSet = new Set(trackIds);
      const remainingTracks = tracks.filter((t) => !idSet.has(t.id));

      // Clean orphaned artworks
      const removedArtIds = tracks
        .filter((t) => idSet.has(t.id) && t.artworkId)
        .map((t) => t.artworkId as string);
      const stillUsedArt = new Set<string>();
      for (const t of remainingTracks) if (t.artworkId) stillUsedArt.add(t.artworkId);
      for (const p of playlists) if (p.artworkId) stillUsedArt.add(p.artworkId);
      const orphanedArt = removedArtIds.filter((id) => !stillUsedArt.has(id));

      await db.deleteTracks(trackIds);
      await db.deleteArtworks(orphanedArt);

      // Remove from playlists
      const nextPlaylists = playlists.map((p) => {
        const filtered = p.trackIds.filter((tid) => !idSet.has(tid));
        if (filtered.length !== p.trackIds.length) {
          const updatedPl = { ...p, trackIds: filtered, updatedAt: Date.now() };
          void db.putPlaylist(updatedPl);
          return updatedPl;
        }
        return p;
      });

      setTracks(remainingTracks);
      setPlaylists(nextPlaylists);
      setLyricsMap((prev) => {
        const next = { ...prev };
        for (const id of trackIds) delete next[id];
        return next;
      });
      showToast(`Removed ${trackIds.length} track${trackIds.length === 1 ? '' : 's'}`, 'info');
    },
    [tracks, playlists, showToast]
  );

  const recordTrackPlay = useCallback(async (trackId: string) => {
    setTracks((prev) =>
      prev.map((t) => {
        if (t.id !== trackId) return t;
        const updated: Track = {
          ...t,
          playCount: (t.playCount || 0) + 1,
          lastPlayedAt: Date.now(),
        };
        void db.putTrack(updated);
        return updated;
      })
    );
  }, []);

  const saveTrackPosition = useCallback(async (trackId: string, position: number) => {
    setTracks((prev) =>
      prev.map((t) => {
        if (t.id !== trackId) return t;
        const updated: Track = { ...t, lastPosition: position };
        void db.putTrack(updated);
        return updated;
      })
    );
  }, []);

  const createPlaylist = useCallback(
    async (input: {
      name: string;
      description?: string;
      moodCategoryId?: string;
      smartKey?: string;
      initialTrackIds?: string[];
    }) => {
      const now = Date.now();
      const playlist: Playlist = {
        id: createId('pl'),
        name: sanitizeText(input.name, 'Untitled Playlist'),
        description: sanitizeText(input.description || ''),
        moodCategoryId: input.moodCategoryId || undefined,
        smartKey: input.smartKey || undefined,
        trackIds: input.initialTrackIds || [],
        createdAt: now,
        updatedAt: now,
      };
      await db.putPlaylist(playlist);
      setPlaylists((prev) => [playlist, ...prev]);
      showToast(`Created "${playlist.name}"`, 'success');
      return playlist;
    },
    [showToast]
  );

  const upsertSmartPlaylist = useCallback(
    async (draft: SmartPlaylistDraft, silent = false): Promise<Playlist> => {
      const existing = playlistsRef.current.find((p) => p.smartKey === draft.smartKey);
      const now = Date.now();
      if (existing) {
        const updated: Playlist = {
          ...existing,
          name: sanitizeText(draft.name, existing.name),
          description: sanitizeText(draft.description),
          moodCategoryId: draft.moodCategoryId || existing.moodCategoryId,
          trackIds: draft.trackIds,
          updatedAt: now,
        };
        await db.putPlaylist(updated);
        setPlaylists((prev) =>
          prev.map((p) => (p.id === updated.id ? updated : p)).sort((a, b) => b.updatedAt - a.updatedAt)
        );
        if (!silent) {
          showToast(`Refreshed "${updated.name}" (${updated.trackIds.length} tracks)`, 'success');
        }
        return updated;
      }

      const created: Playlist = {
        id: createId('pl'),
        name: sanitizeText(draft.name, 'Smart Mix'),
        description: sanitizeText(draft.description),
        moodCategoryId: draft.moodCategoryId,
        smartKey: draft.smartKey,
        trackIds: draft.trackIds,
        createdAt: now,
        updatedAt: now,
      };
      await db.putPlaylist(created);
      setPlaylists((prev) => [created, ...prev]);
      if (!silent) {
        showToast(`Created mix "${created.name}" (${created.trackIds.length} tracks)`, 'success');
      }
      return created;
    },
    [showToast]
  );

  const generateSmartMixes = useCallback(
    async (drafts: SmartPlaylistDraft[]): Promise<Playlist[]> => {
      if (drafts.length === 0) {
        showToast('Import at least one track first so Neo Player can build your mixes.', 'info');
        return [];
      }
      const results: Playlist[] = [];
      for (const draft of drafts) {
        const pl = await upsertSmartPlaylist(draft, true);
        results.push(pl);
      }
      showToast(
        `Created & synced ${results.length} tailored ${results.length === 1 ? 'mix' : 'mixes'}`,
        'success'
      );
      return results;
    },
    [upsertSmartPlaylist, showToast]
  );

  const updatePlaylist = useCallback(
    async (
      playlistId: string,
      patch: Partial<Pick<Playlist, 'name' | 'description' | 'moodCategoryId'>>
    ) => {
      setPlaylists((prev) =>
        prev.map((p) => {
          if (p.id !== playlistId) return p;
          const updated: Playlist = {
            ...p,
            name: patch.name !== undefined ? sanitizeText(patch.name, p.name) : p.name,
            description:
              patch.description !== undefined
                ? sanitizeText(patch.description)
                : p.description,
            moodCategoryId:
              patch.moodCategoryId !== undefined ? patch.moodCategoryId : p.moodCategoryId,
            updatedAt: Date.now(),
          };
          void db.putPlaylist(updated);
          return updated;
        })
      );
      showToast('Playlist updated', 'success');
    },
    [showToast]
  );

  const setPlaylistArtwork = useCallback(
    async (playlistId: string, imageFile: File) => {
      const target = playlists.find((p) => p.id === playlistId);
      if (!target) return;
      const newArtId = createId('art');
      await db.putArtwork({
        id: newArtId,
        blob: imageFile,
        size: imageFile.size,
        mimeType: imageFile.type || 'image/jpeg',
      });
      const oldArtId = target.artworkId;
      const updated: Playlist = { ...target, artworkId: newArtId, updatedAt: Date.now() };
      await db.putPlaylist(updated);
      setPlaylists((prev) => prev.map((p) => (p.id === playlistId ? updated : p)));
      if (oldArtId) {
        const usedElsewhere =
          tracks.some((t) => t.artworkId === oldArtId) ||
          playlists.some((p) => p.id !== playlistId && p.artworkId === oldArtId);
        if (!usedElsewhere) await db.deleteArtworks([oldArtId]);
      }
      showToast('Playlist cover updated', 'success');
    },
    [playlists, tracks, showToast]
  );

  const deletePlaylist = useCallback(
    async (playlistId: string) => {
      const target = playlists.find((p) => p.id === playlistId);
      await db.deletePlaylist(playlistId);
      setPlaylists((prev) => prev.filter((p) => p.id !== playlistId));
      if (target?.artworkId) {
        const usedElsewhere =
          tracks.some((t) => t.artworkId === target.artworkId) ||
          playlists.some((p) => p.id !== playlistId && p.artworkId === target.artworkId);
        if (!usedElsewhere) await db.deleteArtworks([target.artworkId]);
      }
      showToast('Playlist deleted', 'info');
    },
    [playlists, tracks, showToast]
  );

  const addTracksToPlaylist = useCallback(
    async (playlistId: string, trackIds: string[]) => {
      if (trackIds.length === 0) return;
      setPlaylists((prev) =>
        prev.map((p) => {
          if (p.id !== playlistId) return p;
          const updated: Playlist = {
            ...p,
            trackIds: [...p.trackIds, ...trackIds],
            updatedAt: Date.now(),
          };
          void db.putPlaylist(updated);
          return updated;
        })
      );
      showToast(
        `Added ${trackIds.length} track${trackIds.length === 1 ? '' : 's'} to playlist`,
        'success'
      );
    },
    [showToast]
  );

  const removeTrackFromPlaylist = useCallback(async (playlistId: string, trackIndex: number) => {
    setPlaylists((prev) =>
      prev.map((p) => {
        if (p.id !== playlistId) return p;
        const nextIds = p.trackIds.slice();
        nextIds.splice(trackIndex, 1);
        const updated: Playlist = { ...p, trackIds: nextIds, updatedAt: Date.now() };
        void db.putPlaylist(updated);
        return updated;
      })
    );
  }, []);

  const reorderPlaylistTracks = useCallback(
    async (playlistId: string, fromIndex: number, toIndex: number) => {
      setPlaylists((prev) =>
        prev.map((p) => {
          if (p.id !== playlistId) return p;
          if (
            fromIndex < 0 ||
            toIndex < 0 ||
            fromIndex >= p.trackIds.length ||
            toIndex >= p.trackIds.length
          ) {
            return p;
          }
          const nextIds = p.trackIds.slice();
          const [moved] = nextIds.splice(fromIndex, 1);
          nextIds.splice(toIndex, 0, moved);
          const updated: Playlist = { ...p, trackIds: nextIds, updatedAt: Date.now() };
          void db.putPlaylist(updated);
          return updated;
        })
      );
    },
    []
  );

  const saveLyrics = useCallback(
    async (
      trackId: string,
      rawContent: string,
      source: 'manual' | 'imported' = 'manual',
      options?: { silent?: boolean }
    ) => {
      const parsed = parseLrc(rawContent);
      const doc: LyricsDocument = {
        trackId,
        type: parsed.isSynced ? 'synced' : 'plain',
        plainText: parsed.plainText,
        syncedLines: parsed.syncedLines,
        rawLrc: parsed.isSynced ? rawContent : undefined,
        source,
        updatedAt: Date.now(),
      };
      await db.putLyrics(doc);
      setLyricsMap((prev) => ({ ...prev, [trackId]: doc }));
      if (!options?.silent) {
        showToast(parsed.isSynced ? 'Synchronized lyrics saved' : 'Lyrics saved', 'success');
      }
      return doc;
    },
    [showToast]
  );

  const deleteLyrics = useCallback(
    async (trackId: string) => {
      await db.deleteLyrics(trackId);
      setLyricsMap((prev) => {
        const next = { ...prev };
        delete next[trackId];
        return next;
      });
      showToast('Lyrics cleared', 'info');
    },
    [showToast]
  );

  const applyEnrichmentToTrack = useCallback(
    async (
      target: Track,
      options: TrackEnrichmentOptions,
      silent = false
    ): Promise<{ updated: boolean; summary: string[] }> => {
      const res = await enrichTrackOnline(target, options);
      let workingTrack = target;
      const summary: string[] = [];

      if (Object.keys(res.trackPatch).length > 0) {
        workingTrack = await updateTrackInfo(workingTrack, res.trackPatch);
        setTracks((prev) => prev.map((t) => (t.id === workingTrack.id ? workingTrack : t)));
        summary.push('tags');
      }

      if (res.coverBlob) {
        const coverFile = new File([res.coverBlob], `${workingTrack.id}-cover.jpg`, {
          type: res.coverBlob.type || 'image/jpeg',
        });
        workingTrack = await replaceTrackArtwork(
          workingTrack,
          coverFile,
          tracksRef.current,
          playlistsRef.current
        );
        setTracks((prev) => prev.map((t) => (t.id === workingTrack.id ? workingTrack : t)));
        summary.push('cover');
      }

      if (res.lyricsContent) {
        const parsed = parseLrc(res.lyricsContent);
        const doc: LyricsDocument = {
          trackId: workingTrack.id,
          type: parsed.isSynced ? 'synced' : 'plain',
          plainText: parsed.plainText,
          syncedLines: parsed.syncedLines,
          rawLrc: parsed.isSynced ? res.lyricsContent : undefined,
          source: 'imported',
          updatedAt: Date.now(),
        };
        await db.putLyrics(doc);
        setLyricsMap((prev) => ({ ...prev, [workingTrack.id]: doc }));
        summary.push(parsed.isSynced ? 'synced lyrics' : 'plain lyrics');
      }

      if (!silent) {
        if (summary.length > 0) {
          showToast(`Updated ${summary.join(', ')} for "${workingTrack.title}"`, 'success');
        } else {
          showToast(`No new online matches found for "${workingTrack.title}"`, 'info');
        }
      }

      return { updated: summary.length > 0, summary };
    },
    [showToast]
  );

  const downloadLyricsForTrack = useCallback(
    async (
      trackId: string,
      preferredCandidate?: LyricsCandidate,
      options?: { silent?: boolean; track?: Track }
    ): Promise<'synced' | 'plain' | null> => {
      const target = tracksRef.current.find((t) => t.id === trackId) ?? options?.track;
      if (!target) return null;

      try {
        const candidate = preferredCandidate ?? (await fetchBestLyrics(target));
        const content = candidate?.syncedLyrics || candidate?.plainLyrics;
        if (!content) {
          if (!options?.silent) {
            showToast(`No lyrics found online for "${target.title}"`, 'info');
          }
          return null;
        }
        const doc = await saveLyrics(trackId, content, 'imported', options);
        return doc.type;
      } catch (err) {
        if (!options?.silent) {
          showToast(
            err instanceof Error ? err.message : 'Failed to fetch lyrics from LRCLIB.',
            'error'
          );
        }
        return null;
      }
    },
    [saveLyrics, showToast]
  );

  const enrichTrack = useCallback(
    async (trackId: string, options?: Partial<TrackEnrichmentOptions>): Promise<boolean> => {
      const target = tracksRef.current.find((t) => t.id === trackId);
      if (!target) return false;
      try {
        const { updated } = await applyEnrichmentToTrack(
          target,
          {
            mode: options?.mode ?? 'overwrite',
            fetchMetadata: options?.fetchMetadata ?? true,
            fetchCover: options?.fetchCover ?? true,
            fetchLyrics: options?.fetchLyrics ?? true,
          },
          false
        );
        return updated;
      } catch (err) {
        showToast(
          err instanceof Error ? err.message : 'Failed to enrich track online.',
          'error'
        );
        return false;
      }
    },
    [applyEnrichmentToTrack, showToast]
  );

  const runBatchEnrichment = async (
    trackIds?: string[],
    options?: Partial<TrackEnrichmentOptions>,
    explicitTrackList?: Track[]
  ): Promise<{ updatedCount: number }> => {
    const sourceTracks = explicitTrackList ?? tracksRef.current;
    const targetIds = trackIds
      ? new Set(trackIds)
      : new Set(
          sourceTracks
            .filter(
              (t) =>
                !t.artworkId ||
                !lyricsMapRef.current[t.id] ||
                !t.artist ||
                t.artist.trim().toLowerCase() === 'unknown artist' ||
                t.album.trim().toLowerCase() === 'single'
            )
            .map((t) => t.id)
        );

    const queue = sourceTracks.filter((t) => targetIds.has(t.id));
    if (queue.length === 0) {
      showToast('All tracks already have tags, covers, and lyrics.', 'info');
      return { updatedCount: 0 };
    }

    enrichCancelRef.current = false;
    let updatedCount = 0;

    setEnrichProgress({
      active: true,
      done: 0,
      total: queue.length,
      currentTitle: queue[0].title,
    });

    for (let i = 0; i < queue.length; i++) {
      if (enrichCancelRef.current) break;
      const item = tracksRef.current.find((t) => t.id === queue[i].id) ?? queue[i];
      setEnrichProgress({
        active: true,
        done: i,
        total: queue.length,
        currentTitle: item.title,
      });

      const hasLyrics = Boolean(lyricsMapRef.current[item.id]);
      const needsTagsOrCover =
        !item.artworkId ||
        !item.artist ||
        item.artist.trim().toLowerCase() === 'unknown artist' ||
        item.album.trim().toLowerCase() === 'single' ||
        item.genre.trim().toLowerCase() === 'unclassified';

      try {
        const res = await applyEnrichmentToTrack(
          item,
          {
            mode: options?.mode ?? 'missing-only',
            fetchMetadata: options?.fetchMetadata ?? needsTagsOrCover,
            fetchCover: options?.fetchCover ?? !item.artworkId,
            fetchLyrics: options?.fetchLyrics ?? !hasLyrics,
          },
          true
        );
        if (res.updated) updatedCount++;
      } catch {
        // Continue to next track if one lookup fails
      }
    }

    setEnrichProgress({ active: false, done: 0, total: 0, currentTitle: '' });

    if (enrichCancelRef.current) {
      showToast(
        `Stopped auto-enrich (${updatedCount} track${updatedCount === 1 ? '' : 's'} updated)`,
        'info'
      );
    } else if (updatedCount > 0) {
      showToast(
        `Auto-enriched ${updatedCount} track${updatedCount === 1 ? '' : 's'} with tags, covers & lyrics`,
        'success'
      );
    } else {
      showToast('No additional tags, covers, or lyrics matched online.', 'info');
    }

    return { updatedCount };
  };

  const enrichTracksBatch = useCallback(
    async (trackIds?: string[], options?: Partial<TrackEnrichmentOptions>) => {
      return runBatchEnrichment(trackIds, options);
    },
    [applyEnrichmentToTrack, showToast]
  );

  const cancelBatchEnrich = useCallback(() => {
    enrichCancelRef.current = true;
  }, []);

  const getStorageBreakdown = useCallback(async () => {
    return calculateStorageBreakdown(tracks, playlists);
  }, [tracks, playlists]);

  const exportLibraryMetadata = useCallback(() => {
    return JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        app: 'Neo Player',
        tracks,
        playlists,
        lyrics: Object.values(lyricsMap),
      },
      null,
      2
    );
  }, [tracks, playlists, lyricsMap]);

  const clearPlayHistory = useCallback(async () => {
    setTracks((prev) =>
      prev.map((t) => {
        const updated: Track = {
          ...t,
          playCount: 0,
          lastPlayedAt: undefined,
          lastPosition: undefined,
        };
        void db.putTrack(updated);
        return updated;
      })
    );
    showToast('Listening history cleared', 'info');
  }, [showToast]);

  const clearAllLibrary = useCallback(async () => {
    await db.clearLibraryData();
    setTracks([]);
    setPlaylists([]);
    setLyricsMap({});
    showToast('Local library cleared', 'info');
  }, [showToast]);

  return (
    <LibraryContext.Provider
      value={{
        tracks,
        albums,
        artists,
        playlists,
        lyricsMap,
        isLoading,
        isScanningMediaStore,
        importProgress,
        enrichProgress,
        importFiles,
        scanDeviceMediaStore,
        downloadLyricsForTrack,
        enrichTrack,
        enrichTracksBatch,
        cancelBatchEnrich,
        toggleFavourite,
        batchFavourite,
        updateTrack,
        updateTrackArtwork,
        deleteTrackArtwork,
        deleteTracks,
        recordTrackPlay,
        saveTrackPosition,
        createPlaylist,
        upsertSmartPlaylist,
        generateSmartMixes,
        updatePlaylist,
        setPlaylistArtwork,
        deletePlaylist,
        addTracksToPlaylist,
        removeTrackFromPlaylist,
        reorderPlaylistTracks,
        saveLyrics,
        deleteLyrics,
        getStorageBreakdown,
        exportLibraryMetadata,
        clearPlayHistory,
        clearAllLibrary,
      }}
    >
      {children}
    </LibraryContext.Provider>
  );
};

export function useLibrary(): LibraryContextValue {
  const ctx = useContext(LibraryContext);
  if (!ctx) throw new Error('useLibrary must be used within LibraryProvider');
  return ctx;
}
