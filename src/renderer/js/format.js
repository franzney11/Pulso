// Formato de números y unidades en español (coma decimal, espacio antes de %, °C…).
const cache = new Map();
export function nf(n, digits = 0) {
  if (n == null || !Number.isFinite(Number(n))) return '—';
  let f = cache.get(digits);
  if (!f) {
    f = new Intl.NumberFormat('es-ES', { minimumFractionDigits: digits, maximumFractionDigits: digits });
    cache.set(digits, f);
  }
  return f.format(Number(n));
}

// 3600 → "3,6"   4550 → "4,55"   (un decimal si es redondo a 100 MHz)
export const gnum = (mhz) => (mhz == null ? '—' : nf(mhz / 1000, mhz % 100 === 0 ? 1 : 2));
export const ghz = (mhz) => (mhz == null ? '—' : `${gnum(mhz)} GHz`);
export const ghzRange = (a, b) => (a == null || b == null ? '—' : `${gnum(a)} – ${gnum(b)} GHz`);
export const mhzTxt = (mhz) => (mhz == null ? '—' : `${nf(mhz)} MHz`);
export const deg = (c) => (c == null ? '—' : `${nf(c)} °C`);
export const watts = (w) => (w == null ? '—' : `${nf(w)} W`);
export const volts = (v) => (v == null ? '—' : `${nf(v, 3)} V`);
export const rpm = (v) => (v == null ? '—' : `${nf(v)} RPM`);
export const pct = (v) => (v == null ? '—' : `${nf(v)} %`);

export function mem(mb) {
  if (mb == null) return '—';
  return mb >= 1024 ? `${nf(mb / 1024, mb % 1024 === 0 ? 0 : 1)} GB` : `${nf(mb)} MB`;
}

export function diskSize(gb) {
  if (!gb) return '—';
  return gb >= 1000 ? `${nf(gb / 1000, gb % 1000 === 0 ? 0 : 2)} TB` : `${nf(gb)} GB`;
}

export function fmtDate(v) {
  if (!v) return '';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
}

export const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
export const ratio = (n, max) => (n == null || !max ? 0 : clamp((n / max) * 100, 0, 100));
