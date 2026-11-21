(() => {
'use strict';
/* Всё, что меняется через админку, лежит в <script id="bm-data" type="application/json"> в index.html.
   Тексты и картинки страниц правятся прямо в разметке (визуальный редактор админки). */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const DATA = (() => { try { return JSON.parse($('#bm-data').textContent); } catch (e) { return {}; } })();
const S = DATA.settings || {};
const NAV = DATA.nav || { routes: {}, groups: {}, next: {} };
const html = document.documentElement;
html.classList.remove('js-off');
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const svg = id => '<svg><use href="#' + id + '"/></svg>';
const tel = () => 'tel:' + (S.phone || '');
const store = {
  get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } }
};
let toastT;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 2400); }
const offset = () => $('#hdr').offsetHeight + ($('#ctx').hidden ? 0 : $('#ctx').offsetHeight) + 14;
function scrollToEl(el, smooth = true) {
  if (!el) return;
  const y = el.getBoundingClientRect().top + scrollY - offset();
  scrollTo({ top: Math.max(0, y), behavior: smooth && !reduce ? 'smooth' : 'auto' });
}

/* ---------- клоны: частые вопросы на главной, документы ---------- */
$$('[data-clone]').forEach(box => $$(box.dataset.clone).forEach(n => { if (n.closest('[data-hide]')) return; const c = n.cloneNode(true); c.removeAttribute('data-home'); c.removeAttribute('id'); if (c.tagName === 'DETAILS') c.open = false; box.appendChild(c); }));
const DOCSETS = DATA.docsets || {};
$$('[data-docs]').forEach(box => (DOCSETS[box.dataset.docs] || []).forEach(id => {
  const d = $('#docs-all [data-doc="' + id + '"]'); if (!d || d.hasAttribute('data-hide')) return;
  const c = d.cloneNode(true); c.removeAttribute('itemprop'); $$('[itemprop]', c).forEach(x => x.removeAttribute('itemprop')); box.appendChild(c);
}));
$$('[data-year]').forEach(e => e.textContent = new Date().getFullYear());

/* ================= ПЕДАГОГИ (из карточек на странице «Педагоги») ================= */
function teamInfo(id) {
  const a = $('#t-' + id); if (!a) return null;
  const name = ($('h2', a) || {}).textContent || '';
  const w = name.trim().split(/\s+/);
  const short = w.length >= 3 ? w[0] + ' ' + w[1][0] + '.' + w[2][0] + '.' : name.trim();
  const img = $('.tph img', a);
  return { id, name: name.trim(), short, role: (($('.role', a) || {}).textContent || '').trim(), av: a.dataset.av || (img ? img.getAttribute('src') : '') };
}

/* ================= ПРОГРАММЫ ================= */
const PL = (DATA.programs || []).filter(p => !p.hidden);
const P = {}; PL.forEach(p => P[p.id] = p);
function cardHTML(p) {
  const c = p.card || {};
  const tch = (p.tch || []).map(teamInfo).filter(Boolean);
  const who = tch.length ? '<div class="tch">' + (tch[0].av ? '<img src="' + esc(tch[0].av) + '" alt="">' : '') + '<span>' + tch.map(t => esc(t.short)).join('<br>') + '</span></div>' : '';
  return '<a class="card prog-card" href="#/programs/' + esc(p.id) + '" data-tags="' + esc((p.tags || []).join(' ')) + '">' +
    '<div class="top"><span class="chip chip-m">' + esc(c.chip || '') + '</span>' + who + '</div>' +
    '<h3>' + esc(p.t) + '</h3><p>' + esc(c.desc || '') + '</p>' +
    (c.meta ? '<div class="meta"><div>' + svg(c.icon || 'i-cal') + esc(c.meta) + '</div></div>' : '') +
    '<div class="bot"><div class="price">' + esc(c.price || '') + '<small>' + esc(c.priceNote || '') + '</small></div><span class="more">Подробнее' + svg('i-arr') + '</span></div></a>';
}
function miniHTML(p) {
  const c = p.card || {};
  return '<a class="card need" href="#/programs/' + esc(p.id) + '"><div class="top"><span class="ico">' + svg('i-book') + '</span><span class="chip">' + esc(c.chip || '') + '</span></div>' +
    '<h3>' + esc(p.t) + '</h3><p>' + esc(c.desc || '') + '</p><span class="go">Подробнее' + svg('i-arr') + '</span></a>';
}
const progList = $('#prog-list');
if (progList) progList.innerHTML = PL.map(cardHTML).join('');
$$('[data-progs="mini"]').forEach(b => b.innerHTML = PL.map(miniHTML).join(''));
const filt = $('#prog-filters');
if (filt) filt.innerHTML = (DATA.filters || []).map(([k, n], i) => '<button class="fbtn' + (i ? '' : ' on') + '" data-f="' + esc(k) + '">' + esc(n) + '</button>').join('');

/* ================= НОВОСТИ ================= */
const MON = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const MON1 = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
function newsDate(d) {
  const [y, m, dd] = String(d || '').split('-').map(Number);
  if (!y) return '';
  return dd ? dd + ' ' + MON[m - 1] + ' ' + y : (m ? MON1[m - 1] + ' ' + y : String(y));
}
const NEWS = (DATA.news || []).filter(n => !n.hidden && n.id).sort((a, b) => (b.pin ? 1 : 0) - (a.pin ? 1 : 0) || String(b.date || '').localeCompare(String(a.date || '')));
const NW = {}; NEWS.forEach(n => NW[n.id] = n);
function newsCard(n) {
  return '<a class="card news-c hov" href="#/news/' + esc(n.id) + '"><div class="p">' + (n.cover ? '<img src="' + esc(n.cover) + '" alt="" loading="lazy">' : '') + '</div><div class="bd">' +
    (n.pin ? '<span class="chip chip-m pin">Важно</span>' : '') + (n.date ? '<time>' + esc(newsDate(n.date)) + '</time>' : '') + '<h3>' + esc(n.t) + '</h3>' + (n.lead ? '<p>' + esc(n.lead) + '</p>' : '') + '</div></a>';
}
$$('[data-news="list"]').forEach(box => {
  const lim = +box.dataset.limit || 0, list = lim ? NEWS.slice(0, lim) : NEWS;
  if (!list.length) { const s = box.closest('.sec'); if (s) s.hidden = true; return; }
  const first = lim ? list : list.slice(0, 9);
  box.innerHTML = first.map(newsCard).join('');
  if (!lim && list.length > 9) {
    const more = document.createElement('div'); more.className = 'news-more';
    more.innerHTML = '<button class="btn btn-s" type="button">Показать ещё</button>';
    more.firstChild.addEventListener('click', () => { box.innerHTML = list.map(newsCard).join(''); more.remove(); });
    box.after(more);
  }
});

