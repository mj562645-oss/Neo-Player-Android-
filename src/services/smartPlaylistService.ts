import type { MoodCategory, SmartPlaylistDraft, Track } from '../types/music';

function normalizeArtist(artist: string): string {
  return artist.trim().toLowerCase();
}

function findMoodId(moodCategories: MoodCategory[], keywords: string[]): string | undefined {
  for (const kw of keywords) {
    const hit = moodCategories.find((m) => m.name.toLowerCase().includes(kw));
    if (hit) return hit.id;
  }
  return moodCategories[0]?.id;
}

export function buildSmartPlaylistDrafts(
  tracks: Track[],
  followedArtists: string[],
  moodCategories: MoodCategory[]
): SmartPlaylistDraft[] {
  if (tracks.length === 0) return [];

  const drafts: SmartPlaylistDraft[] = [];

  // 1. Heavy Rotation (most played + recently played tracks)
  const playedTracks = tracks
    .filter((t) => (t.playCount || 0) > 0 || Boolean(t.lastPlayedAt))
    .slice()
    .sort((a, b) => {
      const scoreA = (a.playCount || 0) * 10 + (a.lastPlayedAt ? 3 : 0) + (a.isFavourite ? 2 : 0);
      const scoreB = (b.playCount || 0) * 10 + (b.lastPlayedAt ? 3 : 0) + (b.isFavourite ? 2 : 0);
      if (scoreB !== scoreA) return scoreB - scoreA;
      return (b.lastPlayedAt || 0) - (a.lastPlayedAt || 0);
    })
    .slice(0, 25);

  if (playedTracks.length > 0) {
    drafts.push({
      smartKey: 'smart_heavy_rotation',
      kind: 'heavy-rotation',
      name: 'Heavy Rotation',
      description: 'Your most replayed and recent obsessions from your library.',
      reason: `${playedTracks.length} frequently played ${playedTracks.length === 1 ? 'track' : 'tracks'}`,
      moodCategoryId: findMoodId(moodCategories, ['energy', 'focus']),
      trackIds: playedTracks.map((t) => t.id),
      accentColor: '#FF2D55',
    });
  }

  // 2. Favourites Mix (hearted songs + affinity tracks from the same artists)
  const favTracks = tracks.filter((t) => t.isFavourite);
  if (favTracks.length > 0) {
    const favArtists = new Set(favTracks.map((t) => normalizeArtist(t.artist)));
    const affinityTracks = tracks.filter(
      (t) => !t.isFavourite && favArtists.has(normalizeArtist(t.artist))
    );
    const combined = [...favTracks, ...affinityTracks].slice(0, 30);
    drafts.push({
      smartKey: 'smart_favourites_mix',
      kind: 'favourites-mix',
      name: 'Favourites Mix',
      description: 'Hearted songs blended with deep cuts from the same artists.',
      reason: `${favTracks.length} hearted + ${affinityTracks.length} matching artist cuts`,
      moodCategoryId: findMoodId(moodCategories, ['romance', 'chill']),
      trackIds: combined.map((t) => t.id),
      accentColor: '#FF375F',
    });
  }

  // 3. Hidden Gems (least played / unplayed tracks in your library)
  const sortedLeastPlayed = tracks
    .slice()
    .sort((a, b) => {
      if ((a.playCount || 0) !== (b.playCount || 0)) {
        return (a.playCount || 0) - (b.playCount || 0);
      }
      return a.addedAt - b.addedAt;
    });
  const unplayedOrLow = sortedLeastPlayed.filter((t) => (t.playCount || 0) <= 1).slice(0, 20);
  if (unplayedOrLow.length >= 2) {
    drafts.push({
      smartKey: 'smart_hidden_gems',
      kind: 'hidden-gems',
      name: 'Hidden Gems',
      description: 'Overlooked and unplayed songs waiting to be rediscovered.',
      reason: `${unplayedOrLow.length} low-play tracks in your collection`,
      moodCategoryId: findMoodId(moodCategories, ['late night', 'melancholy', 'chill']),
      trackIds: unplayedOrLow.map((t) => t.id),
      accentColor: '#5E5CE6',
    });
  }

  // 4. Fresh Additions (newest added songs)
  const recentAdded = tracks
    .slice()
    .sort((a, b) => b.addedAt - a.addedAt)
    .slice(0, Math.min(20, tracks.length));
  if (recentAdded.length > 0) {
    drafts.push({
      smartKey: 'smart_fresh_additions',
      kind: 'fresh-additions',
      name: 'Fresh Additions',
      description: 'The latest tracks imported or scanned onto your device.',
      reason: `Newest ${recentAdded.length} tracks in your library`,
      moodCategoryId: findMoodId(moodCategories, ['chill', 'focus']),
      trackIds: recentAdded.map((t) => t.id),
      accentColor: '#30D158',
    });
  }

  // 5. Artist Spotlight (followed artists first, or top artist in library)
  const artistScores = new Map<string, { display: string; count: number; plays: number; tracks: Track[] }>();
  for (const t of tracks) {
    const clean = t.artist.trim();
    if (!clean || clean.toLowerCase() === 'unknown artist') continue;
    const key = normalizeArtist(clean);
    const entry = artistScores.get(key) || { display: clean, count: 0, plays: 0, tracks: [] };
    entry.count += 1;
    entry.plays += t.playCount || 0;
    entry.tracks.push(t);
    artistScores.set(key, entry);
  }

  const followedKeys = new Set(followedArtists.map((a) => normalizeArtist(a)));
  const followedPool = tracks.filter((t) => followedKeys.has(normalizeArtist(t.artist)));

  if (followedPool.length >= 2) {
    drafts.push({
      smartKey: 'smart_followed_artists',
      kind: 'artist-spotlight',
      name: 'Followed Artists Radio',
      description: 'Non-stop mix drawn from the artists you follow.',
      reason: `Built from ${followedPool.length} tracks by your followed artists`,
      moodCategoryId: findMoodId(moodCategories, ['energy', 'romance']),
      trackIds: followedPool.slice(0, 30).map((t) => t.id),
      accentColor: '#0A84FF',
    });
  } else {
    const topArtist = Array.from(artistScores.values()).sort(
      (a, b) => b.plays * 3 + b.count - (a.plays * 3 + a.count)
    )[0];
    if (topArtist && topArtist.tracks.length >= 2) {
      drafts.push({
        smartKey: `smart_artist_${normalizeArtist(topArtist.display)}`,
        kind: 'artist-spotlight',
        name: `${topArtist.display} Essentials`,
        description: `Essential mix from your most-represented artist, ${topArtist.display}.`,
        reason: `${topArtist.tracks.length} tracks by ${topArtist.display}`,
        moodCategoryId: findMoodId(moodCategories, ['energy', 'focus']),
        trackIds: topArtist.tracks.slice(0, 25).map((t) => t.id),
        accentColor: '#0A84FF',
      });
    }
  }

  // 6. Top Genre Mix
  const genreBuckets = new Map<string, Track[]>();
  for (const t of tracks) {
    const g = t.genre?.trim();
    if (!g || g.toLowerCase() === 'unclassified') continue;
    const arr = genreBuckets.get(g) || [];
    arr.push(t);
    genreBuckets.set(g, arr);
  }
  const topGenre = Array.from(genreBuckets.entries()).sort((a, b) => b[1].length - a[1].length)[0];
  if (topGenre && topGenre[1].length >= 2) {
    drafts.push({
      smartKey: `smart_genre_${topGenre[0].toLowerCase().replace(/\s+/g, '_')}`,
      kind: 'genre-mix',
      name: `${topGenre[0]} Sessions`,
      description: `Curated ${topGenre[0]} flow tailored from your local library.`,
      reason: `${topGenre[1].length} ${topGenre[0]} tracks ready to queue`,
      moodCategoryId: findMoodId(moodCategories, ['focus', 'late night']),
      trackIds: topGenre[1].slice(0, 25).map((t) => t.id),
      accentColor: '#FF9F0A',
    });
  }

  return drafts;
}
