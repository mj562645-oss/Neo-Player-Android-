const AUDIO_EXT_RE = /\.(mp3|m4a|aac|wav|ogg|opus|flac|webm|mp4|alac|aiff|wma|m4b|oga|3gp)$/i;

const DOWNLOADER_PREFIX_RE =
  /^(?:y2mate\.com|yt1s\.com|yt1s\.io|ytmp3\.cc|snaptube|vidmate|spotifydown\.com|spotidown\.com|spotify-downloader\.com|mp3juices|savemp3|loader\.to)\s*[-–—_:]+\s*/i;

const MEDIA_NOISE_KEYWORDS =
  'official(?:\\s+music|\\s+lyric|\\s+audio|\\s+visualizer)?|' +
  'music\\s+video|lyric\\s+video|lyrics?|audio\\s+only|official\\s+audio|audio|' +
  'video\\s+clip|visualizer|visualiser|hd|hq|4k|8k|uhd|1080p|720p|' +
  'kbps|\\d{2,3}\\s*kbps|320|256|192|128|flac|mp3|m4a|aac|wav|lossless|' +
  'explicit|clean\\s+version|dirty\\s+version|radio\\s+edit|' +
  'color\\s+coded|cc|sub\\s+espa[nñ]ol|eng\\s+sub|mvp|mv|pv|' +
  'remastered(?:\\s+\\d{4})?|full\\s+hd|topic|vevo|youtube|yt\\s+rip|' +
  'free\\s+download|download|spotifydown|y2mate';

const CLOSED_MEDIA_BRACKET_RE = new RegExp(
  `\\s*(?:\\[(?:[^\\]]*(?:${MEDIA_NOISE_KEYWORDS})[^\\]]*)\\]|\\((?:[^)]*(?:${MEDIA_NOISE_KEYWORDS})[^)]*)\\))`,
  'gi'
);

// Matches trailing unclosed `[official_lyric_video` or `[Official_Video` truncated by downloaders/OS limits
const UNCLOSED_TRAILING_SQUARE_RE = /\s*\[[^\]]*$/g;
const UNCLOSED_TRAILING_PAREN_RE = new RegExp(
  `\\s*\\((?:[^)]*(?:${MEDIA_NOISE_KEYWORDS}|feat\\.?|ft\\.?|prod\\.?)[^)]*)$`,
  'gi'
);

const YOUTUBE_ID_SUFFIX_RE = /\s*[\[(](?=[^\])]*\d)[A-Za-z0-9_-]{11}[\])]\s*$/;

const FEATURED_ARTIST_PARENS_RE =
  /\s*[\[(]\s*(?:feat\.?|ft\.?|featuring|with)\s+([^\])]+?)\s*[\])]/gi;
const FEATURED_ARTIST_INLINE_RE = /\s+(?:feat\.?|ft\.?|featuring)\s+(.+)$/i;

const CONTRACTION_SUBJECTS =
  'it|that|what|who|there|here|where|how|when|why|he|she|let|everything|nothing|something|someone|everyone|anyone|one|god|mama|mom|dad|bro|man|life|world|time|love|heart|baby|girl|boy|ain|don|won|can|didn|wasn|weren|isn|aren|couldn|wouldn|shouldn|hasn|haven|hadn';

const KNOWN_S_SUBJECT_RE = new RegExp(`\\b(${CONTRACTION_SUBJECTS})\\s+s\\b`, 'gi');
const GENERIC_POSSESSIVE_S_RE = /\b([A-Za-z]{2,})\s+s(?=\s|$|[,.!?])/g;
const N_T_CONTRACTION_RE = /\b([A-Za-z]*n)\s+t(?=\s|$|[,.!?])/gi;
const I_M_CONTRACTION_RE = /\bi\s+m(?=\s|$|[,.!?])/gi;
const PRONOUN_SUFFIX_RE =
  /\b(i|you|we|they|who|what|there|here|that|she|he|it)\s+(ll|ve|re|d)(?=\s|$|[,.!?])/gi;
const Y_ALL_RE = /\b(y)\s+all(?=\s|$|[,.!?])/gi;

