# Notas para trabajar en Pulso

App Electron (JS sin frameworks) que analiza el hardware de un PC con Windows. Ver `README.md` para qué hace.

## Comandos
- `npm test` — tests con fixtures (`node --test`, sin argumentos: Node 22 no admite una carpeta).
- `npm run start:demo` / `--demo-oc` — datos de ejemplo; es lo que se puede ejecutar fuera de Windows.
- `npm run probe` — vuelca lo que lee de la máquina a `pulso-probe.json`.

## Qué está validado y qué no
- Validado: tests, interfaz en modo demo, el `app.asar` empaquetado arranca bajo Electron/Linux.
- NO validado en un Windows real: `collectors/windows.js` (PowerShell/WMI), `lhm.js` (formato de LibreHardwareMonitor) y la consulta de NVIDIA (la API `gfwsl.geforce.com` no es oficial y está bloqueada desde el sandbox de Claude). Si el usuario pasa un `pulso-probe.json` o un informe exportado, ajustar los parsers con eso.

## Compilar los .exe desde Linux (sandbox)
Hace falta Wine con 32 bits (el desinstalador de NSIS es de 32 bits) y un display virtual:
`dpkg --add-architecture i386 && apt-get update && apt-get install -y --no-install-recommends wine wine64 wine32:i386`
`WINEDEBUG=-all xvfb-run -a npm run dist`
`build.publish` es `null` a propósito: sin repositorio Git, electron-builder falla al generar el fichero de actualizaciones. En Windows/GitHub Actions no hace falta nada de esto.

## Convenciones
- Interfaz y textos en español, tono directo; nada de inventar datos: si no hay lectura, se dice.
- El diagnóstico de overclock son reglas explícitas (`analysis/overclock.js`), no IA.
