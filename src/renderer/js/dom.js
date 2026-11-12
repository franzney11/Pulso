// Utilidades de DOM. Todo lo que viene del hardware (nombres, versiones…) se escapa: la
// interfaz solo pinta HTML a través de html``, que escapa cualquier valor interpolado
// salvo que ya sea HTML seguro creado por otra plantilla html``.
const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

class Raw {
  constructor(s) { this.s = s; }
  toString() { return this.s; }
}
export const raw = (s) => new Raw(s);

const part = (v) => {
  if (v instanceof Raw) return v.s;
  if (Array.isArray(v)) return v.map(part).join('');
  if (v == null || v === false) return '';
  return esc(v);
};

export function html(strings, ...values) {
  let out = strings[0];
  values.forEach((v, i) => { out += part(v) + strings[i + 1]; });
  return new Raw(out);
}

export const setHtml = (el, tpl) => { el.innerHTML = tpl instanceof Raw ? tpl.s : esc(tpl); };

// --- Actualización de lecturas en vivo sin volver a pintar la vista -----------------
const find = (root, key) => root.querySelector(`[data-k="${key}"]`);

export function setText(root, key, text) {
  const el = find(root, key);
  const t = String(text ?? '');
  if (el && el.textContent !== t) el.textContent = t;
}

export function setWidth(root, key, pct) {
  const el = find(root, key);
  if (!el) return;
  const w = `${Math.max(0, Math.min(100, Number(pct) || 0)).toFixed(1)}%`;
  if (el.style.width !== w) el.style.width = w;
}

export function setAttr(root, key, name, value) {
  const el = find(root, key);
  if (el && el.getAttribute(name) !== String(value)) el.setAttribute(name, value);
}

export function setClass(root, key, cls, on) {
  const el = find(root, key);
  if (el) el.classList.toggle(cls, !!on);
}
