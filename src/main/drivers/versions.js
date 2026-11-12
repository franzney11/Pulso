'use strict';
// Compara versiones tipo "560.94" o "6.10.22.311". Devuelve -1, 0 o 1 (o null si falta alguna).
function compareVersions(a, b) {
  if (!a || !b) return null;
  const pa = String(a).match(/\d+/g);
  const pb = String(b).match(/\d+/g);
  if (!pa || !pb) return null;
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const x = Number(pa[i] || 0);
    const y = Number(pb[i] || 0);
    if (x !== y) return x < y ? -1 : 1;
  }
  return 0;
}

module.exports = { compareVersions };
