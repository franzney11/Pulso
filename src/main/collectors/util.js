'use strict';
// Utilidades pequeñas compartidas por los recolectores.

const asArray = (v) => (v == null ? [] : Array.isArray(v) ? v : [v]);
const clean = (s) => (s == null ? '' : String(s).replace(/\s+/g, ' ').trim());
const num = (v) => {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

// Código SMBIOS de tipo de memoria → nombre.
const MEMORY_TYPES = {
  18: 'DDR', 19: 'DDR2', 24: 'DDR3', 26: 'DDR4', 27: 'LPDDR', 28: 'LPDDR2',
  29: 'LPDDR3', 30: 'LPDDR4', 34: 'DDR5', 35: 'LPDDR5',
};

// Algunos módulos reportan el fabricante como código JEDEC en hexadecimal.
const JEDEC = {
  '029E': 'Corsair', '0198': 'Kingston', '04CD': 'G.Skill', '859B': 'Crucial',
  '80CE': 'Samsung', '80AD': 'SK hynix', '802C': 'Micron', '04CB': 'ADATA',
};
function memoryVendor(raw) {
  const v = clean(raw);
  return JEDEC[v.toUpperCase()] || v;
}

// Windows guarda la versión del driver NVIDIA como 32.0.15.6094; la que ves en
// la web y en GeForce Experience es 560.94 (los 5 últimos dígitos, con punto tras el tercero).
function nvidiaUserVersion(winVersion) {
  const digits = String(winVersion || '').replace(/\./g, '');
  if (digits.length < 5) return null;
  const last5 = digits.slice(-5);
  return `${last5.slice(0, 3)}.${last5.slice(3)}`;
}

// "AMD Ryzen 5 5500 6-Core Processor" → "AMD Ryzen 5 5500"
function cleanCpuName(raw) {
  return clean(
    clean(raw)
      .replace(/\((R|TM)\)/gi, '')
      .replace(/\s*@\s*[\d.]+\s*GHz/i, '')
      .replace(/\b\d+(st|nd|rd|th) Gen\b/i, '')
      .replace(/\b\d+-Core\b/i, '')
      .replace(/\bProcessor\b/i, '')
      .replace(/\bCPU\b/i, '')
  );
}

// El nombre de la placa suele llevar el formato pegado al chipset: «B450M PRO-M2 MAX», «B550I AORUS», «B650M».
const CHIPSET_RE = /\b(A320|B350|X370|B450|X470|A520|B550|X570|A620|B650E?|X670E?|X870E?|B840|B850|H310|B360|H370|Z370|Z390|B460|H410|Z490|H510|B560|Z590|H610|B660|H670|Z690|B760|Z790|H810|B860|Z890)[MI]?(?![A-Z0-9])/i;
function chipsetFromBoard(product) {
  const m = CHIPSET_RE.exec(String(product || ''));
  return m ? m[1].toUpperCase() : null;
}

function shortBoardVendor(raw) {
  const v = clean(raw);
  if (/micro-star|\bmsi\b/i.test(v)) return 'MSI';
  if (/asustek|asus/i.test(v)) return 'ASUS';
  if (/gigabyte/i.test(v)) return 'Gigabyte';
  if (/asrock/i.test(v)) return 'ASRock';
  if (/biostar/i.test(v)) return 'Biostar';
  return v;
}

// PowerShell 5.1 serializa fechas como "\/Date(1700000000000)\/"; PowerShell 7 usa ISO.
function toIsoDate(v) {
  if (!v) return null;
  const s = String(v);
  const m = /Date\((-?\d+)\)/.exec(s);
  if (m) return new Date(Number(m[1])).toISOString().slice(0, 10);
  const iso = /^(\d{4}-\d{2}-\d{2})/.exec(s);
  return iso ? iso[1] : null;
}

module.exports = {
  asArray, clean, num, clamp, MEMORY_TYPES, memoryVendor, nvidiaUserVersion,
  cleanCpuName, chipsetFromBoard, shortBoardVendor, toIsoDate,
};
