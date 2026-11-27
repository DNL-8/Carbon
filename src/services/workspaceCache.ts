const databaseName = 'fitness-workspace';
const cacheStore = 'snapshots';
const workspaceChange = 'fitness-workspace-change';

let connection: Promise<IDBDatabase> | undefined;

function openCache() {
  connection ??= new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('Armazenamento local indisponível.'));
      return;
    }
    const request = indexedDB.open(databaseName, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(cacheStore);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('Armazenamento local bloqueado.'));
  }).catch((error) => {
    connection = undefined;
    throw error;
  });
  return connection;
}

type SnapshotKind = 'workspace' | 'health-connect';

async function cached<T>(key: string): Promise<T | undefined> {
  try {
    const db = await openCache();
    return await new Promise((resolve, reject) => {
      const request = db.transaction(cacheStore).objectStore(cacheStore).get(key);
      request.onsuccess = () => resolve(request.result as T | undefined);
      request.onerror = () => reject(request.error);
    });
  } catch {
    return undefined;
  }
}

async function updateCache(key: string, value?: unknown): Promise<void> {
  try {
    const db = await openCache();
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(cacheStore, 'readwrite');
      const store = transaction.objectStore(cacheStore);
      if (value === undefined) store.delete(key);
      else store.put(value, key);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  } catch {
    // O armazenamento local é opcional quando o navegador bloqueia o IndexedDB.
  }
}

export async function readCachedWorkoutLogs<T>(uid: string): Promise<T[] | undefined> {
  return cached<T[]>(`${uid}:workout-logs`);
}

export async function writeCachedWorkoutLogs<T>(uid: string, logs: readonly T[]): Promise<void> {
  await updateCache(`${uid}:workout-logs`, logs);
}

export async function clearWorkspaceCache(uid: string): Promise<void> {
  await Promise.all([
    updateCache(`${uid}:workspace`),
    updateCache(`${uid}:health-connect`),
    updateCache(`${uid}:workout-logs`),
  ]);
}

export function notifyWorkspaceChange(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(workspaceChange));
}

export function watchWorkspace<T>(
  uid: string,
  kind: SnapshotKind,
  fetchSnapshot: (signal: AbortSignal) => Promise<T>,
  onData: (snapshot: T) => void,
  onError: (error: unknown, showingCached: boolean) => void,
) {
  const key = `${uid}:${kind}`;
  let lastLoad = 0;
  let inFlight: AbortController | undefined;
  const load = () => {
    inFlight?.abort();
    const request = new AbortController();
    inFlight = request;
    lastLoad = Date.now();
    void (async () => {
      try {
        const result = await fetchSnapshot(request.signal);
        if (request.signal.aborted) return;
        onData(result);
        await updateCache(key, result);
      } catch (error) {
        if (request.signal.aborted) return;
        const offline = !navigator.onLine || error instanceof TypeError;
        const fallback = offline ? await cached<T>(key) : undefined;
        if (request.signal.aborted) return;
        if (fallback !== undefined) onData(fallback);
        onError(error, fallback !== undefined);
      }
    })();
  };
  const onFocus = () => {
    if (!document.hidden && Date.now() - lastLoad >= 15_000) load();
  };
  load();
  window.addEventListener('online', load);
  window.addEventListener('focus', onFocus);
  window.addEventListener(workspaceChange, load);
  const timer = window.setInterval(onFocus, 30_000);
  return () => {
    inFlight?.abort();
    window.clearInterval(timer);
    window.removeEventListener('online', load);
    window.removeEventListener('focus', onFocus);
    window.removeEventListener(workspaceChange, load);
  };
}
