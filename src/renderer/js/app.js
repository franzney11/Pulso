// Arranque de la interfaz: pide el estado al proceso principal, pinta el menú y la pantalla
// activa, y reparte las lecturas en vivo (una por segundo) a la pantalla abierta.
import { VIEWS } from './views/index.js';
import { html, setHtml } from './dom.js';
import { dot } from './components.js';

const api = window.pulso;
const $ = (id) => document.getElementById(id);
const els = {
  nav: $('nav'), view: $('view'), main: $('main'), machine: $('machine'),
  banners: $('banners'), demo: $('demo-badge'), rescan: $('btn-rescan'), export: $('btn-export'),
};

const HIST_N = 60;
const store = { state: null, hist: { mhz: [], load: [] } };
let current = null; // { view, inst }
const navShown = new Map();

const loading = (msg) => setHtml(els.view, html`<div class="loading"><div><b>${msg}</b><div class="bar"></div></div></div>`);
const fail = (e) => setHtml(els.view, html`<div class="page"><div class="callout callout--bad"><b>Algo ha fallado.</b> ${(e && e.message) || String(e)}</div>
  <p class="note">Si pasa siempre, ejecuta <code>npm run probe</code> en una terminal: guarda un archivo con todo lo que Pulso lee de tu PC.</p></div>`);

function push(arr, v) {
  arr.push(v == null ? null : v);
  if (arr.length > HIST_N) arr.shift();
}

// ---- Menú y cabecera ----------------------------------------------------------------------
function renderNav() {
  const out = [];
  let prev = null;
  for (const v of VIEWS) {
    if (prev !== null && v.group !== prev) out.push(html`<div class="nav-sep"></div>`);
    prev = v.group;
    out.push(html`<button class="nav-item" type="button" data-go="${v.id}"><span>${v.label}</span><span data-nav-dot="${v.id}"></span></button>`);
  }
  setHtml(els.nav, html`${out}`);
  navShown.clear();
}

function updateNavDots() {
  const s = store.state;
  for (const v of VIEWS) {
    const kind = v.dot ? v.dot(s) : null;
    if (navShown.get(v.id) === kind) continue;
    navShown.set(v.id, kind);
    const el = els.nav.querySelector(`[data-nav-dot="${v.id}"]`);
    if (el) setHtml(el, kind ? dot(kind) : html``);
  }
}

function updateNavActive() {
  els.nav.querySelectorAll('.nav-item').forEach((b) => {
    const on = current && b.dataset.go === current.view.id;
    b.classList.toggle('is-active', !!on);
    if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
  });
}

function renderChrome() {
  const s = store.state;
  const sn = s.snapshot;
  setHtml(els.machine, html`<b>${sn.machine.name || 'Este equipo'}</b>${sn.os.caption ? html` · ${sn.os.caption}` : ''}${sn.os.arch ? html` · ${sn.os.arch}` : ''}`);
  els.demo.hidden = !s.demo;

  const notes = (sn.meta.warnings || []).map((w) => html`<div class="callout callout--ice">${w}</div>`);
  if (s.platform !== 'win32' && !s.demo) {
    notes.push(html`<div class="callout callout--ice">Pulso está pensado para Windows. Aquí se usa un recolector genérico y faltan datos (sobre todo discos, RAM y frecuencias reales).</div>`);
  }
  setHtml(els.banners, html`${notes}`);
  updateNavDots();
}

// ---- Pantallas ----------------------------------------------------------------------------
const ctx = {
  hist: store.hist,
  go: (id) => go(id),
  rerender() {
    const top = els.main.scrollTop;
    renderCurrent();
    els.main.scrollTop = top;
  },
  async saveProfile(profile) {
    store.state = await api.saveProfile(profile);
    renderChrome();
  },
  async checkDrivers() {
    store.state = await api.checkDrivers();
    renderChrome();
    ctx.rerender();
  },
};

function renderCurrent() {
  const { view } = current;
  if (current.inst && current.inst.destroy) current.inst.destroy();
  setHtml(els.view, html`<div class="page">${view.render(store.state)}</div>`);
  current.inst = (view.mount && view.mount(els.view, store.state, ctx)) || null;
}

function go(id) {
  const view = VIEWS.find((v) => v.id === id) || VIEWS[0];
  current = { view, inst: null };
  renderCurrent();
  updateNavActive();
  els.main.scrollTop = 0;
}

// ---- Lecturas en vivo ---------------------------------------------------------------------
function onTick({ live, report, session }) {
  const s = store.state;
  if (!s || !current) return;
  s.live = live;
  s.report = report;
  s.session = session;
  const c = live && live.cpu;
  if (c) {
    push(store.hist.mhz, c.maxCoreMHz != null ? c.maxCoreMHz : c.effectiveMHz);
    push(store.hist.load, c.loadPct);
  }
  updateNavDots();
  if (current.inst && current.inst.update) current.inst.update(s);
}

// ---- Eventos ------------------------------------------------------------------------------
document.addEventListener('click', async (e) => {
  const t = e.target.closest('[data-go],[data-open],[data-action]');
  if (!t) return;
  if (t.dataset.go) go(t.dataset.go);
  else if (t.dataset.open) api.openExternal(t.dataset.open);
  else if (t.dataset.action === 'check-drivers') {
    const label = t.textContent;
    t.disabled = true;
    t.textContent = 'Comprobando…';
    try { await ctx.checkDrivers(); } catch (err) { t.textContent = label; t.disabled = false; }
  }
});

els.rescan.addEventListener('click', async () => {
  els.rescan.disabled = true;
  loading('Leyendo el equipo…');
  try {
    store.state = await api.rescan();
    store.hist.mhz.length = 0;
    store.hist.load.length = 0;
    renderChrome();
    ctx.rerender();
  } catch (e) {
    fail(e);
  } finally {
    els.rescan.disabled = false;
  }
});

els.export.addEventListener('click', async () => {
  const label = els.export.textContent;
  const r = await api.exportReport();
  if (r && r.saved) {
    els.export.textContent = 'Informe guardado';
    setTimeout(() => { els.export.textContent = label; }, 2500);
  }
});

// ---- Arranque -----------------------------------------------------------------------------
async function boot() {
  if (!api) {
    loading('Esta pantalla solo funciona dentro de la app Pulso.');
    return;
  }
  document.documentElement.dataset.platform = api.platform;
  renderNav();
  loading('Leyendo el equipo…');
  try {
    store.state = await api.getState();
  } catch (e) {
    fail(e);
    return;
  }
  renderChrome();
  go('resumen');
  api.onTick(onTick);
}

boot();
