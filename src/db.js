/**
 * db.js — IndexedDB storage layer for MedTranslate
 * Database: medtranslate-db v1
 * Stores: sessions (keyPath: id), translationCache (keyPath: cacheKey)
 */

const DB_NAME = 'medtranslate-db';
const DB_VERSION = 1;

let db = null;

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (e) => {
      const database = e.target.result;

      // sessions store
      if (!database.objectStoreNames.contains('sessions')) {
        const sessionStore = database.createObjectStore('sessions', { keyPath: 'id' });
        sessionStore.createIndex('startedAt', 'startedAt', { unique: false });
      }

      // translationCache store
      if (!database.objectStoreNames.contains('translationCache')) {
        database.createObjectStore('translationCache', { keyPath: 'cacheKey' });
      }
    };

    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = (e) => reject(new Error('DB open failed: ' + e.target.error));
  });
}

export async function initDB() {
  if (!db) db = await openDB();
  return db;
}

// ── Sessions ────────────────────────────────────────────────────────────────

export async function saveSession(session) {
  const database = await initDB();
  return new Promise((resolve, reject) => {
    const tx = database.transaction('sessions', 'readwrite');
    const req = tx.objectStore('sessions').put(session);
    req.onsuccess = () => resolve(req.result);
    req.onerror = (e) => reject(new Error('saveSession failed: ' + e.target.error));
  });
}

export async function getSession(id) {
  const database = await initDB();
  return new Promise((resolve, reject) => {
    const tx = database.transaction('sessions', 'readonly');
    const req = tx.objectStore('sessions').get(id);
    req.onsuccess = () => resolve(req.result);
    req.onerror = (e) => reject(new Error('getSession failed: ' + e.target.error));
  });
}

export async function getAllSessions() {
  const database = await initDB();
  return new Promise((resolve, reject) => {
    const tx = database.transaction('sessions', 'readonly');
    const index = tx.objectStore('sessions').index('startedAt');
    const req = index.openCursor(null, 'prev'); // newest-first
    const results = [];
    req.onsuccess = (e) => {
      const cursor = e.target.result;
      if (cursor) {
        results.push(cursor.value);
        cursor.continue();
      } else {
        resolve(results);
      }
    };
    req.onerror = (e) => reject(new Error('getAllSessions failed: ' + e.target.error));
  });
}

export async function deleteSession(id) {
  const database = await initDB();
  return new Promise((resolve, reject) => {
    const tx = database.transaction('sessions', 'readwrite');
    const req = tx.objectStore('sessions').delete(id);
    req.onsuccess = () => resolve();
    req.onerror = (e) => reject(new Error('deleteSession failed: ' + e.target.error));
  });
}

// ── Translation Cache ────────────────────────────────────────────────────────

export async function getCachedTranslations(cacheKey) {
  const database = await initDB();
  return new Promise((resolve, reject) => {
    const tx = database.transaction('translationCache', 'readonly');
    const req = tx.objectStore('translationCache').get(cacheKey);
    req.onsuccess = () => resolve(req.result ? req.result.translations : null);
    req.onerror = (e) => reject(new Error('getCachedTranslations failed: ' + e.target.error));
  });
}

export async function setCachedTranslations(cacheKey, translations) {
  const database = await initDB();
  return new Promise((resolve, reject) => {
    const tx = database.transaction('translationCache', 'readwrite');
    const entry = { cacheKey, translations, cachedAt: new Date().toISOString() };
    const req = tx.objectStore('translationCache').put(entry);
    req.onsuccess = () => resolve(req.result);
    req.onerror = (e) => reject(new Error('setCachedTranslations failed: ' + e.target.error));
  });
}