/* ================= ВИДЕО: ролик подгружается только после нажатия ================= */
function embed(u) {
  u = String(u || '').trim(); if (!u) return null; let m;
  if ((m = u.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{6,})/))) return { f: 1, src: 'https://www.youtube-nocookie.com/embed/' + m[1] + '?autoplay=1&rel=0' };
  if ((m = u.match(/rutube\.ru\/(?:video|play\/embed|shorts)\/([\w]+)/))) return { f: 1, src: 'https://rutube.ru/play/embed/' + m[1] + '?autoplay=1' };
  if ((m = u.match(/video(-?\d+)_(\d+)/)) && /vk|vkvideo/.test(u)) return { f: 1, src: 'https://vk.com/video_ext.php?oid=' + m[1] + '&id=' + m[2] + '&hd=2&autoplay=1' };
  if (/\.(mp4|webm|mov|m4v|ogv)(\?|$)/i.test(u) || !/^https?:/.test(u)) return { f: 0, src: u };
  return { f: 1, src: u };
}
function vidHTML(url, poster, cap) {
  return '<figure class="vid-f"><div class="vid" data-video="' + esc(url) + '" role="button" tabindex="0" aria-label="Смотреть видео">' + (poster ? '<img src="' + esc(poster) + '" alt="" loading="lazy">' : '') + '<span class="vid-play"></span></div>' + (cap ? '<figcaption>' + esc(cap) + '</figcaption>' : '') + '</figure>';
}
function playVid(v) {
  const e = embed(v.dataset.video); if (!e) return;
  v.innerHTML = e.f ? '<iframe src="' + esc(e.src) + '" allow="autoplay; encrypted-media; fullscreen; picture-in-picture" allowfullscreen title="Видео"></iframe>' : '<video src="' + esc(e.src) + '" controls autoplay playsinline></video>';
  v.style.cursor = 'auto'; v.removeAttribute('role');
}
document.addEventListener('click', e => { const v = e.target.closest && e.target.closest('.vid[data-video]'); if (v && !v.querySelector('iframe,video')) { e.preventDefault(); playVid(v); } });
document.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.classList && e.target.classList.contains('vid')) { e.preventDefault(); playVid(e.target); } });

/* ================= МАРШРУТЫ ================= */
const ROUTE = { program: { nav: 'programs', parent: ['programs', 'Все программы'] }, post: { nav: 'about', parent: ['life', 'Жизнь центра'] } };
Object.entries(NAV.routes || {}).forEach(([k, t]) => {
  ROUTE[k] = { t, nav: k };
  Object.entries(NAV.groups || {}).forEach(([g, list]) => { if (list.some(x => x[0] === k)) { ROUTE[k].g = g; ROUTE[k].nav = g; } });
});
if (ROUTE.home) ROUTE.home.nav = '';
if (ROUTE.sveden) ROUTE.sveden.nav = '';
if (ROUTE.privacy) ROUTE.privacy.nav = '';
const SVNAMES = {}; $$('#sv-nav a').forEach(a => SVNAMES[a.getAttribute('href').split('/').pop()] = a.textContent.replace(/^\d+/, '').trim());

