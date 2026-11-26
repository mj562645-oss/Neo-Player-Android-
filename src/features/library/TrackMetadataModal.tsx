import React, { useEffect, useRef, useState } from 'react';
import { Check, CloudDownload, ImagePlus, Loader2, Sparkles, Trash2 } from 'lucide-react';
import { useLibrary } from '../../app/LibraryContext';
import { useTheme } from '../../app/ThemeContext';
import { isNativeMediaStoreAvailable } from '../../plugins/mediaStore';
import {
  downloadCoverBlob,
  extractSearchHints,
  fetchMetadataCandidates,
  type MetadataCandidate,
} from '../../services/enrichmentService';
import type { Track } from '../../types/music';
import { AlbumArtwork } from '../../components/AlbumArtwork';
import { GlassButton } from '../../components/glass/GlassButton';
import { GlassModal } from '../../components/glass/GlassModal';

interface TrackMetadataModalProps {
  track: Track | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const TrackMetadataModal: React.FC<TrackMetadataModalProps> = ({
  track,
  open,
  onOpenChange,
}) => {
  const { updateTrack, downloadLyricsForTrack } = useLibrary();
  const { settings } = useTheme();
  const artInputRef = useRef<HTMLInputElement | null>(null);
  const trackRef = useRef(track);
  trackRef.current = track;
  const openRef = useRef(open);
  openRef.current = open;
  const lookupRequestIdRef = useRef(0);
  const candidateRequestIdRef = useRef(0);
  const trackId = track?.id;

  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [album, setAlbum] = useState('');
  const [albumArtist, setAlbumArtist] = useState('');
  const [genre, setGenre] = useState('');
  const [year, setYear] = useState('');
  const [trackNumber, setTrackNumber] = useState('');
  const [moodTags, setMoodTags] = useState<string[]>([]);
  const [pendingArtworkFile, setPendingArtworkFile] = useState<File | null>(null);
  const [pendingArtworkUrl, setPendingArtworkUrl] = useState<string | null>(null);
  const [pendingArtworkSource, setPendingArtworkSource] = useState<'manual' | 'candidate' | null>(
    null
  );
  const [removeArtwork, setRemoveArtwork] = useState(false);

  const [lookingUp, setLookingUp] = useState(false);
  const [applyingCandidate, setApplyingCandidate] = useState(false);
  const [downloadingLyrics, setDownloadingLyrics] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [lookupStatus, setLookupStatus] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<MetadataCandidate[]>([]);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);

  useEffect(() => {
    lookupRequestIdRef.current += 1;
    candidateRequestIdRef.current += 1;
    const currentTrack = trackRef.current;
    if (!open || !currentTrack || currentTrack.id !== trackId) {
      setLookingUp(false);
      setApplyingCandidate(false);
      return;
    }
    setTitle(currentTrack.title);
    setArtist(currentTrack.artist);
    setAlbum(currentTrack.album);
    setAlbumArtist(currentTrack.albumArtist);
    setGenre(currentTrack.genre);
    setYear(currentTrack.year ? String(currentTrack.year) : '');
    setTrackNumber(currentTrack.trackNumber ? String(currentTrack.trackNumber) : '');
    setMoodTags(currentTrack.moodTags || []);
    setPendingArtworkFile(null);
    setPendingArtworkSource(null);
    setRemoveArtwork(false);
    setSaveError(null);
    setLookupStatus(null);
    setCandidates([]);
    setSelectedCandidateId(null);
    setLookingUp(false);
    setApplyingCandidate(false);
  }, [open, trackId]);

