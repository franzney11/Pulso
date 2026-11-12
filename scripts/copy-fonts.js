'use strict';
// Copia las fuentes (woff2, solo alfabeto latino: sirve para español) desde node_modules a
// src/renderer/fonts y genera fonts.css. Las fuentes viajan dentro de la app: no hace falta internet.
// Uso: npm run fonts   (ya está hecho y subido al repositorio; solo sirve para regenerarlas)
const fs = require('node:fs');
const path = require('node:path');

const OUT = path.join(__dirname, '..', 'src', 'renderer', 'fonts');
const FONTS = [
  { pkg: 'saira-semi-condensed', family: 'Saira Semi Condensed', weights: [400, 500, 600, 700] },
  { pkg: 'hanken-grotesk', family: 'Hanken Grotesk', weights: [400, 500, 600, 700] },
];

fs.mkdirSync(OUT, { recursive: true });
let css = '/* Generado por scripts/copy-fonts.js. Fuentes bajo licencia SIL OFL 1.1 (ver @fontsource). */\n';
for (const f of FONTS) {
  for (const w of f.weights) {
    const file = `${f.pkg}-latin-${w}-normal.woff2`;
    const src = path.join(__dirname, '..', 'node_modules', '@fontsource', f.pkg, 'files', file);
    fs.copyFileSync(src, path.join(OUT, file));
    css += `@font-face{font-family:'${f.family}';font-style:normal;font-weight:${w};font-display:swap;src:url('${file}') format('woff2');}\n`;
  }
}
fs.writeFileSync(path.join(OUT, 'fonts.css'), css);
console.log(`Fuentes copiadas en ${OUT}`);
