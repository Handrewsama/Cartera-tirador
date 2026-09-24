const DB_NAME = 'tirador_wallet';
const DB_VERSION = 3;

export const STORE_DOCS = 'documents';
export const STORE_EVENTS = 'events';
export const STORE_META = 'meta';

let _dbPromise = null;

function openDb() {
  if (_dbPromise) return _dbPromise;
  _dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_DOCS)) {
        const os = db.createObjectStore(STORE_DOCS, { keyPath: 'id' });
        os.createIndex('category', 'category', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_EVENTS)) {
        db.createObjectStore(STORE_EVENTS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META, { keyPath: 'key' });
      }
    };
    req.onsuccess = e => resolve(e.target.result);
    req.onerror = e => reject(e);
  });
  return _dbPromise;
}

function tx(store, mode) {
  return openDb().then(db => {
    try { return db.transaction(store, mode, { durability: 'strict' }); }
    catch (e) { return db.transaction(store, mode); }
  });
}

/* ---- generic helpers ---- */
export async function getAll(store) {
  const t = await tx(store, 'readonly');
  return new Promise(res => {
    const r = t.objectStore(store).getAll();
    r.onsuccess = () => res(r.result || []);
    r.onerror = () => res([]);
  });
}

export async function put(store, value) {
  const t = await tx(store, 'readwrite');
  return new Promise(res => {
    t.objectStore(store).put(value);
    t.oncomplete = () => res(true);
    t.onerror = () => res(false);
  });
}

export async function del(store, key) {
  const t = await tx(store, 'readwrite');
  return new Promise(res => {
    t.objectStore(store).delete(key);
    t.oncomplete = () => res(true);
    t.onerror = () => res(false);
  });
}

export async function clear(store) {
  const t = await tx(store, 'readwrite');
  return new Promise(res => {
    t.objectStore(store).clear();
    t.oncomplete = () => res(true);
    t.onerror = () => res(false);
  });
}

export async function getOne(store, key) {
  const t = await tx(store, 'readonly');
  return new Promise(res => {
    const r = t.objectStore(store).get(key);
    r.onsuccess = () => res(r.result || null);
    r.onerror = () => res(null);
  });
}

/* ---- meta helpers (persistent key-value) ---- */
export async function metaSet(key, value) {
  return put(STORE_META, { key, value });
}
export async function metaGet(key) {
  const row = await getOne(STORE_META, key);
  return row ? row.value : null;
}
export async function metaDel(key) {
  return del(STORE_META, key);
}

/* ---- backup / restore ---- */
export async function exportAll() {
  const [documents, events] = await Promise.all([
    getAll(STORE_DOCS),
    getAll(STORE_EVENTS)
  ]);
  return { app: 'cartera-tirador', version: 3, exportedAt: Date.now(), documents, events };
}

export async function importAll(payload) {
  const docs = Array.isArray(payload.documents) ? payload.documents : [];
  const evs = Array.isArray(payload.events) ? payload.events : [];
  let ok = 0;
  for (const d of docs) if (d && d.id) { if (await put(STORE_DOCS, d)) ok++; }
  for (const e of evs) if (e && e.id) { if (await put(STORE_EVENTS, e)) ok++; }
  return ok;
}

export async function wipeAll() {
  await clear(STORE_DOCS);
  await clear(STORE_EVENTS);
}