const pages = {}; $$('.page').forEach(p => { if (!p.hasAttribute('data-hide')) pages[p.dataset.page] = p; });
let cur = null, curSub = null, curHash = '', prevHash = '';
history.scrollRestoration = 'manual';
function parse() {
  const h = location.hash.replace(/^#\/?/, ''), [path, q] = h.split('?'), parts = path.split('/').filter(Boolean);
  let page = parts[0] || 'home', sub = decodeURIComponent(parts[1] || '');
  if (page === 'programs' && sub && P[sub]) page = 'program';
  if (page === 'news') page = sub && NW[sub] ? 'post' : 'life';
  return { page, sub, q: new URLSearchParams(q || '') };
}
const saveY = () => { try { history.replaceState(Object.assign({}, history.state, { y: scrollY }), ''); } catch (e) { } };
let sT; addEventListener('scroll', () => { clearTimeout(sT); sT = setTimeout(saveY, 150); }, { passive: true });

function ctxRender(pg, sub) {
  const ctx = $('#ctx'), box = $('#ctx-in');
  if (pg === 'home') { ctx.hidden = true; return; }
  ctx.hidden = false;
  const r = ROUTE[pg] || {};
  const backTo = r.parent ? r.parent : ['', (NAV.routes || {}).home || 'Главная'];
  let h = '<a class="back" href="#/' + backTo[0] + '">' + svg('i-arr') + '<b>' + esc(backTo[1]) + '</b></a><span class="sep"></span>';
  if (r.g && NAV.groups[r.g]) {
    h += '<div class="tabs">' + NAV.groups[r.g].map(([k, n]) => '<a href="#/' + k + '" class="' + (k === pg ? 'on' : '') + '"' + (k === pg ? ' aria-current="page"' : '') + '>' + esc(n) + '</a>').join('') + '</div>';
  } else if (pg === 'program') {
    h += '<span class="here"><span>Программы /</span> ' + esc(P[sub].t) + '</span>';
  } else if (pg === 'post') {
    h += '<span class="here"><span>Новости /</span> ' + esc(NW[sub].t) + '</span>';
  } else if (pg === 'sveden') {
    h += '<span class="here">Сведения об организации <span>/ ' + esc(SVNAMES[sub || 'common'] || '') + '</span></span>';
  } else {
    h += '<span class="here">' + esc(r.t || '') + '</span>';
  }
  box.innerHTML = h;
  const on = $('.tabs a.on', box); if (on) on.scrollIntoView({ inline: 'center', block: 'nearest' });
}
function nextRender(pg) {
  const w = $('#next-wrap'), n = (NAV.next || {})[pg];
  if (!n || !n.length) { w.innerHTML = ''; return; }
  w.innerHTML = '<div class="next">' + n.map(([k, t, d]) => '<a class="card" href="#/' + esc(k) + '"><div><small>Дальше</small><b>' + esc(t) + '</b><small>' + esc(d) + '</small></div>' + svg('i-arr') + '</a>').join('') + '</div>';
}
function route() {
  if (location.hash && !location.hash.startsWith('#/')) return;
  const r = parse();
  const pg = pages[r.page] && (r.page !== 'program' || P[r.sub]) && (r.page !== 'post' || NW[r.sub]) ? r.page : 'home';
  if (location.hash !== curHash) { prevHash = curHash; curHash = location.hash; }
  const st = history.state, y = st && typeof st.y === 'number' ? st.y : null;
  const changed = pg !== cur || ((pg === 'program' || pg === 'post') && r.sub !== curSub);
  if (changed) {
    if (cur && pages[cur]) pages[cur].classList.remove('on');
    if (pg === 'program') renderProgram(r.sub);
    if (pg === 'post') renderPost(r.sub);
    pages[pg].classList.remove('on'); void pages[pg].offsetWidth; pages[pg].classList.add('on');
    cur = pg; curSub = r.sub;
    const title = pg === 'program' ? P[r.sub].t : pg === 'post' ? NW[r.sub].t : (ROUTE[pg] || {}).t;
    document.title = pg === 'home' ? (S.homeTitle || document.title) : (title || '') + (S.titleSuffix || '');
    const nav = (ROUTE[pg] || {}).nav;
    $$('#nav [data-nav]').forEach(a => { const on = a.dataset.nav === nav; a.classList.toggle('on', on); on ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current'); });
    $$('#mnav [data-m]').forEach(a => a.classList.toggle('on', a.dataset.m === (pg === 'program' ? 'programs' : pg === 'post' ? 'life' : pg)));
    const usv = $('#util-sv'); if (usv) usv.classList.toggle('on', pg === 'sveden');
    nextRender(pg);
  }
  ctxRender(pg, r.sub);
  if (pg === 'programs') applyFilter(r.q.get('f') || 'all');
  if (pg === 'sveden') svShow(r.sub || 'common', changed);
  const target = pg === 'team' && r.sub ? $('#t-' + r.sub) : null;
  if (y !== null) scrollTo(0, y);
  else if (target) { scrollTo(0, 0); setTimeout(() => scrollToEl(target, false), 30); }
  else if (changed || pg === 'sveden') scrollTo(0, 0);
  if (pg === 'team' && r.sub) { const d = $('#t-' + r.sub + ' details'); if (d) d.open = true; }
  setTimeout(() => watch(pages[pg]), 40);
}
addEventListener('hashchange', route);

document.addEventListener('click', e => {
  const a = e.target.closest('a[href^="#"]');
  if (a) {
    const h = a.getAttribute('href');
    if (h === '#') { e.preventDefault(); }
    else if (!h.startsWith('#/')) { e.preventDefault(); scrollToEl(document.getElementById(h.slice(1))); }
    else {
      if (a.classList.contains('back') && prevHash) {
        const base = h.replace(/\?.*$/, ''), prev = prevHash.replace(/\?.*$/, '');
        if (prev === base || (base === '#/' && (prev === '' || prev === '#/'))) { e.preventDefault(); history.back(); return; }
      }
      saveY();
      if (h === location.hash || (h === '#/' && location.hash === '')) { e.preventDefault(); scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' }); }
      menu(false);
    }
  }
  const b = e.target.closest('[data-quiz],[data-search],[data-a11y],[data-lb],[data-close]');
  if (!b) return;
  if (b.hasAttribute('data-quiz')) { e.preventDefault(); menu(false); quizOpen(); }
  else if (b.hasAttribute('data-search')) { e.preventDefault(); menu(false); searchOpen(); }
  else if (b.hasAttribute('data-a11y')) { e.preventDefault(); menu(false); modal('#a11y', true); }
  else if (b.hasAttribute('data-lb')) { e.preventDefault(); lbOpen(b); }
  else if (b.hasAttribute('data-close')) closeAll();
});

/* ================= СПОКОЙНОЕ ПОЯВЛЕНИЕ ================= */
const io = 'IntersectionObserver' in window ? new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -6% 0px', threshold: 0.05 }) : null;
function watch(root) {
  $$('.rv:not(.in)', root).forEach(el => {
    const b = el.getBoundingClientRect();
    if (!io || (b.top < innerHeight && b.bottom > 0)) { el.classList.add('now', 'in'); requestAnimationFrame(() => requestAnimationFrame(() => el.classList.remove('now'))); }
    else io.observe(el);
  });
}

/* ================= ШАПКА, МЕНЮ, ПАНЕЛЬ ================= */
const dock = $('#dock');
addEventListener('scroll', () => dock.classList.toggle('show', scrollY > 300), { passive: true });
const mnav = $('#mnav');
function menu(on) {
  if (!mnav) return;
  if (on === mnav.classList.contains('open')) return;
  mnav.classList.toggle('open', on); mnav.setAttribute('aria-hidden', !on);
  $('[data-menu]').setAttribute('aria-expanded', on);
  document.body.style.overflow = on ? 'hidden' : '';
}
$('[data-menu]').addEventListener('click', () => menu(true));
$('[data-menu-close]').addEventListener('click', () => menu(false));

/* ================= ФИЛЬТР ПРОГРАММ ================= */
function applyFilter(f) {
  $$('#prog-list .prog-card').forEach(c => c.classList.toggle('hide', !(f === 'all' || (c.dataset.tags || '').split(' ').includes(f))));
  $$('#prog-filters [data-f]').forEach(b => b.classList.toggle('on', b.dataset.f === f));
}
$$('#prog-filters [data-f]').forEach(b => b.addEventListener('click', () => {
  const f = b.dataset.f;
  try { history.replaceState({ y: scrollY }, '', f === 'all' ? '#/programs' : '#/programs?f=' + f); } catch (e) { }
  applyFilter(f);
}));

/* ================= СТРАНИЦА ПРОГРАММЫ ================= */
function teacherMini(id) {
  const t = teamInfo(id); if (!t) return '';
  const ph = t.av ? '<img src="' + esc(t.av) + '" alt="">' : '<span class="mono">' + esc(t.short.slice(0, 2)) + '</span>';
  return '<a class="card tmini hov" href="#/team/' + esc(id) + '">' + ph + '<div><b>' + esc(t.name) + '</b><span>' + esc(t.role) + '</span></div></a>';
}
function renderProgram(id) {
  const p = P[id], c = p.card || {};
  const sec = s => {
    if (s.learn) { const l = $('#learn'); return l ? '<div class="pd-sec"><h2>' + esc(s.h) + '</h2><div class="learn" style="grid-template-columns:repeat(4,1fr)">' + l.innerHTML + '</div></div>' : ''; }
    const body = s.list && s.list.length ? '<ul class="dots">' + s.list.map(x => '<li>' + esc(x) + '</li>').join('') + '</ul>' : (s.text ? '<p>' + esc(s.text) + '</p>' : '');
    return body ? '<div class="pd-sec"><h2>' + esc(s.h) + '</h2>' + body + '</div>' : '';
  };
  const tch = (p.tch || []).filter(t => $('#t-' + t));
  let h = '<div class="ph"><div class="wrap"><div class="chips">' + (p.chips || []).map(x => '<span class="chip chip-m">' + esc(x) + '</span>').join('') + '</div><h1 class="h1" style="margin-top:16px">' + esc(p.t) + '</h1><p class="lead">' + esc(p.lead) + '</p></div></div>';
  h += '<section class="sec" style="padding-top:0"><div class="wrap pd"><div>' + (p.sec || []).map(sec).join('');
  if (tch.length) h += '<div class="pd-sec"><h2>' + (tch.length > 1 ? 'Педагоги' : 'Педагог') + '</h2><div class="grid2">' + tch.map(teacherMini).join('') + '</div></div>';
  h += '</div><aside class="pd-aside"><div class="card pd-box"><div class="price">' + esc(c.price || '') + '<small>' + esc(c.priceNote || '') + '</small></div><div style="margin-top:14px;display:grid;gap:8px">' + (p.facts || []).map(([k, v]) => '<div class="fact"><small>' + esc(k) + '</small><b>' + esc(v) + '</b></div>').join('') + '</div>' +
    '<a class="btn btn-p" href="' + tel() + '">' + svg('i-phone') + 'Записаться по телефону</a>' +
    (p.doc ? '<a class="btn btn-s" href="' + esc(p.doc) + '" target="_blank" rel="noopener">' + svg('i-doc') + 'Программа (PDF)</a>' : '') +
    (p.poster ? '<button class="btn btn-s" type="button" data-lb="' + esc(p.poster) + '">' + svg('i-doc') + 'Афиша</button>' : '') + '</div></aside></div></section>';
  const tags = p.tags || [];
  const others = PL.filter(x => x.id !== id).map(x => [x, (x.tags || []).filter(t => tags.includes(t)).length]).sort((a, b) => b[1] - a[1]).slice(0, 3).map(x => x[0]);
  h += '<section class="sec"><div class="wrap"><div class="sec-head"><div><h2 class="h2">Другие программы</h2></div><a class="link" href="#/programs">Все программы' + svg('i-arr') + '</a></div><div class="grid3">' + others.map(cardHTML).join('') + '</div></div></section>';
  $('#pd-view').innerHTML = h;
}

/* ================= СТРАНИЦА НОВОСТИ ================= */
function renderPost(id) {
  const n = NW[id];
  let h = '<div class="ph"><div class="wrap">' + (n.date ? '<div class="chips"><span class="chip chip-m">' + esc(newsDate(n.date)) + '</span></div>' : '') +
    '<h1 class="h1" style="margin-top:16px">' + esc(n.t) + '</h1>' + (n.lead ? '<p class="lead">' + esc(n.lead) + '</p>' : '') + '</div></div>';
  h += '<section class="sec" style="padding-top:0"><div class="wrap">';
  if (n.cover && !n.video) h += '<figure class="pic" style="max-width:960px;aspect-ratio:16/9;margin-bottom:28px"><img src="' + esc(n.cover) + '" alt=""></figure>';
  if (n.body) h += '<div class="prose post-body">' + n.body + '</div>';
  const media = [];
  if (n.video) media.push(vidHTML(n.video, n.cover, n.videoCap));
  if ((n.gallery || []).length) media.push('<div class="gal">' + n.gallery.map(g => '<button type="button" data-lb><img src="' + esc(g) + '" alt="" loading="lazy"></button>').join('') + '</div>');
  if (media.length) h += '<div class="post-media">' + media.join('') + '</div>';
  h += '<div class="row-btn"><a class="btn btn-s" href="#/life">' + svg('i-arr').replace('<svg>', '<svg style="transform:rotate(180deg)">') + 'Все новости</a></div></div></section>';
  const others = NEWS.filter(x => x.id !== id).slice(0, 3);
  if (others.length) h += '<section class="sec"><div class="wrap"><div class="sec-head"><div><h2 class="h2">Другие новости</h2></div></div><div class="news-l">' + others.map(newsCard).join('') + '</div></div></section>';
  $('#post-view').innerHTML = h;
}

/* ================= ПЕДАГОГИ: документы из таблицы сведений ================= */
const TSET = DATA.team || {};
const skip = (TSET.skip || []).map(s => s.toLowerCase());
$$('#team-list .tp[data-t]').forEach(tp => {
  const id = tp.dataset.t, dl = $('details.cred dl', tp), row = $('#staff tr[data-t="' + id + '"]');
  if (!dl) return;
  if (!row) { const d = $('details.cred', tp); if (d) d.remove(); return; }
  const clean = s => s.replace(/ itemprop="[^"]*"/g, '');
  const filt = s => clean(s).split(/<br\s*\/?>/i).filter(x => !skip.some(k => x.toLowerCase().includes(k))).join('<br>');
  const g = p => { const el = $('[itemprop="' + p + '"]', row); return el ? filt(el.innerHTML) : ''; };
  const lvl = $$('td', row)[3];
  const items = [['Образование', lvl ? clean(lvl.innerHTML.replace(/<span[^>]*hidden[^>]*>[^<]*<\/span>/g, '')) : ''], ['Программы', g('teachingDiscipline')], ['Повышение квалификации', g('profDevelopment')], ['Переподготовка', g('qualification')], ['Стаж в профессии', g('specExperience') + (TSET.asOf ? ' ' + esc(TSET.asOf) : '')]];
  dl.innerHTML = items.filter(([, v]) => v && v.trim() && v.trim() !== 'Нет').map(([k, v]) => '<div><dt>' + k + '</dt><dd>' + v + '</dd></div>').join('');
});

/* ================= МОДАЛКИ ================= */
const ov = $('#ov');
let lastFocus = null;
function modal(sel, on) {
  const m = $(sel);
  if (on) { $$('.mdl.on').forEach(x => x !== m && modal('#' + x.id, false)); lastFocus = document.activeElement; }
  m.classList.toggle('on', on); m.setAttribute('aria-hidden', !on);
  ov.classList.toggle('on', on);
  document.body.style.overflow = on ? 'hidden' : '';
  if (on) setTimeout(() => { const f = $('input,button:not([data-close])', m); f && f.focus({ preventScroll: true }); }, 50);
  else if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
}
function closeAll() {
  if ($('#lb').classList.contains('on')) { lbClose(); return; }
  const m = $('.mdl.on'); if (m) { modal('#' + m.id, false); return; }
  menu(false);
}
ov.addEventListener('click', closeAll);
addEventListener('keydown', e => {
  if (e.key === 'Escape') closeAll();
  if ((e.key === 'k' && (e.ctrlKey || e.metaKey)) || (e.key === '/' && !/input|textarea/i.test(document.activeElement.tagName))) { e.preventDefault(); searchOpen(); }
  if ($('#lb').classList.contains('on')) { if (e.key === 'ArrowRight') lbStep(1); if (e.key === 'ArrowLeft') lbStep(-1); }
});

/* ================= ПОДБОР ПРОГРАММЫ ================= */
const QS = DATA.quiz || [];
let qa = {};
function quizOpen() { qa = {}; quizStep(0); modal('#quiz', true); }
function quizStep(i) {
  const b = $('#quiz-b');
  let h = '<div class="qz-prog">' + QS.map((_, j) => '<i class="' + (j <= i ? 'on' : '') + '"></i>').join('') + '<i class="' + (i >= QS.length ? 'on' : '') + '"></i></div>';
  if (i < QS.length) {
    const s = QS[i];
    h += '<div class="qz-step"><span class="muted" style="font-weight:650;font-size:14px">Вопрос ' + (i + 1) + ' из ' + QS.length + '</span><h3 style="margin-top:4px">' + esc(s.q) + '</h3><div class="qz-opts">' +
      s.o.map((o, j) => '<button type="button" data-j="' + j + '"><i>' + svg(o[2] || 'i-info') + '</i><span>' + esc(o[0]) + (o[3] ? '<small>' + esc(o[3]) + '</small>' : '') + '</span></button>').join('') + '</div>' +
      (i ? '<button class="link" type="button" data-back style="margin-top:16px">← Назад</button>' : '') + '</div>';
    b.innerHTML = h;
    $$('.qz-opts button', b).forEach(btn => btn.addEventListener('click', () => { qa[s.k] = s.o[+btn.dataset.j][1]; quizStep(i + 1); }));
    const bk = $('[data-back]', b); if (bk) bk.addEventListener('click', () => quizStep(i - 1));
  } else {
    const res = quizResult();
    h += '<div class="qz-step"><h3>Вам подойдёт</h3><p class="muted" style="margin-top:6px">Начните с консультации. На ней уточним выбор и подберём время.</p><div class="qz-res">' +
      res.map(([href, t, s]) => '<a href="' + esc(href) + '" data-cq><div><b>' + esc(t) + '</b><span>' + esc(s) + '</span></div>' + svg('i-arr') + '</a>').join('') +
      '</div><div class="row-btn" style="margin-top:18px"><a class="btn btn-p" href="' + tel() + '">' + svg('i-phone') + 'Записаться по телефону</a><button class="btn btn-s" type="button" data-again>Пройти заново</button></div></div>';
    b.innerHTML = h;
    $('[data-again]', b).addEventListener('click', () => { qa = {}; quizStep(0); });
    $$('[data-cq]', b).forEach(a => a.addEventListener('click', () => modal('#quiz', false)));
  }
}
function quizResult() {
  const out = [];
  if (qa.need === 'diag') out.push(['#/diagnostics', 'Собеседование-консультация', '1 час, 3 000 ₽'], ['#/diagnostics', 'Тест Лейтер-3', 'оценка без использования речи, с 3 лет']);
  const sc = PL.filter(p => p.quiz).map(p => {
    const { min, max, fmt } = p.quiz;
    if (qa.age < min - .5 || qa.age > max + .5) return [p, -1];
    let s = 0; const tg = p.tags || [];
    if (tg.includes(qa.need)) s += 3;
    if (qa.fmt === fmt) s += 2; else if (qa.fmt === 'any') s += .5;
    if (qa.need === 'diag' && fmt === 'ind') s += 2;
    return [p, s];
  }).filter(x => x[1] > 0).sort((a, b) => b[1] - a[1]).slice(0, qa.need === 'diag' ? 1 : 3);
  sc.forEach(([p]) => out.push(['#/programs/' + p.id, p.t, (p.chips || []).join(' · ')]));
  if (!out.length) out.push(['#/diagnostics', 'Собеседование-консультация', 'обсудим, что подойдёт именно вам']);
  return out;
}

/* ================= ПОИСК ================= */
let IDX = null;
const norm = s => s.toLowerCase().replace(/ё/g, 'е');
function buildIdx() {
  IDX = [];
  Object.entries(pages).forEach(([k, p]) => {
    if (k === 'program' || k === 'post') return;
    const r = '#/' + (k === 'home' ? '' : k) + (k === 'sveden' ? '/common' : '');
    const t = (ROUTE[k] || {}).t || k;
    IDX.push({ t, s: 'Раздел сайта', h: r, w: 3 });
    $$('h2,h3', p).forEach(h => { if (h.closest('[data-clone],.tp,[data-hide]')) return; IDX.push({ t: h.textContent.trim(), s: t, h: r, el: h, w: 1 }); });
  });
  PL.forEach(p => IDX.push({ t: p.t, s: p.lead || '', h: '#/programs/' + p.id, w: 4 }));
  NEWS.forEach(n => IDX.push({ t: n.t, s: 'Новость' + (n.date ? ', ' + newsDate(n.date) : ''), h: '#/news/' + n.id, w: 2 }));
  $$('#team-list .tp[data-t]').forEach(a => { const t = teamInfo(a.dataset.t); if (t) IDX.push({ t: t.name, s: t.role, h: '#/team/' + t.id, w: 4 }); });
  $$('#docs-all .doc').forEach(d => { if (!d.hasAttribute('data-hide')) IDX.push({ t: $('b', d).textContent, s: 'Документ', h: '#/sveden/document', w: 2 }); });
  $$('#faq-all summary').forEach(s => { if (!s.closest('[data-hide]')) IDX.push({ t: s.textContent.trim(), s: 'Частые вопросы', h: '#/parents', el: s, w: 2 }); });
  $$('.sv-sec').forEach(s => IDX.push({ t: $('h2', s).textContent, s: 'Сведения об организации', h: '#/sveden/' + s.dataset.sv, w: 2 }));
  (DATA.quick || []).forEach(([k, t, h]) => IDX.push({ t, s: 'Быстрый ответ', h, k, w: 3 }));
}
let sSel = 0;
function searchOpen() { if (!IDX) buildIdx(); modal('#search', true); const i = $('#sq'); i.value = ''; searchRun(''); setTimeout(() => i.focus(), 60); }
function hl(t, q) { if (!q) return esc(t); const n = norm(t), i = n.indexOf(q); return i < 0 ? esc(t) : esc(t.slice(0, i)) + '<mark>' + esc(t.slice(i, i + q.length)) + '</mark>' + esc(t.slice(i + q.length)); }
function searchRun(v) {
  const q = norm(v.trim()), box = $('#sres');
  let list;
  if (!q) list = IDX.filter(x => x.w >= 4).slice(0, 8);
  else {
    const words = q.split(/\s+/);
    list = IDX.map(x => { const hay = norm(x.t + ' ' + x.s + ' ' + (x.k || '')); let s = 0; words.forEach(w => { if (norm(x.t).includes(w)) s += 3; else if (hay.includes(w)) s += 1; else s -= 10; }); return [x, s + x.w * .1]; })
      .filter(x => x[1] > 0).sort((a, b) => b[1] - a[1]).map(x => x[0]);
    const seen = new Set(); list = list.filter(x => { const k = x.t + x.h; if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, 12);
  }
  sSel = 0;
  box.innerHTML = list.length ? list.map((x, i) => '<a href="' + esc(x.h) + '" class="' + (i === 0 ? 'on' : '') + '"><b>' + hl(x.t, q) + '</b><span>' + esc(x.s.slice(0, 110)) + '</span></a>').join('') : '<p class="muted" style="padding:12px 14px;font-weight:600">Ничего не нашли. Позвоните, подскажем: <a class="accent" href="' + tel() + '">' + esc(S.phoneText || '') + '</a></p>';
  $$('a', box).forEach((a, i) => a.addEventListener('click', () => {
    modal('#search', false);
    const it = list[i];
    if (it && it.el) setTimeout(() => { scrollToEl(it.el); if (it.el.tagName === 'SUMMARY') it.el.parentElement.open = true; }, 120);
  }));
}
$('#sq').addEventListener('input', e => searchRun(e.target.value));
$('#sq').addEventListener('keydown', e => {
  const as = $$('#sres a'); if (!as.length) return;
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); sSel = (sSel + (e.key === 'ArrowDown' ? 1 : -1) + as.length) % as.length; as.forEach((a, i) => a.classList.toggle('on', i === sSel)); as[sSel].scrollIntoView({ block: 'nearest' }); }
  if (e.key === 'Enter') { e.preventDefault(); as[sSel].click(); }
});

/* ================= ДОСТУПНОСТЬ ================= */
let a11y = Object.assign({ fs: '0', hc: '0', noimg: '0', nomo: '0' }, store.get('bm-a11y') || {});
function a11yApply() {
  html.classList.toggle('fs1', a11y.fs === '1'); html.classList.toggle('fs2', a11y.fs === '2');
  html.classList.toggle('hc', a11y.hc === '1'); html.classList.toggle('noimg', a11y.noimg === '1'); html.classList.toggle('nomo', a11y.nomo === '1');
  $$('#a11y [data-a]').forEach(g => $$('button', g).forEach(b => b.classList.toggle('on', b.dataset.v === a11y[g.dataset.a])));
  store.set('bm-a11y', a11y);
}
$$('#a11y [data-a]').forEach(g => $$('button', g).forEach(b => b.addEventListener('click', () => { a11y[g.dataset.a] = b.dataset.v; a11yApply(); })));
$('#a11y-reset').addEventListener('click', () => { a11y = { fs: '0', hc: '0', noimg: '0', nomo: '0' }; a11yApply(); });
a11yApply();

/* ================= ЛАЙТБОКС ================= */
let lbList = [], lbI = 0;
const lbOf = b => { const i = $('img', b); return { src: b.dataset.lb || (i ? i.getAttribute('src') : ''), alt: i ? i.alt : '' }; };
function lbOpen(btn) {
  const scope = btn.closest('.page') || document;
  lbList = $$('[data-lb]', scope).filter(b => !b.closest('[data-hide]')).map(lbOf).filter(x => x.src);
  const me = lbOf(btn);
  lbI = Math.max(0, lbList.findIndex(x => x.src === me.src));
  if (!lbList.length) lbList = [me];
  lbShow();
  $('#lb').classList.add('on'); $('#lb').setAttribute('aria-hidden', 'false');
  $$('#lb .nav-l,#lb .nav-r').forEach(b => b.style.display = lbList.length > 1 ? '' : 'none');
}
function lbShow() { const im = $('#lb-img'); im.src = lbList[lbI].src; im.alt = lbList[lbI].alt || ''; }
function lbStep(d) { lbI = (lbI + d + lbList.length) % lbList.length; lbShow(); }
function lbClose() { $('#lb').classList.remove('on'); $('#lb').setAttribute('aria-hidden', 'true'); }
$$('[data-lbn]').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); lbStep(+b.dataset.lbn); }));
$('#lb').addEventListener('click', e => { if (e.target.id === 'lb') lbClose(); });

