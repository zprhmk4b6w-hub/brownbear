// Админка сайта «Бурый мишка». Работает прямо на GitHub Pages, без сервера.
// Источник правды: index.html в репозитории. Тексты и картинки страниц правятся визуально,
// данные для скриптов (программы, калькулятор и т. п.) лежат в <script id="bm-data"> в том же файле.
import { GitHub, MockGitHub, GitHubError } from './github.js';
import { processImage, fileForRepo, blobToBase64, humanSize, idb, translit } from './media.js';

/* ================= утилиты ================= */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function h(tag, attrs, ...kids) {
  const e = document.createElement(tag);
  if (attrs) for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (k === 'html') e.innerHTML = v;
    else if (k === 'value') e.value = v;
    else if (k === 'checked') e.checked = !!v;
    else e.setAttribute(k, v === true ? '' : v);
  }
  kids.flat(9).forEach(k => { if (k != null && k !== false) e.append(k.nodeType ? k : String(k)); });
  return e;
}
const ICO = {
  page: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/>',
  book: '<path d="M3 5.5c3-1.5 6-1.5 9 .5 3-2 6-2 9-.5V19c-3-1.5-6-1.5-9 .5-3-2-6-2-9-.5z"/><path d="M12 6v13.5"/>',
  calc: '<rect x="5" y="3" width="14" height="18" rx="2.5"/><path d="M8 7h8M8 11h2M12 11h2M16 11h0M8 15h2M12 15h2M8 18h8"/>',
  quiz: '<circle cx="12" cy="12" r="8.5"/><path d="M9.6 9.5a2.5 2.5 0 1 1 3.4 2.3c-.6.3-1 .8-1 1.5v.4M12 16.8v.2"/>',
  chat: '<path d="M20 12a7.5 7.5 0 0 1-11 6.6L4 20l1.4-4.3A7.5 7.5 0 1 1 20 12z"/>',
  nav: '<path d="M4 6h16M4 12h16M4 18h10"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z"/>',
  img: '<rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5L5 20"/>',
  hist: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/>',
  help: '<circle cx="12" cy="12" r="8.5"/><path d="M12 16.5v.2M12 13.5c0-2.5 3-2.5 3-5a3 3 0 0 0-6 0"/>',
  undo: '<path d="M9 7 4.5 11.5 9 16"/><path d="M5 11.5h9.5a5 5 0 0 1 0 10H11"/>',
  redo: '<path d="m15 7 4.5 4.5L15 16"/><path d="M19 11.5H9.5a5 5 0 0 0 0 10H13"/>',
  pc: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>',
  phone: '<rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M11 18h2"/>',
  edit: '<path d="M4 20l1-4.5L15.5 5a2.1 2.1 0 0 1 3 3L8 18.5z"/>',
  eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
  up: '<path d="M12 19V5M6 11l6-6 6 6"/>', down: '<path d="M12 5v14M6 13l6 6 6-6"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2.5"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
  del: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  hide: '<path d="M3 3l18 18M10.6 6.1A9.8 9.8 0 0 1 12 6c6 0 9.5 6 9.5 6a17 17 0 0 1-3.1 3.8M6.6 7.6C4 9.3 2.5 12 2.5 12s3.5 6 9.5 6a9.6 9.6 0 0 0 4.2-1"/>',
  plus: '<path d="M12 5v14M5 12h14"/>', x: '<path d="M6 6l12 12M18 6 6 18"/>', send: '<path d="M4 12h12M12 6l6 6-6 6"/>',
  out: '<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>', dl: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>', file: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>',
  play: '<path d="M7 5v14l11-7z"/>',
  news: '<rect x="3" y="4" width="15" height="16" rx="2"/><path d="M18 8h2a1 1 0 0 1 1 1v9a2 2 0 0 1-2 2H5M7 8h7M7 12h7M7 16h4"/>',
  brush: '<path d="M14.5 4.5l5 5L10 19l-5 1 1-5z"/><path d="M12.5 6.5l5 5"/>',
  video: '<rect x="3" y="6" width="13" height="12" rx="2.5"/><path d="m16 10.5 5-3v9l-5-3z"/>',
  layout: '<rect x="3" y="4" width="18" height="16" rx="2.5"/><path d="M3 10h18M10 10v10"/>',
  bold: '<path d="M7 5h6a3.5 3.5 0 0 1 0 7H7zM7 12h7a3.5 3.5 0 0 1 0 7H7z"/>', ital: '<path d="M11 5h6M7 19h6M14 5l-4 14"/>', und: '<path d="M7 4v7a5 5 0 0 0 10 0V4M5 20h14"/>', strike: '<path d="M5 12h14M16 6.5A4 4 0 0 0 12 5c-2.5 0-4 1.3-4 3 0 1.5 1 2.4 3 3M8 17.5A4.5 4.5 0 0 0 12 19c2.6 0 4.2-1.4 4.2-3.2"/>',
  link: '<path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1"/>', clear: '<path d="M4 7h11M9.5 7 7 19M14 13l6 6M20 13l-6 6"/>', list: '<path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01"/>', olist: '<path d="M10 6h10M10 12h10M10 18h10M4 5l1.5-1V9M4 14h3l-3 4h3"/>', quote: '<path d="M7 7h4v5H7l-1 5M15 7h4v5h-4l-1 5"/>',
  alignl: '<path d="M4 6h16M4 10h10M4 14h16M4 18h10"/>', alignc: '<path d="M4 6h16M7 10h10M4 14h16M7 18h10"/>', alignr: '<path d="M4 6h16M10 10h10M4 14h16M10 18h10"/>', minus: '<path d="M5 12h14"/>', search: '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/>', users: '<circle cx="9" cy="8.5" r="3.2"/><path d="M3.5 19a5.5 5.5 0 0 1 11 0M15.5 5.6a3.2 3.2 0 0 1 0 6M17 13.6a5.5 5.5 0 0 1 3.5 5.4"/>'
};
const ic = n => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">' + (ICO[n] || '') + '</svg>';
const icEl = n => { const s = document.createElement('span'); s.style.display = 'contents'; s.innerHTML = ic(n); return s.firstChild; };
let toastT;
function toast(msg, err) { const t = $('#a-toast'); t.textContent = msg; t.classList.toggle('err', !!err); t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), err ? 5200 : 2600); }
const getp = (o, p) => String(p).split('.').reduce((a, k) => a == null ? undefined : a[k], o);
function setp(o, p, v) { const ks = String(p).split('.'); let a = o; ks.slice(0, -1).forEach(k => { if (a[k] == null || typeof a[k] !== 'object') a[k] = {}; a = a[k]; }); a[ks[ks.length - 1]] = v; }
const clone = o => JSON.parse(JSON.stringify(o));
const fmtDate = d => new Date(d).toLocaleString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });

/* ================= состояние ================= */
const LS_KEY = 'bm-admin';
const S = {
  gh: null, head: null, repo: '', branch: 'main',
  doc: null, data: null, base: '', baseData: '',
  pending: new Map(),        // путь -> { blob, url, size }
  view: 'page', page: 'home', mode: 'edit', device: 'pc',
  edoc: null, editing: null, editBefore: '', sel: null, block: null,
  undo: [], redo: [], cur: null,
  lists: {},                 // кэш списков файлов
  siteUrl: new URL('../', location.href).href,
};
const isMock = /[?&]mock=1/.test(location.search) && /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);

/* ================= модальные окна ================= */
function modal({ title, body, foot, wide, onClose }) {
  const root = $('#modal-root');
  const box = h('div', { class: 'mo' });
  const close = () => { box.remove(); if (onClose) onClose(); };
  const c = h('div', { class: 'mo-c' + (wide ? ' wide' : '') },
    h('div', { class: 'mo-h' }, h('h3', null, title), h('button', { class: 'ib', type: 'button', 'aria-label': 'Закрыть', html: ic('x'), onclick: close })),
    h('div', { class: 'mo-b' }, body), foot ? h('div', { class: 'mo-f' }, foot) : null);
  box.append(c);
  box.addEventListener('mousedown', e => { if (e.target === box) close(); });
  root.append(box);
  return { close, box, body: $('.mo-b', c) };
}
function ask(title, text, okLabel = 'Да', danger) {
  return new Promise(res => {
    let done = false;
    const m = modal({
      title, body: h('p', { style: 'margin:0;line-height:1.6' }, text),
      foot: [h('button', { class: 'b', type: 'button', onclick: () => { done = true; m.close(); res(false); } }, 'Отмена'),
        h('button', { class: 'b p' + (danger ? ' d' : ''), type: 'button', onclick: () => { done = true; m.close(); res(true); } }, okLabel)],
      onClose: () => { if (!done) res(false); }
    });
  });
}

/* ================= вход ================= */
function guessRepo() {
  const m = location.hostname.match(/^([\w-]+)\.github\.io$/i);
  if (!m) return '';
  const seg = location.pathname.split('/').filter(Boolean);
  const i = seg.indexOf('admin');
  return i >= 1 ? m[1] + '/' + seg[i - 1] : m[1] + '/' + m[1] + '.github.io';
}
function loadCfg() { try { return JSON.parse(localStorage.getItem(LS_KEY)) || {}; } catch (e) { return {}; } }
function saveCfg(c) { try { localStorage.setItem(LS_KEY, JSON.stringify(c)); } catch (e) { } }

