// Работа с GitHub через REST API. Ключ доступа (токен) уходит только на api.github.com.
const API = 'https://api.github.com';

export class GitHubError extends Error {
  constructor(status, message, data) { super(message); this.status = status; this.data = data; }
}

export function b64encodeUtf8(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
export function b64decodeUtf8(b64) {
  const bin = atob(String(b64).replace(/\s/g, ''));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}
const encPath = p => String(p).split('/').map(encodeURIComponent).join('/');

function explain(status, msg) {
  if (status === 401) return 'Ключ доступа не подходит: он неверный, отозван или истёк. Выпустите новый.';
  if (status === 403 && /rate limit/i.test(msg)) return 'GitHub временно ограничил запросы. Подождите несколько минут.';
  if (status === 403) return 'У ключа нет прав на это действие. Нужно разрешение Contents: Read and write для этого репозитория.';
  if (status === 404) return 'Не найдено. Проверьте название репозитория и то, что ключ выдан именно на него.';
  if (status === 409) return 'Конфликт версий в репозитории. Обновите страницу.';
  if (status === 422) return 'GitHub отклонил изменения: ' + msg;
  return 'GitHub ответил ошибкой ' + status + ': ' + msg;
}

export class GitHub {
  constructor({ token, repo, branch }) {
    this.token = token; this.repo = repo; this.branch = branch || 'main'; this.tokenExpires = null; this.mock = false;
  }
  async req(method, path, body, { raw = false, accept } = {}) {
    let res;
    try {
      res = await fetch(API + path, {
        method,
        headers: {
          Authorization: 'Bearer ' + this.token,
          Accept: accept || (raw ? 'application/vnd.github.raw+json' : 'application/vnd.github+json'),
          'X-GitHub-Api-Version': '2022-11-28',
          ...(body ? { 'Content-Type': 'application/json' } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
        cache: 'no-store',
      });
    } catch (e) { throw new GitHubError(0, 'Нет связи с GitHub. Проверьте интернет.'); }
    const exp = res.headers.get('github-authentication-token-expiration');
    if (exp) this.tokenExpires = exp;
    if (res.status === 204) return null;
    const text = await res.text();
    let data = text;
    if (!raw) { try { data = text ? JSON.parse(text) : null; } catch (e) { } }
    if (!res.ok) throw new GitHubError(res.status, explain(res.status, (data && data.message) || text || res.statusText), data);
    return data;
  }
  get r() { return '/repos/' + this.repo; }
  user() { return this.req('GET', '/user'); }
  repoInfo() { return this.req('GET', this.r); }
  async headSha() { return (await this.req('GET', this.r + '/git/ref/heads/' + encodeURIComponent(this.branch))).object.sha; }
  readText(path, ref) { return this.req('GET', this.r + '/contents/' + encPath(path) + '?ref=' + encodeURIComponent(ref || this.branch), null, { raw: true }); }
  async listDir(path) {
    try { const d = await this.req('GET', this.r + '/contents/' + encPath(path) + '?ref=' + encodeURIComponent(this.branch)); return Array.isArray(d) ? d.filter(x => x.type === 'file').map(x => ({ name: x.name, path: x.path, size: x.size })) : []; }
    catch (e) { if (e.status === 404) return []; throw e; }
  }
  commits(path, perPage = 40) { return this.req('GET', this.r + '/commits?sha=' + encodeURIComponent(this.branch) + '&path=' + encodeURIComponent(path) + '&per_page=' + perPage); }
  async pagesStatus() { try { return await this.req('GET', this.r + '/pages/builds/latest'); } catch (e) { return null; } }
  async pagesInfo() { try { return await this.req('GET', this.r + '/pages'); } catch (e) { return null; } }
  // Один коммит из нескольких файлов: [{path, text} | {path, base64} | {path, delete:true}]
  async commitFiles(files, message, expectedHead, onStep) {
    const head = await this.headSha();
    if (expectedHead && head !== expectedHead) {
      const e = new GitHubError(409, 'После того как вы открыли админку, сайт уже меняли (с другого устройства или вкладки).');
      e.conflict = true; e.head = head; throw e;
    }
    const commit = await this.req('GET', this.r + '/git/commits/' + head);
    const tree = [];
    let i = 0;
    for (const f of files) {
      if (f.delete) { tree.push({ path: f.path, mode: '100644', type: 'blob', sha: null }); continue; }
      const blob = await this.req('POST', this.r + '/git/blobs', { content: f.text !== undefined ? b64encodeUtf8(f.text) : f.base64, encoding: 'base64' });
      tree.push({ path: f.path, mode: '100644', type: 'blob', sha: blob.sha });
      if (onStep) onStep(++i, files.length, f.path);
    }
    const newTree = await this.req('POST', this.r + '/git/trees', { base_tree: commit.tree.sha, tree });
    const newCommit = await this.req('POST', this.r + '/git/commits', { message, tree: newTree.sha, parents: [head] });
    await this.req('PATCH', this.r + '/git/refs/heads/' + encodeURIComponent(this.branch), { sha: newCommit.sha, force: false });
    return newCommit.sha;
  }
}

/* ---------- Тестовый режим без GitHub: только на localhost, ?mock=1 ---------- */
export class MockGitHub {
  constructor() {
    this.repo = 'test/burymishka'; this.branch = 'main'; this.tokenExpires = null; this.mock = true;
    this.sha = 'mock000'; this.n = 0; this.files = {}; this.log = [];
  }
  async user() { return { login: 'test', name: 'Тестовый режим' }; }
  async repoInfo() { return { full_name: this.repo, default_branch: 'main', permissions: { push: true }, html_url: '#' }; }
  async headSha() { return this.sha; }
  async readText(path, ref) {
    if (ref && ref !== this.sha) { const l = this.log.find(x => x.sha === ref); if (l && l.snap[path] !== undefined) return l.snap[path]; }
    if (ref !== 'mock000' && this.files[path] !== undefined) return this.files[path];
    const r = await fetch('../' + path, { cache: 'no-store' }); if (!r.ok) throw new GitHubError(404, 'нет файла ' + path); return r.text();
  }
  async listDir(path) {
    try {
      const html = await (await fetch('../' + path + '/', { cache: 'no-store' })).text();
      const list = [...html.matchAll(/href="([^"?/]+\.[\w]+)"/gi)].map(m => decodeURIComponent(m[1])).map(n => ({ name: n, path: path + '/' + n, size: 0 }));
      Object.keys(this.files).filter(p => p.startsWith(path + '/')).forEach(p => { if (!list.some(x => x.path === p)) list.push({ name: p.slice(path.length + 1), path: p, size: 0 }); });
      return list;
    } catch (e) { return []; }
  }
  async commits() {
    return this.log.map(l => ({ sha: l.sha, commit: { message: l.message, author: { name: 'test', date: l.date } }, html_url: '#' })).reverse()
      .concat([{ sha: 'mock000', commit: { message: 'Исходная версия', author: { name: 'test', date: new Date(Date.now() - 864e5).toISOString() } }, html_url: '#' }]);
  }
  async pagesStatus() { return { status: 'built' }; }
  async pagesInfo() { return { html_url: '../' }; }
  async commitFiles(files, message, expectedHead, onStep) {
    if (expectedHead && expectedHead !== this.sha) { const e = new GitHubError(409, 'Конфликт (тест)'); e.conflict = true; throw e; }
    const snap = {};
    let i = 0;
    for (const f of files) { if (f.text !== undefined) { this.files[f.path] = f.text; snap[f.path] = f.text; } else if (f.base64) this.files[f.path] = '[binary]'; if (onStep) onStep(++i, files.length, f.path); await new Promise(r => setTimeout(r, 30)); }
    this.sha = 'mock' + String(++this.n).padStart(3, '0');
    this.log.push({ sha: this.sha, message, date: new Date().toISOString(), files: files.map(f => f.path), snap });
    window.__mockCommits = this.log;
    return this.sha;
  }
}
