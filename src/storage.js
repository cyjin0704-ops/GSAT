export const STORAGE_KEY = "gsat-exam-tool-v2";
export const SCHEMA_VERSION = 2;

export const defaultState = {
  schemaVersion: SCHEMA_VERSION,
  view: "home",
  settings: {
    sections: { math: { questionCount: 20, minutes: 30 }, reasoning: { questionCount: 30, minutes: 30 } },
    scoreMode: "simple",
    penalty: 0,
  },
  session: null,
  records: [],
  customTags: [],
};

export function createSession(mode, settings, overrides = {}) {
  const now = Date.now();
  return {
    id: crypto.randomUUID?.() || `${now}-${Math.random()}`,
    name: `GSAT 연습 ${new Date(now).toLocaleString("ko-KR")}`,
    mode, startedAt: now, updatedAt: now, status: "ready",
    currentSectionId: "math", currentQuestion: { sectionId: "math", number: 1 },
    answers: {}, metrics: { "math:1": { visits: 1, firstEnteredAt: now, lastEnteredAt: now } }, pageMappings: {},
    answerKey: [], result: null,
    timer: { kind: "countdown", running: false, sectionId: "math", remaining: (settings.sections.math?.minutes || 30) * 60, elapsed: 0, startedAt: null, endAt: null, warnings: [] },
    pdf: null, pdfPage: 1, pdfScale: 1, omrScrollTop: 0,
    ...overrides,
  };
}

function migrateLegacy() {
  const next = structuredClone(defaultState);
  try {
    const legacyAnswers = JSON.parse(localStorage.getItem("skct-omr-answers") || "{}");
    const answers = {};
    Object.entries(legacyAnswers).forEach(([number, value]) => {
      const n = Number(number);
      if (n <= 20) answers[`math:${n}`] = value;
      else if (n <= 50) answers[`reasoning:${n - 20}`] = value;
    });
    if (Object.keys(answers).length) next.session = createSession("practice", next.settings, { answers });
    next.legacyRecords = JSON.parse(localStorage.getItem("skct-exam-records") || "[]");
  } catch { /* clean state */ }
  return next;
}

export function loadState() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (parsed?.schemaVersion === SCHEMA_VERSION) return { ...structuredClone(defaultState), ...parsed };
  } catch { /* migrate */ }
  return migrateLegacy();
}
export const saveState = (state) => {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, schemaVersion: SCHEMA_VERSION })); }
  catch (error) { console.warn("GSAT 상태 저장 실패:", error); }
};

const DB_NAME = "gsat-pdf-store";
const STORE_NAME = "pdfs";
function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME, { keyPath: "fingerprint" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
export async function savePdf(record) {
  const db = await openDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(record);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}
export async function getPdf(fingerprint) {
  if (!fingerprint) return null;
  const db = await openDb();
  const result = await new Promise((resolve, reject) => {
    const request = db.transaction(STORE_NAME).objectStore(STORE_NAME).get(fingerprint);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
  db.close();
  return result;
}
export async function deletePdf(fingerprint) {
  if (!fingerprint) return;
  const db = await openDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(fingerprint);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}
export async function fingerprintFile(file) {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  const fingerprint = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return { fingerprint, buffer };
}