function loginScreen(msg) {
  const cfg = loadCfg();
  const tok = cfg.token || sessionStorage.getItem('bm-token') || '';
  const app = $('#app'); app.innerHTML = '';
  const repo = h('input', { class: 'in', value: cfg.repo || guessRepo(), placeholder: 'владелец/репозиторий' });
  const token = h('input', { class: 'in', type: 'password', value: tok, placeholder: 'github_pat_…', autocomplete: 'off' });
  const rem = h('input', { type: 'checkbox', checked: !!cfg.token || !tok });
  const err = h('div', { class: 'err' + (msg ? '' : ' hidden') }, msg || '');
  const go = h('button', { class: 'b p', type: 'submit', style: 'width:100%;height:46px;margin-top:6px' }, 'Войти');
  const form = h('form', { onsubmit: async e => {
    e.preventDefault(); err.classList.add('hidden'); go.disabled = true; go.textContent = 'Проверяем…';
    const r = repo.value.trim().replace(/^https?:\/\/github\.com\//, '').replace(/\.git$/, '').replace(/\/$/, '');
    try {
      const gh = new GitHub({ token: token.value.trim(), repo: r });
      const info = await gh.repoInfo();
      if (info.permissions && !info.permissions.push) throw new GitHubError(403, 'У этого ключа нет права записи в репозиторий.');
      gh.branch = info.default_branch || 'main';
      saveCfg({ repo: r, token: rem.checked ? token.value.trim() : '' });
      if (!rem.checked) sessionStorage.setItem('bm-token', token.value.trim());
      await start(gh);
    } catch (ex) { err.textContent = ex.message || String(ex); err.classList.remove('hidden'); go.disabled = false; go.textContent = 'Войти'; }
  } },
    h('label', { class: 'fld' }, h('span', { class: 'fld-l' }, 'Репозиторий сайта на GitHub'), repo, h('span', { class: 'fld-h' }, 'Например: eleasing1/burymishka. Если админка открыта с сайта на github.io, поле заполнится само.')),
    h('label', { class: 'fld' }, h('span', { class: 'fld-l' }, 'Ключ доступа (токен GitHub)'), token),
    h('label', { class: 'chk' }, rem, 'Запомнить на этом устройстве'),
    err, go);
  app.append(h('div', { class: 'login' }, h('div', { class: 'login-c' },
    h('img', { class: 'logo', src: '../img/logo.webp', alt: '' }),
    h('h1', null, 'Админка сайта'), h('p', { class: 'sub' }, 'Образовательный центр «Бурый мишка»'),
    form,
    h('details', { class: 'howto' }, h('summary', null, 'Где взять ключ доступа'),
      h('ol', { html: '<li>Войдите на github.com в аккаунт, где лежит сайт.</li><li>Откройте <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener">github.com/settings/personal-access-tokens/new</a>.</li><li>Название любое, например «Админка сайта». Срок: до года.</li><li>Repository access: <b>Only select repositories</b>, выберите репозиторий сайта.</li><li>Permissions → Repository permissions → <b>Contents: Read and write</b>. Остальное не трогайте.</li><li>Нажмите Generate token, скопируйте ключ и вставьте сюда.</li></ol>' }),
      h('p', { class: 'fld-h' }, 'Ключ хранится только в этом браузере и отправляется только на api.github.com.')),
    location.hostname === 'localhost' || location.hostname === '127.0.0.1' ? h('p', { class: 'fld-h' }, h('a', { href: '?mock=1' }, 'Открыть тестовый режим без GitHub')) : null
  )));
}

/* ================= загрузка сайта ================= */
async function start(gh) {
  S.gh = gh; S.repo = gh.repo; S.branch = gh.branch;
  $('#app').innerHTML = '<div class="boot">Загружаем сайт из репозитория…</div>';
  const [head, html] = await Promise.all([gh.headSha(), gh.readText('index.html')]);
  S.head = head;
  loadHTML(html);
  S.base = finalHTML(); S.baseData = JSON.stringify(S.data);
  // неопубликованные файлы и черновик
  for (const [p, blob] of await idb.all('pending')) S.pending.set(p, { blob, url: URL.createObjectURL(blob), size: blob.size });
  const draft = await idb.get('draft', 'cur');
  shell();
  if (draft && draft.repo === S.repo && draft.html && draft.html !== S.base) {
    const ok = await ask('Есть несохранённые правки', 'В этом браузере остался черновик от ' + fmtDate(draft.ts) + ', который ещё не опубликован. Продолжить с ним?' + (draft.head !== S.head ? ' Внимание: после этого черновика сайт уже меняли, при публикации черновик заменит те изменения.' : ''), 'Восстановить черновик');
    if (ok) { loadHTML(draft.html); renderView(); markDirty(); toast('Черновик восстановлен'); }
    else { await idb.del('draft', 'cur'); await idb.clear('pending'); S.pending.clear(); }
  }
  if (gh.tokenExpires) {
    const days = (new Date(gh.tokenExpires) - Date.now()) / 864e5;
    if (days < 14) banner('Ключ доступа истекает ' + fmtDate(gh.tokenExpires) + '. Выпустите новый заранее, иначе публикация перестанет работать.');
  }
}
function loadHTML(html) {
  S.doc = new DOMParser().parseFromString(html, 'text/html');
  const dj = S.doc.getElementById('bm-data');
  try { S.data = JSON.parse(dj ? dj.textContent : '{}'); } catch (e) { S.data = {}; toast('Не удалось прочитать данные сайта (bm-data)', true); }
  S.undo = []; S.redo = []; S.cur = snap();
}
function finalHTML() {
  const d = S.doc.cloneNode(true);
  let dj = d.getElementById('bm-data');
  if (!dj) { dj = d.createElement('script'); dj.type = 'application/json'; dj.id = 'bm-data'; d.body.append(dj); }
  dj.textContent = '\n' + JSON.stringify(S.data, null, 1).replace(/<\//g, '<\\/') + '\n';
  return '<!doctype html>\n' + d.documentElement.outerHTML + '\n';
}
const snap = () => ({ head: S.doc.head.innerHTML, body: S.doc.body.innerHTML, data: JSON.stringify(S.data) });
function restore(s) { S.doc.head.innerHTML = s.head; S.doc.body.innerHTML = s.body; S.data = JSON.parse(s.data); }
function commit(label) {
  const now = snap();
  if (S.cur && now.body === S.cur.body && now.head === S.cur.head && now.data === S.cur.data) return;
  S.undo.push(S.cur); if (S.undo.length > 80) S.undo.shift();
  S.redo = []; S.cur = now;
  markDirty(); saveDraftSoon(); updUndo();
}
function undo() { if (!S.undo.length) return; endEdit(true); S.redo.push(S.cur); S.cur = S.undo.pop(); restore(S.cur); afterHistory(); }
function redo() { if (!S.redo.length) return; endEdit(true); S.undo.push(S.cur); S.cur = S.redo.pop(); restore(S.cur); afterHistory(); }
function afterHistory() { markDirty(); saveDraftSoon(); updUndo(); renderView(true); }
function updUndo() { const u = $('#u-undo'), r = $('#u-redo'); if (u) u.disabled = !S.undo.length; if (r) r.disabled = !S.redo.length; }
let dT;
function saveDraftSoon() { clearTimeout(dT); dT = setTimeout(() => idb.put('draft', 'cur', { repo: S.repo, head: S.head, ts: Date.now(), html: finalHTML() }), 900); }
const unpublished = () => [...S.pending].filter(([, v]) => !v.pub).map(([k]) => k);
function isDirty() { return unpublished().length > 0 || finalHTML() !== S.base; }
function markDirty() { const d = $('#dirty'); if (d) d.classList.toggle('hidden', !isDirty()); }
function banner(text) { const b = h('div', { class: 'banner' }, text, h('span', { class: 'sp' }), h('button', { class: 'ib', html: ic('x'), onclick: () => b.remove() })); const m = $('.main'); if (m) m.prepend(b); }

/* ================= каркас ================= */
const BASE_PAGES = { home: 'Главная', about: 'О центре', life: 'Жизнь центра', programs: 'Программы', diagnostics: 'Консультации и диагностика', adk: 'АДК', team: 'Педагоги', prices: 'Стоимость', parents: 'Родителям', contacts: 'Контакты', sveden: 'Сведения об организации', privacy: 'Политика данных' };
// список страниц берётся из самого сайта: новые страницы появляются в нём сразу
function pagesList(withChrome = true) {
  const R = ((S.data || {}).nav || {}).routes || {};
  const out = $$('.page[data-page]', S.doc).filter(p => p.dataset.page !== 'program' && p.dataset.page !== 'post')
    .map(p => [p.dataset.page, (R[p.dataset.page] || BASE_PAGES[p.dataset.page] || p.dataset.page) + (p.hasAttribute('data-hide') ? ' (скрыта)' : '')]);
  if (withChrome) out.push(['@chrome', 'Шапка, меню и подвал']);
  return out;
}
const pageName = k => (pagesList().find(p => p[0] === k) || [k, k])[1];
const VIEWS = [
  ['h', 'Страницы сайта'], ['page', 'Редактировать страницы', 'edit'], ['pages', 'Страницы и меню', 'page'], ['news', 'Новости', 'news'],
  ['h', 'Внешний вид'], ['design', 'Дизайн сайта', 'brush'],
  ['h', 'Разделы с данными'], ['programs', 'Программы', 'book'], ['calc', 'Калькулятор цен', 'calc'], ['quiz', 'Подбор программы', 'quiz'], ['tiles', 'Коммуникатор', 'chat'], ['nav', 'Навигация и поиск', 'nav'], ['docsets', 'Документы на страницах', 'file'],
  ['h', 'Сайт'], ['settings', 'Контакты, логотип, объявление', 'gear'], ['files', 'Картинки, видео, файлы', 'img'], ['history', 'История версий', 'hist'], ['help', 'Как пользоваться', 'help']
];
function fillPageSel() { const s = $('#pg'); if (!s) return; s.innerHTML = ''; pagesList().forEach(([k, n]) => s.append(h('option', { value: k }, n))); if (!pagesList().some(p => p[0] === S.page)) S.page = 'home'; s.value = S.page; }
function shell() {
  const app = $('#app'); app.innerHTML = '';
  const pageSel = h('select', { class: 'in', id: 'pg', onchange: e => { S.page = e.target.value; S.view = 'page'; renderView(); } });
  pageSel.value = S.page;
  const top = h('header', { class: 'top' },
    h('button', { class: 'ib burger-a', html: ic('menu'), onclick: () => $('.side').classList.toggle('open') }),
    h('div', { class: 'brand' }, h('img', { src: S.siteUrl + 'img/logo.webp', alt: '' }), h('span', null, 'Бурый мишка', h('small', null, S.gh.mock ? 'тестовый режим' : S.repo))),
    pageSel,
    h('div', { class: 'seg2', id: 'modes' },
      h('button', { type: 'button', 'data-m': 'edit', html: ic('edit') + 'Править', onclick: () => setMode('edit') }),
      h('button', { type: 'button', 'data-m': 'preview', html: ic('eye') + 'Просмотр', onclick: () => setMode('preview') })),
    h('div', { class: 'seg2', id: 'dev' },
      h('button', { type: 'button', 'data-d': 'pc', title: 'Компьютер', html: ic('pc'), onclick: () => setDev('pc') }),
      h('button', { type: 'button', 'data-d': 'phone', title: 'Телефон', html: ic('phone'), onclick: () => setDev('phone') })),
    h('button', { class: 'ib', id: 'u-undo', title: 'Отменить (Ctrl+Z)', html: ic('undo'), onclick: undo, disabled: true }),
    h('button', { class: 'ib', id: 'u-redo', title: 'Вернуть (Ctrl+Y)', html: ic('redo'), onclick: redo, disabled: true }),
    h('span', { class: 'sp' }),
    h('span', { class: 'dirty hidden', id: 'dirty' }, 'Есть неопубликованные правки'),
    h('a', { class: 'b g sm', href: S.siteUrl, target: '_blank', rel: 'noopener', html: ic('out') + 'Сайт' }),
    h('button', { class: 'b p', type: 'button', id: 'pub', html: ic('send') + 'Опубликовать', onclick: publish }));
  const side = h('nav', { class: 'side' }, VIEWS.map(v => v[0] === 'h' ? h('h5', null, v[1]) :
    h('button', { type: 'button', 'data-v': v[0], html: ic(v[2]) + esc(v[1]), onclick: () => { S.view = v[0]; $('.side').classList.remove('open'); renderView(); } })),
    h('h5', null, 'Выход'), h('button', { type: 'button', html: ic('out') + 'Выйти из админки', onclick: logout }));
  const main = h('div', { class: 'main', id: 'main' });
  const insp = h('aside', { class: 'insp', id: 'insp' });
  app.append(h('div', { class: 'shell' }, top, h('div', { class: 'body' }, side, main, insp)));
  renderView();
  markDirty(); updUndo();
}
async function logout() {
  if (isDirty() && !await ask('Выйти?', 'Неопубликованные правки останутся черновиком в этом браузере.', 'Выйти')) return;
  const c = loadCfg(); delete c.token; saveCfg(c); sessionStorage.removeItem('bm-token'); location.reload();
}
function setMode(m) { endEdit(); S.mode = m; if (S.view !== 'page') S.view = 'page'; renderView(); }
function setDev(d) { S.device = d; $$('#dev button').forEach(b => b.classList.toggle('on', b.dataset.d === d)); const w = $('.frame-wrap'); if (w) w.classList.toggle('phone', d === 'phone'); }
function renderView(keepScroll) {
  $$('.side button[data-v]').forEach(b => b.classList.toggle('on', b.dataset.v === S.view));
  $$('#modes button').forEach(b => b.classList.toggle('on', S.view === 'page' && b.dataset.m === S.mode));
  fillPageSel(); $('#pg').disabled = S.view !== 'page';
  setDev(S.device);
  const main = $('#main'), insp = $('#insp');
  const y = keepScroll && S.edoc ? S.edoc.defaultView.scrollY : 0;
  $$('.hint,.frame-wrap,.panel', main).forEach(x => x.remove());
  S.edoc = null; S.sel = S.block = S.editing = null;
  if (S.view === 'page') {
    insp.classList.toggle('hidden', S.mode !== 'edit');
    if (S.mode === 'edit') {
      const hint = h('div', { class: 'hint', html: 'Нажмите на любой текст и печатайте. Нажмите на картинку, чтобы заменить. Скрытое на сайте показано бледным с пунктиром.<span class="sp"></span>' });
      if (S.page !== '@chrome') hint.append(h('button', { class: 'b sm p', type: 'button', html: ic('plus') + 'Добавить блок в конец страницы', onclick: () => addBlockDialog('end') }));
      main.append(hint);
    }
    else main.append(h('div', { class: 'hint', html: 'Так сайт будет выглядеть после публикации. Ссылки и кнопки работают.' }));
    const fr = h('iframe', { title: 'Страница сайта' });
    main.append(h('div', { class: 'frame-wrap' + (S.device === 'phone' ? ' phone' : '') }, fr));
    if (S.mode === 'edit') { fr.addEventListener('load', () => { bindEditor(fr, y); }, { once: true }); fr.srcdoc = editorHTML(); emptyInsp(); }
    else { fr.srcdoc = previewHTML(); }
  } else {
    insp.classList.add('hidden');
    const p = h('div', { class: 'panel' }), inn = h('div', { class: 'panel-in' }); p.append(inn); main.append(p);
    (FORMS[S.view] || (() => inn.append('Раздел не найден')))(inn);
  }
}

/* ================= HTML для окна редактора и просмотра ================= */
function withBlobs(html) { for (const [p, v] of S.pending) html = html.split('"' + p).join('"' + v.url).split("'" + p).join("'" + v.url); return html; }
// В окне просмотра документ живёт по адресу about:srcdoc, поэтому переходы по #/… и history
// приводим к этому адресу, иначе браузер ушёл бы на опубликованный сайт.
function previewHTML(html) {
  let s = html || finalHTML();
  const pg = S.page === '@chrome' ? 'home' : S.page;
  const start = S.previewHash || ('#/' + (pg === 'home' ? '' : pg === 'sveden' ? 'sveden/common' : pg)); S.previewHash = '';
  const shim = '<script>(function(){var H=history,R=H.replaceState.bind(H),P=H.pushState.bind(H);' +
    'function fx(u){if(u==null)return u;u=String(u);var i=u.indexOf("#");return location.href.split("#")[0]+(i>=0?u.slice(i):"");}' +
    'H.replaceState=function(s,t,u){try{R(s,t,fx(u))}catch(e){try{R(s,t)}catch(_){}}};H.pushState=function(s,t,u){try{P(s,t,fx(u))}catch(e){}};' +
    'window.addEventListener("click",function(e){if(e.defaultPrevented)return;var a=e.target.closest&&e.target.closest("a[href^=\'#/\']");if(!a)return;e.preventDefault();var h=a.getAttribute("href");if(location.hash!==h)location.hash=h;});' +
    'if(!location.hash||location.hash==="#")location.hash=' + JSON.stringify(start) + ';})();<\/script>';
  s = s.replace('<head>', '<head><base href="' + S.siteUrl + '">' + shim);
  return withBlobs(s);
}
function editorHTML() {
  const d = S.doc.cloneNode(true);
  // скрипты сайта в редакторе не запускаем, но и не удаляем: после правок они вернутся на место
  $$('body script', d).forEach(s => { s.setAttribute('data-ed-type', s.getAttribute('type') || ''); s.setAttribute('type', 'text/x-ed-off'); });
  $$('head script[src]', d).forEach(s => s.remove());
  const base = d.createElement('base'); base.href = S.siteUrl; d.head.prepend(base);
  const css = d.createElement('link'); css.rel = 'stylesheet'; css.href = 'admin/editor.css?v=' + Date.now(); d.head.append(css);
  d.documentElement.classList.add('ed-mode'); d.documentElement.classList.remove('js-off');
  if (S.page === '@chrome') { d.documentElement.classList.add('ed-chrome'); }
  else { const pg = d.querySelector('.page[data-page="' + S.page + '"]'); if (pg) pg.classList.add('ed-on'); }
  $$('[data-hide]', d).forEach(e => { e.setAttribute('data-ed-hide', ''); e.removeAttribute('data-hide'); });
  $$('details:not([open])', d).forEach(e => { e.setAttribute('open', ''); e.setAttribute('data-ed-closed', ''); });
  // заглушки на месте автоматических блоков
  const PH = {
    programs: ['Карточки программ', 'собираются автоматически из раздела «Программы».', 'programs'],
    filters: ['Кнопки фильтров', 'настраиваются в разделе «Программы».', 'programs'],
    program: ['Страница программы', 'собирается из раздела «Программы».', 'programs'],
    comm: ['Коммуникатор', 'слова, значки и звуки настраиваются в разделе «Коммуникатор».', 'tiles'],
    calc: ['Калькулятор', 'занятия и цены настраиваются в разделе «Калькулятор цен».', 'calc'],
    next: ['Ссылки «Дальше»', 'внизу каждой страницы настраиваются в разделе «Навигация и поиск».', 'nav'],
    news: ['Лента новостей', 'новости добавляются и правятся в разделе «Новости». Если новостей нет, этот блок на сайте не показывается.', 'news'],
    post: ['Страница новости', 'собирается из раздела «Новости».', 'news']
  };
  $$('[data-dyn]', d).forEach(e => { const p = PH[e.dataset.dyn]; if (p) e.prepend(phEl(d, p)); });
  $$('[data-clone]', d).forEach(e => e.prepend(phEl(d, ['Частые вопросы', 'подставляются со страницы «Родителям»: те, у которых включено «Показывать на главной».', '@parents'])));
  $$('[data-docs]', d).forEach(e => e.prepend(phEl(d, ['Документы', 'подставляются из «Сведения → Документы». Какие именно, выбирается в разделе «Документы на страницах».', 'docsets'])));
  if (S.page === '@chrome') { const t = d.createElement('div'); t.className = 'ed-chrome-t ed-ui'; t.textContent = 'Мобильное меню и нижняя панель на телефоне:'; const m = d.getElementById('mnav'); if (m) m.before(t); }
  // неопубликованные файлы показываем из памяти браузера
  $$('[src],[href],[data-lb],[data-av],[data-video]', d).forEach(e => ['src', 'href', 'data-lb', 'data-av', 'data-video'].forEach(a => {
    const v = e.getAttribute(a); if (v && S.pending.has(v)) { e.setAttribute('data-ed-o-' + a, v); e.setAttribute(a, S.pending.get(v).url); }
  }));
  return '<!doctype html>\n' + d.documentElement.outerHTML;
}
function phEl(d, [t, text, go]) {
  const x = d.createElement('div'); x.className = 'ed-ph ed-ui'; x.setAttribute('contenteditable', 'false');
  x.innerHTML = '<span><b>' + esc(t) + '</b> ' + esc(text) + '</span>' + (go ? '<button type="button" data-goto="' + go + '">Открыть</button>' : '');
  return x;
}
// из окна редактора обратно в документ
function syncFromEditor() {
  if (!S.edoc) return;
  const b = S.edoc.body.cloneNode(true);
  $$('.ed-ui', b).forEach(e => e.remove());
  $$('script[data-ed-type]', b).forEach(s => { const t = s.getAttribute('data-ed-type'); if (t) s.setAttribute('type', t); else s.removeAttribute('type'); s.removeAttribute('data-ed-type'); });
  $$('[contenteditable]', b).forEach(e => e.removeAttribute('contenteditable'));
  $$('[spellcheck]', b).forEach(e => e.removeAttribute('spellcheck'));
  $$('.ed-hover,.ed-sel,.ed-editing,.ed-on', b).forEach(e => { e.classList.remove('ed-hover', 'ed-sel', 'ed-editing', 'ed-on'); if (!e.className) e.removeAttribute('class'); });
  $$('[data-ed-hide]', b).forEach(e => { e.setAttribute('data-hide', ''); e.removeAttribute('data-ed-hide'); });
  $$('.rv.in', b).forEach(e => e.classList.remove('in'));
  $$('[data-ed-closed]', b).forEach(e => { e.removeAttribute('open'); e.removeAttribute('data-ed-closed'); });
  $$('*', b).forEach(e => [...e.attributes].forEach(at => { if (at.name.startsWith('data-ed-o-')) { e.setAttribute(at.name.slice(10), at.value); e.removeAttribute(at.name); } }));
  // данные bm-data живут в S.data, разметку тела берём из редактора
  S.doc.body.innerHTML = b.innerHTML;
}

/* ================= визуальный редактор ================= */
const INL = new Set(['A', 'B', 'STRONG', 'I', 'EM', 'SMALL', 'SPAN', 'BR', 'MARK', 'TIME', 'SUP', 'SUB', 'U', 'S', 'CODE', 'SVG', 'IMG', 'WBR']);
const ITEM = '.vid-f,.gal>button,.gal>figure,.quote,.cta-s,.stat,hr,.tl-i,.tags>span,.chip,.prow,.fact,.room,.face,.tp,.posters>button,.vs-it,.lt>div,.step,.ev,.soc,.cline,.pnote,.badge,.trust>*,.who-list>li,.roles>div,.tp-blocks>div,.space-l>div,.myth,.need,.feat,.ptab,.learn>figure,.fbtn,.dl-row,.sv-nav>a,.nav>a,#mnav-list>li,.sub>a,.socials>a,.progs>a,.doc,details,tr,li,.card,figure,.btn,.next a';
const SECT = '.sec,.hero,.ph,.foot,.util,.hdr,.mnav,.dock';
function inlineOnly(el) {
  for (const c of el.childNodes) {
    if (c.nodeType !== 1) continue;
    const t = c.tagName.toUpperCase();
    if (!INL.has(t)) return false;
    if (t !== 'SVG' && t !== 'IMG' && !inlineOnly(c)) return false;
  }
  return true;
}
const directText = el => [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
function textLeaf(t) {
  if (t && t.nodeType === 3) t = t.parentElement;
  if (!t || t.nodeType !== 1 || t.closest('svg,.ed-ui,[data-dyn],[data-clone],[data-docs]') || t === S.edoc.body) return null;
  if (t.tagName === 'IMG') return null;
  if (!(inlineOnly(t) && t.textContent.trim())) return null;
  let el = t;
  while (el.parentElement && el.parentElement !== S.edoc.body) {
    const p = el.parentElement;
    if (inlineOnly(p) && directText(p)) el = p; else break;
  }
  return el;
}
function blockOf(el) {
  for (let e = el; e && e !== S.edoc.body; e = e.parentElement) {
    if (e.classList && e.classList.contains('page')) return null;
    if (e.matches && e.matches(ITEM)) return e;
    if (e.matches && e.matches(SECT)) return e;
  }
  return null;
}
function nameOf(e) {
  const c = e.classList, t = e.tagName;
  if (c.contains('sec')) return 'Секция'; if (c.contains('hero')) return 'Первый экран'; if (c.contains('ph') && !c.contains('tph')) return 'Шапка страницы';
  if (c.contains('hdr')) return 'Шапка сайта'; if (c.contains('util')) return 'Верхняя строка'; if (c.contains('foot')) return 'Подвал'; if (c.contains('mnav')) return 'Мобильное меню'; if (c.contains('dock')) return 'Нижняя панель';
  if (c.contains('vid-f') || c.contains('vid')) return 'Видео'; if (c.contains('gal')) return 'Фотогалерея'; if (c.contains('quote')) return 'Цитата'; if (c.contains('cta-s')) return 'Призыв'; if (c.contains('stat')) return 'Число'; if (c.contains('stats')) return 'Цифры'; if (t === 'HR') return 'Разделитель'; if (c.contains('prose')) return 'Текстовый блок'; if (c.contains('news-l')) return 'Лента новостей'; if (c.contains('annc')) return 'Объявление';
  if (c.contains('tp')) return 'Педагог'; if (c.contains('doc')) return 'Документ'; if (t === 'DETAILS') return 'Вопрос'; if (t === 'TR') return 'Строка таблицы'; if (t === 'TD' || t === 'TH') return 'Ячейка';
  if (t === 'LI') return 'Пункт'; if (c.contains('chip')) return 'Метка'; if (c.contains('btn') || c.contains('fbtn')) return 'Кнопка'; if (c.contains('prow')) return 'Строка цены'; if (c.contains('fact')) return 'Факт';
  if (t === 'FIGURE' || c.contains('tph')) return 'Картинка'; if (c.contains('ptab')) return 'Таблица цен'; if (c.contains('step')) return 'Шаг'; if (c.contains('badge')) return 'Значок';
  if (c.contains('card') || c.contains('pnote') || c.contains('need') || c.contains('feat') || c.contains('myth') || c.contains('ev')) return 'Карточка';
  if (/^H[1-6]$/.test(t)) return 'Заголовок'; if (t === 'P') return 'Абзац'; if (t === 'A') return 'Ссылка'; if (t === 'BUTTON') return 'Кнопка'; if (t === 'IMG') return 'Картинка';
  if (c.contains('grid2') || c.contains('grid3') || c.contains('faces') || c.contains('steps') || c.contains('roles') || c.contains('trust')) return 'Сетка'; if (c.contains('split') || c.contains('who')) return 'Колонки';
  if (t === 'TABLE' || c.contains('tbl-wrap')) return 'Таблица'; if (t === 'UL' || t === 'OL') return 'Список'; if (c.contains('tags')) return 'Метки'; if (c.contains('docs')) return 'Список документов'; if (c.contains('faq')) return 'Вопросы';
  if (c.contains('wrap')) return 'Контейнер'; if (t === 'SECTION') return 'Секция';
  return 'Блок';
}
function bindEditor(fr, y) {
  const doc = fr.contentDocument; S.edoc = doc;
  if (y) fr.contentWindow.scrollTo(0, y);
  const win = fr.contentWindow;
  let hov = null;
  doc.addEventListener('mouseover', e => {
    const t = e.target.closest ? (e.target.closest('img') || textLeaf(e.target) || blockOf(e.target)) : null;
    if (hov && hov !== t) hov.classList.remove('ed-hover');
    hov = t; if (t && t !== S.editing) t.classList.add('ed-hover');
  });
  doc.addEventListener('mouseleave', () => { if (hov) hov.classList.remove('ed-hover'); });
  doc.addEventListener('mousedown', e => {
    if (e.button !== 0) return;
    const t = e.target.nodeType === 3 ? e.target.parentElement : e.target;
    const go = t.closest('[data-goto]'); if (go) { e.preventDefault(); const g = go.dataset.goto; if (g === '@parents') { S.page = 'parents'; renderView(); } else { S.view = g; renderView(); } return; }
    if (t.closest('.ed-ui')) { e.preventDefault(); return; }
    if (S.editing && S.editing.contains(t)) return;
    endEdit();
    const img = t.closest('img');
    if (img && !t.closest('svg')) { e.preventDefault(); select(img); return; }
    const leaf = textLeaf(t);
    if (leaf && !leaf.closest('button') && leaf.tagName !== 'BUTTON') { startEdit(leaf); return; }
    e.preventDefault();
    if (leaf) { select(leaf); return; }
    const b = blockOf(t); if (b) select(b); else select(t);
  }, true);
  doc.addEventListener('click', e => { const a = e.target.closest && e.target.closest('a,button,summary,label'); if (a) e.preventDefault(); }, true);
  doc.addEventListener('submit', e => e.preventDefault(), true);
  doc.addEventListener('keydown', e => {
    if (!S.editing) { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); } if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); } return; }
    if (e.key === 'Escape') { e.preventDefault(); endEdit(); return; }
    if (e.key === 'Enter') { e.preventDefault(); doc.execCommand('insertLineBreak'); }
  }, true);
  doc.addEventListener('paste', e => {
    if (!S.editing) return;
    e.preventDefault();
    const text = (e.clipboardData || win.clipboardData).getData('text/plain').replace(/\r/g, '').replace(/[ \t]+\n/g, '\n');
    doc.execCommand('insertText', false, text);
  }, true);
  doc.addEventListener('dragstart', e => e.preventDefault(), true);
  doc.addEventListener('focusout', e => { if (S.editing && e.target === S.editing) setTimeout(() => { if (S.editing && doc.activeElement !== S.editing) endEdit(); }, 0); }, true);
}
function startEdit(el) {
  S.editing = el; S.editBefore = el.innerHTML;
  el.setAttribute('contenteditable', 'true'); el.setAttribute('spellcheck', 'true');
  $$('svg,img', el).forEach(x => x.setAttribute('contenteditable', 'false'));
  el.classList.add('ed-editing'); el.classList.remove('ed-hover');
  select(el, true);
}
function endEdit(silent) {
  const el = S.editing; if (!el) return; S.editing = null;
  el.removeAttribute('contenteditable'); el.removeAttribute('spellcheck'); el.classList.remove('ed-editing');
  $$('[contenteditable]', el).forEach(x => x.removeAttribute('contenteditable'));
  $$('font', el).forEach(x => x.replaceWith(...x.childNodes));
  $$('span:not([class]):not([style])', el).forEach(x => x.replaceWith(...x.childNodes));
  while (el.lastChild && el.lastChild.nodeName === 'BR' && el.childNodes.length > 1) el.lastChild.remove();
  if (!silent && el.innerHTML !== S.editBefore) { syncFromEditor(); commit('Текст'); }
  if (!silent && S.sel === el && !$('#insp').contains(document.activeElement)) inspector();
}
function select(el, editing) {
  if (S.sel && S.sel !== el) S.sel.classList.remove('ed-sel');
  if (S.block && S.block !== el) S.block.classList.remove('ed-sel');
  S.sel = el;
  let b = el.tagName === 'IMG' ? blockOf(el.parentElement) : (el.matches(ITEM + ',' + SECT) ? el : blockOf(el.parentElement));
  // отдельный абзац или заголовок внутри секции выбираем сам по себе, чтобы «Удалить» не снесло всю секцию
  if ((!b || b.matches(SECT)) && el.tagName !== 'IMG' && /^(P|H[1-6]|UL|OL|BLOCKQUOTE|FIGURE|HR|SPAN|DIV|TABLE)$/.test(el.tagName) && !el.classList.contains('page') && el !== S.edoc.body) b = el;
  S.block = b;
  if (!editing) el.classList.add('ed-sel');
  inspector();
}
function emptyInsp() {
  const i = $('#insp'); if (!i) return;
  i.innerHTML = '';
  i.append(h('div', { class: 'empty-insp', html: '<h3 style="color:var(--ink)">Как править</h3><ul><li><b>Текст:</b> нажмите на него и печатайте. <span class="kbd">Enter</span> переносит строку, <span class="kbd">Ctrl+B</span> делает жирным.</li><li><b>Картинка:</b> нажмите на неё, справа появится «Заменить».</li><li><b>Карточки, пункты, строки таблиц:</b> выберите, затем «Копия», «Выше», «Ниже», «Скрыть» или «Удалить».</li><li><b>Новый блок:</b> кнопка «Добавить блок» сверху или «Добавить ниже» у выбранного: текст, фото, видео, галерея, отзыв, вопросы, документы.</li><li><b>Цвет, размер, колонки, фон:</b> выберите блок, справа «Оформление».</li><li>Ошиблись? <span class="kbd">Ctrl+Z</span> или стрелка «Отменить» сверху.</li><li>Когда всё готово, нажмите <b>«Опубликовать»</b>.</li></ul>' }));
}

