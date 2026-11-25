import type { Album, Artist, LibrarySortField, SortDirection, Track } from '../types/music';

export const SORT_OPTIONS: {
  id: LibrarySortField;
  label: string;
  defaultDir: SortDirection;
}[] = [
  { id: 'title', label: 'Title', defaultDir: 'asc' },
  { id: 'artist', label: 'Artist', defaultDir: 'asc' },
  { id: 'album', label: 'Album', defaultDir: 'asc' },
  { id: 'addedAt', label: 'Date Added', defaultDir: 'desc' },
  { id: 'duration', label: 'Duration', defaultDir: 'desc' },
  { id: 'playCount', label: 'Most Played', defaultDir: 'desc' },
];

export function getDefaultDirectionForSortField(field: LibrarySortField): SortDirection {
  return SORT_OPTIONS.find((opt) => opt.id === field)?.defaultDir ?? 'asc';
}

export function sortTracks(
  tracks: Track[],
  field: LibrarySortField,
  direction: SortDirection
): Track[] {
  const dir = direction === 'asc' ? 1 : -1;

  return tracks.slice().sort((a, b) => {
    let cmp = 0;

    if (field === 'title') {
      cmp = a.title.localeCompare(b.title, undefined, { sensitivity: 'base' });
      if (cmp === 0) cmp = a.artist.localeCompare(b.artist, undefined, { sensitivity: 'base' });
    } else if (field === 'artist') {
      cmp = a.artist.localeCompare(b.artist, undefined, { sensitivity: 'base' });
      if (cmp === 0) cmp = a.album.localeCompare(b.album, undefined, { sensitivity: 'base' });
      if (cmp === 0) cmp = (a.trackNumber ?? 999) - (b.trackNumber ?? 999);
      if (cmp === 0) cmp = a.title.localeCompare(b.title, undefined, { sensitivity: 'base' });
    } else if (field === 'album') {
      cmp = a.album.localeCompare(b.album, undefined, { sensitivity: 'base' });
      if (cmp === 0) cmp = (a.trackNumber ?? 999) - (b.trackNumber ?? 999);
      if (cmp === 0) cmp = a.title.localeCompare(b.title, undefined, { sensitivity: 'base' });
    } else if (field === 'duration') {
      cmp = (a.duration || 0) - (b.duration || 0);
      if (cmp === 0) cmp = a.title.localeCompare(b.title, undefined, { sensitivity: 'base' });
    } else if (field === 'playCount') {
      cmp = (a.playCount || 0) - (b.playCount || 0);
      if (cmp === 0) cmp = (a.lastPlayedAt || 0) - (b.lastPlayedAt || 0);
      if (cmp === 0) cmp = a.title.localeCompare(b.title, undefined, { sensitivity: 'base' });
    } else {
      cmp = a.addedAt - b.addedAt;
      if (cmp === 0) cmp = a.title.localeCompare(b.title, undefined, { sensitivity: 'base' });
    }

    return cmp * dir;
  });
}

export function sortAlbums(
  albums: Album[],
  field: LibrarySortField,
  direction: SortDirection
): Album[] {
  const dir = direction === 'asc' ? 1 : -1;
  return albums.slice().sort((a, b) => {
    let cmp = 0;
    if (field === 'artist') {
      cmp = a.artist.localeCompare(b.artist, undefined, { sensitivity: 'base' });
      if (cmp === 0) cmp = a.title.localeCompare(b.title, undefined, { sensitivity: 'base' });
    } else if (field === 'duration') {
      cmp = a.totalDuration - b.totalDuration;
    } else {
      cmp = a.title.localeCompare(b.title, undefined, { sensitivity: 'base' });
    }
    return cmp * dir;
  });
}

export function sortArtists(artists: Artist[], direction: SortDirection): Artist[] {
  const dir = direction === 'asc' ? 1 : -1;
  return artists
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }) * dir);
}