/* ================= ЗВУК: записанный голос через Web Audio ================= */
const TILES = DATA.tiles || [];
let actx = null, abuf = {}, aready = null, playing = [], soundOn = store.get('bm-snd') !== false;
function audioPrep() {
  if (aready) { if (actx && actx.state === 'suspended') actx.resume(); return aready; }
  const AC = window.AudioContext || window.webkitAudioContext;
  const urls = [...new Set(TILES.map(t => t.a).concat(DATA.doneSound || []).filter(Boolean))];
  if (!AC || !urls.length) { aready = Promise.resolve(false); return aready; }
  try { actx = new AC(); } catch (e) { aready = Promise.resolve(false); return aready; }
  if (actx.state === 'suspended') actx.resume();
  aready = Promise.all(urls.map(u => fetch(u).then(r => r.arrayBuffer())
    .then(b => new Promise((res, rej) => actx.decodeAudioData(b, res, rej)))
    .then(buf => { abuf[u] = Object.assign({ b: buf }, trim(buf)); }).catch(() => { })))
    .then(() => Object.keys(abuf).length > 0);
  return aready;
}
function trim(buf) {
  const d = buf.getChannelData(0), th = 0.01, sr = buf.sampleRate; let s = 0, e = d.length - 1;
  while (s < e && Math.abs(d[s]) < th) s++; while (e > s && Math.abs(d[e]) < th) e--;
  return { s: Math.max(0, s / sr - 0.02), e: Math.min(buf.duration, e / sr + 0.08) };
}
function speakFallback(words) {
  if (!('speechSynthesis' in window) || !words.length) return;
  try { const u = new SpeechSynthesisUtterance(words.join(' ')); u.lang = 'ru-RU'; const v = speechSynthesis.getVoices().find(x => /^ru/i.test(x.lang)); if (v) u.voice = v; speechSynthesis.speak(u); } catch (e) { }
}
function play(urls, words) {
  if (!soundOn) return;
  playing.forEach(s => { try { s.stop(); } catch (e) { } }); playing = [];
  audioPrep().then(ok => {
    if (!ok || urls.some(u => !abuf[u])) { speakFallback(words || []); return; }
    let t = actx.currentTime + 0.03;
    urls.forEach(u => { const a = abuf[u]; const src = actx.createBufferSource(); src.buffer = a.b; src.connect(actx.destination); src.start(t, a.s, a.e - a.s); playing.push(src); t += (a.e - a.s) + 0.12; });
  });
}
function mountComm(el) {
  el.innerHTML = '<div class="comm"><div class="comm-bar"><div class="comm-out" aria-live="polite"><span class="cph">Нажмите на картинки</span></div>' +
    '<button class="ibtn" type="button" data-undo aria-label="Убрать последнее слово">' + svg('i-undo') + '</button><button class="ibtn say" type="button" data-say aria-label="Сказать фразу">' + svg('i-vol') + '<b>Сказать</b></button></div>' +
    '<div class="comm-grid">' + TILES.map((t, i) => '<button class="tile ' + esc(t.k) + '" type="button" data-i="' + i + '">' + svg(t.i) + esc(t.w) + '</button>').join('') + '</div>' +
    '<div class="comm-foot"><div class="legend"><span style="--c:var(--k-people)">люди</span><span style="--c:var(--k-verb)">действия</span><span style="--c:var(--k-social)">просьбы</span><span style="--c:var(--k-stop)">стоп</span></div><button class="snd" type="button" data-snd>' + svg('i-vol') + '<span></span></button></div></div>';
  const out = $('.comm-out', el); let words = [];
  const sndBtn = $('[data-snd]', el);
  const sndDraw = () => { $$('[data-snd]').forEach(b => { b.classList.toggle('off', !soundOn); $('span', b).textContent = soundOn ? 'Звук включён' : 'Звук выключен'; }); };
  sndDraw();
  sndBtn.addEventListener('click', () => { soundOn = !soundOn; store.set('bm-snd', soundOn); sndDraw(); if (soundOn && TILES[0]) play([TILES[0].a], [TILES[0].w]); });
  const draw = (hi = -1) => {
    out.innerHTML = words.length ? words.map((i, j) => '<span class="tok ' + esc(TILES[i].k) + (j === hi ? ' talk' : '') + '"><i>' + svg(TILES[i].i) + '</i>' + esc(TILES[i].w) + '</span>').join('') : '<span class="cph">Нажмите на картинки</span>';
  };
  $$('.tile', el).forEach(b => b.addEventListener('click', () => {
    const i = +b.dataset.i; if (words.length >= 6) words.shift(); words.push(i); draw(); play([TILES[i].a], [TILES[i].w]);
    b.classList.add('pr'); setTimeout(() => b.classList.remove('pr'), 140);
  }));
  $('[data-undo]', el).addEventListener('click', () => { words.pop(); draw(); });
  $('[data-say]', el).addEventListener('click', () => {
    if (!words.length) { toast('Сначала выберите картинки'); return; }
    play(words.map(i => TILES[i].a), words.map(i => TILES[i].w));
    words.forEach((_, j) => setTimeout(() => draw(j), j * 520)); setTimeout(() => draw(), words.length * 520 + 200);
  });
}
$$('[data-comm-mount]').forEach(mountComm);