/* ================= правая панель ================= */
function inspector() {
  const i = $('#insp'); if (!i) return; i.innerHTML = ''; i.classList.remove('closed');
  const el = S.sel; if (!el) { emptyInsp(); return; }
  const add = (title, ...kids) => i.append(h('section', null, title ? h('h3', null, title) : null, ...kids));
  // текст
  if (S.editing) add('Текст', textToolbar(), h('p', { class: 'muted', html: 'Выделите слова и нажмите кнопку: жирный, курсив, цвет, ссылка. <span class="kbd">Enter</span>: новая строка. <span class="kbd">Esc</span>: готово.' }));
  if (el.tagName === 'BUTTON' || (!S.editing && el.closest('button') && textLeaf(el))) buttonText(add, el.closest('button') || el);
  if (el.tagName === 'IMG') imageTools(add, el);
  const a = el.closest('a'); if (a && !a.closest('.ed-ui')) linkTools(add, a);
  if (!a && el.tagName !== 'IMG' && el.tagName !== 'BUTTON' && !el.closest('button') && textLeaf(el) === el) {
    add('', h('button', { class: 'b sm', type: 'button', html: ic('out') + 'Сделать текст ссылкой', onclick: () => {
      endEdit(true);
      const link = S.edoc.createElement('a'); link.setAttribute('href', '#/');
      while (el.firstChild) link.append(el.firstChild);
      el.append(link); syncFromEditor(); commit('Ссылка'); select(link);
      toast('Теперь выберите справа, куда ведёт ссылка');
    } }), h('p', { class: 'muted' }, 'Например, чтобы приложить PDF программы в таблице «Образование».'));
  }
  const lb = el.closest('[data-lb]'); if (lb && lb.getAttribute('data-lb')) zoomTools(add, lb);
  const blk = S.block;
  if (blk) {
    if (blk.matches('.doc')) docTools(add, blk);
    if (blk.matches('.tp')) teacherTools(add, blk);
    if (blk.matches('details')) faqTools(add, blk);
    const vid = blk.matches('.vid-f') ? $('.vid', blk) : blk.closest('.vid'); if (vid) vidTools(add, vid);
    if (blk.matches('.gal') || blk.closest('.gal')) galTools(add, blk.matches('.gal') ? blk : blk.closest('.gal'));
    const use = $('svg use', blk); if (use && blk.matches('.feat,.need,.pnote,.badge,.trust>*,.cline,.tp-blocks>div,.btn,.lt>div,.soc,.progs>a,.vac-ok,.util a,.socials>a')) iconTools(add, use);
    blockTools(add, blk);
    styleTools(add, el, blk);
  }
  if (!blk && !S.editing && el.tagName !== 'IMG') add('', h('p', { class: 'muted' }, 'Это служебная часть страницы. Выберите текст, картинку или карточку.'));
}

/* ---------- форматирование текста ---------- */
function textToolbar() {
  const ex = (cmd, val) => { S.edoc.execCommand('styleWithCSS', false, cmd === 'foreColor' || cmd === 'hiliteColor'); S.edoc.execCommand(cmd, false, val); };
  const tb = (icon, title, fn) => h('button', { class: 'ib', type: 'button', title, html: ic(icon), onmousedown: e => { e.preventDefault(); fn(); } });
  const sw = (c, title) => h('button', { type: 'button', title, style: 'width:24px;height:24px;border-radius:50%;border:2px solid #fff;box-shadow:0 0 0 1px var(--line2);background:' + c, onmousedown: e => { e.preventDefault(); ex('foreColor', c); } });
  const cs = S.edoc ? S.edoc.defaultView.getComputedStyle(S.edoc.documentElement) : null;
  const tv = n => cs ? cs.getPropertyValue(n).trim() : '';
  return h('div', null,
    h('div', { class: 'row', style: 'flex-wrap:wrap;gap:2px' },
      tb('bold', 'Жирный (Ctrl+B)', () => ex('bold')), tb('ital', 'Курсив (Ctrl+I)', () => ex('italic')), tb('und', 'Подчеркнуть', () => ex('underline')), tb('strike', 'Зачеркнуть', () => ex('strikeThrough')),
      tb('link', 'Сделать выделенное ссылкой', () => {
        const sel = S.edoc.getSelection(); if (!sel || sel.isCollapsed) return toast('Сначала выделите слова, которые станут ссылкой');
        ex('createLink', '#/'); const a = sel.anchorNode && (sel.anchorNode.nodeType === 1 ? sel.anchorNode : sel.anchorNode.parentElement).closest('a');
        endEdit(); if (a) { select(a); toast('Выберите справа, куда ведёт ссылка'); }
      }),
      tb('clear', 'Убрать оформление выделенного', () => ex('removeFormat'))),
    h('div', { class: 'row', style: 'gap:6px;margin-top:8px;flex-wrap:wrap' }, h('span', { class: 'muted', style: 'margin-right:2px' }, 'Цвет:'),
      sw(tv('--maroon') || '#7a2432', 'Основной'), sw(tv('--honey-d') || '#8a5c30', 'Второй'), sw(tv('--ink') || '#2b201d', 'Тёмный'), sw(tv('--muted') || '#766a64', 'Серый'),
      sw('#c0392b', 'Красный'), sw('#2e7d4f', 'Зелёный'), sw('#2a6fb0', 'Синий'),
      h('button', { class: 'b sm g', type: 'button', onmousedown: e => { e.preventDefault(); ex('hiliteColor', '#fff1a8'); } }, 'Маркер')));
}

/* ---------- видео и галерея ---------- */
function vidTools(add, v) {
  const cur = v.getAttribute('data-ed-o-data-video') || v.getAttribute('data-video') || '';
  const inp = h('input', { class: 'in', value: /^https?:/.test(cur) ? cur : '', placeholder: 'https://vk.com/video-… или youtube, rutube' });
  const setV = p => { if (S.pending.has(p)) { v.setAttribute('data-ed-o-data-video', p); v.setAttribute('data-video', S.pending.get(p).url); } else { v.removeAttribute('data-ed-o-data-video'); v.setAttribute('data-video', p); } syncFromEditor(); commit('Видео'); inspector(); toast('Видео подключено'); };
  inp.addEventListener('change', () => { if (inp.value.trim()) setV(inp.value.trim()); });
  const img = $('img', v);
  const setPoster = p => { let i = $('img', v); if (!i) { i = S.edoc.createElement('img'); i.alt = ''; v.prepend(i); } if (S.pending.has(p)) { i.setAttribute('data-ed-o-src', p); i.src = S.pending.get(p).url; } else { i.removeAttribute('data-ed-o-src'); i.setAttribute('src', p); } syncFromEditor(); commit('Обложка'); };
  add('Видео', h('p', { class: 'muted' }, 'Вставьте ссылку на ролик во ВКонтакте, Rutube или YouTube. Ролик загрузится, только когда посетитель нажмёт «смотреть».'),
    h('label', { class: 'fld' }, h('span', { class: 'fld-l' }, 'Ссылка на видео'), inp),
    h('p', { class: 'muted', style: 'word-break:break-all' }, cur && !/^https?:/.test(cur) ? 'Сейчас: файл ' + cur : ''),
    h('div', { class: 'acts' },
      h('button', { class: 'b sm', type: 'button', html: ic('video') + 'Загрузить видеофайл', onclick: () => uploadFile('video', p => setV(p), 'video/*') }),
      h('button', { class: 'b sm', type: 'button', html: ic('img') + (img ? 'Сменить обложку' : 'Добавить обложку'), onclick: () => uploadImage(setPoster) })),
    h('p', { class: 'muted' }, 'Файл лучше не больше 50 МБ. Длинные ролики выкладывайте во ВКонтакте или Rutube и вставляйте ссылку.'));
}
function galTools(add, g) {
  add('Фотогалерея', h('p', { class: 'muted' }, 'Нажмите на фото, чтобы заменить. Лишнее фото выберите и удалите.'),
    h('div', { class: 'acts' }, h('button', { class: 'b sm p', type: 'button', html: ic('plus') + 'Добавить фото', onclick: async () => {
      const files = await pickFiles('image/*'); if (!files.length) return;
      toast('Обрабатываем фото: ' + files.length);
      for (const f of files) {
        try { const r = await processImage(f); await addPending(r.path, r.blob); const b = S.edoc.createElement('button'); b.type = 'button'; b.setAttribute('data-lb', ''); b.innerHTML = '<img alt="" loading="lazy">'; const i = b.firstChild; i.setAttribute('data-ed-o-src', r.path); i.src = S.pending.get(r.path).url; g.append(b); }
        catch (e) { toast(e.message, true); }
      }
      syncFromEditor(); commit('Фото'); toast('Фото добавлены');
    } })));
}

/* ---------- оформление выбранного блока ---------- */
const GRID_SEL = '.grid2,.grid3,.grid4,.faces,.steps,.roles,.posters,.learn,.gal,.news-l,.trust,.stats,.lt,.facts,.rooms,.next,.docs';
const SWAP_SEL = '.split,.adk,.ph-grid,.who,.story,.cta,.call,.hero-grid,.cont,.calc,.teaser,.tp';
const RAD_SEL = '.card,.pic,figure,.tph,.adk,.cta,.story,.quote,.cta-s,.vid,.ptab,img,.poster-one,.map,.pnote,.stat,.btn';
function styleTools(add, el, blk) {
  const target = blk || el, win = S.edoc.defaultView;
  const done = (lbl) => { syncFromEditor(); commit(lbl || 'Оформление'); inspector(); };
  const seg = (opts, cur, fn) => h('div', { class: 'seg2', style: 'flex-wrap:wrap' }, opts.map(([v, n]) => h('button', { type: 'button', class: v === cur ? 'on' : '', onclick: () => fn(v) }, n)));
  const rows = [];
  const row = (label, ctrl) => rows.push(h('div', { class: 'fld' }, h('span', { class: 'fld-l' }, label), ctrl));
  // фон
  const bgNow = target.style.background || target.style.backgroundColor || '';
  const BG = [['', 'Нет'], ['var(--tint)', 'Светлый'], ['var(--honey-l)', 'Тёплый'], ['var(--maroon-ll)', 'Розовый'], ['var(--maroon)', 'Основной'], ['#ffffff', 'Белый']];
  const bgCol = h('input', { type: 'color', value: /^#/.test(bgNow) ? bgNow : '#ffffff', title: 'Свой цвет', style: 'width:34px;height:30px;border:0;background:none;padding:0' });
  const setBg = v => {
    target.style.background = v; if (!v) target.style.removeProperty('background');
    if (v === 'var(--maroon)') target.style.color = '#fff'; else if (target.style.color === 'rgb(255, 255, 255)' || target.style.color === '#fff') target.style.removeProperty('color');
    if (target.matches('.sec')) target.classList.toggle('sec-bg', !!v);
    if (!target.getAttribute('style')) target.removeAttribute('style');
    done('Фон');
  };
  bgCol.addEventListener('change', () => setBg(bgCol.value));
  row('Фон', h('div', { class: 'row', style: 'flex-wrap:wrap' }, seg(BG, bgNow, setBg), bgCol));
  // цвет текста
  const fgNow = target.style.color || '';
  const fgCol = h('input', { type: 'color', value: '#2b201d', title: 'Свой цвет', style: 'width:34px;height:30px;border:0;background:none;padding:0' });
  const setFg = v => { if (v) target.style.color = v; else target.style.removeProperty('color'); if (!target.getAttribute('style')) target.removeAttribute('style'); done('Цвет текста'); };
  fgCol.addEventListener('change', () => setFg(fgCol.value));
  row('Цвет текста', h('div', { class: 'row', style: 'flex-wrap:wrap' }, seg([['', 'Обычный'], ['var(--maroon)', 'Основной'], ['var(--honey-d)', 'Второй'], ['var(--muted)', 'Серый'], ['#fff', 'Белый']], fgNow, setFg), fgCol));
  // выравнивание
  row('Выравнивание текста', seg([['', 'Как было'], ['left', 'Слева'], ['center', 'По центру'], ['right', 'Справа']], target.style.textAlign || '', v => { target.style.textAlign = v; if (!v) target.style.removeProperty('text-align'); if (!target.getAttribute('style')) target.removeAttribute('style'); done('Выравнивание'); }));
  // размер текста
  const fsEl = S.editing || (textLeaf(el) === el ? el : null) || (/^(H[1-6]|P|SPAN|A|LI|B|SMALL)$/.test(target.tagName) ? target : null);
  if (fsEl) {
    const px = parseFloat(win.getComputedStyle(fsEl).fontSize) || 16;
    const setFs = k => { if (!k) fsEl.style.removeProperty('font-size'); else { const n = Math.round(px * k); fsEl.style.fontSize = 'clamp(' + Math.max(12, Math.round(n * .78)) + 'px,' + (n / 14.4).toFixed(2) + 'vw,' + n + 'px)'; } if (!fsEl.getAttribute('style')) fsEl.removeAttribute('style'); done('Размер текста'); };
    row('Размер текста: ' + Math.round(px) + ' px', h('div', { class: 'row' }, h('button', { class: 'b sm', type: 'button', html: ic('minus'), title: 'Меньше', onclick: () => setFs(1 / 1.12) }), h('button', { class: 'b sm', type: 'button', html: ic('plus'), title: 'Больше', onclick: () => setFs(1.12) }), h('button', { class: 'b sm g', type: 'button', onclick: () => setFs(0) }, 'Как было')));
  }
  // отступы секции
  const sec = target.closest('.sec');
  if (sec && (target === sec || target.matches('.sec'))) {
    const cur = sec.style.getPropertyValue('--sec-y').trim();
    const SY = [['', 'Обычные'], ['0px', 'Нет'], ['clamp(28px,4vw,52px)', 'Меньше'], ['clamp(84px,10vw,150px)', 'Больше']];
    row('Отступы секции сверху и снизу', seg(SY, cur, v => { if (v) sec.style.setProperty('--sec-y', v); else sec.style.removeProperty('--sec-y'); if (v && sec.previousElementSibling && sec.previousElementSibling.matches('.sec')) sec.style.paddingTop = v; else sec.style.removeProperty('padding-top'); if (!sec.getAttribute('style')) sec.removeAttribute('style'); done('Отступы'); }));
  }
  // колонки
  const grid = target.matches(GRID_SEL) ? target : (target.parentElement && target.parentElement.matches(GRID_SEL) ? target.parentElement : $(GRID_SEL, target));
  if (grid) {
    const cur = ([...grid.classList].find(c => /^cols-\d$/.test(c)) || '').slice(5);
    row('Колонок в сетке', seg([['', 'Как было'], ['1', '1'], ['2', '2'], ['3', '3'], ['4', '4'], ['5', '5'], ['6', '6']], cur, v => { [...grid.classList].filter(c => /^cols-\d$/.test(c)).forEach(c => grid.classList.remove(c)); if (v) grid.classList.add('cols-' + v); done('Колонки'); }));
  }
  // поменять местами
  const sw = target.matches(SWAP_SEL) ? target : target.closest(SWAP_SEL) || $(SWAP_SEL, target);
  if (sw) row('Две колонки', h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: sw.classList.contains('swap'), onchange: e => { sw.classList.toggle('swap', e.target.checked); done('Порядок колонок'); } }), 'Поменять колонки местами (картинка слева или справа)'));
  // пропорции картинки
  const box = el.tagName === 'IMG' ? el.parentElement : target;
  if (box && box.matches('figure,.pic,.tph,.vid,.p,.face .p,.poster-one') ) {
    const cur = box.style.aspectRatio || '';
    row('Пропорции картинки', seg([['', 'Как было'], ['1 / 1', 'Квадрат'], ['4 / 3', '4:3'], ['3 / 4', '3:4'], ['16 / 9', '16:9'], ['9 / 16', '9:16']], cur.replace(/\s+/g, ' '), v => { if (v) box.style.aspectRatio = v; else box.style.removeProperty('aspect-ratio'); if (!box.getAttribute('style')) box.removeAttribute('style'); done('Пропорции'); }));
  }
  // скругление
  const rb = el.tagName === 'IMG' ? (el.closest('figure,.pic,.tph,.vid') || el) : target;
  if (rb.matches(RAD_SEL)) {
    const cur = parseInt(rb.style.borderRadius) || '';
    const r = h('input', { type: 'range', min: 0, max: 48, value: cur === '' ? parseInt(win.getComputedStyle(rb).borderRadius) || 0 : cur, style: 'flex:1' });
    r.addEventListener('change', () => { rb.style.borderRadius = r.value + 'px'; done('Скругление'); });
    row('Скругление углов', h('div', { class: 'row' }, r, h('button', { class: 'b sm g', type: 'button', onclick: () => { rb.style.removeProperty('border-radius'); if (!rb.getAttribute('style')) rb.removeAttribute('style'); done('Скругление'); } }, 'Как было')));
  }
  // видимость
  const vis = target.classList.contains('hide-m') ? 'd' : target.classList.contains('hide-d') ? 'm' : '';
  row('Где показывать', seg([['', 'Везде'], ['d', 'Только на компьютере'], ['m', 'Только на телефоне']], vis, v => { target.classList.remove('hide-m', 'hide-d'); if (v === 'd') target.classList.add('hide-m'); if (v === 'm') target.classList.add('hide-d'); done('Видимость'); }));
  // анимация
  if (target.matches('.rv') || $('.rv', target)) row('Плавное появление при прокрутке', h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: !target.classList.contains('no-anim'), onchange: e => { target.classList.toggle('no-anim', !e.target.checked); done('Анимация'); } }), 'Включено'));
  // свой стиль
  const css = h('input', { class: 'in', value: target.getAttribute('style') || '', placeholder: 'например: margin-top:40px', style: 'font-family:monospace;font-size:13px' });
  css.addEventListener('change', () => { if (css.value.trim()) target.setAttribute('style', css.value.trim()); else target.removeAttribute('style'); done('Свой стиль'); });
  row('Свой стиль (CSS, для опытных)', css);
  const det = h('details', { class: 'obj', open: S.styleOpen || null }, h('summary', null, h('span', { class: 't', html: ic('brush') + ' Оформление: ' + esc(nameOf(target).toLowerCase()) })), h('div', { class: 'ob' }, rows));
  det.addEventListener('toggle', () => { S.styleOpen = det.open; });
  add('', det);
}
function crumbsFor(el) {
  const out = [];
  for (let e = el; e && e !== S.edoc.body; e = e.parentElement) {
    if (e.classList.contains('page')) break;
    if (e.matches(ITEM) || e.matches(SECT) || /^(H[1-6]|P|TABLE|UL|OL)$/.test(e.tagName) || e.matches('.grid2,.grid3,.grid4,.split,.faces,.steps,.tags,.docs,.faq,.roles,.trust,.who,.posters,.learn,.gal,.stats,.news-l,.prose,.sec-head,.row-btn')) out.unshift(e);
  }
  return out;
}
function blockTools(add, blk) {
  const cr = crumbsFor(blk);
  const crumbs = h('div', { class: 'crumbs' }, cr.map(e => h('button', { type: 'button', class: e === blk ? 'on' : '', onclick: () => { endEdit(); select(e); e.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } }, nameOf(e))));
  const hidden = blk.hasAttribute('data-ed-hide');
  const act = (icon, label, fn, cls) => h('button', { class: 'b sm ' + (cls || ''), type: 'button', html: ic(icon) + label, onclick: fn });
  add('Выбрано: ' + nameOf(blk),
    h('p', { class: 'muted' }, 'Нажмите на название выше, чтобы выбрать блок побольше (всю карточку, секцию).'), crumbs,
    h('div', { class: 'acts' },
      act('copy', 'Копия', () => blockOp('copy')),
      act('up', 'Выше', () => blockOp('up')), act('down', 'Ниже', () => blockOp('down')),
      act(hidden ? 'eye' : 'hide', hidden ? 'Показать на сайте' : 'Скрыть с сайта', () => blockOp('hide')),
      act('del', 'Удалить', () => blockOp('del'), 'd')),
    h('div', { class: 'acts' }, h('button', { class: 'b sm p', type: 'button', html: ic('plus') + 'Добавить ниже', onclick: () => addBlockDialog('after') })));
}

