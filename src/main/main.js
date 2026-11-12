'use strict';
const { app, BrowserWindow, ipcMain, shell, dialog, Menu } = require('electron');
const path = require('node:path');
const fs = require('node:fs');

const { collectSnapshot, startLive, DEFAULT_LHM_URL } = require('./collectors');
const { buildReport } = require('./analysis/report');
const { cpuTempFrom } = require('./analysis/sensors');
const { checkDrivers } = require('./drivers');

// Opciones de línea de comandos:  --demo  --demo-oc (demo con CPU overclockeada)  --dev (abre DevTools)
const ARGV = process.argv;
const DEMO = ARGV.includes('--demo') || ARGV.includes('--demo-oc') || process.env.PULSO_DEMO === '1';
const DEMO_OC = ARGV.includes('--demo-oc');
const DEV = ARGV.includes('--dev');

// En la versión portable los datos se guardan junto al .exe; si no, en %APPDATA%.
const dataDir = process.env.PORTABLE_EXECUTABLE_DIR
  ? path.join(process.env.PORTABLE_EXECUTABLE_DIR, 'pulso-data')
  : app.getPath('userData');
const profilePath = path.join(dataDir, 'profile.json');
const driversCachePath = path.join(dataDir, 'drivers-cache.json');
const DRIVERS_TTL_MS = 3 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Perfil "Mi equipo": lo que Windows no puede saber (disipador, fuente, caja)
// ---------------------------------------------------------------------------
const DEFAULT_PROFILE = { cooler: '', coolerType: '', psuWatts: null, psuModel: '', pcCase: '', lhmUrl: DEFAULT_LHM_URL };
const DEMO_PROFILE = {
  cooler: 'AMD Wraith Stealth (de caja)', coolerType: 'stock', psuWatts: 650,
  psuModel: 'Nox 650 W (80+ Bronze)', pcCase: 'MSI MAG Forge M100R', lhmUrl: DEFAULT_LHM_URL,
};

function sanitizeProfile(p = {}) {
  const watts = Number(p.psuWatts);
  let lhmUrl = DEFAULT_LHM_URL;
  try {
    const u = new URL(String(p.lhmUrl || DEFAULT_LHM_URL));
    // Solo equipos locales: evita que la app haga peticiones a sitios arbitrarios.
    if (u.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(u.hostname)) lhmUrl = u.toString();
  } catch { /* se queda la URL por defecto */ }
  return {
    cooler: String(p.cooler || '').trim().slice(0, 80),
    coolerType: ['stock', 'tower', 'aio'].includes(p.coolerType) ? p.coolerType : '',
    psuWatts: Number.isFinite(watts) && watts >= 150 && watts <= 2000 ? Math.round(watts) : null,
    psuModel: String(p.psuModel || '').trim().slice(0, 80),
    pcCase: String(p.pcCase || '').trim().slice(0, 80),
    lhmUrl,
  };
}

function loadProfile() {
  if (DEMO) return { ...DEMO_PROFILE };
  try {
    return sanitizeProfile(JSON.parse(fs.readFileSync(profilePath, 'utf8')));
  } catch {
    return { ...DEFAULT_PROFILE };
  }
}

function persistProfile(profile) {
  if (DEMO) return;
  try {
    fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(profilePath, JSON.stringify(profile, null, 2));
  } catch (e) {
    console.error('No se pudo guardar el perfil:', e.message);
  }
}

// ---------------------------------------------------------------------------
// Estado de la sesión
// ---------------------------------------------------------------------------
const state = {
  snapshot: null,
  live: null,
  drivers: [],
  profile: loadProfile(),
  // Lo que se va viendo mientras la app está abierta. Alimenta la detección de overclock.
  session: { peakCpuMHz: null, maxLoadPct: 0, maxCpuTempLoadedC: null },
  prevCoreMax: null,
  live$: null,
};
let win = null;
let scanPromise = null;

const makeReport = () =>
  buildReport({ snapshot: state.snapshot, live: state.live, profile: state.profile, session: state.session, drivers: state.drivers });

const fullState = () => ({
  snapshot: state.snapshot,
  live: state.live,
  report: makeReport(),
  profile: state.profile,
  session: state.session,
  demo: DEMO,
  demoOc: DEMO_OC,
  platform: process.platform,
  appVersion: app.getVersion(),
});