/* ================= ВИЗУАЛЬНОЕ РАСПИСАНИЕ ================= */
(() => {
  const bank = $('#vs-bank'), track = $('#vs-track'); if (!bank) return;
  let seq = [], now = -1;
  const go = $('#vs-go'), next = $('#vs-next'), cnt = $('#vs-count');
  function draw() {
    cnt.textContent = seq.length + ' из 6';
    track.innerHTML = seq.length ? seq.map((s, i) => '<div class="vs-step ' + (i < now ? 'done' : i === now ? 'now' : '') + '"><span class="n">' + (i < now ? svg('i-check').replace('<svg>', '<svg style="width:15px;height:15px">') : i + 1) + '</span><img src="' + esc(s.src) + '" alt=""><b>' + esc(s.l) + '</b></div>').join('') : '<div class="vs-empty">Нажмите на карточки слева.<br>Можно выбрать до шести дел.</div>';
    go.disabled = seq.length < 2 || now >= 0; next.hidden = now < 0 || now >= seq.length;
    $$('.vs-it', bank).forEach(b => b.classList.toggle('used', seq.some(s => s.l === (b.dataset.l || b.textContent.trim()))));
  }
  $$('.vs-it', bank).forEach(b => b.addEventListener('click', () => {
    const l = b.dataset.l || b.textContent.trim();
    if (now >= 0 || seq.length >= 6 || seq.some(s => s.l === l)) return;
    seq.push({ l, src: $('img', b).getAttribute('src') }); draw();
  }));
  go.addEventListener('click', () => { now = 0; draw(); });
  next.addEventListener('click', () => { now++; draw(); if (now >= seq.length) { play([DATA.doneSound], ['Молодец!']); toast('День выполнен. Молодец!'); } });
  $('#vs-clear').addEventListener('click', () => { seq = []; now = -1; draw(); });
})();

