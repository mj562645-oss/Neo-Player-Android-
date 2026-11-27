import type { ListeningHistoryEntry } from '../types/music';

export type { ListeningHistoryEntry } from '../types/music';

const DATABASE_NAME = 'neo-player-listening-history';
const DATABASE_VERSION = 1;
const STORE_NAME = 'plays';
const MAX_HISTORY_ENTRIES = 5000;

let databasePromise: Promise<IDBDatabase> | null = null;

function openDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('Listening history requires local browser storage.'));
  }
  if (databasePromise) return databasePromise;
  databasePromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('playedAt', 'playedAt', { unique: false });
        store.createIndex('trackId', 'trackId', { unique: false });
      }
    };
    request.onsuccess = () => {
      const database = request.result;
      database.onversionchange = () => {
        database.close();
        databasePromise = null;
      };
      resolve(database);
    };
    request.onerror = () => {
      databasePromise = null;
      reject(request.error || new Error('Unable to open listening history.'));
    };
    request.onblocked = () => {
      databasePromise = null;
      reject(new Error('Listening history storage is busy in another app tab.'));
    };
  });
  return databasePromise;
}

export async function listListeningHistory(): Promise<ListeningHistoryEntry[]> {
  const database = await openDatabase();
  const transaction = database.transaction(STORE_NAME, 'readonly');
  const entries = await new Promise<ListeningHistoryEntry[]>((resolve, reject) => {
    const request = transaction.objectStore(STORE_NAME).getAll();
    request.onsuccess = () => resolve(request.result as ListeningHistoryEntry[]);
    request.onerror = () => reject(request.error || new Error('Unable to read listening history.'));
  });
  return entries.sort((a, b) => b.playedAt - a.playedAt);
}

export async function recordListeningHistory(trackId: string): Promise<ListeningHistoryEntry> {
  const database = await openDatabase();
  const transaction = database.transaction(STORE_NAME, 'readwrite');
  const store = transaction.objectStore(STORE_NAME);
  const now = Date.now();
  const recent = await new Promise<ListeningHistoryEntry | undefined>((resolve, reject) => {
    const request = store.index('playedAt').openCursor(null, 'prev');
    request.onsuccess = () => resolve(request.result?.value as ListeningHistoryEntry | undefined);
    request.onerror = () => reject(request.error || new Error('Unable to inspect listening history.'));
  });
  if (recent?.trackId === trackId && now - recent.playedAt < 10_000) return recent;

  const entry: ListeningHistoryEntry = {
    id: `${now}-${Math.random().toString(36).slice(2, 10)}`,
    trackId,
    playedAt: now,
  };
  await new Promise<void>((resolve, reject) => {
    const request = store.put(entry);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error || new Error('Unable to save listening history.'));
  });

  const count = await new Promise<number>((resolve, reject) => {
    const request = store.count();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Unable to count listening history.'));
  });
  const excess = count - MAX_HISTORY_ENTRIES;
  if (excess > 0) {
    await new Promise<void>((resolve, reject) => {
      let removed = 0;
      const cursorRequest = store.index('playedAt').openCursor();
      cursorRequest.onsuccess = () => {
        const cursor = cursorRequest.result;
        if (!cursor || removed >= excess) {
          resolve();
          return;
        }
        cursor.delete();
        removed += 1;
        cursor.continue();
      };
      cursorRequest.onerror = () => reject(cursorRequest.error || new Error('Unable to trim history.'));
    });
  }
  return entry;
}

export async function clearListeningHistory(): Promise<void> {
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const request = database.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).clear();
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error || new Error('Unable to clear listening history.'));
  });
}