/* ---------- библиотека блоков ---------- */
const TPL_TEL = () => 'tel:' + (((S.data || {}).settings || {}).phone || '');
const SEC_TPL = [
  ['Заголовок и текст', 'Подзаголовок, заголовок и абзацы', () => '<section class="sec"><div class="wrap"><div class="prose rv"><span class="eyebrow">Подзаголовок</span><h2 class="h2">Заголовок раздела</h2><p>Текст раздела. Нажмите, чтобы изменить. Новый абзац добавляется кнопкой «Добавить ниже».</p></div></div></section>'],
  ['Текст и картинка', 'Две колонки: текст с кнопкой и фото', () => '<section class="sec"><div class="wrap split rv"><div><span class="eyebrow">Подзаголовок</span><h2 class="h2">Заголовок</h2><p class="lead" style="margin-top:14px">Текст рядом с картинкой. Нажмите на картинку справа, чтобы заменить её.</p><div class="row-btn"><a class="btn btn-p" href="' + TPL_TEL() + '">Записаться</a></div></div><figure class="pic" style="aspect-ratio:4/3"><img src="img/placeholder.webp" alt="" loading="lazy"></figure></div></section>'],
  ['Карточки с иконками', 'Три карточки: значок, заголовок, текст', () => '<section class="sec"><div class="wrap"><div class="sec-head rv"><div><span class="eyebrow">Подзаголовок</span><h2 class="h2">Заголовок раздела</h2></div></div><div class="grid3 rv">' + [1, 2, 3].map(i => '<div class="card feat col"><span class="ico"><svg><use href="#i-star"/></svg></span><div><h3>Карточка ' + i + '</h3><p>Короткий текст карточки.</p></div></div>').join('') + '</div></div></section>'],
  ['Фотогалерея', 'Сетка фото, открываются крупно', () => '<section class="sec"><div class="wrap"><div class="sec-head rv"><div><span class="eyebrow">Фото</span><h2 class="h2">Фотогалерея</h2></div></div><div class="gal rv">' + [1, 2, 3, 4].map(() => '<button type="button" data-lb><img src="img/placeholder.webp" alt="" loading="lazy"></button>').join('') + '</div></div></section>'],
  ['Видео', 'Ролик из ВКонтакте, Rutube, YouTube или файл', () => '<section class="sec"><div class="wrap"><div class="sec-head rv"><div><span class="eyebrow">Видео</span><h2 class="h2">Заголовок видео</h2></div></div><figure class="vid-f rv" style="max-width:960px"><div class="vid" data-video="" role="button" tabindex="0" aria-label="Смотреть видео"><img src="img/placeholder.webp" alt=""><span class="vid-play"></span></div><figcaption>Подпись к видео</figcaption></figure></div></section>'],
  ['Отзыв или цитата', 'Крупная цитата с подписью', () => '<section class="sec"><div class="wrap"><blockquote class="quote rv" style="max-width:900px"><p>Текст отзыва или цитаты.</p><cite>Имя, кто это</cite></blockquote></div></section>'],
  ['Призыв позвонить', 'Цветная плашка с кнопкой', () => '<section class="sec"><div class="wrap"><div class="cta-s rv"><div><h2 class="h2">Приходите знакомиться</h2><p>Начните с консультации: расскажем, как построены занятия.</p></div><a class="btn btn-w" href="' + TPL_TEL() + '">Записаться по телефону</a></div></div></section>'],
  ['Вопросы и ответы', 'Раскрывающиеся вопросы', () => '<section class="sec"><div class="wrap"><div class="sec-head rv"><div><span class="eyebrow">Вопросы</span><h2 class="h2">Частые вопросы</h2></div></div><div class="faq rv">' + [1, 2, 3].map(i => '<details><summary>Вопрос ' + i + '?<i><svg><use href="#i-plus"/></svg></i></summary><div class="ans"><p>Ответ на вопрос.</p></div></details>').join('') + '</div></div></section>'],
  ['Документы', 'Список файлов для скачивания', () => '<section class="sec"><div class="wrap"><div class="sec-head rv"><div><span class="eyebrow">Документы</span><h2 class="h2">Документы</h2></div></div><div class="docs rv"><div class="doc"><span class="fi">PDF</span><div class="tx"><b>Название документа</b><span><span>PDF</span></span></div><div class="act"><a href="#/" download aria-label="Скачать"><svg><use href="#i-down"/></svg></a></div></div></div></div></section>'],
  ['Цифры', 'Три крупных числа с подписями', () => '<section class="sec"><div class="wrap"><div class="stats rv"><div class="stat"><b>138 м²</b><span>Подпись к числу</span></div><div class="stat"><b>2–8</b><span>Подпись к числу</span></div><div class="stat"><b>5,0</b><span>Подпись к числу</span></div></div></div></section>'],
  ['Шаги', 'Пронумерованные карточки', () => '<section class="sec"><div class="wrap"><div class="sec-head rv"><div><span class="eyebrow">Как это работает</span><h2 class="h2">Три шага</h2></div></div><div class="steps rv">' + [1, 2, 3].map(i => '<div class="card step"><div class="n">' + i + '</div><h3>Шаг ' + i + '</h3><p>Что происходит на этом шаге.</p></div>').join('') + '</div></div></section>'],
  ['Новости', 'Последние новости из раздела «Новости»', () => '<section class="sec"><div class="wrap"><div class="sec-head rv"><div><span class="eyebrow">Жизнь центра</span><h2 class="h2">Новости</h2></div><a class="link" href="#/life">Все новости<svg><use href="#i-arr"/></svg></a></div><div class="news-l rv" data-news="list" data-limit="3" data-dyn="news"></div></div></section>'],
  ['Таблица', 'Две колонки: название и значение', () => '<section class="sec"><div class="wrap"><h2 class="h3 rv" style="margin-bottom:16px">Заголовок таблицы</h2><table class="tbl rv">' + [1, 2, 3].map(i => '<tr><th>Строка ' + i + '</th><td>Значение</td></tr>').join('') + '</table></div></section>'],
  ['Важная плашка', 'Выделенное сообщение со значком', () => '<section class="sec"><div class="wrap"><div class="pnote rv"><svg><use href="#i-info"/></svg><div><b>Заголовок</b>Текст важного сообщения.</div></div></div></section>']
];
const EL_TPL = [
  ['Абзац', () => '<p>Новый абзац. Нажмите, чтобы изменить.</p>'],
  ['Заголовок', () => '<h3 class="h3">Новый заголовок</h3>'],
  ['Подзаголовок', () => '<span class="eyebrow">Подзаголовок</span>'],
  ['Список', () => '<ul class="dots"><li>Первый пункт</li><li>Второй пункт</li></ul>'],
  ['Картинка', () => '<figure class="pic" style="aspect-ratio:4/3;margin:16px 0"><img src="img/placeholder.webp" alt=""></figure>'],
  ['Кнопка', () => '<div class="row-btn"><a class="btn btn-p" href="' + TPL_TEL() + '">Записаться</a></div>'],
  ['Видео', () => '<figure class="vid-f" style="margin:16px 0"><div class="vid" data-video="" role="button" tabindex="0" aria-label="Смотреть видео"><img src="img/placeholder.webp" alt=""><span class="vid-play"></span></div></figure>'],
  ['Фотогалерея', () => '<div class="gal" style="margin:16px 0">' + [1, 2, 3].map(() => '<button type="button" data-lb><img src="img/placeholder.webp" alt="" loading="lazy"></button>').join('') + '</div>'],
  ['Цитата', () => '<blockquote class="quote"><p>Текст цитаты.</p><cite>Подпись</cite></blockquote>'],
  ['Плашка', () => '<div class="pnote"><svg><use href="#i-info"/></svg><div><b>Заголовок</b>Текст сообщения.</div></div>'],
  ['Разделитель', () => '<hr class="sep">']
];
function addBlockDialog(where) {
  endEdit();
  const page = S.edoc && (S.edoc.querySelector('.page.ed-on'));
  const anchor = where === 'end' ? null : (S.block || S.sel);
  const topSec = anchor && anchor.closest('.page > *');
  const insert = (html, kind) => {
    const tmp = S.edoc.createElement('div'); tmp.innerHTML = html.trim(); const node = tmp.firstElementChild;
    if (kind === 'sec') {
      if (topSec) topSec.after(node); else if (page) page.append(node); else return toast('Откройте страницу, чтобы добавить секцию', true);
    } else {
      let a = anchor; if (!a) return toast('Сначала выберите место на странице', true);
      if (a.matches('.sec,.hero,.ph')) { const w = $('.wrap', a) || a; w.append(node); } else a.after(node);
    }
    syncFromEditor(); commit('Новый блок'); m.close();
    // в редакторе показываем новый блок сразу, с заглушками
    renderView(true);
    toast('Блок добавлен. Нажмите на текст или картинку, чтобы изменить.');
  };
  const card = (t, sub, fn) => h('button', { type: 'button', class: 'tplc', onclick: fn }, h('b', null, t), sub ? h('span', null, sub) : null);
  const body = h('div', null,
    h('h4', { class: 'f-h' }, where === 'end' || !anchor ? 'Секция в конец страницы' : 'Новая секция после текущей'),
    h('div', { class: 'tpls' }, SEC_TPL.map(([t, sub, fn]) => card(t, sub, () => insert(fn(), 'sec')))),
    anchor && where !== 'end' ? [h('h4', { class: 'f-h' }, 'Элемент сразу после выбранного'), h('div', { class: 'tpls sm' }, EL_TPL.map(([t, fn]) => card(t, '', () => insert(fn(), 'el'))))] : null);
  const m = modal({ title: 'Добавить блок', body, wide: true });
}
async function blockOp(op) {
  endEdit(); const b = S.block; if (!b) return;
  if (op === 'copy') {
    const c = b.cloneNode(true);
    c.classList.remove('ed-sel', 'ed-hover');
    if (c.matches('.tp')) { const id = 'new' + Math.random().toString(36).slice(2, 6); c.id = 't-' + id; c.setAttribute('data-t', id); $$('details.cred dl', c).forEach(x => x.innerHTML = ''); }
    else { c.removeAttribute('id'); $$('[id]', c).forEach(x => x.removeAttribute('id')); }
    b.after(c); select(c); toast('Копия добавлена ниже. Поправьте её текст.');
  } else if (op === 'up') { const p = b.previousElementSibling; if (!p || p.classList.contains('ed-ui')) return toast('Выше двигать некуда'); p.before(b); }
  else if (op === 'down') { const n = b.nextElementSibling; if (!n) return toast('Ниже двигать некуда'); n.after(b); }
  else if (op === 'hide') { b.toggleAttribute('data-ed-hide'); toast(b.hasAttribute('data-ed-hide') ? 'Скрыто: на сайте этого не будет, но в админке оно осталось' : 'Снова показывается на сайте'); }
  else if (op === 'del') {
    if (!await ask('Удалить ' + nameOf(b).toLowerCase() + '?', 'Если передумаете, нажмите «Отменить» сверху. Если блок может пригодиться позже, лучше «Скрыть с сайта».', 'Удалить', true)) return;
    b.remove(); S.sel = S.block = null; emptyInsp();
  }
  syncFromEditor(); commit(op);
  if (op !== 'del' && S.sel) { inspector(); S.block.scrollIntoView({ block: 'nearest' }); }
}
function buttonText(add, btn) {
  const tn = [...btn.childNodes].filter(n => n.nodeType === 3 && n.textContent.trim()).pop();
  const inp = h('input', { class: 'in', value: tn ? tn.textContent.trim() : btn.textContent.trim() });
  inp.addEventListener('change', () => { if (tn) tn.textContent = inp.value; else btn.append(inp.value); if (btn.hasAttribute('data-l')) btn.removeAttribute('data-l'); syncFromEditor(); commit('Кнопка'); });
  add('Текст кнопки', inp);
}
const pathOf = img => img.getAttribute('data-ed-o-src') || img.getAttribute('src') || '';
const urlOf = p => S.pending.has(p) ? S.pending.get(p).url : (/^(https?:|data:|blob:)/.test(p) ? p : S.siteUrl + p);
function imageTools(add, img) {
  const prev = h('img', { class: 'prev-img', src: img.src, alt: '' });
  const alt = h('input', { class: 'in', value: img.getAttribute('alt') || '' });
  alt.addEventListener('change', () => { img.setAttribute('alt', alt.value); syncFromEditor(); commit('Описание'); });
  const setSrc = (path) => {
    if (S.pending.has(path)) { img.setAttribute('data-ed-o-src', path); img.src = S.pending.get(path).url; }
    else { img.removeAttribute('data-ed-o-src'); img.setAttribute('src', path); }
    img.removeAttribute('srcset'); img.removeAttribute('width'); img.removeAttribute('height');
    prev.src = urlOf(path); syncFromEditor(); commit('Картинка'); toast('Картинка заменена');
  };
  // положение кадра
  const cur = (img.style.objectPosition || '50% 50%').split(' ');
  const pos = h('div', { class: 'pos' }, [['0%', '0%'], ['50%', '0%'], ['100%', '0%'], ['0%', '50%'], ['50%', '50%'], ['100%', '50%'], ['0%', '100%'], ['50%', '100%'], ['100%', '100%']].map(([x, y]) =>
    h('button', { type: 'button', title: 'Кадр: ' + x + ' ' + y, class: (cur[0] === x && (cur[1] || '50%') === y) ? 'on' : '', onclick: e => { img.style.objectPosition = x + ' ' + y; $$('button', e.target.parentNode).forEach(b => b.classList.toggle('on', b === e.target)); syncFromEditor(); commit('Кадр'); } })));
  add('Картинка', prev,
    h('div', { class: 'acts' },
      h('button', { class: 'b sm p', type: 'button', html: ic('img') + 'Заменить с компьютера', onclick: () => uploadImage(p => setSrc(p)) }),
      h('button', { class: 'b sm', type: 'button', html: ic('img') + 'Выбрать из загруженных', onclick: () => library('img', p => setSrc(p)) })),
    h('label', { class: 'fld', style: 'margin-top:12px' }, h('span', { class: 'fld-l' }, 'Описание картинки'), alt, h('span', { class: 'fld-h' }, 'Для поисковиков и незрячих. Коротко, что на фото.')),
    h('div', { class: 'fld' }, h('span', { class: 'fld-l' }, 'Какую часть фото показывать, если оно обрезается'), pos));
}
function zoomTools(add, el) {
  const p = el.getAttribute('data-ed-o-data-lb') || el.getAttribute('data-lb');
  const th = h('img', { class: 'prev-img', src: urlOf(p), alt: '', style: 'max-height:140px' });
  const setZ = path => {
    if (S.pending.has(path)) { el.setAttribute('data-ed-o-data-lb', path); el.setAttribute('data-lb', S.pending.get(path).url); } else { el.removeAttribute('data-ed-o-data-lb'); el.setAttribute('data-lb', path); }
    th.src = urlOf(path); syncFromEditor(); commit('Увеличение');
  };
  add('Картинка при нажатии', h('p', { class: 'muted' }, 'Эта картинка открывается крупно, когда посетитель нажимает на блок.'), th,
    h('div', { class: 'acts' }, h('button', { class: 'b sm', type: 'button', onclick: () => uploadImage(setZ) }, 'Загрузить'), h('button', { class: 'b sm', type: 'button', onclick: () => library('img', setZ) }, 'Выбрать')));
}
function linkTargets() {
  const out = [['#/', 'Главная']];
  pagesList(false).forEach(([k, n]) => { if (k !== 'home') out.push(['#/' + (k === 'sveden' ? 'sveden/common' : k), n]); });
  (S.data.news || []).forEach(n => out.push(['#/news/' + n.id, 'Новость: ' + n.t]));
  (S.data.programs || []).forEach(p => out.push(['#/programs/' + p.id, 'Программа: ' + p.t]));
  $$('#team-list .tp[data-t]', S.doc).forEach(t => out.push(['#/team/' + t.dataset.t, 'Педагог: ' + ($('h2', t) || {}).textContent]));
  $$('#sv-nav a', S.doc).forEach(a => out.push([a.getAttribute('href'), 'Сведения: ' + a.textContent.replace(/^\d+/, '')]));
  (S.data.filters || []).forEach(([k, n]) => { if (k !== 'all') out.push(['#/programs?f=' + k, 'Программы, фильтр: ' + n]); });
  return out;
}
function linkTools(add, a) {
  const href = a.getAttribute('data-ed-o-href') || a.getAttribute('href') || '';
  const kind = href.startsWith('tel:') ? 'tel' : href.startsWith('mailto:') ? 'mail' : href.startsWith('#') ? 'page' : /^(docs|img|assets)\//.test(href) ? 'file' : 'url';
  const sel = h('select', { class: 'in' }, [['page', 'Страница сайта'], ['tel', 'Телефон'], ['mail', 'Почта'], ['file', 'Файл (документ, картинка)'], ['url', 'Другой сайт']].map(([v, n]) => h('option', { value: v }, n)));
  sel.value = kind;
  const box = h('div');
  const nt = h('input', { type: 'checkbox', checked: a.getAttribute('target') === '_blank' });
  const apply = v => { if (S.pending.has(v)) { a.setAttribute('data-ed-o-href', v); a.setAttribute('href', S.pending.get(v).url); } else { a.removeAttribute('data-ed-o-href'); a.setAttribute('href', v); } syncFromEditor(); commit('Ссылка'); toast('Ссылка изменена'); };
  const draw = () => {
    box.innerHTML = '';
    const k = sel.value;
    if (k === 'page') {
      const s2 = h('select', { class: 'in' }, linkTargets().map(([v, n]) => h('option', { value: v }, n)));
      if ([...s2.options].some(o => o.value === href)) s2.value = href; else s2.prepend(h('option', { value: href, selected: true }, href || '(не выбрано)'));
      s2.addEventListener('change', () => apply(s2.value)); box.append(s2);
    } else if (k === 'file') {
      box.append(h('div', { class: 'muted', style: 'margin-bottom:6px;word-break:break-all' }, href || 'файл не выбран'),
        h('div', { class: 'acts', style: 'margin-top:0' }, h('button', { class: 'b sm', type: 'button', onclick: () => library('docs', apply) }, 'Выбрать документ'), h('button', { class: 'b sm', type: 'button', onclick: () => uploadFile('docs', apply) }, 'Загрузить новый')));
    } else {
      const pre = k === 'tel' ? 'tel:' : k === 'mail' ? 'mailto:' : '';
      const inp = h('input', { class: 'in', value: href.startsWith(pre) ? href.slice(pre.length) : (k === 'url' ? href : ''), placeholder: k === 'tel' ? '+79501302274' : k === 'mail' ? 'почта@пример.ру' : 'https://…' });
      inp.addEventListener('change', () => { let v = inp.value.trim(); if (k === 'tel') v = v.replace(/[^\d+]/g, ''); apply(pre + v); });
      box.append(inp);
    }
  };
  sel.addEventListener('change', draw); draw();
  const unlink = !a.className && a.parentElement && textLeaf(a.parentElement) ? h('button', { class: 'b sm g', type: 'button', style: 'margin-top:8px', onclick: () => { endEdit(true); const p = a.parentElement; a.replaceWith(...a.childNodes); syncFromEditor(); commit('Ссылка'); select(p); toast('Ссылка убрана, текст остался'); } }, 'Убрать ссылку, оставить текст') : null;
  nt.addEventListener('change', () => { if (nt.checked) { a.setAttribute('target', '_blank'); a.setAttribute('rel', 'noopener'); } else { a.removeAttribute('target'); a.removeAttribute('rel'); } syncFromEditor(); commit('Ссылка'); });
  add('Куда ведёт ссылка', h('label', { class: 'fld' }, h('span', { class: 'fld-l' }, 'Тип'), sel), box, h('label', { class: 'chk', style: 'margin-top:10px' }, nt, 'Открывать в новой вкладке'), unlink);
}
function docTools(add, d) {
  const links = $$('.act a', d), cur = links[0] ? (links[0].getAttribute('data-ed-o-href') || links[0].getAttribute('href')) : '';
  const sig = !!$('.sig', d);
  const setDoc = (path, size) => {
    const ext = (path.match(/\.(\w+)$/) || [, ''])[1].toLowerCase();
    const real = S.pending.has(path) ? S.pending.get(path).url : path;
    const act = $('.act', d);
    act.innerHTML = (ext === 'pdf' ? '<a href="' + real + '" target="_blank" rel="noopener" aria-label="Открыть"><svg><use href="#i-open"/></svg></a>' : '') + '<a href="' + real + '" download aria-label="Скачать"><svg><use href="#i-down"/></svg></a>';
    if (S.pending.has(path)) $$('a', act).forEach(x => x.setAttribute('data-ed-o-href', path));
    const fi = $('.fi', d); if (fi) { fi.textContent = ext.toUpperCase(); fi.classList.toggle('docx', ext !== 'pdf'); }
    const meta = $('.tx>span', d);
    if (meta && size) { const sp = [...meta.children].filter(x => !x.classList.contains('sig')).pop(); if (sp) sp.textContent = humanSize(size, ext); }
    syncFromEditor(); commit('Документ'); toast('Файл документа заменён'); inspector();
  };
  const sg = h('input', { type: 'checkbox', checked: sig });
  sg.addEventListener('change', () => {
    const meta = $('.tx>span', d); if (!meta) return;
    if (sg.checked && !$('.sig', d)) meta.insertAdjacentHTML('afterbegin', '<span class="sig"><svg><use href="#i-sign"/></svg>Подписан ЭЦП</span>');
    if (!sg.checked) $$('.sig', d).forEach(x => x.remove());
    syncFromEditor(); commit('ЭЦП');
  });
  add('Документ', h('p', { class: 'muted', style: 'word-break:break-all' }, 'Файл: ' + (cur || 'не выбран')),
    h('div', { class: 'acts' },
      h('button', { class: 'b sm p', type: 'button', html: ic('file') + 'Загрузить новый файл', onclick: () => uploadFile('docs', (p, sz) => setDoc(p, sz)) }),
      h('button', { class: 'b sm', type: 'button', onclick: () => library('docs', (p, sz) => setDoc(p, sz)) }, 'Выбрать из загруженных')),
    h('label', { class: 'chk', style: 'margin-top:10px' }, sg, 'Подписан ЭЦП'),
    h('p', { class: 'muted' }, 'Название документа правится прямо в списке. Чтобы добавить новый документ, выберите похожий, нажмите «Копия» и загрузите в копию свой файл.'));
}
function teacherTools(add, tp) {
  const id = tp.getAttribute('data-t') || '';
  const inp = h('input', { class: 'in', value: id });
  inp.addEventListener('change', () => {
    const v = inp.value.trim().toLowerCase().replace(/[^a-z0-9-]/g, ''); if (!v) return;
    const old = id;
    tp.setAttribute('data-t', v); tp.id = 't-' + v;
    (S.data.programs || []).forEach(p => { p.tch = (p.tch || []).map(x => x === old ? v : x); });
    syncFromEditor(); commit('Код педагога'); toast('Код изменён');
  });
  const avP = tp.getAttribute('data-ed-o-data-av') || tp.getAttribute('data-av') || '';
  const av = h('img', { src: avP ? urlOf(avP) : '', alt: '', style: 'width:64px;height:64px;border-radius:50%;object-fit:cover;background:#eee' });
  const setAv = p => { if (S.pending.has(p)) { tp.setAttribute('data-ed-o-data-av', p); tp.setAttribute('data-av', S.pending.get(p).url); } else { tp.removeAttribute('data-ed-o-data-av'); tp.setAttribute('data-av', p); } av.src = urlOf(p); syncFromEditor(); commit('Аватар'); };
  add('Педагог', h('p', { class: 'muted' }, 'Имя, должность и описание правятся прямо на странице. Большая картинка слева меняется нажатием на неё.'),
    h('div', { class: 'fld' }, h('span', { class: 'fld-l' }, 'Маленькое круглое фото'), h('div', { class: 'row' }, av, h('button', { class: 'b sm', type: 'button', onclick: () => uploadImage(setAv, { square: 1, maxW: 320 }) }, 'Заменить')), h('span', { class: 'fld-h' }, 'Показывается в карточках программ рядом с именем.')),
    h('label', { class: 'fld' }, h('span', { class: 'fld-l' }, 'Код педагога для ссылок'), inp, h('span', { class: 'fld-h' }, 'Латиницей. По нему программы находят педагога, а таблица в «Сведениях» подставляет его образование (строка с таким же кодом).')));
}
function faqTools(add, d) {
  const page = d.closest('[data-page]');
  if (!page || page.dataset.page !== 'parents') return;
  const c = h('input', { type: 'checkbox', checked: d.hasAttribute('data-home') });
  c.addEventListener('change', () => { d.toggleAttribute('data-home', c.checked); syncFromEditor(); commit('На главной'); });
  add('Вопрос', h('label', { class: 'chk' }, c, 'Показывать на главной'), h('p', { class: 'muted' }, 'Вопрос и ответ правятся прямо на странице.'));
}
function spriteIds(prefix) { return $$('symbol[id^="' + prefix + '"]', S.doc).map(s => s.id); }
const ICON_NAMES = { 'i-phone': 'Телефон', 'i-pin': 'Метка', 'i-clock': 'Часы', 'i-mail': 'Письмо', 'i-arr': 'Стрелка', 'i-users': 'Люди', 'i-shield': 'Щит', 'i-heart': 'Сердце', 'i-book': 'Книга', 'i-pencil': 'Карандаш', 'i-chat': 'Сообщение', 'i-cal': 'Календарь', 'i-sun': 'Солнце', 'i-check': 'Галочка', 'i-doc': 'Документ', 'i-home': 'Дом', 'i-cap': 'Шапочка выпускника', 'i-brain': 'Мозг', 'i-puzzle': 'Пазл', 'i-hand': 'Ладонь', 'i-wallet': 'Кошелёк', 'i-child': 'Ребёнок', 'i-star': 'Звезда', 'i-info': 'Подсказка', 'i-key': 'Ключ', 'i-video': 'Видео', 'i-drop': 'Капля', 'i-tablet': 'Планшет', 'i-apple': 'Яблоко', 'i-cross': 'Аптечка', 'i-gov': 'Учреждение', 'i-tg': 'Telegram', 'i-max': 'MAX', 'i-search': 'Поиск', 'i-eye': 'Глаз', 'i-spark': 'Искры', 'i-vol': 'Звук', 'i-down': 'Скачать', 'i-open': 'Открыть', 'i-sign': 'Подпись', 'i-copy': 'Копия', 'i-plus': 'Плюс', 'i-x': 'Крестик', 'i-undo': 'Назад', 'i-cv': 'Галка вниз', 'i-burger': 'Меню', 't-ya': 'я', 't-mama': 'мама', 't-hochu': 'хочу', 't-nehochu': 'не хочу', 't-pomogi': 'помоги', 't-stop': 'стоп', 't-pit': 'пить', 't-est': 'есть', 't-igrat': 'играть', 't-gul': 'гулять', 't-wc': 'туалет', 't-esche': 'ещё' };
function symSvg(id, size) {
  const s = S.doc.getElementById(id); if (!s) return '';
  const at = ['viewBox', 'fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin'].map(a => s.getAttribute(a) ? a + '="' + s.getAttribute(a) + '"' : '').join(' ');
  return '<svg ' + at + ' width="' + (size || 20) + '" height="' + (size || 20) + '">' + s.innerHTML + '</svg>';
}
function iconTools(add, use) {
  const cur = (use.getAttribute('href') || '').slice(1);
  if (!cur.startsWith('i-')) return;
  const grid = h('div', { class: 'icons' }, spriteIds('i-').map(id => {
    const b = h('button', { type: 'button', title: ICON_NAMES[id] || id, class: id === cur ? 'on' : '', onclick: () => { use.setAttribute('href', '#' + id); $$('button', grid).forEach(x => x.classList.toggle('on', x === b)); syncFromEditor(); commit('Значок'); } });
    b.innerHTML = symSvg(id, 20); return b;
  }));
  add('Значок', grid);
}