/* ================= КАЛЬКУЛЯТОР ================= */
(() => {
  const C = DATA.calc, w = $('#c-what'); if (!w || !C || !C.options || !C.options.length) return;
  const fmt = n => n.toLocaleString('ru-RU').replace(/\s/g, ' ') + ' ₽';
  let opt = 0, times = null, care = 0, lastWk = null;
  const seg = (box, list, cur, lab) => { box.innerHTML = list.map(v => '<button type="button" data-v="' + v + '" class="' + (v === cur ? 'on' : '') + '">' + (lab ? lab(v) : v) + '</button>').join(''); };
  function draw() {
    const o = C.options[opt], wk = !!o.weekend;
    const tl = wk ? (C.weekendTimes || [1]) : (C.times || [1, 2, 3]);
    // при переходе между будними и выходными частота возвращается к обычной: в выходные 1 раз, в будни 2
    if (wk !== lastWk || !tl.includes(times)) times = wk ? tl[0] : (tl.includes(2) ? 2 : tl[0]);
    lastWk = wk;
    seg(w, C.options.map((_, i) => i), opt, i => esc(C.options[i].label || C.options[i].n));
    seg($('#c-times'), tl, times);
    seg($('#c-care'), C.care || [0], care, v => v ? v : 'Не нужен');
    $('#c-times-l').textContent = wk ? 'Занятий в выходные за неделю' : 'Раз в неделю';
    const rate = wk ? (C.careWeekend || 0) : (C.careWeekday || 0);
    $('#c-care-l').textContent = (wk ? 'Продлёнка в выходной' : 'Присмотр и уход') + ', часов в неделю (' + fmt(rate) + ' в час)';
    const weeks = C.weeks || 4, n = times * weeks, a = o.p * n, c = care * weeks * rate;
    $('#c-l1').textContent = (o.n || o.label) + ': ' + fmt(o.p) + ' × ' + n;
    $('#c-v1').textContent = fmt(a);
    $('#c-l2').textContent = care ? (wk ? 'Продлёнка' : 'Присмотр') + ': ' + care + ' ч × ' + weeks + ' нед. × ' + fmt(rate) : (wk ? 'Продлёнка' : 'Присмотр');
    $('#c-v2').textContent = fmt(c);
    $('#c-sum').textContent = fmt(a + c);
    if (C.note) $('#c-note').textContent = C.note;
  }
  w.addEventListener('click', e => { const b = e.target.closest('button'); if (b) { opt = +b.dataset.v; draw(); } });
  $('#c-times').addEventListener('click', e => { const b = e.target.closest('button'); if (b) { times = +b.dataset.v; draw(); } });
  $('#c-care').addEventListener('click', e => { const b = e.target.closest('button'); if (b) { care = +b.dataset.v; draw(); } });
  draw();
})();