  useEffect(() => {
    if (!pendingArtworkFile) {
      setPendingArtworkUrl(null);
      return;
    }
    const objectUrl = URL.createObjectURL(pendingArtworkFile);
    setPendingArtworkUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [pendingArtworkFile]);

  if (!track) return null;

  const tagFormatSupported = ['MP3', 'M4A', 'MP4', 'FLAC', 'OGG', 'WAV'].includes(
    track.format.toUpperCase()
  );
  const canWriteEmbeddedTags =
    isNativeMediaStoreAvailable() &&
    Boolean(track.contentUri) &&
    (track.source === 'document' || track.source === 'mediastore') &&
    tagFormatSupported;
  const tagWriteHint = !canWriteEmbeddedTags
    ? 'Tags and artwork save in Neo Player; re-import with Pick Editable Files to embed them'
    : 'Saving embeds text tags, mood labels, and album artwork in the original file';

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    const parsedYear = year.trim() ? parseInt(year, 10) : undefined;
    const parsedTrackNum = trackNumber.trim() ? parseInt(trackNumber, 10) : undefined;
    setSaving(true);
    setSaveError(null);
    try {
      await updateTrack(
        track.id,
        {
          title,
          artist,
          album,
          albumArtist,
          genre,
          year: parsedYear && parsedYear >= 1900 && parsedYear <= 2100 ? parsedYear : undefined,
          trackNumber: parsedTrackNum && parsedTrackNum > 0 ? parsedTrackNum : undefined,
          moodTags,
        },
        {
          artworkFile: pendingArtworkFile || undefined,
          removeArtwork,
          moodTagNames: settings.moodCategories
            .filter((mood) => moodTags.includes(mood.id))
            .map((mood) => mood.name),
        }
      );
      onOpenChange(false);
    } catch (error) {
      setSaveError(
        error instanceof Error ? error.message : 'Unable to write the updated audio tags.'
      );
    } finally {
      setSaving(false);
    }
  };