function onTick(live) {
  state.live = live;
  const s = state.session;
  if (live.cpu) {
    // El pico solo cuenta si se mantiene al menos 2 muestras seguidas: así un valor
    // espurio de una sola lectura no dispara un falso "overclock detectado".
    const cur = live.cpu.maxCoreMHz != null ? live.cpu.maxCoreMHz : live.cpu.effectiveMHz;
    if (cur != null) {
      if (state.prevCoreMax != null) {
        const pair = Math.min(cur, state.prevCoreMax);
        if (s.peakCpuMHz == null || pair > s.peakCpuMHz) s.peakCpuMHz = pair;
      }
      state.prevCoreMax = cur;
    }
    if (live.cpu.loadPct != null) s.maxLoadPct = Math.max(s.maxLoadPct, live.cpu.loadPct);
    const temp = cpuTempFrom(live.sensors);
    if (temp != null && live.cpu.loadPct >= 60) s.maxCpuTempLoadedC = Math.max(s.maxCpuTempLoadedC || 0, temp);
  }
  if (win && !win.isDestroyed()) win.webContents.send('pulso:tick', { live, report: makeReport(), session: s });
}

async function refreshDrivers({ force = false } = {}) {
  if (!state.snapshot) return;
  if (!force && !DEMO) {
    try {
      const cached = JSON.parse(fs.readFileSync(driversCachePath, 'utf8'));
      if (Date.now() - cached.ts < DRIVERS_TTL_MS && cached.gpuKey === state.snapshot.gpus.map((g) => g.driverVersion).join()) {
        state.drivers = cached.rows;
        return;
      }
    } catch { /* sin caché válida */ }
  }
  state.drivers = await checkDrivers({ snapshot: state.snapshot, demo: DEMO });
  if (!DEMO) {
    try {
      fs.mkdirSync(dataDir, { recursive: true });
      fs.writeFileSync(driversCachePath, JSON.stringify({ ts: Date.now(), gpuKey: state.snapshot.gpus.map((g) => g.driverVersion).join(), rows: state.drivers }));
    } catch { /* la caché es opcional */ }
  }
}

async function scan() {
  state.snapshot = await collectSnapshot({ demo: DEMO });
  if (!state.live$) {
    state.live$ = startLive({ demo: DEMO, demoOc: DEMO_OC, getProfile: () => state.profile, onTick });
  }
  refreshDrivers().catch((e) => console.error('Drivers:', e.message));
  return fullState();
}

// ---------------------------------------------------------------------------
// Ventana
// ---------------------------------------------------------------------------
function createWindow() {
  const isWin = process.platform === 'win32';
  win = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 1080,
    minHeight: 700,
    backgroundColor: '#12161c',
    show: false,
    title: 'Pulso',
    icon: path.join(__dirname, '..', 'renderer', 'assets', 'icon.png'),
    ...(isWin ? { titleBarStyle: 'hidden', titleBarOverlay: { color: '#12161c', symbolColor: '#e8e6df', height: 40 } } : {}),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  win.once('ready-to-show', () => win.show());
  win.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (e) => e.preventDefault());
  if (DEV) win.webContents.openDevTools({ mode: 'detach' });
}

// ---------------------------------------------------------------------------
// IPC
// ---------------------------------------------------------------------------
ipcMain.handle('pulso:get-state', async () => {
  if (!scanPromise) scanPromise = scan();
  await scanPromise;
  return fullState();
});

ipcMain.handle('pulso:rescan', async () => {
  scanPromise = scan();
  return scanPromise;
});

ipcMain.handle('pulso:save-profile', (_e, incoming) => {
  state.profile = sanitizeProfile(incoming);
  persistProfile(state.profile);
  return fullState();
});

ipcMain.handle('pulso:check-drivers', async () => {
  await refreshDrivers({ force: true });
  return fullState();
});

ipcMain.handle('pulso:open-external', (_e, url) => {
  try {
    const u = new URL(String(url));
    if (u.protocol === 'https:') return shell.openExternal(u.toString());
  } catch { /* URL inválida */ }
  return false;
});

ipcMain.handle('pulso:export-report', async () => {
  const stamp = new Date().toISOString().slice(0, 10);
  const { filePath, canceled } = await dialog.showSaveDialog(win, {
    title: 'Guardar informe',
    defaultPath: `pulso-informe-${stamp}.json`,
    filters: [{ name: 'JSON', extensions: ['json'] }],
  });
  if (canceled || !filePath) return { saved: false };
  const payload = { generadoEl: new Date().toISOString(), app: `Pulso ${app.getVersion()}`, ...fullState() };
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2));
  return { saved: true, filePath };
});

// ---------------------------------------------------------------------------
// Ciclo de vida
// ---------------------------------------------------------------------------
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (win) { if (win.isMinimized()) win.restore(); win.focus(); }
  });
  app.whenReady().then(() => {
    Menu.setApplicationMenu(null);
    createWindow();
    if (process.env.PULSO_CAPTURE) {
      // Herramienta de desarrollo (ver dev-capture.js): captura cada pantalla y sale.
      require('./dev-capture')(win, process.env.PULSO_CAPTURE, (process.env.PULSO_CAPTURE_VIEWS || '').split(',').filter(Boolean))
        .then(() => app.quit())
        .catch((e) => { console.error(e); app.exit(1); });
    }
    app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
  });
  app.on('window-all-closed', () => {
    if (state.live$) state.live$.stop();
    app.quit();
  });
}
