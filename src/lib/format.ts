export function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const totalSec = Math.floor(seconds);
  const hrs = Math.floor(totalSec / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function formatRemainingTime(current: number, duration: number): string {
  const remaining = Math.max(0, (Number.isFinite(duration) ? duration : 0) - (Number.isFinite(current) ? current : 0));
  return `-${formatTime(remaining)}`;
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const val = bytes / Math.pow(1024, i);
  return `${val >= 100 || i === 0 ? val.toFixed(0) : val.toFixed(1)} ${units[i]}`;
}

export function formatRelativeDate(timestamp: number): string {
  const diffMs = Date.now() - timestamp;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return new Date(timestamp).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function sanitizeText(value: unknown, fallback = ''): string {
  if (typeof value !== 'string') return fallback;
  // Strip control characters and null bytes safely without altering valid Unicode
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim() || fallback;
}

export function getAudioFormatLabel(fileName: string, mimeType: string): string {
  const ext = fileName.split('.').pop()?.toUpperCase();
  if (ext && ['MP3', 'M4A', 'AAC', 'WAV', 'OGG', 'FLAC', 'OPUS', 'WEBM'].includes(ext)) {
    return ext;
  }
  if (mimeType.includes('mpeg')) return 'MP3';
  if (mimeType.includes('mp4') || mimeType.includes('m4a')) return 'M4A';
  if (mimeType.includes('aac')) return 'AAC';
  if (mimeType.includes('wav')) return 'WAV';
  if (mimeType.includes('ogg')) return 'OGG';
  if (mimeType.includes('flac')) return 'FLAC';
  return 'AUDIO';
}