export interface ParsedAudioFilename {
  title: string;
  artist: string;
  searchTitle: string;
  featuredArtists: string[];
  cleanedBaseName: string;
  hasExplicitArtist: boolean;
}

export function stripAudioExtension(fileName: string): string {
  return fileName.trim().replace(AUDIO_EXT_RE, '').trim();
}

export function restoreSeparatedContractions(input: string): string {
  let out = input;
  out = out.replace(N_T_CONTRACTION_RE, (_m, stem: string) => `${stem}'t`);
  out = out.replace(I_M_CONTRACTION_RE, (m) => (m[0] === 'I' ? "I'm" : "I'm"));
  out = out.replace(
    PRONOUN_SUFFIX_RE,
    (_m, pronoun: string, suffix: string) =>
      `${pronoun.toLowerCase() === 'i' ? 'I' : pronoun}'${suffix.toLowerCase()}`
  );
  out = out.replace(Y_ALL_RE, (_m, y: string) => `${y}'all`);
  out = out.replace(KNOWN_S_SUBJECT_RE, (_m, word: string) => `${word}'s`);
  // Catch general possessives like "Lil Keed s Freestyle" -> "Lil Keed's Freestyle"
  out = out.replace(GENERIC_POSSESSIVE_S_RE, (_m, word: string) => `${word}'s`);
  return out;
}

function normalizeFilenameDelimiters(raw: string): string {
  return (
    raw
      .replace(DOWNLOADER_PREFIX_RE, '')
      // Convert explicit dash+underscore boundaries into " - " before converting underscores to spaces
      // so "Blvck_Svm_-_hyogo" -> "Blvck Svm - hyogo" while "Jay-Z_-_99" keeps "Jay-Z".
      .replace(/[_]+[-–—]+[_]+|[_]+[-–—]+\s+|\s+[-–—]+[_]+|[_]+[-–—]+|[-–—]+[_]+/g, ' - ')
      .replace(/[•|]/g, ' - ')
      .replace(/_+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  );
}

export function cleanMediaTagNoise(raw: string): string {
  if (!raw) return '';
  let out = normalizeFilenameDelimiters(raw);
  out = out.replace(YOUTUBE_ID_SUFFIX_RE, '');
  out = out.replace(CLOSED_MEDIA_BRACKET_RE, '');
  out = out.replace(UNCLOSED_TRAILING_SQUARE_RE, '');
  out = out.replace(UNCLOSED_TRAILING_PAREN_RE, '');
  out = restoreSeparatedContractions(out);
  out = out
    .replace(/\s+[-–—]\s*$/, '')
    .replace(/^[-–—\s]+/, '')
    .replace(/\s+/g, ' ')
    .trim();
  return out;
}

export function stripLeadingTrackNumber(text: string): string {
  const trimmed = text.trim();
  // Explicit punctuation track numbers: "01. Artist - Title", "03 - Title", "1) Title"
  let next = trimmed.replace(/^(?:\(\d{1,3}\)|\d{1,2}[.)]|\d{1,2}\s*-\s+(?=.*\s+[-–—]\s+))/i, '').trim();
  if (next && next !== trimmed) return next;
  // Zero-padded 2-digit prefix: "01 Blvck Svm - hyogo"
  next = trimmed.replace(/^0\d\s+(?=[A-Za-z])/, '').trim();
  if (next && next !== trimmed) return next;
  // Numeric track prefix when an "Artist - Title" separator exists downstream
  if (/\s+[-–—]\s+/.test(trimmed)) {
    next = trimmed.replace(/^\d{1,2}\s+(?=[A-Za-z])/, '').trim();
    if (next) return next;
  }
  return trimmed;
}

export function extractFeaturedArtists(text: string): {
  mainText: string;
  featuredArtists: string[];
} {
  const featured: string[] = [];
  let main = text.replace(FEATURED_ARTIST_PARENS_RE, (_m, names: string) => {
    featured.push(names.trim());
    return '';
  });
  const inlineMatch = main.match(FEATURED_ARTIST_INLINE_RE);
  if (inlineMatch && inlineMatch[1]) {
    featured.push(inlineMatch[1].trim());
    main = main.slice(0, inlineMatch.index).trim();
  }
  return {
    mainText: main.replace(/\s+/g, ' ').trim(),
    featuredArtists: featured.filter(Boolean),
  };
}

