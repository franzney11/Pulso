'use strict';
// Busca la CPU en la base de datos de especificaciones (data/cpus.json) a partir del
// nombre que reporta Windows.
const { cpus } = require('../data/cpus.json');

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function normalize(name) {
  return (
    ' ' +
    String(name || '')
      .toLowerCase()
      .replace(/\((r|tm)\)/g, '')
      .replace(/@\s*[\d.]+\s*ghz/g, '')
      .replace(/\b\d+(st|nd|rd|th) gen\b/g, '')
      .replace(/\b\d+-core\b/g, '')
      .replace(/\b(amd|intel|core|processor|cpu)\b/g, ' ')
      .replace(/\s+/g, ' ')
      .trim() +
    ' '
  );
}

// Devuelve la ficha de la CPU o null. Gana el modelo más largo que encaje, y el carácter
// siguiente no puede ser alfanumérico (así "5600" no confunde "5600X" ni "5500U").
function lookupCpu(name) {
  const hay = normalize(name);
  let best = null;
  for (const spec of cpus) {
    const re = new RegExp(`(^|[^a-z0-9])${escapeRe(spec.model.toLowerCase())}($|[^a-z0-9])`);
    if (re.test(hay) && (!best || spec.model.length > best.model.length)) best = spec;
  }
  return best;
}

// Si la CPU no está en la base de datos, se intenta adivinar si el multiplicador está desbloqueado.
function inferUnlocked(name, vendor) {
  const n = String(name || '');
  if (/intel/i.test(vendor) || /\bi[3579]-\d{4,5}/i.test(n)) {
    return /\bi[3579]-\d{4,5}(K|KF|KS|X|XE)\b/i.test(n) ? true : false;
  }
  if (/ryzen/i.test(n)) return /X3D/i.test(n) ? false : true;
  return null;
}

module.exports = { lookupCpu, inferUnlocked, normalize };