/* ================= загрузка файлов ================= */
function pickFiles(accept) {
  return new Promise(res => { const i = h('input', { type: 'file', accept, multiple: true }); i.addEventListener('change', () => res([...i.files])); i.click(); });
}
function pickFile(accept) {
  return new Promise(res => { const i = h('input', { type: 'file', accept }); i.addEventListener('change', () => res(i.files[0] || null)); i.click(); });
}
async function addPending(path, blob) { S.pending.set(path, { blob, url: URL.createObjectURL(blob), size: blob.size }); await idb.put('pending', path, blob); markDirty(); }
async function uploadImage(cb, opt) {
  const f = await pickFile('image/*'); if (!f) return;
  try { toast('Обрабатываем фото…'); const r = await processImage(f, opt || {}); await addPending(r.path, r.blob); cb(r.path, r.blob.size); }
  catch (e) { toast(e.message || String(e), true); }
}
async function uploadFile(dir, cb, accept) {
  const f = await pickFile(accept || (dir === 'docs' ? '.pdf,.doc,.docx,.xls,.xlsx,.odt,.rtf,.txt' : '*/*')); if (!f) return;
  if (f.size > 45 * 1024 * 1024) return toast(dir === 'video' ? 'Видео больше 45 МБ GitHub не примет. Выложите ролик во ВКонтакте или Rutube и вставьте ссылку.' : 'Файл больше 45 МБ, GitHub такой не примет. Сожмите PDF.', true);
  const r = fileForRepo(f, dir); await addPending(r.path, f); cb(r.path, f.size);
}
async function listDir(dir) {
  if (!S.lists[dir]) S.lists[dir] = await S.gh.listDir(dir).catch(() => []);
  const remote = S.lists[dir];
  const pend = [...S.pending].filter(([p]) => p.startsWith(dir + '/') && !remote.some(x => x.path === p)).map(([p, v]) => ({ name: p.slice(dir.length + 1), path: p, size: v.size, pending: !v.pub }));
  return pend.concat(remote);
}
async function library(dir, cb) {
  const body = h('div', null, h('p', { class: 'muted' }, 'Загружаем список…'));
  const m = modal({ title: dir === 'img' ? 'Картинки сайта' : dir === 'docs' ? 'Документы сайта' : dir === 'video' ? 'Видео сайта' : 'Файлы', body, wide: true,
    foot: [h('button', { class: 'b', type: 'button', onclick: () => { m.close(); (dir === 'img' ? uploadImage : (c => uploadFile(dir, c)))(cb); } }, 'Загрузить новый')] });
  const list = await listDir(dir);
  body.innerHTML = '';
  if (!list.length) { body.append(h('p', null, 'Пока пусто.')); return; }
  if (dir === 'img') {
    body.append(h('div', { class: 'lib' }, list.filter(x => /\.(webp|jpe?g|png|gif|svg)$/i.test(x.name)).map(x => h('button', { type: 'button', title: x.name, onclick: () => { m.close(); cb(x.path, x.size); } },
      h('div', { class: 'th', style: 'background-image:url("' + urlOf(x.path) + '")' }), h('span', { class: 'nm' }, (x.pending ? '● ' : '') + x.name)))));
  } else {
    body.append(h('div', { class: 'flist' }, list.map(x => h('button', { type: 'button', onclick: () => { m.close(); cb(x.path, x.size); } }, h('span', { html: ic('file') }), x.name, h('span', { class: 'x' }, x.pending ? 'не опубликован' : (x.size ? humanSize(x.size) : ''))))));
  }
}

/* ================= формы для данных ================= */
const teamOpts = () => $$('#team-list .tp[data-t]', S.doc).map(t => [t.dataset.t, (($('h2', t) || {}).textContent || t.dataset.t).trim()]);
const filterOpts = () => (S.data.filters || []).filter(f => f[0] !== 'all').map(f => [f[0], f[1]]);
const docOpts = () => $$('#docs-all .doc[data-doc]', S.doc).map(d => [d.dataset.doc, (($('b', d) || {}).textContent || d.dataset.doc).trim()]);
let dataT;
function dataChanged(final) { markDirty(); saveDraftSoon(); clearTimeout(dataT); if (final) commit('Данные'); else dataT = setTimeout(() => commit('Данные'), 800); }
function fields(box, defs, obj, onCh) { defs.forEach(d => box.append(d.h ? h('h4', { class: 'f-h' }, d.h) : field(d, obj, onCh))); return box; }
function field(d, obj, onCh) {
  const ch = (final) => { (onCh || dataChanged)(final); };
  const val = getp(obj, d.k);
  const wrap = h('div', { class: 'fld' }, d.l ? h('span', { class: 'fld-l' }, d.l) : null);
  const put = v => setp(obj, d.k, v);
  switch (d.t) {
    case 'text': case 'slug': case 'number': {
      const i = h('input', { class: 'in', type: d.t === 'number' ? 'number' : 'text', value: val == null ? '' : val, placeholder: d.ph || '' });
      i.addEventListener('input', () => { let v = i.value; if (d.t === 'number') v = v === '' ? 0 : +v; if (d.t === 'slug') v = v.toLowerCase().replace(/[^a-z0-9-]/g, ''); put(v); ch(); });
      i.addEventListener('change', () => { if (d.t === 'slug') i.value = getp(obj, d.k); ch(true); if (d.after) d.after(); });
      wrap.append(i); break;
    }
    case 'textarea': {
      const i = h('textarea', { class: 'in', rows: d.rows || 3 }, val || '');
      i.addEventListener('input', () => { put(i.value); ch(); }); i.addEventListener('change', () => ch(true));
      wrap.append(i); break;
    }
    case 'bool': { const i = h('input', { type: 'checkbox', checked: !!val }); i.addEventListener('change', () => { put(i.checked); ch(true); if (d.after) d.after(); }); wrap.innerHTML = ''; wrap.append(h('label', { class: 'chk' }, i, d.l)); break; }
    case 'select': {
      const opts = typeof d.opts === 'function' ? d.opts() : d.opts;
      const s = h('select', { class: 'in' }, opts.map(([v, n]) => h('option', { value: v }, n)));
      s.value = val == null ? '' : val; s.addEventListener('change', () => { put(s.value); ch(true); }); wrap.append(s); break;
    }
    case 'multi': {
      const opts = typeof d.opts === 'function' ? d.opts() : d.opts, cur = new Set(val || []);
      wrap.append(h('div', { class: 'multi' }, opts.map(([v, n]) => { const c = h('input', { type: 'checkbox', checked: cur.has(v) }); c.addEventListener('change', () => { const arr = (getp(obj, d.k) || []).filter(x => x !== v); if (c.checked) { const order = opts.map(o => o[0]); arr.push(v); arr.sort((a, b) => order.indexOf(a) - order.indexOf(b)); } put(arr); ch(true); }); return h('label', null, c, n); })));
      break;
    }
    case 'strings': wrap.append(listEditor(val || [], arr => { put(arr); }, (v, set) => { const i = h('input', { class: 'in', value: v }); i.addEventListener('input', () => { set(i.value); ch(); }); i.addEventListener('change', () => ch(true)); return i; }, () => '', ch)); break;
    case 'numbers': wrap.append(listEditor(val || [], arr => put(arr), (v, set) => { const i = h('input', { class: 'in', type: 'number', value: v }); i.addEventListener('input', () => { set(+i.value); ch(); }); i.addEventListener('change', () => ch(true)); return i; }, () => 1, ch)); break;
    case 'pairs': wrap.append(listEditor(val || [], arr => put(arr), (v, set) => {
      const a = h('input', { class: 'in', value: v[0] || '', placeholder: d.a || '' }), b = h('input', { class: 'in', value: v[1] || '', placeholder: d.b || '', style: 'flex:2' });
      const up = () => { set([a.value, b.value]); ch(); }; a.addEventListener('input', up); b.addEventListener('input', up); a.addEventListener('change', () => ch(true)); b.addEventListener('change', () => ch(true));
      return h('div', { class: 'row', style: 'flex:1' }, a, b);
    }, () => ['', ''], ch)); break;
    case 'objlist': wrap.append(objList(val || [], arr => put(arr), d, ch)); break;
    case 'icon': {
      const ids = spriteIds(d.set === 't' ? 't-' : 'i-');
      const prev = h('span', { style: 'width:36px;height:36px;display:grid;place-items:center;border-radius:10px;background:var(--tint2);flex:none' });
      const draw = id => { prev.innerHTML = symSvg(id, 22); };
      const s = h('select', { class: 'in' }, ids.map(id => h('option', { value: id }, ICON_NAMES[id] || id))); s.value = val || ids[0];
      draw(s.value); s.addEventListener('change', () => { put(s.value); draw(s.value); ch(true); });
      wrap.append(h('div', { class: 'row' }, prev, s)); break;
    }
    case 'image': case 'file': case 'audio': {
      const th = h('div', { class: 'th' }), name = h('div', { class: 'fld-h', style: 'word-break:break-all;margin:0 0 6px' });
      const draw = () => { const p = getp(obj, d.k) || ''; name.textContent = p || 'не выбрано'; if (d.t === 'image') th.style.backgroundImage = p ? 'url("' + urlOf(p) + '")' : 'none'; };
      const set = (p) => { put(p); draw(); ch(true); };
      const dir = d.t === 'image' ? 'img' : d.t === 'audio' ? 'assets/audio' : 'docs';
      const acts = h('div', { class: 'acts', style: 'margin-top:0' },
        h('button', { class: 'b sm', type: 'button', onclick: () => d.t === 'image' ? uploadImage(set) : uploadFile(dir, set, d.t === 'audio' ? 'audio/*' : undefined) }, 'Загрузить'),
        h('button', { class: 'b sm', type: 'button', onclick: () => library(dir, set) }, 'Выбрать'),
        d.t === 'audio' ? h('button', { class: 'b sm', type: 'button', html: ic('play'), title: 'Послушать', onclick: () => { const p = getp(obj, d.k); if (p) new Audio(urlOf(p)).play().catch(() => toast('Не получилось проиграть', true)); } }) : null,
        h('button', { class: 'b sm g', type: 'button', onclick: () => set('') }, 'Убрать'));
      draw();
      wrap.append(d.t === 'image' ? h('div', { class: 'pick-img' }, th, h('div', null, name, acts)) : h('div', null, name, acts)); break;
    }
    case 'color': { const i = h('input', { type: 'color', value: val || '#000000', style: 'width:64px;height:40px;border:0;background:none' }); i.addEventListener('input', () => { put(i.value); ch(); }); i.addEventListener('change', () => ch(true)); wrap.append(i); break; }
    case 'date': {
      const v = String(val || ''), monthOnly = /^\d{4}-\d{2}$/.test(v);
      const i = h('input', { class: 'in', type: 'date', value: monthOnly ? v + '-01' : v, style: 'max-width:200px' });
      const mo = h('input', { type: 'checkbox', checked: monthOnly });
      const upd = () => { put(mo.checked && i.value ? i.value.slice(0, 7) : i.value); ch(true); if (d.after) d.after(); };
      i.addEventListener('change', upd); mo.addEventListener('change', upd);
      wrap.append(h('div', { class: 'row', style: 'flex-wrap:wrap' }, i, h('label', { class: 'chk' }, mo, 'Показывать только месяц и год'))); break;
    }
    case 'rich': wrap.append(richEditor(val || '', html => { put(html); }, ch)); break;
    case 'video': {
      const i = h('input', { class: 'in', value: val && /^https?:/.test(val) ? val : '', placeholder: 'Ссылка на ролик во ВКонтакте, Rutube или YouTube' });
      const nm = h('div', { class: 'fld-h' }, val && !/^https?:/.test(val) ? 'Загружен файл: ' + val : '');
      i.addEventListener('change', () => { put(i.value.trim()); nm.textContent = ''; ch(true); });
      wrap.append(i, h('div', { class: 'acts' },
        h('button', { class: 'b sm', type: 'button', html: ic('video') + 'Загрузить видеофайл', onclick: () => uploadFile('video', p => { put(p); i.value = ''; nm.textContent = 'Загружен файл: ' + p; ch(true); }, 'video/*') }),
        h('button', { class: 'b sm g', type: 'button', onclick: () => { put(''); i.value = ''; nm.textContent = ''; ch(true); } }, 'Убрать')), nm,
        h('span', { class: 'fld-h' }, 'Файл до 45 МБ. Длинные ролики выкладывайте во ВКонтакте или Rutube и вставляйте ссылку.')); break;
    }
    case 'gallery': {
      const arr = Array.isArray(val) ? val : []; put(arr);
      const grid = h('div', { class: 'galf' });
      const draw = () => {
        grid.innerHTML = '';
        arr.forEach((p, i) => grid.append(h('div', { class: 'gi', style: 'background-image:url("' + urlOf(p) + '")' },
          h('button', { class: 'ib', type: 'button', title: 'Левее', html: ic('up'), style: 'transform:rotate(-90deg)', onclick: () => { if (i) { [arr[i - 1], arr[i]] = [arr[i], arr[i - 1]]; draw(); ch(true); } } }),
          h('button', { class: 'ib', type: 'button', title: 'Убрать фото', html: ic('x'), onclick: () => { arr.splice(i, 1); draw(); ch(true); } }))));
        grid.append(h('button', { class: 'gi add', type: 'button', html: ic('plus') + '<span>Добавить фото</span>', onclick: async () => {
          const fs = await pickFiles('image/*'); if (!fs.length) return; toast('Обрабатываем фото: ' + fs.length);
          for (const f of fs) { try { const r = await processImage(f); await addPending(r.path, r.blob); arr.push(r.path); } catch (e) { toast(e.message, true); } }
          draw(); ch(true);
        } }));
      };
      draw(); wrap.append(grid); break;
    }
    case 'seckind': {
      const kind = obj.learn ? 'learn' : (obj.list ? 'list' : 'text');
      const s = h('select', { class: 'in' }, [['list', 'Список пунктов'], ['text', 'Абзац текста'], ['learn', 'Картинки «Чему учимся за день»']].map(([v, n]) => h('option', { value: v }, n))); s.value = kind;
      const box = h('div', { style: 'margin-top:10px' });
      const draw = () => {
        box.innerHTML = '';
        if (s.value === 'list') box.append(field({ k: 'list', l: 'Пункты', t: 'strings' }, obj, onCh));
        else if (s.value === 'text') box.append(field({ k: 'text', l: 'Текст', t: 'textarea' }, obj, onCh));
        else box.append(h('p', { class: 'fld-h' }, 'Покажутся картинки из блока «Чему учимся за учебный день» на странице «Программы».'));
      };
      s.addEventListener('change', () => { delete obj.list; delete obj.text; delete obj.learn; if (s.value === 'list') obj.list = ['']; else if (s.value === 'text') obj.text = ''; else obj.learn = true; draw(); ch(true); });
      draw(); wrap.append(s, box); break;
    }
  }
  if (d.help) wrap.append(h('span', { class: 'fld-h' }, d.help));
  return wrap;
}
function listEditor(arr, save, make, blank, ch) {
  const box = h('div', { class: 'lst' });
  const draw = () => {
    box.innerHTML = '';
    arr.forEach((v, i) => box.append(h('div', { class: 'row' }, make(v, nv => { arr[i] = nv; save(arr); }),
      h('button', { class: 'ib', type: 'button', title: 'Выше', html: ic('up'), disabled: i === 0, onclick: () => { [arr[i - 1], arr[i]] = [arr[i], arr[i - 1]]; save(arr); draw(); ch(true); } }),
      h('button', { class: 'ib', type: 'button', title: 'Удалить', html: ic('del'), onclick: () => { arr.splice(i, 1); save(arr); draw(); ch(true); } }))));
    box.append(h('div', null, h('button', { class: 'b sm', type: 'button', html: ic('plus') + 'Добавить', onclick: () => { arr.push(blank()); save(arr); draw(); ch(true); const ins = $$('input', box); if (ins.length) ins[ins.length - 1].focus(); } })));
  };
  save(arr); draw(); return box;
}
function objList(arr, save, d, ch) {
  const box = h('div');
  const draw = (openI) => {
    box.innerHTML = '';
    arr.forEach((o, i) => {
      const t = h('span', { class: 't' }, d.title ? d.title(o, i) : 'Пункт ' + (i + 1));
      const det = h('details', { class: 'obj' }, h('summary', null, t,
        h('button', { class: 'ib', type: 'button', title: 'Выше', html: ic('up'), disabled: i === 0, onclick: e => { e.preventDefault(); [arr[i - 1], arr[i]] = [arr[i], arr[i - 1]]; save(arr); draw(i - 1); ch(true); } }),
        h('button', { class: 'ib', type: 'button', title: 'Копия', html: ic('copy'), onclick: e => { e.preventDefault(); arr.splice(i + 1, 0, clone(o)); save(arr); draw(i + 1); ch(true); } }),
        h('button', { class: 'ib', type: 'button', title: 'Удалить', html: ic('del'), onclick: async e => { e.preventDefault(); if (await ask('Удалить?', 'Удалить «' + t.textContent + '»?', 'Удалить', true)) { arr.splice(i, 1); save(arr); draw(); ch(true); } } })),
        fields(h('div', { class: 'ob' }), d.fields, o, (f) => { t.textContent = d.title ? d.title(o, i) : t.textContent; ch(f); }));
      if (i === openI) det.open = true;
      box.append(det);
    });
    box.append(h('button', { class: 'b sm', type: 'button', html: ic('plus') + (d.addLabel || 'Добавить'), onclick: () => { arr.push(d.make ? d.make() : {}); save(arr); draw(arr.length - 1); ch(true); } }));
  };
  save(arr); draw(); return box;
}

const F_PROGRAM = [
  { k: 't', l: 'Название программы', t: 'text' },
  { k: 'hidden', l: 'Скрыть программу с сайта', t: 'bool' },
  { k: 'id', l: 'Адрес страницы', t: 'slug', help: 'Латиницей, без пробелов. Страница откроется по адресу сайт/#/programs/адрес. Если поменять, старые ссылки на программу перестанут работать.' },
  { h: 'Карточка в списке программ' },
  { k: 'card.chip', l: 'Метка (возраст, формат)', t: 'text' },
  { k: 'card.desc', l: 'Короткое описание', t: 'textarea', rows: 2 },
  { k: 'card.meta', l: 'Строка с расписанием', t: 'text' },
  { k: 'card.icon', l: 'Значок у расписания', t: 'icon', set: 'i' },
  { k: 'card.price', l: 'Цена', t: 'text', ph: '1 500 ₽' },
  { k: 'card.priceNote', l: 'Подпись к цене', t: 'text', ph: 'за занятие' },
  { h: 'Страница программы' },
  { k: 'chips', l: 'Метки вверху страницы', t: 'strings' },
  { k: 'lead', l: 'Вступление', t: 'textarea', rows: 4 },
  { k: 'facts', l: 'Факты в правой колонке', t: 'pairs', a: 'Название', b: 'Значение' },
  { k: 'sec', l: 'Разделы страницы', t: 'objlist', title: s => s.h || 'Раздел', addLabel: 'Добавить раздел', make: () => ({ h: 'Новый раздел', list: [''] }), fields: [{ k: 'h', l: 'Заголовок раздела', t: 'text' }, { k: 'kind', l: 'Что внутри', t: 'seckind' }] },
  { k: 'tch', l: 'Педагоги', t: 'multi', opts: teamOpts },
  { k: 'poster', l: 'Афиша (картинка, открывается кнопкой «Афиша»)', t: 'image' },
  { k: 'doc', l: 'Документ программы (PDF)', t: 'file', help: 'Если загрузить, на странице программы появится кнопка «Программа (PDF)».' },
  { h: 'Где программа показывается' },
  { k: 'tags', l: 'В каких фильтрах', t: 'multi', opts: filterOpts },
  { k: 'quiz.min', l: 'Подбор программы: возраст от', t: 'number' },
  { k: 'quiz.max', l: 'Подбор программы: возраст до', t: 'number' },
  { k: 'quiz.fmt', l: 'Подбор программы: формат', t: 'select', opts: [['short', 'Пару раз в неделю'], ['class', 'Учебный день в центре'], ['ind', 'Индивидуально']] }
];
const panelHead = (box, title, lead) => box.append(h('h2', null, title), lead ? h('p', { class: 'lead', html: lead }) : '');