export function cleanArtistName(raw: string): string {
  return cleanMediaTagNoise(raw)
    .replace(/\s*-\s*Topic$/i, '')
    .replace(/\s*VEVO$/i, '')
    .trim();
}

export function isPlaceholderArtist(artist?: string | null): boolean {
  if (!artist) return true;
  const norm = artist.trim().toLowerCase();
  return (
    !norm ||
    norm === 'unknown' ||
    norm === '<unknown>' ||
    norm === 'unknown artist' ||
    norm === 'various artists' ||
    norm === 'va'
  );
}

export function isPlaceholderAlbum(album?: string | null): boolean {
  if (!album) return true;
  const norm = album.trim().toLowerCase();
  return (
    !norm ||
    norm === 'single' ||
    norm === 'unknown' ||
    norm === '<unknown>' ||
    norm === 'unknown album' ||
    norm === 'download' ||
    norm === 'downloads' ||
    norm === 'music' ||
    norm === 'audio'
  );
}

const DIRTY_TEXT_HINT_RE = new RegExp(
  `(?:_|\\[[A-Za-z0-9\\s_-]*$|\\((?:[^)]*(?:${MEDIA_NOISE_KEYWORDS}))|\\b(?:${MEDIA_NOISE_KEYWORDS})\\b|\\b(?:it|that|what|don|won|can|ain|didn)\\s+[st]\\b|\\bi\\s+m\\b)`,
  'i'
);

export function hasFilenameNoise(value?: string | null): boolean {
  if (!value) return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (trimmed.includes('_')) return true;
  if (/\[[^\]]*$/.test(trimmed)) return true;
  if (AUDIO_EXT_RE.test(trimmed)) return true;
  if (DOWNLOADER_PREFIX_RE.test(trimmed)) return true;
  return DIRTY_TEXT_HINT_RE.test(trimmed);
}

export function parseAudioFilename(fileName: string): ParsedAudioFilename {
  const withoutExt = stripAudioExtension(fileName);
  const cleanedBaseName = stripLeadingTrackNumber(cleanMediaTagNoise(withoutExt)) || withoutExt;

  const dashParts = cleanedBaseName
    .split(/\s+[-–—]\s+/)
    .map((p) => p.trim())
    .filter(Boolean);

  if (dashParts.length >= 2) {
    const rawArtistPart = dashParts[0];
    const rawTitlePart = dashParts.slice(1).join(' - ');
    const artistSplit = extractFeaturedArtists(rawArtistPart);
    const titleSplit = extractFeaturedArtists(rawTitlePart);
    const artist = cleanArtistName(artistSplit.mainText) || 'Unknown Artist';
    const title = titleSplit.mainText || rawTitlePart || cleanedBaseName;
    const featuredArtists = [...artistSplit.featuredArtists, ...titleSplit.featuredArtists];
    const displayTitle =
      featuredArtists.length > 0 && titleSplit.featuredArtists.length > 0
        ? `${title} (feat. ${featuredArtists.join(', ')})`
        : title;

    return {
      title: displayTitle,
      artist,
      searchTitle: title,
      featuredArtists,
      cleanedBaseName,
      hasExplicitArtist: !isPlaceholderArtist(artist),
    };
  }

  const titleSplit = extractFeaturedArtists(cleanedBaseName);
  const searchTitle = titleSplit.mainText || cleanedBaseName || 'Untitled Track';
  const displayTitle =
    titleSplit.featuredArtists.length > 0
      ? `${searchTitle} (feat. ${titleSplit.featuredArtists.join(', ')})`
      : searchTitle;

  return {
    title: displayTitle,
    artist: 'Unknown Artist',
    searchTitle,
    featuredArtists: titleSplit.featuredArtists,
    cleanedBaseName,
    hasExplicitArtist: false,
  };
}
