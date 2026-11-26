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
  const { updateTrack, updateTrackArtwork, deleteTrackArtwork, downloadLyricsForTrack } =
    useLibrary();
  const { settings } = useTheme();
  const artInputRef = useRef<HTMLInputElement | null>(null);
  const trackRef = useRef(track);
  trackRef.current = track;
  const trackId = track?.id;

  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [album, setAlbum] = useState('');
  const [albumArtist, setAlbumArtist] = useState('');
  const [genre, setGenre] = useState('');
  const [year, setYear] = useState('');
  const [trackNumber, setTrackNumber] = useState('');
  const [moodTags, setMoodTags] = useState<string[]>([]);

  const [lookingUp, setLookingUp] = useState(false);
  const [downloadingLyrics, setDownloadingLyrics] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [lookupStatus, setLookupStatus] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<MetadataCandidate[]>([]);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);

  useEffect(() => {
    const currentTrack = trackRef.current;
    if (!open || !currentTrack || currentTrack.id !== trackId) return;
    setTitle(currentTrack.title);
    setArtist(currentTrack.artist);
    setAlbum(currentTrack.album);
    setAlbumArtist(currentTrack.albumArtist);
    setGenre(currentTrack.genre);
    setYear(currentTrack.year ? String(currentTrack.year) : '');
    setTrackNumber(currentTrack.trackNumber ? String(currentTrack.trackNumber) : '');
    setMoodTags(currentTrack.moodTags || []);
    setSaveError(null);
    setLookupStatus(null);
    setCandidates([]);
    setSelectedCandidateId(null);
  }, [open, trackId]);

  if (!track) return null;

  const canWriteEmbeddedTags =
    isNativeMediaStoreAvailable() &&
    Boolean(track.contentUri) &&
    (track.source === 'document' || track.source === 'mediastore');
  const tagFormatSupported = ['MP3', 'M4A', 'MP4', 'FLAC', 'OGG', 'WAV'].includes(
    track.format.toUpperCase()
  );
  const tagWriteHint = !canWriteEmbeddedTags
    ? 'Tags save in Neo Player; re-import with Pick Editable Files to write to the original file'
    : tagFormatSupported
      ? 'Saving writes tags to the original file'
      : 'This format only supports tags saved in Neo Player';

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    const parsedYear = year.trim() ? parseInt(year, 10) : undefined;
    const parsedTrackNum = trackNumber.trim() ? parseInt(trackNumber, 10) : undefined;
    setSaving(true);
    setSaveError(null);
    try {
      await updateTrack(track.id, {
        title,
        artist,
        album,
        albumArtist,
        genre,
        year: parsedYear && parsedYear >= 1900 && parsedYear <= 2100 ? parsedYear : undefined,
        trackNumber: parsedTrackNum && parsedTrackNum > 0 ? parsedTrackNum : undefined,
        moodTags,
      });
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
    try {
      await updateTrackArtwork(track.id, file);
      setSaveError(null);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Unable to update album artwork.');
    }
    e.target.value = '';
  };

  const applyCandidate = async (candidate: MetadataCandidate) => {
    setSelectedCandidateId(candidate.recordingId);
    setTitle(candidate.title);
    setArtist(candidate.artist);
    setAlbum(candidate.album);
    setAlbumArtist(candidate.albumArtist);
    if (candidate.genre) setGenre(candidate.genre);
    if (candidate.year) setYear(String(candidate.year));
    if (candidate.trackNumber) setTrackNumber(String(candidate.trackNumber));

    setLookupStatus('Applied tags. Checking Cover Art Archive...');
    try {
      const coverBlob = await downloadCoverBlob(candidate);
      if (coverBlob) {
        const coverFile = new File([coverBlob], `${track.id}-cover.jpg`, {
          type: coverBlob.type || 'image/jpeg',
        });
        await updateTrackArtwork(track.id, coverFile);
        setLookupStatus('Tags filled and album cover downloaded. Save Changes to keep tags.');
      } else {
        setLookupStatus('Tags filled (no cover found in Cover Art Archive). Save Changes to keep.');
      }
    } catch (error) {
      setLookupStatus(
        error instanceof Error
          ? `Tags filled, but album cover could not be saved: ${error.message}`
          : 'Tags filled, but album cover could not be saved.'
      );
    }
  };

  const handleAutoLookup = async () => {
    if (lookingUp) return;
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

      setCandidates(list);
      if (list.length === 0) {
        setLookupStatus('No matching releases found on MusicBrainz.');
        return;
      }

      await applyCandidate(list[0]);
    } catch (err) {
      setLookupStatus(
        err instanceof Error ? err.message : 'Unable to reach MusicBrainz right now.'
      );
    } finally {
      setLookingUp(false);
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
        onChange={handleArtChange}
        className="hidden"
      />

      <form onSubmit={handleSave} className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <AlbumArtwork
              artworkId={track.artworkId}
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
                <GlassButton size="sm" onClick={() => artInputRef.current?.click()}>
                  <ImagePlus className="w-3.5 h-3.5" />
                  <span>{track.artworkId ? 'Replace Cover' : 'Add Cover'}</span>
                </GlassButton>
                {track.artworkId && (
                  <GlassButton
                    size="sm"
                    onClick={() => void deleteTrackArtwork(track.id)}
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
              disabled={lookingUp}
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
          <GlassButton type="submit" variant="accent" disabled={saving}>
            {saving ? 'Saving Tags...' : 'Save Changes'}
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