/* ---------- редактор текста новости ---------- */
const RICH_OK = new Set(['P', 'BR', 'B', 'STRONG', 'I', 'EM', 'U', 'S', 'H2', 'H3', 'UL', 'OL', 'LI', 'A', 'IMG', 'BLOCKQUOTE', 'FIGURE', 'FIGCAPTION', 'HR']);
function cleanRich(html) {
  const t = document.createElement('template'); t.innerHTML = html;
  const walk = node => [...node.childNodes].forEach(n => {
    if (n.nodeType === 8) { n.remove(); return; }
    if (n.nodeType !== 1) return;
    walk(n);
    if (n.tagName === 'DIV') { const p = document.createElement('p'); p.append(...n.childNodes); n.replaceWith(p); return; }
    if (!RICH_OK.has(n.tagName)) { n.replaceWith(...n.childNodes); return; }
    [...n.attributes].forEach(a => { if (!['href', 'src', 'alt', 'target', 'rel'].includes(a.name)) n.removeAttribute(a.name); });
    if (n.tagName === 'A' && /^https?:/.test(n.getAttribute('href') || '')) { n.setAttribute('target', '_blank'); n.setAttribute('rel', 'noopener'); }
    if (n.tagName === 'IMG') n.setAttribute('loading', 'lazy');
  });
  walk(t.content);
  return t.innerHTML.replace(/<p><br><\/p>/g, '').trim();
}
function richEditor(val, put, ch) {
  const ed = h('div', { class: 'rich', contenteditable: 'true' });
  ed.innerHTML = withBlobs(val);
  const save = final => { let html = ed.innerHTML; for (const [p, v] of S.pending) html = html.split(v.url).join(p); put(cleanRich(html)); ch(final); };
  ed.addEventListener('focus', () => document.execCommand('defaultParagraphSeparator', false, 'p'));
  ed.addEventListener('input', () => save(false)); ed.addEventListener('blur', () => save(true));
  ed.addEventListener('paste', e => { e.preventDefault(); document.execCommand('insertText', false, (e.clipboardData || window.clipboardData).getData('text/plain')); });
  let range = null;
  const keep = () => { const s = getSelection(); if (s.rangeCount && ed.contains(s.anchorNode)) range = s.getRangeAt(0).cloneRange(); };
  ed.addEventListener('keyup', keep); ed.addEventListener('mouseup', keep);
  const back = () => { ed.focus(); if (range) { const s = getSelection(); s.removeAllRanges(); s.addRange(range); } };
  const ex = (c, v) => { back(); document.execCommand(c, false, v); keep(); save(false); };
  const tb = (icon, title, fn) => h('button', { class: 'ib', type: 'button', title, html: ic(icon), onmousedown: e => { e.preventDefault(); fn(); } });
  const tt = (label, fn) => h('button', { class: 'b sm g', type: 'button', onmousedown: e => { e.preventDefault(); fn(); } }, label);
  const bar = h('div', { class: 'rich-bar' },
    tt('Заголовок', () => ex('formatBlock', 'h2')), tt('Подзаголовок', () => ex('formatBlock', 'h3')), tt('Обычный текст', () => ex('formatBlock', 'p')),
    tb('bold', 'Жирный', () => ex('bold')), tb('ital', 'Курсив', () => ex('italic')), tb('und', 'Подчеркнуть', () => ex('underline')),
    tb('list', 'Список', () => ex('insertUnorderedList')), tb('olist', 'Нумерованный список', () => ex('insertOrderedList')), tb('quote', 'Цитата', () => ex('formatBlock', 'blockquote')),
    tb('link', 'Ссылка', () => { back(); const s = getSelection(); if (!s || s.isCollapsed) return toast('Сначала выделите слова, которые станут ссылкой'); const u = prompt('Куда ведёт ссылка? Например https://vk.com/… или #/prices', 'https://'); if (u && u !== 'https://') ex('createLink', u.trim()); }),
    tb('img', 'Вставить картинку', () => { keep(); uploadImage(p => ex('insertImage', urlOf(p))); }),
    tb('minus', 'Разделитель', () => ex('insertHorizontalRule')),
    tb('clear', 'Убрать оформление', () => ex('removeFormat')));
  return h('div', { class: 'rich-wrap' }, bar, ed);
}

/* ---------- дизайн: цвета, шрифты, форма, отступы ---------- */
const DESIGN_DEFAULT = { preset: 'base', maroon: '#7a2432', honey: '#ad7846', bg: '#ffffff', tint: '#faf7f5', tint2: '#f4efeb', line: '#ece5e0', ink: '#2b201d', ink2: '#4d403b', muted: '#766a64', fontBody: 'Manrope', fontHead: 'Manrope', fontHand: 'Caveat', headW: 750, fs: 17, hs: 1, radius: 20, pill: 'pill', shadow: 'soft', wrap: 1200, secY: 'normal', anim: true, css: '' };
const PRESETS = {
  base: ['Бордо и мёд (исходная)', { maroon: '#7a2432', honey: '#ad7846', bg: '#ffffff', tint: '#faf7f5', tint2: '#f4efeb', line: '#ece5e0', ink: '#2b201d', ink2: '#4d403b', muted: '#766a64' }],
  forest: ['Лесная', { maroon: '#2f5d46', honey: '#b0894f', bg: '#ffffff', tint: '#f6f8f5', tint2: '#edf1ec', line: '#e2e8e1', ink: '#1f2a24', ink2: '#3d4a43', muted: '#6a766f' }],
  sea: ['Морская', { maroon: '#1f5f8b', honey: '#d08b3e', bg: '#ffffff', tint: '#f5f8fb', tint2: '#ebf1f6', line: '#e1e8ef', ink: '#1c2733', ink2: '#3a4757', muted: '#687586' }],
  terracotta: ['Терракота', { maroon: '#b0502c', honey: '#7f8f4e', bg: '#ffffff', tint: '#fbf7f3', tint2: '#f5ede5', line: '#eee3d8', ink: '#2e221c', ink2: '#52423a', muted: '#7f6f66' }],
  lavender: ['Лавандовая', { maroon: '#6b4fa0', honey: '#d39a3a', bg: '#ffffff', tint: '#f9f7fc', tint2: '#f1edf8', line: '#e8e2f2', ink: '#26203a', ink2: '#463f5c', muted: '#7a7390' }],
  graphite: ['Графит', { maroon: '#2d2f36', honey: '#c08a3e', bg: '#ffffff', tint: '#f7f7f8', tint2: '#efeff1', line: '#e6e6ea', ink: '#1d1e22', ink2: '#3f4148', muted: '#70737c' }]
};
const FONTS = ['Manrope', 'Inter', 'Montserrat', 'Nunito', 'Rubik', 'Golos Text', 'Onest', 'Open Sans', 'Comfortaa', 'PT Sans', 'Raleway', 'Lora', 'PT Serif'];
const HANDS = ['Caveat', 'Marck Script', 'Neucha', 'Pacifico', 'Bad Script'];
const SERIF = new Set(['Lora', 'PT Serif']);
const hex2rgb = x => { x = String(x).replace('#', ''); if (x.length === 3) x = x.split('').map(c => c + c).join(''); return [0, 2, 4].map(i => parseInt(x.slice(i, i + 2), 16) || 0); };
const mixc = (a, b, t) => { const p = hex2rgb(a), q = hex2rgb(b); return '#' + p.map((v, i) => Math.round(v + (q[i] - v) * t).toString(16).padStart(2, '0')).join(''); };
function themeCSS(dd) {
  const d = Object.assign({}, DESIGN_DEFAULT, dd || {}), D = DESIGN_DEFAULT, v = [];
  const ch = k => String(d[k]).toLowerCase() !== String(D[k]).toLowerCase();
  if (ch('maroon')) v.push('--maroon:' + d.maroon, '--maroon-d:' + mixc(d.maroon, '#000000', .22), '--maroon-l:' + mixc(d.maroon, '#ffffff', .9), '--maroon-ll:' + mixc(d.maroon, '#ffffff', .95));
  if (ch('honey')) v.push('--honey:' + d.honey, '--honey-d:' + mixc(d.honey, '#000000', .22), '--honey-l:' + mixc(d.honey, '#ffffff', .86));
  ['bg', 'tint', 'tint2', 'ink', 'ink2', 'muted'].forEach(k => { if (ch(k)) v.push('--' + k + ':' + d[k]); });
  if (ch('line')) v.push('--line:' + d.line, '--line2:' + mixc(d.line, '#000000', .08));
  const stack = f => '"' + f + '",' + (SERIF.has(f) ? 'Georgia,"Times New Roman",serif' : 'system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif');
  if (ch('fontBody')) v.push('--font-body:' + stack(d.fontBody));
  if (d.fontHead !== d.fontBody) v.push('--font-head:' + stack(d.fontHead));
  if (ch('fontHand')) v.push('--font-hand:"' + d.fontHand + '",cursive');
  if (+d.headW !== D.headW) v.push('--head-w:' + d.headW);
  if (+d.hs !== D.hs) v.push('--hs:' + d.hs);
  if (+d.radius !== D.radius) v.push('--r-s:' + Math.round(d.radius * .6) + 'px', '--r:' + d.radius + 'px', '--r-l:' + Math.round(d.radius * 1.4) + 'px');
  if (d.pill !== D.pill) v.push('--pill:' + (d.pill === 'round' ? '14px' : '6px'));
  if (d.shadow === 'none') v.push('--sh1:none', '--sh2:none');
  if (d.shadow === 'strong') v.push('--sh1:0 2px 4px rgba(0,0,0,.06),0 10px 28px rgba(0,0,0,.09)', '--sh2:0 4px 10px rgba(0,0,0,.08),0 24px 56px rgba(0,0,0,.15)');
  if (+d.wrap !== D.wrap) v.push('--wrap:' + d.wrap + 'px');
  if (d.secY === 'compact') v.push('--sec-y:clamp(40px,5vw,72px)');
  if (d.secY === 'airy') v.push('--sec-y:clamp(72px,9vw,136px)');
  let css = v.length ? ':root{' + v.join(';') + '}' : '';
  if (+d.fs !== D.fs) css += ':root{--fs:' + d.fs + 'px}@media (max-width:720px){:root{--fs:' + (d.fs - 1) + 'px}}';
  if (d.anim === false || d.anim === 'false') css += '.rv{opacity:1!important;transform:none!important}';
  return css;
}
function applyDesign() {
  let t = S.doc.getElementById('bm-theme'); if (!t) { t = S.doc.createElement('style'); t.id = 'bm-theme'; S.doc.head.append(t); }
  t.textContent = themeCSS(S.data.design);
  let c = S.doc.getElementById('bm-custom'); const cs = ((S.data.design || {}).css || '').replace(/<\/style/gi, '');
  if (cs.trim()) { if (!c) { c = S.doc.createElement('style'); c.id = 'bm-custom'; t.after(c); } c.textContent = cs; } else if (c) c.remove();
}

/* ---------- страницы и меню ---------- */
const footList = () => S.doc.querySelector('.foot-g ul');
function menuLink(slug, where) {
  const sel = 'a[href="#/' + slug + '"]';
  if (where === 'top') return S.doc.querySelector('#nav ' + sel);
  if (where === 'mob') return S.doc.querySelector('#mnav-list > li > ' + sel);
  const f = footList(); return f ? f.querySelector(sel) : null;
}
function setMenu(slug, where, on, title) {
  const ex = menuLink(slug, where);
  if (!on) { if (ex) (where === 'top' ? ex : ex.closest('li')).remove(); return; }
  if (ex) { ex.textContent = title; return; }
  const a = S.doc.createElement('a'); a.setAttribute('href', '#/' + slug); a.textContent = title;
  if (where === 'top') { a.setAttribute('data-nav', slug); const n = S.doc.getElementById('nav'); if (n) n.append(a); return; }
  const li = S.doc.createElement('li'); li.append(a);
  if (where === 'mob') { a.setAttribute('data-m', slug); const l = S.doc.getElementById('mnav-list'); if (!l) return; const sv = l.querySelector('a[href^="#/sveden"]'); if (sv) sv.closest('li').before(li); else l.append(li); return; }
  const f = footList(); if (f) f.append(li);
}
function createPage(title, tpl, menus) {
  const R = S.data.nav.routes = S.data.nav.routes || {};
  let slug = translit(title, 30) || 'page', n = 2; const base = slug;
  while (S.doc.querySelector('.page[data-page="' + slug + '"]') || ['news', 'program', 'post', 'programs', 'team'].includes(slug)) slug = base + '-' + n++;
  const body = tpl === 'img'
    ? '<section class="sec" style="padding-top:0"><div class="wrap split rv"><div class="prose"><p>Текст страницы. Нажмите, чтобы изменить. Новые блоки добавляются кнопкой «Добавить блок».</p></div><figure class="pic" style="aspect-ratio:4/3"><img src="img/placeholder.webp" alt="" loading="lazy"></figure></div></section>'
    : tpl === 'empty' ? '' : '<section class="sec" style="padding-top:0"><div class="wrap"><div class="prose rv"><p>Текст страницы. Нажмите, чтобы изменить. Новые блоки добавляются кнопкой «Добавить блок».</p></div></div></section>';
  const t = S.doc.createElement('template');
  t.innerHTML = '<section class="page" data-page="' + slug + '"><div class="ph"><div class="wrap"><h1 class="h1">' + esc(title) + '</h1><p class="lead">Коротко о том, что на этой странице.</p></div></div>' + body + '</section>';
  const pages = $$('main .page', S.doc); pages[pages.length - 1].after(t.content.firstElementChild);
  R[slug] = title;
  ['top', 'mob', 'foot'].forEach(w => { if (menus[w]) setMenu(slug, w, true, title); });
  commit('Новая страница');
  return slug;
}