/* ================= СВЕДЕНИЯ ================= */
function svShow(id) {
  if (!$('.sv-sec[data-sv="' + id + '"]')) id = 'common';
  $$('.sv-sec').forEach(s => s.classList.toggle('on', s.dataset.sv === id));
  $$('#sv-nav a').forEach(a => { const on = a.getAttribute('href') === '#/sveden/' + id; a.classList.toggle('on', on); if (on && innerWidth <= 980) a.scrollIntoView({ inline: 'center', block: 'nearest' }); });
}

/* ================= КАРТА ================= */
const mapBtn = $('#map-on');
if (mapBtn) mapBtn.addEventListener('click', () => {
  const m = $('#map'), f = document.createElement('iframe');
  f.src = 'https://yandex.ru/map-widget/v1/?text=' + encodeURIComponent(S.mapQuery || '') + '&z=17';
  f.title = 'Карта: ' + (S.mapQuery || ''); f.loading = 'lazy'; f.allowFullscreen = true;
  m.appendChild(f); $('.lay', m).style.display = 'none';
});

/* режим проверки: ?qa=1 без анимаций */
if (/[?&]qa=1/.test(location.search)) {
  html.classList.add('nomo'); $$('.rv').forEach(e => e.classList.add('in'));
  window.__bm = { audio: () => ({ ctx: actx && actx.state, clips: Object.keys(abuf).length, playing: playing.length, on: soundOn }), prep: () => audioPrep() };
  const sy = location.search.match(/[?&]sy=(\d+)/), to = location.search.match(/[?&]to=([\w-]+)/);
  setTimeout(() => { if (to) scrollToEl(document.getElementById(to[1]), false); else if (sy) scrollTo(0, +sy[1]); if (/[?&]menu=1/.test(location.search)) menu(true); }, 60);
}

/* ================= СТАРТ ================= */
if (!location.hash) history.replaceState(null, '', '#/');
route();
})();
