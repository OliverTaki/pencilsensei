const DB_NAME = "pencilsensei";
const STORE = "sessions";
const VERSION = 1;

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: "id" });
        store.createIndex("updatedAt", "updatedAt");
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveSession(session) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(session);
    tx.oncomplete = () => { db.close(); resolve(session); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

export async function listSessions(limit = 20) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const out = [];
    const tx = db.transaction(STORE, "readonly");
    const store = tx.objectStore(STORE);
    const req = store.index("updatedAt").openCursor(null, "prev");
    req.onsuccess = () => {
      const cursor = req.result;
      if (!cursor || out.length >= limit) return;
      out.push(cursor.value);
      cursor.continue();
    };
    tx.oncomplete = () => { db.close(); resolve(out); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}