const F_NEWS = [
  { k: 't', l: 'Заголовок', t: 'text' },
  { k: 'date', l: 'Дата', t: 'date' },
  { k: 'hidden', l: 'Скрыть с сайта (черновик)', t: 'bool' },
  { k: 'pin', l: 'Закрепить первой и пометить «Важно»', t: 'bool' },
  { k: 'cover', l: 'Обложка (видна в списке новостей)', t: 'image' },
  { k: 'lead', l: 'Коротко, одной-двумя фразами (видно в списке)', t: 'textarea', rows: 2 },
  { k: 'body', l: 'Текст новости', t: 'rich' },
  { k: 'video', l: 'Видео', t: 'video' },
  { k: 'videoCap', l: 'Подпись к видео', t: 'text' },
  { k: 'gallery', l: 'Фотографии (открываются крупно)', t: 'gallery' },
  { k: 'id', l: 'Адрес страницы новости', t: 'slug', help: 'Новость открывается по адресу сайт/#/news/адрес. После публикации лучше не менять, иначе старые ссылки перестанут работать.' }
];
const FORMS = {
  design(box) {
    panelHead(box, 'Дизайн сайта', 'Цвета, шрифты, форма блоков и отступы. Справа сразу видно результат. На сайт попадёт после «Опубликовать». Оформление отдельного блока меняется в редакторе страниц: выберите блок, справа «Оформление».');
    const D = S.data.design = Object.assign({}, DESIGN_DEFAULT, S.data.design || {});
    const left = h('div', { class: 'dz-form' }), right = h('div', { class: 'dz-prev' });
    const pg = h('select', { class: 'in' }, pagesList(false).map(([k, n]) => h('option', { value: k }, n)));
    pg.value = S.page === '@chrome' ? 'home' : S.page;
    const dev = h('div', { class: 'seg2' }, h('button', { type: 'button', class: 'on', html: ic('pc'), onclick: e => { fr.classList.remove('ph'); $$('button', dev).forEach(b => b.classList.toggle('on', b === e.currentTarget)); } }), h('button', { type: 'button', html: ic('phone'), onclick: e => { fr.classList.add('ph'); $$('button', dev).forEach(b => b.classList.toggle('on', b === e.currentTarget)); } }));
    const fr = h('iframe', { title: 'Предпросмотр дизайна' });
    const load = () => { const keep = S.page; S.page = pg.value; applyDesign(); fr.srcdoc = previewHTML(); S.page = keep; };
    pg.addEventListener('change', load);
    const live = () => {
      applyDesign();
      try { const d = fr.contentDocument; d.getElementById('bm-theme').textContent = S.doc.getElementById('bm-theme').textContent; let c = d.getElementById('bm-custom'); if (!c) { c = d.createElement('style'); c.id = 'bm-custom'; d.head.append(c); } c.textContent = D.css || ''; } catch (e) { }
    };
    const ch = f => { live(); dataChanged(f); };
    const chc = f => { D.preset = 'custom'; $$('.preset', left).forEach(b => b.classList.remove('on')); ch(f); };
    left.append(h('div', { class: 'card' }, h('h4', { class: 'f-h' }, 'Готовые сочетания цветов'),
      h('div', { class: 'presets' }, Object.entries(PRESETS).map(([k, [n, c]]) => h('button', { type: 'button', class: 'preset' + (D.preset === k ? ' on' : ''), onclick: () => { Object.assign(D, c, { preset: k }); applyDesign(); dataChanged(true); renderView(); } },
        h('span', { class: 'sw' }, [c.maroon, c.honey, c.tint2, c.ink].map(x => h('i', { style: 'background:' + x }))), n)))));
    left.append(fields(h('div', { class: 'card' }), [{ h: 'Цвета' },
      { k: 'maroon', l: 'Основной: кнопки, акценты, ссылки', t: 'color' }, { k: 'honey', l: 'Второй: значки, подзаголовки', t: 'color' },
      { k: 'bg', l: 'Фон страницы', t: 'color' }, { k: 'tint', l: 'Фон светлых блоков', t: 'color' }, { k: 'tint2', l: 'Фон меток и кнопок', t: 'color' },
      { k: 'line', l: 'Линии и рамки', t: 'color' }, { k: 'ink', l: 'Текст и заголовки', t: 'color' }, { k: 'ink2', l: 'Основной текст абзацев', t: 'color' }, { k: 'muted', l: 'Серые подписи', t: 'color' }], D, chc));
    const fopt = l => l.map(f => [f, f]);
    left.append(fields(h('div', { class: 'card' }), [{ h: 'Шрифты' },
      { k: 'fontBody', l: 'Основной текст', t: 'select', opts: fopt(FONTS) }, { k: 'fontHead', l: 'Заголовки', t: 'select', opts: fopt(FONTS) },
      { k: 'fontHand', l: 'Надписи «от руки» (например «Семейная атмосфера»)', t: 'select', opts: fopt(HANDS) },
      { k: 'headW', l: 'Жирность заголовков', t: 'select', opts: [['600', 'Средняя'], ['700', 'Полужирная'], ['750', 'Как было'], ['800', 'Жирная']] },
      { k: 'fs', l: 'Размер основного текста', t: 'select', opts: [['15', 'Мелкий'], ['16', 'Чуть меньше'], ['17', 'Как было'], ['18', 'Чуть крупнее'], ['19', 'Крупный']] },
      { k: 'hs', l: 'Размер заголовков', t: 'select', opts: [['0.86', 'Меньше'], ['0.93', 'Чуть меньше'], ['1', 'Как было'], ['1.08', 'Чуть больше'], ['1.16', 'Больше']] }], D, ch));
    left.append(fields(h('div', { class: 'card' }), [{ h: 'Форма и отступы' },
      { k: 'radius', l: 'Углы карточек и фото', t: 'select', opts: [['0', 'Прямые'], ['8', 'Чуть скруглённые'], ['14', 'Мягкие'], ['20', 'Как было'], ['28', 'Очень круглые']] },
      { k: 'pill', l: 'Кнопки и метки', t: 'select', opts: [['pill', 'Капсулой, как было'], ['round', 'Скруглённые'], ['square', 'Почти прямые']] },
      { k: 'shadow', l: 'Тени', t: 'select', opts: [['none', 'Без теней'], ['soft', 'Мягкие, как было'], ['strong', 'Заметные']] },
      { k: 'wrap', l: 'Ширина сайта на большом экране', t: 'select', opts: [['1080', 'Узкая'], ['1200', 'Как было'], ['1320', 'Шире'], ['1440', 'Широкая']] },
      { k: 'secY', l: 'Расстояние между секциями', t: 'select', opts: [['compact', 'Компактно'], ['normal', 'Как было'], ['airy', 'Просторно']] },
      { k: 'anim', l: 'Плавное появление блоков при прокрутке', t: 'bool' }], D, ch));
    const css = fields(h('div', { class: 'card' }), [{ h: 'Свой CSS (для опытных)' }, { k: 'css', l: 'Правила дополняют стили всего сайта. Например: .h1{letter-spacing:0}', t: 'textarea', rows: 7 }], D, ch);
    $('textarea', css).style.fontFamily = 'ui-monospace,Consolas,monospace';
    left.append(css, h('button', { class: 'b', type: 'button', onclick: async () => { if (!await ask('Вернуть исходный дизайн?', 'Цвета, шрифты, углы и отступы станут как были. Свой CSS тоже очистится.', 'Вернуть')) return; Object.assign(D, DESIGN_DEFAULT); applyDesign(); dataChanged(true); renderView(); } }, 'Вернуть исходный дизайн'));
    right.append(h('div', { class: 'row', style: 'margin-bottom:10px' }, pg, dev), fr);
    box.closest('.panel-in').classList.add('wide');
    box.append(h('div', { class: 'dz' }, left, right));
    load();
  },
  pages(box) {
    panelHead(box, 'Страницы и меню', 'Новые страницы, названия, пункты меню. Содержимое страниц правится в «Редактировать страницы»: там же кнопка «Добавить блок». Порядок пунктов меню меняется на странице «Шапка, меню и подвал» кнопками «Выше» и «Ниже».');
    const R = S.data.nav.routes = S.data.nav.routes || {};
    const list = h('div', { class: 'hist' });
    pagesList(false).forEach(([k]) => {
      const pgEl = S.doc.querySelector('.page[data-page="' + k + '"]'), custom = !BASE_PAGES[k], hidden = pgEl.hasAttribute('data-hide');
      const name = h('input', { class: 'in', value: R[k] || BASE_PAGES[k] || k });
      name.addEventListener('change', () => { const v = name.value.trim(); if (!v) return; R[k] = v; ['top', 'mob', 'foot'].forEach(w => { const a = menuLink(k, w); if (a) a.textContent = v; }); commit('Название страницы'); toast('Название изменено, в меню тоже'); });
      const cb = (w, label) => { const c = h('input', { type: 'checkbox', checked: !!menuLink(k, w) }); c.addEventListener('change', () => { setMenu(k, w, c.checked, name.value.trim()); commit('Меню'); }); return h('label', { class: 'chk' }, c, label); };
      list.append(h('div', { class: 'it', style: 'flex-wrap:wrap;align-items:flex-start' },
        h('div', { style: 'flex:1;min-width:240px' }, name, h('small', null, 'Адрес: #/' + k + (hidden ? ' · скрыта с сайта' : '') + (custom ? ' · своя страница' : ''))),
        k === 'home' ? h('div', { class: 'muted', style: 'padding-top:10px;font-size:13px' }, 'Главная всегда в меню через логотип') : h('div', { style: 'display:grid;gap:2px' }, cb('top', 'В верхнем меню'), cb('mob', 'В мобильном меню'), cb('foot', 'В подвале')),
        h('div', { class: 'acts', style: 'margin:0' },
          h('button', { class: 'b sm', type: 'button', html: ic('edit') + 'Открыть', onclick: () => { S.page = k; S.view = 'page'; S.mode = 'edit'; renderView(); } }),
          k !== 'home' ? h('button', { class: 'b sm', type: 'button', html: ic(hidden ? 'eye' : 'hide') + (hidden ? 'Показать' : 'Скрыть'), onclick: () => { pgEl.toggleAttribute('data-hide'); const hd = pgEl.hasAttribute('data-hide'); ['top', 'mob', 'foot'].forEach(w => { const a = menuLink(k, w); if (a) (w === 'top' ? a : a.closest('li')).toggleAttribute('data-hide', hd); }); commit('Видимость страницы'); renderView(); toast(hd ? 'Страница скрыта с сайта и из меню' : 'Страница снова на сайте'); } }) : null,
          custom ? h('button', { class: 'b sm d', type: 'button', html: ic('del') + 'Удалить', onclick: async () => { if (!await ask('Удалить страницу?', '«' + name.value + '» и все её блоки исчезнут. Если передумаете, нажмите «Отменить» сверху.', 'Удалить', true)) return; pgEl.remove(); ['top', 'mob', 'foot'].forEach(w => setMenu(k, w, false)); delete R[k]; commit('Удаление страницы'); renderView(); } }) : null)));
    });
    box.append(list);
    const t = h('input', { class: 'in', placeholder: 'Например: Летний лагерь' });
    const tpl = h('select', { class: 'in' }, [['text', 'Заголовок и текст'], ['img', 'Текст и картинка'], ['empty', 'Только заголовок']].map(([v, n]) => h('option', { value: v }, n)));
    const m1 = h('input', { type: 'checkbox', checked: true }), m2 = h('input', { type: 'checkbox', checked: true }), m3 = h('input', { type: 'checkbox' });
    box.append(h('div', { class: 'card', style: 'margin-top:18px' }, h('h4', { class: 'f-h' }, 'Новая страница'),
      h('label', { class: 'fld' }, h('span', { class: 'fld-l' }, 'Название'), t),
      h('label', { class: 'fld' }, h('span', { class: 'fld-l' }, 'С чего начать'), tpl),
      h('div', { class: 'row', style: 'flex-wrap:wrap;gap:14px;margin-bottom:14px' }, h('label', { class: 'chk' }, m1, 'В верхнее меню'), h('label', { class: 'chk' }, m2, 'В мобильное меню'), h('label', { class: 'chk' }, m3, 'В подвал')),
      h('button', { class: 'b p', type: 'button', html: ic('plus') + 'Создать страницу', onclick: () => {
        const title = t.value.trim(); if (!title) return toast('Напишите название страницы', true);
        const slug = createPage(title, tpl.value, { top: m1.checked, mob: m2.checked, foot: m3.checked });
        S.page = slug; S.view = 'page'; S.mode = 'edit'; renderView(); toast('Страница создана. Добавляйте блоки и меняйте текст.');
      } }),
      h('p', { class: 'fld-h' }, 'В верхнем меню помещается около восьми пунктов. Если пунктов много, часть лучше оставить только в мобильном меню и подвале.')));
  },
  news(box) {
    panelHead(box, 'Новости', 'Новости появляются на странице «Жизнь центра» и в блоке «Новости» на главной (последние три). У каждой новости своя страница с текстом, фото и видео.');
    const N = S.data.news = S.data.news || [];
    const order = () => N.map((n, i) => i).sort((a, b) => (N[b].pin ? 1 : 0) - (N[a].pin ? 1 : 0) || String(N[b].date || '').localeCompare(String(N[a].date || '')));
    let cur = order()[0] ?? -1;
    const list = h('div', { class: 'md-list' }), form = h('div');
    const fmt = d => { const [y, m, dd] = String(d || '').split('-'); return y ? (dd ? dd + '.' : '') + (m || '') + '.' + y : 'без даты'; };
    const drawList = () => {
      list.innerHTML = '';
      list.append(h('button', { type: 'button', class: 'b sm p', style: 'width:100%;margin-bottom:6px', html: ic('plus') + 'Новая новость', onclick: () => {
        const today = new Date().toISOString().slice(0, 10);
        N.push({ id: 'novost-' + Date.now().toString(36).slice(-5), t: 'Новая новость', date: today, pin: false, hidden: true, cover: '', lead: '', body: '', video: '', videoCap: '', gallery: [] });
        cur = N.length - 1; dataChanged(true); drawList(); drawForm(); toast('Новость создана скрытой. Заполните и снимите галочку «Скрыть».');
      } }));
      if (!N.length) list.append(h('p', { class: 'muted', style: 'padding:8px' }, 'Пока нет новостей.'));
      order().forEach(i => { const n = N[i]; list.append(h('button', { type: 'button', class: 'it' + (i === cur ? ' on' : '') + (n.hidden ? ' off' : ''), onclick: () => { cur = i; drawList(); drawForm(); } }, h('span', { style: 'display:block' }, (n.pin ? '📌 ' : '') + (n.t || 'Без заголовка')), h('small', { class: 'muted', style: 'font-weight:600' }, fmt(n.date) + (n.hidden ? ' · скрыта' : '')))); });
      if (cur >= 0) list.append(h('div', { class: 'tools' },
        h('button', { class: 'ib', type: 'button', title: 'Копия', html: ic('copy'), onclick: () => { const c = clone(N[cur]); c.id += '-2'; c.t += ' (копия)'; c.hidden = true; N.push(c); cur = N.length - 1; dataChanged(true); drawList(); drawForm(); } }),
        h('button', { class: 'ib', type: 'button', title: 'Удалить', html: ic('del'), onclick: async () => { if (await ask('Удалить новость?', '«' + N[cur].t + '» исчезнет с сайта. Можно вместо этого поставить «Скрыть».', 'Удалить', true)) { N.splice(cur, 1); cur = order()[0] ?? -1; dataChanged(true); drawList(); drawForm(); } } })));
    };
    const drawForm = () => {
      form.innerHTML = ''; const n = N[cur]; if (!n) return;
      const prev = h('button', { class: 'b sm', type: 'button', html: ic('eye') + 'Посмотреть на сайте', onclick: () => { S.previewHash = '#/news/' + n.id; S.view = 'page'; S.mode = 'preview'; renderView(); } });
      form.append(fields(h('div', { class: 'card' }), F_NEWS.map(f => f.k === 'date' ? Object.assign({}, f, { after: drawList }) : f), n, f => { dataChanged(f); if (f) drawList(); }), prev,
        n.hidden ? h('p', { class: 'fld-h' }, 'Скрытая новость в просмотре не откроется: сначала снимите галочку «Скрыть».') : null);
    };
    box.append(h('div', { class: 'md' }, list, form));
    drawList(); drawForm();
  },
  programs(box) {
    panelHead(box, 'Программы', 'Карточки на странице «Программы», страницы программ, список на странице «АДК» и подбор программы собираются отсюда. Изменения видны в режиме «Просмотр».');
    const P = S.data.programs = S.data.programs || [];
    let cur = 0;
    const list = h('div', { class: 'md-list' }), form = h('div');
    const drawList = () => {
      list.innerHTML = '';
      P.forEach((p, i) => list.append(h('button', { type: 'button', class: 'it' + (i === cur ? ' on' : '') + (p.hidden ? ' off' : ''), onclick: () => { cur = i; drawList(); drawForm(); } }, (p.hidden ? '🙈 ' : '') + (p.t || 'Без названия'))));
      list.append(h('div', { class: 'tools' },
        h('button', { class: 'ib', type: 'button', title: 'Выше', html: ic('up'), onclick: () => { if (cur > 0) { [P[cur - 1], P[cur]] = [P[cur], P[cur - 1]]; cur--; dataChanged(true); drawList(); } } }),
        h('button', { class: 'ib', type: 'button', title: 'Ниже', html: ic('down'), onclick: () => { if (cur < P.length - 1) { [P[cur + 1], P[cur]] = [P[cur], P[cur + 1]]; cur++; dataChanged(true); drawList(); } } }),
        h('button', { class: 'ib', type: 'button', title: 'Копия', html: ic('copy'), onclick: () => { const c = clone(P[cur]); c.id = (c.id || 'prog') + '-2'; c.t += ' (копия)'; P.splice(cur + 1, 0, c); cur++; dataChanged(true); drawList(); drawForm(); } }),
        h('button', { class: 'ib', type: 'button', title: 'Новая программа', html: ic('plus'), onclick: () => { P.push({ id: 'new-' + Math.random().toString(36).slice(2, 5), t: 'Новая программа', hidden: true, card: { chip: '', desc: '', meta: '', icon: 'i-cal', price: '', priceNote: 'за занятие' }, chips: [], lead: '', facts: [], sec: [], tch: [], poster: '', doc: '', tags: [], quiz: { min: 3, max: 10, fmt: 'short' } }); cur = P.length - 1; dataChanged(true); drawList(); drawForm(); toast('Программа добавлена скрытой. Заполните и снимите галочку «Скрыть».'); } }),
        h('button', { class: 'ib', type: 'button', title: 'Удалить', html: ic('del'), onclick: async () => { if (P[cur] && await ask('Удалить программу?', '«' + P[cur].t + '» исчезнет с сайта. Можно вместо этого поставить «Скрыть».', 'Удалить', true)) { P.splice(cur, 1); cur = Math.max(0, cur - 1); dataChanged(true); drawList(); drawForm(); } } })));
    };
    const drawForm = () => { form.innerHTML = ''; const p = P[cur]; if (!p) return; form.append(fields(h('div', { class: 'card' }), F_PROGRAM, p, f => { dataChanged(f); if (f) drawList(); })); };
    box.append(h('div', { class: 'md' }, list, form));
    box.append(h('h3', { style: 'margin:26px 0 8px' }, 'Кнопки фильтров на странице «Программы»'),
      fields(h('div', { class: 'card' }), [{ k: 'filters', l: 'Код и надпись. Первый «all» показывает все программы, его оставьте.', t: 'pairs', a: 'код', b: 'Надпись' }], S.data));
    drawList(); drawForm();
  },
  calc(box) {
    panelHead(box, 'Калькулятор цен', 'Блок «Сколько выйдет в месяц» на странице «Стоимость». Сумма = цена × раз в неделю × недель + присмотр.');
    const C = S.data.calc = S.data.calc || {};
    box.append(fields(h('div', { class: 'card' }), [
      { k: 'options', l: 'Занятия', t: 'objlist', title: o => (o.label || o.n || 'Занятие') + ': ' + (o.p || 0) + ' ₽', addLabel: 'Добавить занятие', make: () => ({ label: 'Новое занятие', n: 'Новое занятие', p: 1000 }), fields: [
        { k: 'label', l: 'Надпись на кнопке', t: 'text' }, { k: 'n', l: 'Название в расчёте', t: 'text' }, { k: 'p', l: 'Цена одного занятия, ₽', t: 'number' }, { k: 'weekend', l: 'Это занятие в выходной (другие варианты частоты и цена присмотра)', t: 'bool' }] },
      { k: 'times', l: 'Варианты «раз в неделю» для будних занятий', t: 'numbers' },
      { k: 'weekendTimes', l: 'Варианты «занятий в выходные за неделю»', t: 'numbers' },
      { k: 'care', l: 'Варианты часов присмотра в неделю (0 значит «не нужен»)', t: 'numbers' },
      { k: 'careWeekday', l: 'Присмотр в будни, ₽ в час', t: 'number' },
      { k: 'careWeekend', l: 'Продлёнка в выходные, ₽ в час', t: 'number' },
      { k: 'weeks', l: 'Сколько недель считать в месяце', t: 'number' },
      { k: 'note', l: 'Подпись под суммой', t: 'textarea', rows: 2 }], C));
  },
  quiz(box) {
    panelHead(box, 'Подбор программы', 'Окно «Подобрать программу» на главной. Какая программа подходит под ответы, задаётся в разделе «Программы» (возраст и формат) и фильтрами. Значения ответов лучше не менять: по ним идёт подбор.');
    S.data.quiz = S.data.quiz || [];
    box.append(fields(h('div', { class: 'card' }), [{ k: 'quiz', l: 'Вопросы', t: 'objlist', title: q => q.q || 'Вопрос', make: () => ({ q: 'Новый вопрос', k: 'x', o: [] }), fields: [
      { k: 'q', l: 'Вопрос', t: 'text' },
      { k: 'o', l: 'Ответы', t: 'objlist', title: o => o[0] || 'Ответ', make: () => ['Ответ', '', 'i-info', ''], fields: [{ k: '0', l: 'Ответ', t: 'text' }, { k: '3', l: 'Пояснение мелким шрифтом', t: 'text' }, { k: '2', l: 'Значок', t: 'icon', set: 'i' }, { k: '1', l: 'Значение для подбора', t: 'text' }] }] }], S.data));
  },
  tiles(box) {
    panelHead(box, 'Коммуникатор', 'Плитки «Попробуйте сами» на странице «АДК». Для каждого слова можно загрузить свою запись голоса (mp3). Если записи нет, слово прочитает голос браузера.');
    S.data.tiles = S.data.tiles || [];
    box.append(fields(h('div', { class: 'card' }), [{ k: 'tiles', l: 'Плитки', t: 'objlist', title: t => t.w || 'Слово', addLabel: 'Добавить плитку', make: () => ({ w: 'слово', i: 't-ya', k: 'k2', a: '' }), fields: [
      { k: 'w', l: 'Слово', t: 'text' }, { k: 'i', l: 'Картинка', t: 'icon', set: 't' },
      { k: 'k', l: 'Цвет', t: 'select', opts: [['k1', 'Жёлтый: люди'], ['k2', 'Зелёный: действия'], ['k3', 'Розовый: просьбы'], ['k4', 'Оранжевый: стоп'], ['k5', 'Бежевый: предметы']] },
      { k: 'a', l: 'Звук (mp3)', t: 'audio' }] },
      { k: 'doneSound', l: 'Звук «Молодец!» в визуальном расписании', t: 'audio' }], S.data));
  },
  nav(box) {
    panelHead(box, 'Навигация и поиск', 'Названия разделов (в полосе «← назад» и во вкладке браузера), вкладки внутри разделов, ссылки «Дальше» внизу страниц и быстрые ответы в поиске. Пункты верхнего меню и подвала правятся на странице «Шапка, меню и подвал».');
    const N = S.data.nav = S.data.nav || { routes: {}, groups: {}, next: {} };
    const rt = h('div', { class: 'card' }, h('h4', { class: 'f-h' }, 'Названия разделов'));
    Object.keys(N.routes).forEach(k => rt.append(field({ k, l: BASE_PAGES[k] || k, t: 'text' }, N.routes)));
    box.append(rt);
    const gr = h('div', { class: 'card' }, h('h4', { class: 'f-h' }, 'Вкладки внутри разделов'));
    Object.keys(N.groups).forEach(g => gr.append(field({ k: g, l: 'Раздел «' + (N.routes[g] || g) + '»: код страницы и надпись вкладки', t: 'pairs', a: 'код', b: 'Надпись' }, N.groups)));
    box.append(gr);
    const nx = h('div', { class: 'card' }, h('h4', { class: 'f-h' }, 'Ссылки «Дальше» внизу страниц'));
    Object.keys(N.next).forEach(pg => nx.append(field({ k: pg, l: 'Страница «' + (N.routes[pg] || (pg === 'program' ? 'Программа' : pg)) + '»', t: 'objlist', title: x => x[1] || 'Ссылка', make: () => ['contacts', 'Контакты', 'Приходите знакомиться'], fields: [{ k: '1', l: 'Заголовок', t: 'text' }, { k: '2', l: 'Подпись', t: 'text' }, { k: '0', l: 'Куда ведёт (код страницы, например contacts или programs/rech)', t: 'text' }] }, N.next)));
    box.append(nx);
    box.append(fields(h('div', { class: 'card' }), [{ k: 'quick', l: 'Быстрые ответы в поиске по сайту', t: 'objlist', title: q => q[1] || 'Ответ', make: () => ['слова для поиска', 'Что показать', '#/contacts'], fields: [{ k: '1', l: 'Что показать', t: 'text' }, { k: '0', l: 'Слова, по которым найти (через пробел)', t: 'text' }, { k: '2', l: 'Куда ведёт (например #/prices)', t: 'text' }] }], S.data));
  },
  docsets(box) {
    panelHead(box, 'Документы на страницах', 'Какие документы из «Сведения → Документы» показывать на страницах «Стоимость» и «Родителям». Сами документы, их названия и файлы правятся на странице «Сведения об организации».');
    const D = S.data.docsets = S.data.docsets || {};
    box.append(fields(h('div', { class: 'card' }), [{ k: 'paid', l: 'На странице «Стоимость» (порядок оплаты и договор)', t: 'multi', opts: docOpts }, { k: 'forms', l: 'На странице «Родителям» (бланки для записи)', t: 'multi', opts: docOpts }], D));
    box.append(fields(h('div', { class: 'card' }), [{ h: 'Документы педагогов на странице «Педагоги»' }, { k: 'asOf', l: 'Подпись к стажу', t: 'text' }, { k: 'skip', l: 'Не показывать строки курсов, где встречаются слова', t: 'strings' }], S.data.team = S.data.team || {}));
  },
  settings(box) {
    panelHead(box, 'Контакты, логотип, объявление', 'Общие настройки сайта. Цвета, шрифты и форма блоков в разделе «Дизайн сайта».');
    const st = S.data.settings = S.data.settings || {};
    // контакты с заменой по всему сайту
    const c = h('div', { class: 'card' }, h('h4', { class: 'f-h' }, 'Контакты'), h('p', { class: 'fld-h', style: 'margin-top:-6px' }, 'Новое значение заменит старое везде на сайте: в тексте, ссылках и сведениях.'));
    const gl = (label, key, help, fix) => {
      const i = h('input', { class: 'in', value: st[key] || '' });
      const b = h('button', { class: 'b sm p', type: 'button', onclick: async () => {
        const nv = fix ? fix(i.value) : i.value.trim(), ov = st[key] || '';
        if (!nv || nv === ov) return;
        const n = replaceEverywhere(ov, nv);
        if (key === 'phone') replaceEverywhere('tel:' + ov, 'tel:' + nv);
        st[key] = nv; commit('Контакты'); toast('Заменено: ' + n);
      } }, 'Заменить везде');
      c.append(h('div', { class: 'fld' }, h('span', { class: 'fld-l' }, label), h('div', { class: 'row' }, i, b), help ? h('span', { class: 'fld-h' }, help) : null));
    };
    gl('Телефон, как он написан на сайте', 'phoneText', 'Например: +7 950 130-22-74. В «Сведениях» номер записан со скобками, +7 (950) 130-22-74: его замените через «Найти и заменить» ниже.');
    gl('Телефон для звонка (только цифры с +7)', 'phone', 'Например: +79501302274. Меняет все кнопки «Позвонить».', v => v.replace(/[^\d+]/g, ''));
    gl('Почта', 'email');
    box.append(c);
    // найти и заменить
    const fi = h('input', { class: 'in', placeholder: 'Что найти' }), ri = h('input', { class: 'in', placeholder: 'На что заменить' });
    const cnt = h('span', { class: 'fld-h' });
    fi.addEventListener('input', () => { cnt.textContent = fi.value ? 'Найдено на сайте: ' + countEverywhere(fi.value) : ''; });
    box.append(h('div', { class: 'card' }, h('h4', { class: 'f-h' }, 'Найти и заменить по всему сайту'), h('div', { class: 'row' }, fi, ri, h('button', { class: 'b sm p', type: 'button', onclick: async () => { if (!fi.value) return; const n = countEverywhere(fi.value); if (!n) return toast('Не найдено'); if (!await ask('Заменить?', 'Заменить «' + fi.value + '» на «' + ri.value + '» в ' + n + ' местах?', 'Заменить')) return; replaceEverywhere(fi.value, ri.value); commit('Замена'); toast('Заменено: ' + n); fi.dispatchEvent(new Event('input')); } }, 'Заменить')), cnt));
    // заголовки и описание
    const meta = (sel, attr) => { const e = $(sel, S.doc.head); return e ? (attr ? e.getAttribute(attr) : e.textContent) : ''; };
    const seo = { title: S.doc.title, desc: meta('meta[name="description"]', 'content'), ogt: meta('meta[property="og:title"]', 'content'), ogd: meta('meta[property="og:description"]', 'content'), home: st.homeTitle || '', suf: st.titleSuffix || '' };
    box.append(fields(h('div', { class: 'card' }), [{ h: 'Для поисковиков и мессенджеров' },
      { k: 'title', l: 'Заголовок сайта (вкладка браузера, поиск)', t: 'text' }, { k: 'desc', l: 'Описание для поисковиков', t: 'textarea', rows: 2 },
      { k: 'ogt', l: 'Заголовок, когда ссылку присылают в мессенджер', t: 'text' }, { k: 'ogd', l: 'Описание для мессенджеров', t: 'textarea', rows: 2 },
      { k: 'suf', l: 'Хвост заголовка внутренних страниц', t: 'text', help: 'Например « · Бурый мишка»: «Стоимость · Бурый мишка».' }], seo, f => {
      S.doc.title = seo.title; st.homeTitle = seo.title; st.titleSuffix = seo.suf;
      const setM = (sel, v) => { const e = $(sel, S.doc.head); if (e) e.setAttribute('content', v); };
      setM('meta[name="description"]', seo.desc); setM('meta[property="og:title"]', seo.ogt); setM('meta[property="og:description"]', seo.ogd);
      dataChanged(f);
    }));
    box.append(fields(h('div', { class: 'card' }), [{ h: 'Карта' }, { k: 'mapQuery', l: 'Адрес для Яндекс Карты на странице «Контакты»', t: 'text' }], st));
    // логотип
    const logos = () => $$('img', S.doc.body).filter(i => /(^|\/)img\/logo[^/]*$/.test(i.getAttribute('src') || '') || i.classList.contains('keep'));
    const lp = (logos()[0] || {}).getAttribute ? logos()[0].getAttribute('src') : 'img/logo.webp';
    const lth = h('div', { class: 'th', style: 'background-image:url("' + urlOf(lp) + '");background-size:contain' });
    const fav = $('link[rel="icon"]', S.doc.head);
    const fth = h('div', { class: 'th', style: 'width:48px;height:48px;background-size:contain;background-image:url("' + urlOf(fav ? fav.getAttribute('href') : 'img/favicon.png') + '")' });
    box.append(h('div', { class: 'card' }, h('h4', { class: 'f-h' }, 'Логотип'),
      h('div', { class: 'pick-img' }, lth, h('div', null, h('p', { class: 'fld-h', style: 'margin-top:0' }, 'Заменяется в шапке, меню и подвале. Лучше PNG с прозрачным фоном.'),
        h('button', { class: 'b sm p', type: 'button', onclick: () => uploadImage(p => { logos().forEach(i => i.setAttribute('src', p)); lth.style.backgroundImage = 'url("' + urlOf(p) + '")'; commit('Логотип'); toast('Логотип заменён'); }, { maxW: 600, quality: .92 }) }, 'Загрузить новый логотип'))),
      h('div', { class: 'pick-img', style: 'margin-top:14px' }, fth, h('div', null, h('p', { class: 'fld-h', style: 'margin-top:0' }, 'Значок во вкладке браузера (квадратная картинка).'),
        h('button', { class: 'b sm', type: 'button', onclick: () => uploadImage(p => { $$('link[rel="icon"],link[rel="apple-touch-icon"]', S.doc.head).forEach(l => l.setAttribute('href', p)); fth.style.backgroundImage = 'url("' + urlOf(p) + '")'; commit('Значок'); toast('Значок заменён'); }, { maxW: 192, square: 1 }) }, 'Загрузить значок')))));
    // объявление над шапкой
    const an = S.doc.getElementById('annc');
    if (an) {
      const sp = $('span', an), lk = $('a', an);
      const A = { on: !an.hasAttribute('data-hide'), text: sp ? sp.textContent : '', link: lk ? lk.textContent : '', href: lk ? lk.getAttribute('href') : '' };
      box.append(fields(h('div', { class: 'card' }), [{ h: 'Объявление над шапкой сайта' },
        { k: 'on', l: 'Показывать объявление на всех страницах', t: 'bool' },
        { k: 'text', l: 'Текст объявления', t: 'textarea', rows: 2 },
        { k: 'link', l: 'Текст ссылки (можно оставить пустым)', t: 'text' },
        { k: 'href', l: 'Куда ведёт ссылка (например tel:+79501302274 или #/news/адрес)', t: 'text' }], A, f => {
        an.toggleAttribute('data-hide', !A.on); if (sp) sp.textContent = A.text;
        if (lk) { lk.textContent = A.link; lk.setAttribute('href', A.href || '#/'); lk.toggleAttribute('hidden', !A.link.trim()); }
        dataChanged(f);
      }), h('p', { class: 'fld-h' }, 'Цвет объявления меняется в разделе «Дизайн сайта» вместе с основным цветом.'));
    }
    // подтверждение для Яндекс Вебмастера и Google
    const vm = name => { const e = $('meta[name="' + name + '"]', S.doc.head); return e ? e.getAttribute('content') : ''; };
    const V = { ya: vm('yandex-verification'), go: vm('google-site-verification') };
    box.append(fields(h('div', { class: 'card' }), [{ h: 'Подтверждение сайта в поисковиках' },
      { k: 'ya', l: 'Код Яндекс Вебмастера (только значение content)', t: 'text' }, { k: 'go', l: 'Код Google Search Console', t: 'text' }], V, f => {
      [['yandex-verification', V.ya], ['google-site-verification', V.go]].forEach(([n, v]) => {
        let e = $('meta[name="' + n + '"]', S.doc.head);
        if (!v.trim()) { if (e) e.remove(); return; }
        if (!e) { e = S.doc.createElement('meta'); e.setAttribute('name', n); S.doc.head.prepend(e); }
        e.setAttribute('content', v.trim().replace(/^.*content="([^"]+)".*$/, '$1'));
      });
      dataChanged(f);
    }));
  },
  async files(box) {
    panelHead(box, 'Картинки и файлы', 'Всё, что загружено на сайт. Новые файлы попадут на сайт при публикации, если они где-то используются.');
    const tabs = h('div', { class: 'tabs2' }), out = h('div');
    const show = async dir => {
      $$('button', tabs).forEach(b => b.classList.toggle('on', b.dataset.d === dir));
      out.innerHTML = '<p class="muted">Загружаем…</p>';
      const list = await listDir(dir);
      out.innerHTML = '';
      out.append(h('div', { class: 'acts', style: 'margin:0 0 12px' }, h('button', { class: 'b sm p', type: 'button', onclick: () => (dir === 'img' ? uploadImage : (c => uploadFile(dir, c)))(() => { show(dir); toast('Загружено. Теперь его можно выбрать в любом месте сайта.'); }) }, 'Загрузить')));
      if (dir === 'img') out.append(h('div', { class: 'lib' }, list.map(x => h('a', { href: urlOf(x.path), target: '_blank', rel: 'noopener', style: 'display:block;border:1px solid var(--line);border-radius:12px;overflow:hidden;text-decoration:none;color:inherit' }, h('div', { class: 'th', style: 'aspect-ratio:1;background:var(--tint2) center/contain no-repeat url("' + urlOf(x.path) + '")' }), h('span', { class: 'nm', style: 'display:block;padding:6px 8px;font-size:12px' }, (x.pending ? '● ' : '') + x.name)))));
      else out.append(h('div', { class: 'flist' }, list.map(x => h('a', { href: urlOf(x.path), target: '_blank', rel: 'noopener', style: 'display:flex;gap:10px;padding:10px 12px;border:1px solid var(--line);border-radius:12px;text-decoration:none;color:inherit' }, x.name, h('span', { class: 'x', style: 'margin-left:auto;color:var(--mut)' }, x.pending ? 'не опубликован' : humanSize(x.size || 0))))));
    };
    [['img', 'Картинки'], ['video', 'Видео'], ['docs', 'Документы'], ['assets/audio', 'Звуки']].forEach(([d, n]) => tabs.append(h('button', { type: 'button', 'data-d': d, onclick: () => show(d) }, n)));
    box.append(tabs, out); show('img');
  },
  async history(box) {
    panelHead(box, 'История версий', 'Каждая публикация сохраняется. Любую прошлую версию можно посмотреть и вернуть.');
    const out = h('div', { class: 'hist' }, h('p', { class: 'muted' }, 'Загружаем…')); box.append(out);
    try {
      const list = await S.gh.commits('index.html');
      out.innerHTML = '';
      list.forEach((c, i) => out.append(h('div', { class: 'it' }, h('div', null, h('b', null, (c.commit.message || '').split('\n')[0]), h('small', null, fmtDate(c.commit.author.date) + (i === 0 ? ' · сейчас на сайте' : ''))), h('span', { class: 'sp' }),
        h('button', { class: 'b sm', type: 'button', onclick: () => viewVersion(c.sha) }, 'Посмотреть'),
        i ? h('button', { class: 'b sm', type: 'button', onclick: () => restoreVersion(c.sha, c.commit.author.date) }, 'Вернуть эту версию') : null)));
    } catch (e) { out.innerHTML = ''; out.append(h('div', { class: 'err' }, e.message)); }
    box.append(h('div', { class: 'card', style: 'margin-top:16px' }, h('h4', { class: 'f-h' }, 'Резервная копия'), h('p', { class: 'fld-h' }, 'Скачать текущую версию страницы со всеми правками (файл index.html).'),
      h('button', { class: 'b sm', type: 'button', html: ic('dl') + 'Скачать index.html', onclick: () => { const a = h('a', { href: URL.createObjectURL(new Blob([finalHTML()], { type: 'text/html' })), download: 'index.html' }); a.click(); } })));
  },
  help(box) {
    panelHead(box, 'Как пользоваться админкой');
    box.append(h('div', { class: 'card', html: `
      <h4 class="f-h">Тексты и картинки</h4>
      <p>Откройте <b>«Редактировать страницы»</b>, выберите страницу в списке сверху. Нажмите на любой текст и печатайте. Нажмите на картинку, справа появится кнопка <b>«Заменить с компьютера»</b>: фото само уменьшится и сожмётся.</p>
      <h4 class="f-h">Добавить или убрать</h4>
      <p>Выберите карточку, пункт списка, строку таблицы, вопрос или документ. Справа: <b>«Копия»</b> добавит такой же ниже (потом поправьте текст), <b>«Выше/Ниже»</b> переставят, <b>«Скрыть с сайта»</b> уберёт с сайта, но оставит в админке (бледным с пунктиром), <b>«Удалить»</b> удалит совсем. Над кнопками есть цепочка «Секция › Сетка › Карточка»: так выбирается блок побольше, например целая секция.</p>
      <h4 class="f-h">Новые блоки</h4>
      <p>Кнопка <b>«Добавить блок в конец страницы»</b> над страницей или <b>«Добавить ниже»</b> у выбранного блока. Готовые секции: заголовок и текст, текст и картинка, карточки, фотогалерея, видео, отзыв, призыв позвонить, вопросы, документы, цифры, шаги, новости, таблица. Отдельные элементы: абзац, заголовок, список, картинка, кнопка, видео.</p>
      <h4 class="f-h">Оформление</h4>
      <p>Весь сайт: раздел <b>«Дизайн сайта»</b> (готовые сочетания цветов, свои цвета, шрифты, углы, тени, ширина, отступы, свой CSS). Отдельный блок: выберите его, справа <b>«Оформление»</b> (фон, цвет текста, размер, выравнивание, колонки, порядок колонок, пропорции фото, где показывать). Слова внутри текста: выделите и нажмите «жирный», «курсив», цвет или «маркер».</p>
      <h4 class="f-h">Страницы, новости, видео</h4>
      <p><b>«Страницы и меню»</b>: новые страницы, названия, пункты меню, скрыть или удалить страницу. <b>«Новости»</b>: заголовок, дата, обложка, текст с заголовками и картинками, видео, фото. Видео: ссылка на ролик во ВКонтакте, Rutube или YouTube, либо файл до 45 МБ.</p>
      <h4 class="f-h">Ссылки и кнопки</h4>
      <p>Нажмите на текст ссылки. Справа выберите, куда она ведёт: страница сайта, телефон, почта, файл или другой сайт.</p>
      <h4 class="f-h">Документы</h4>
      <p>«Сведения об организации» → «Документы»: выберите документ, справа «Загрузить новый файл». Новый документ: «Копия» похожего и загрузите в неё файл. Программы на год можно приложить в разделе «Программы» (поле «Документ программы») и в таблице «Образование» (ссылка в столбце «Документ»).</p>
      <h4 class="f-h">Программы, калькулятор, коммуникатор</h4>
      <p>Это отдельные разделы слева: там формы с полями. Как это выглядит, смотрите в режиме <b>«Просмотр»</b>.</p>
      <h4 class="f-h">Публикация</h4>
      <p>Пока вы не нажали <b>«Опубликовать»</b>, посетители видят старую версию. Правки сохраняются в браузере как черновик. После публикации сайт обновляется за 1–2 минуты. Если что-то пошло не так, <b>«История версий»</b> вернёт любую прошлую версию.</p>
      <h4 class="f-h">Отмена</h4>
      <p><span class="kbd">Ctrl+Z</span> или стрелка «Отменить» в верхней панели.</p>` }));
  }
};
// замена текста по всему документу (тело, заголовки, данные)
function walkText(fn) {
  const tw = S.doc.createTreeWalker(S.doc.body, NodeFilter.SHOW_TEXT);
  let n; while ((n = tw.nextNode())) { if (n.parentElement && n.parentElement.id === 'bm-data') continue; fn(n); }
}
function countEverywhere(q) {
  if (!q) return 0; let n = 0;
  walkText(t => { n += t.nodeValue.split(q).length - 1; });
  $$('*', S.doc.body).forEach(e => [...e.attributes].forEach(a => { if (a.name !== 'class' && a.name !== 'style') n += a.value.split(q).length - 1; }));
  n += JSON.stringify(S.data).split(JSON.stringify(q).slice(1, -1)).length - 1;
  return n;
}
function replaceEverywhere(q, r) {
  if (!q) return 0; let n = 0;
  walkText(t => { const c = t.nodeValue.split(q).length - 1; if (c) { n += c; t.nodeValue = t.nodeValue.split(q).join(r); } });
  $$('*', S.doc.body).forEach(e => [...e.attributes].forEach(a => { if (a.name === 'class' || a.name === 'style') return; const c = a.value.split(q).length - 1; if (c) { n += c; e.setAttribute(a.name, a.value.split(q).join(r)); } }));
  const js = JSON.stringify(S.data), qq = JSON.stringify(q).slice(1, -1), rr = JSON.stringify(r).slice(1, -1);
  const c = js.split(qq).length - 1; if (c) { n += c; S.data = JSON.parse(js.split(qq).join(rr)); }
  $$('meta[content]', S.doc.head).forEach(m => { const v = m.getAttribute('content'); if (v.includes(q)) { m.setAttribute('content', v.split(q).join(r)); n++; } });
  return n;
}

