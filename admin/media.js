// Картинки и файлы: сжатие фото в WebP прямо в браузере, хранение неопубликованных файлов в IndexedDB.

const TR = { а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'c', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya' };
export function translit(s, max = 40) {
  return String(s).toLowerCase().split('').map(c => TR[c] !== undefined ? TR[c] : c).join('')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, max).replace(/-+$/, '') || 'file';
}
const rand = (n = 4) => Math.random().toString(36).slice(2, 2 + n);

async function decode(file) {
  try { return await createImageBitmap(file, { imageOrientation: 'from-image' }); }
  catch (e) {
    const url = URL.createObjectURL(file);
    try { const im = new Image(); im.src = url; await im.decode(); return im; }
    catch (e2) { throw new Error('Не получилось открыть «' + file.name + '». Сохраните фото как JPG или PNG и загрузите снова (формат HEIC браузеры не читают).'); }
    finally { setTimeout(() => URL.revokeObjectURL(url), 5000); }
  }
}
const toBlob = (c, type, q) => new Promise(res => c.toBlob(res, type, q));

// Фото -> одна картинка WebP шириной до maxW (по умолчанию 1600)
export async function processImage(file, { maxW = 1600, quality = 0.84, dir = 'img', square = 0 } = {}) {
  const src = await decode(file);
  let W = src.width, H = src.height, sx = 0, sy = 0, sw = W, sh = H;
  if (square) { const m = Math.min(W, H); sx = (W - m) / 2; sy = (H - m) / 3; sw = sh = m; W = H = m; }
  const w = Math.min(maxW, W), h = Math.round(H * w / W);
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const ctx = c.getContext('2d'); ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src, sx, sy, sw, sh, 0, 0, w, h);
  let blob = await toBlob(c, 'image/webp', quality), ext = 'webp';
  if (!blob || blob.type !== 'image/webp') { blob = await toBlob(c, 'image/jpeg', quality); ext = 'jpg'; }
  if (src.close) src.close();
  return { path: dir + '/' + translit(file.name.replace(/\.[^.]+$/, '')) + '-' + rand() + '.' + ext, blob, w, h };
}
export function fileForRepo(file, dir) {
  const m = file.name.match(/\.([a-z0-9]+)$/i), ext = m ? m[1].toLowerCase() : 'bin';
  return { path: dir + '/' + translit(file.name.replace(/\.[^.]+$/, '')) + '-' + rand(3) + '.' + ext, blob: file };
}
export function readAsDataURL(blob) {
  return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(r.error); r.readAsDataURL(blob); });
}
export async function blobToBase64(blob) { const d = String(await readAsDataURL(blob)); return d.slice(d.indexOf(',') + 1); }
export function humanSize(bytes, ext) {
  const kb = bytes / 1024, e = (ext || '').toUpperCase();
  return (e ? e + ', ' : '') + (kb < 1024 ? Math.max(1, Math.round(kb)) + ' КБ' : (kb / 1024).toFixed(1).replace('.', ',') + ' МБ');
}

/* ---------- IndexedDB: черновик и неопубликованные файлы ---------- */
const DB = 'bm-admin', STORES = ['pending', 'draft'];
function db() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 2);
    r.onupgradeneeded = () => STORES.forEach(s => { if (!r.result.objectStoreNames.contains(s)) r.result.createObjectStore(s); });
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
}
const withTimeout = (p, ms = 4000) => Promise.race([p, new Promise(res => setTimeout(() => res(undefined), ms))]);
async function op(store, mode, fn) {
  try {
    const d = await withTimeout(db()); if (!d) return undefined;
    return await withTimeout(new Promise((res, rej) => {
      const t = d.transaction(store, mode), st = t.objectStore(store), rq = fn(st);
      t.oncomplete = () => { d.close(); res(rq && rq.result); }; t.onerror = () => { d.close(); rej(t.error); };
    }));
  } catch (e) { return undefined; }
}
export const idb = {
  put: (store, key, val) => op(store, 'readwrite', s => s.put(val, key)),
  get: (store, key) => op(store, 'readonly', s => s.get(key)),
  del: (store, key) => op(store, 'readwrite', s => s.delete(key)),
  clear: store => op(store, 'readwrite', s => s.clear()),
  async all(store) {
    try {
      const d = await withTimeout(db()); if (!d) return [];
      return (await withTimeout(new Promise((res, rej) => {
        const out = [], rq = d.transaction(store, 'readonly').objectStore(store).openCursor();
        rq.onsuccess = () => { const c = rq.result; if (c) { out.push([c.key, c.value]); c.continue(); } else { d.close(); res(out); } };
        rq.onerror = () => { d.close(); rej(rq.error); };
      }))) || [];
    } catch (e) { return []; }
  }
};
