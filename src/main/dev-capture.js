'use strict';
// Solo para desarrollo: guarda una captura de cada pantalla y cierra la app.
//   PULSO_CAPTURE=capturas npm run start:demo        (opcional: PULSO_CAPTURE_VIEWS=cpu,memoria)
// No se usa en el uso normal: main.js solo lo carga si existe la variable PULSO_CAPTURE.
const fs = require('node:fs');
const path = require('node:path');

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

module.exports = async function capture(win, dir, only = []) {
  fs.mkdirSync(dir, { recursive: true });
  const js = (code) => win.webContents.executeJavaScript(code);

  for (let i = 0; i < 60; i++) {
    if (await js("!!document.querySelector('.ledger')")) break;
    await wait(500);
  }
  await wait(4500); // deja que lleguen varias lecturas en vivo

  const ids = only.length ? only : await js("[...document.querySelectorAll('#nav .nav-item')].map((b) => b.dataset.go)");
  for (const id of ids) {
    await js(`document.querySelector('#nav .nav-item[data-go="${id}"]').click()`);
    await wait(1700);
    const img = await win.webContents.capturePage();
    fs.writeFileSync(path.join(dir, `${id}.png`), img.toPNG());
    console.log(`captura: ${id}`);
  }
};