  const handleArtChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPendingArtworkFile(file);
    setPendingArtworkSource('manual');
    setRemoveArtwork(false);
    setLookupStatus('Cover selected. Save Changes to embed it and update your library.');
    setSaveError(null);
    e.target.value = '';
  };

  const applyCandidate = async (candidate: MetadataCandidate) => {
    if (
      applyingCandidate ||
      !openRef.current ||
      !track ||
      trackRef.current?.id !== track.id
    ) {
      return;
    }
    const requestId = ++candidateRequestIdRef.current;
    setApplyingCandidate(true);
    setSelectedCandidateId(candidate.recordingId);
    setTitle(candidate.title);
    setArtist(candidate.artist);
    setAlbum(candidate.album);
    setAlbumArtist(candidate.albumArtist);
    if (candidate.genre) setGenre(candidate.genre);
    if (candidate.year) setYear(String(candidate.year));
    if (candidate.trackNumber) setTrackNumber(String(candidate.trackNumber));
    if (pendingArtworkSource === 'candidate') {
      setPendingArtworkFile(null);
      setPendingArtworkSource(null);
    }

    setLookupStatus('Applied tags. Checking Cover Art Archive...');
    try {
      const coverBlob = await downloadCoverBlob(candidate);
      if (
        requestId !== candidateRequestIdRef.current ||
        !openRef.current ||
        trackRef.current?.id !== track.id
      ) {
        return;
      }
      if (coverBlob) {
        const coverFile = new File([coverBlob], `${track.id}-cover.jpg`, {
          type: coverBlob.type || 'image/jpeg',
        });
        setPendingArtworkFile(coverFile);
        setPendingArtworkSource('candidate');
        setRemoveArtwork(false);
        setLookupStatus(
          'Tags and cover selected. Save Changes to embed them and update your library.'
        );
      } else {
        setLookupStatus('Tags filled (no cover found in Cover Art Archive). Save Changes to keep.');
      }
    } catch (error) {
      if (
        requestId !== candidateRequestIdRef.current ||
        !openRef.current ||
        trackRef.current?.id !== track.id
      ) {
        return;
      }
      setLookupStatus(
        error instanceof Error
          ? `Tags filled, but album cover could not be saved: ${error.message}`
          : 'Tags filled, but album cover could not be saved.'
      );
    } finally {
      if (requestId === candidateRequestIdRef.current) {
        setApplyingCandidate(false);
      }
    }
  };

  const handleAutoLookup = async () => {
    if (lookingUp || applyingCandidate) return;
    const requestId = ++lookupRequestIdRef.current;
    const lookupTrackId = track.id;
    setLookingUp(true);
    setLookupStatus('Searching MusicBrainz & Cover Art Archive...');
    try {
      const hints = extractSearchHints({
        title: title || track.title,
        artist: artist || track.artist,
        album: album || track.album,
        fileName: track.fileName,
        duration: track.duration,
      });
      const list = await fetchMetadataCandidates({
        title: hints.title,
        artist: hints.artist,
        album: hints.album,
        fileName: track.fileName,
        duration: track.duration,
      });

      if (
        requestId !== lookupRequestIdRef.current ||
        !openRef.current ||
        trackRef.current?.id !== lookupTrackId
      ) {
        return;
      }
      setCandidates(list);
      if (list.length === 0) {
        setLookupStatus('No matching releases found on MusicBrainz.');
        return;
      }

      await applyCandidate(list[0]);
    } catch (err) {
      if (
        requestId === lookupRequestIdRef.current &&
        openRef.current &&
        trackRef.current?.id === lookupTrackId
      ) {
        setLookupStatus(
          err instanceof Error ? err.message : 'Unable to reach MusicBrainz right now.'
        );
      }
    } finally {
      if (requestId === lookupRequestIdRef.current) {
        setLookingUp(false);
      }
    }
  };

  const handleFetchLyrics = async () => {
    if (downloadingLyrics) return;
    setDownloadingLyrics(true);
    try {
      const resultType = await downloadLyricsForTrack(track.id);
      if (resultType) {
        setLookupStatus(
          resultType === 'synced'
            ? 'Downloaded synchronized LRC lyrics locally.'
            : 'Downloaded plain lyrics locally.'
        );
      }
    } finally {
      setDownloadingLyrics(false);
    }
  };

  const toggleMood = (moodId: string) => {
    setMoodTags((prev) =>
      prev.includes(moodId) ? prev.filter((id) => id !== moodId) : [...prev, moodId]
    );
  };

  return (
    <GlassModal
      open={open}
      onOpenChange={onOpenChange}
      title="Edit Track Information"
      description={`${track.fileName} · ${track.format} · ${tagWriteHint}`}
      className="max-w-xl"
    >
      <input
        ref={artInputRef}
        type="file"
        accept="image/*"
        disabled={saving || applyingCandidate || lookingUp}
        onChange={handleArtChange}
        className="hidden"
      />

      <form onSubmit={handleSave} className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <AlbumArtwork
              artworkId={removeArtwork || pendingArtworkFile ? undefined : track.artworkId}
              artworkUrl={pendingArtworkUrl || undefined}
              alt={track.title}
              fallbackSeed={`${track.album}-${track.artist}`}
              size="lg"
              rounded="2xl"
            />
            <div className="space-y-2">
              <p className="text-xs font-medium text-[#6E6E73] dark:text-[#98989D]">
                Album Artwork
              </p>
              <div className="flex flex-wrap gap-2">
                <GlassButton
                  size="sm"
                  disabled={saving || applyingCandidate || lookingUp}
                  onClick={() => artInputRef.current?.click()}
                >
                  <ImagePlus className="w-3.5 h-3.5" />
                  <span>
                    {track.artworkId || pendingArtworkFile ? 'Replace Cover' : 'Add Cover'}
                  </span>
                </GlassButton>
                {(track.artworkId || pendingArtworkFile) && (
                  <GlassButton
                    size="sm"
                    disabled={saving || applyingCandidate || lookingUp}
                    onClick={() => {
                      setPendingArtworkFile(null);
                      setPendingArtworkSource(null);
                      setRemoveArtwork(true);
                      setLookupStatus('Cover will be removed when you save these changes.');
                    }}
                    className="text-red-600 dark:text-red-400"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Remove</span>
                  </GlassButton>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <GlassButton
              size="sm"
              variant="accent"
              disabled={lookingUp || applyingCandidate || saving}
              onClick={() => void handleAutoLookup()}
            >
              {lookingUp ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Sparkles className="w-3.5 h-3.5" />
              )}
              <span>{lookingUp ? 'Matching...' : 'Auto-Match Tags & Cover'}</span>
            </GlassButton>
            <GlassButton
              size="sm"
              disabled={downloadingLyrics}
              onClick={() => void handleFetchLyrics()}
            >
              {downloadingLyrics ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <CloudDownload className="w-3.5 h-3.5" />
              )}
              <span>{downloadingLyrics ? 'Fetching...' : 'Download Lyrics'}</span>
            </GlassButton>
          </div>
        </div>

        {lookupStatus && (
          <p className="text-xs text-[#6E6E73] dark:text-[#98989D] liquid-glass-subtle rounded-xl px-3 py-2">
            {lookupStatus}
          </p>
        )}
        {saveError && (
          <p role="alert" className="text-xs text-red-600 dark:text-red-400 rounded-xl px-3 py-2">
            {saveError}
          </p>
        )}

        {candidates.length > 1 && (
          <div className="space-y-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#6E6E73] dark:text-[#98989D]">
              MusicBrainz Release Matches
            </p>
            <div className="max-h-36 overflow-y-auto scrollbar-thin rounded-2xl liquid-glass-subtle divide-y divide-black/6 dark:divide-white/8">
              {candidates.slice(0, 5).map((cand) => {
                const isSelected = selectedCandidateId === cand.recordingId;
                return (
                  <button
                    key={`${cand.recordingId}-${cand.releaseId || ''}`}
                    type="button"
                    disabled={applyingCandidate || lookingUp || saving}
                    onClick={() => void applyCandidate(cand)}
                    className="w-full text-left px-3 py-2 flex items-center justify-between gap-2 hover:bg-black/5 dark:hover:bg-white/8 transition-colors cursor-pointer"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-semibold truncate">{cand.title}</p>
                      <p className="text-[11px] text-[#6E6E73] dark:text-[#98989D] truncate">
                        {cand.artist} · {cand.album}
                        {cand.year ? ` (${cand.year})` : ''}
                      </p>
                    </div>
                    {isSelected && (
                      <Check className="w-4 h-4 text-[var(--neo-accent)] shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <Field label="Track Title" value={title} onChange={setTitle} required />
          <Field label="Artist" value={artist} onChange={setArtist} required />
          <Field label="Album" value={album} onChange={setAlbum} />
          <Field label="Album Artist" value={albumArtist} onChange={setAlbumArtist} />
          <Field label="Genre" value={genre} onChange={setGenre} />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Year" value={year} onChange={setYear} type="number" placeholder="2026" />
            <Field
              label="Track #"
              value={trackNumber}
              onChange={setTrackNumber}
              type="number"
              placeholder="1"
            />
          </div>
        </div>

        <div>
          <p className="text-xs font-medium text-[#6E6E73] dark:text-[#98989D] mb-2">
            Mood Collections
          </p>
          <div className="flex flex-wrap gap-1.5">
            {settings.moodCategories.map((mood) => {
              const active = moodTags.includes(mood.id);
              return (
                <button
                  key={mood.id}
                  type="button"
                  onClick={() => toggleMood(mood.id)}
                  className={`min-h-[34px] px-3 rounded-xl text-xs font-medium transition-colors cursor-pointer border ${
                    active
                      ? 'bg-[var(--neo-accent)] text-white border-[var(--neo-accent)]'
                      : 'liquid-glass-subtle text-[#48484A] dark:text-[#AEAEB2] border-black/8 dark:border-white/10 hover:text-[#111216] dark:hover:text-white'
                  }`}
                >
                  {mood.name}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2">
          <GlassButton variant="ghost" disabled={saving} onClick={() => onOpenChange(false)}>
            Cancel
          </GlassButton>
          <GlassButton
            type="submit"
            variant="accent"
            disabled={saving || lookingUp || applyingCandidate}
          >
            {saving ? 'Saving Tags...' : applyingCandidate ? 'Applying Match...' : 'Save Changes'}
          </GlassButton>
        </div>
      </form>
    </GlassModal>
  );
};

interface FieldProps {
  label: string;
  value: string;
  onChange: (val: string) => void;
  type?: string;
  required?: boolean;
  placeholder?: string;
}

const Field: React.FC<FieldProps> = ({
  label,
  value,
  onChange,
  type = 'text',
  required = false,
  placeholder,
}) => (
  <label className="block">
    <span className="block text-xs font-medium text-[#6E6E73] dark:text-[#98989D] mb-1">
      {label}
    </span>
    <input
      type={type}
      value={value}
      required={required}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className="w-full min-h-[42px] px-3.5 rounded-xl liquid-glass-subtle text-sm text-[#111216] dark:text-[#F5F5F7] focus:outline-none focus:ring-2 focus:ring-[var(--neo-accent)]"
    />
  </label>
);
