const MEM = new Map(); // k -> { value, exp }
const LS_PREFIX = "tw_translate_v1:";
const TTL = 7 * 24 * 60 * 60 * 1000;
const IN_FLIGHT = new Map();

function now() {
  return Date.now();
}
function hash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h.toString(16);
}
function keyOf(text, targetLang, isHtml) {
  return `${targetLang}:${isHtml ? "html" : "text"}:${hash(text)}`;
}
function getCache(k) {
  const m = MEM.get(k);
  if (m && m.exp > now()) return m.value;
  try {
    const raw = localStorage.getItem(LS_PREFIX + k);
    if (!raw) return null;
    const obj = JSON.parse(raw);
    if (obj.exp > now()) {
      MEM.set(k, obj);
      return obj.value;
    }
    localStorage.removeItem(LS_PREFIX + k);
  } catch {}
  return null;
}
function setCache(k, value) {
  const obj = { value, exp: now() + TTL };
  MEM.set(k, obj);
  try {
    localStorage.setItem(LS_PREFIX + k, JSON.stringify(obj));
  } catch {}
}

/**
 * 後端翻譯 API（單筆）
 * @param {string} text
 * @param {string} targetLang "EN" | "JA" | "KO" | ...
 * @param {{isHtml?: boolean}} options
 */
export async function translateOne(text, targetLang) {
  const src = (text ?? "").toString();
  if (!src) return "";

  const k = keyOf(src, targetLang);
  const cached = getCache(k);
  if (cached != null) return cached;

  if (IN_FLIGHT.has(k)) return IN_FLIGHT.get(k);

  const p = (async () => {
    const resp = await fetch(`${import.meta.env.VITE_HOST_URL_TPLANET}/api/projects/translate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: src, target_lang: targetLang }),
    });

    if (!resp.ok) return src;

    const json = await resp.json();
    const payload = json?.data ?? json;
    const out = payload?.translations?.[0]?.text ?? src;

    setCache(k, out);
    return out;
  })();

  IN_FLIGHT.set(k, p);
  try {
    return await p;
  } finally {
    IN_FLIGHT.delete(k);
  }
}

/**
 * 批次翻譯：前端做並行（後端若之後支援 batch endpoint 可再優化）
 */
export async function translateBatch(
  texts,
  targetLang,
  { isHtml = false, concurrency = 6 } = {}
) {
  const arr = (texts || []).map((t) => (t ?? "").toString());
  const results = new Array(arr.length).fill("");

  let idx = 0;
  async function worker() {
    while (idx < arr.length) {
      const i = idx++;
      results[i] = await translateOne(arr[i], targetLang, { isHtml });
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, arr.length) }, () => worker())
  );

  return results;
}