/* ================= история ================= */
async function viewVersion(sha) {
  try {
    const html = await S.gh.readText('index.html', sha);
    const fr = h('iframe', { style: 'width:100%;height:70vh;border:1px solid var(--line);border-radius:12px' });
    modal({ title: 'Версия ' + sha.slice(0, 7), body: fr, wide: true });
    fr.srcdoc = previewHTML(html);
  } catch (e) { toast(e.message, true); }
}
async function restoreVersion(sha, date) {
  if (!await ask('Вернуть версию от ' + fmtDate(date) + '?', 'Она откроется в админке как черновик. Чтобы она появилась на сайте, нажмите «Опубликовать». Текущие неопубликованные правки пропадут.', 'Вернуть')) return;
  try { const html = await S.gh.readText('index.html', sha); loadHTML(html); S.view = 'page'; S.mode = 'preview'; renderView(); markDirty(); saveDraftSoon(); toast('Версия загружена. Проверьте и опубликуйте.'); }
  catch (e) { toast(e.message, true); }
}

/* ================= публикация ================= */
async function publish() {
  endEdit();
  const html = finalHTML();
  const fresh = unpublished();
  if (html === S.base && !fresh.length) return toast('Нет изменений для публикации');
  const used = fresh.filter(p => html.includes(p));
  const unused = fresh.filter(p => !html.includes(p));
  const note = h('input', { class: 'in', placeholder: 'Например: обновили цены' });
  const prog = h('div', { class: 'prog hidden' }, h('i')), st = h('p', { class: 'fld-h' });
  const go = h('button', { class: 'b p', type: 'button', html: ic('send') + 'Опубликовать' });
  const m = modal({ title: 'Опубликовать изменения', body: h('div', null,
    h('p', { style: 'margin-top:0' }, 'После публикации посетители увидят новую версию примерно через 1–2 минуты.'),
    used.length ? h('p', { class: 'fld-h' }, 'Новых файлов: ' + used.length + '.') : null,
    unused.length ? h('p', { class: 'fld-h' }, 'Загруженные, но нигде не использованные файлы (' + unused.length + ') не попадут на сайт.') : null,
    h('label', { class: 'fld', style: 'margin-top:12px' }, h('span', { class: 'fld-l' }, 'Что изменили (для истории версий)'), note), prog, st),
    foot: [h('button', { class: 'b', type: 'button', onclick: () => m.close() }, 'Отмена'), go] });
  go.addEventListener('click', async () => {
    go.disabled = true; prog.classList.remove('hidden'); st.textContent = 'Готовим файлы…';
    try {
      const files = [];
      for (const p of used) files.push({ path: p, base64: await blobToBase64(S.pending.get(p).blob) });
      files.push({ path: 'index.html', text: html });
      const msg = (note.value.trim() || 'Правки сайта из админки') + '\n\nАдминка, ' + new Date().toLocaleString('ru-RU');
      const sha = await S.gh.commitFiles(files, msg, S.head, (i, n, p) => { $('i', prog).style.width = Math.round(i / n * 100) + '%'; st.textContent = 'Отправляем ' + i + ' из ' + n + ': ' + p; });
      S.head = sha; S.base = html;
      // опубликованные файлы ещё минуту показываем из памяти: GitHub Pages обновляется не сразу
      for (const p of fresh) { const d = p.split('/').slice(0, -1).join('/'); delete S.lists[d]; if (used.includes(p)) S.pending.get(p).pub = true; else { URL.revokeObjectURL(S.pending.get(p).url); S.pending.delete(p); } }
      await idb.clear('pending'); await idb.del('draft', 'cur');
      markDirty();
      m.close();
      const ok = modal({ title: 'Опубликовано', body: h('div', null, h('div', { class: 'okmsg' }, 'Изменения отправлены на сайт.'), h('p', null, 'GitHub обновит сайт примерно через 1–2 минуты. Если открыть сайт раньше, можно увидеть старую версию: обновите страницу чуть позже.')),
        foot: [h('a', { class: 'b p', href: S.siteUrl, target: '_blank', rel: 'noopener' }, 'Открыть сайт'), h('button', { class: 'b', type: 'button', onclick: () => ok.close() }, 'Готово')] });
      renderView(true);
    } catch (e) {
      go.disabled = false; prog.classList.add('hidden');
      if (e.conflict) {
        st.innerHTML = '';
        st.append(h('div', { class: 'err' }, e.message), h('p', null, 'Чтобы ничего не потерять: скачайте копию своих правок, затем обновите страницу (загрузится свежая версия сайта).'),
          h('div', { class: 'acts' }, h('button', { class: 'b sm', type: 'button', onclick: () => { const a = h('a', { href: URL.createObjectURL(new Blob([html], { type: 'text/html' })), download: 'index-moi-pravki.html' }); a.click(); } }, 'Скачать мои правки'),
            h('button', { class: 'b sm d', type: 'button', onclick: async () => { if (await ask('Опубликовать поверх?', 'Ваши правки заменят изменения, сделанные в другом месте. Продолжить?', 'Опубликовать поверх', true)) { S.head = await S.gh.headSha(); m.close(); publish(); } } }, 'Всё равно опубликовать мои')));
      } else { st.innerHTML = ''; st.append(h('div', { class: 'err' }, e.message || String(e))); }
    }
  });
}

/* ================= старт ================= */
addEventListener('keydown', e => {
  if (!S.doc || S.editing) return;
  if (/input|textarea|select/i.test(document.activeElement.tagName)) return;
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); }
});
addEventListener('beforeunload', e => { if (S.doc && isDirty() && !S.gh.mock) { e.preventDefault(); e.returnValue = ''; } });
(async () => {
  try {
    if (isMock) { const gh = new MockGitHub(); await start(gh); return; }
    const cfg = loadCfg(), tok = cfg.token || sessionStorage.getItem('bm-token');
    if (cfg.repo && tok) {
      try { const gh = new GitHub({ token: tok, repo: cfg.repo }); const info = await gh.repoInfo(); gh.branch = info.default_branch || 'main'; await start(gh); return; }
      catch (e) { loginScreen(e.message); return; }
    }
    loginScreen();
  } catch (e) { console.error(e); loginScreen('Ошибка: ' + (e.message || e)); }
})();
window.__bmAdmin = S;
