'use strict';
// Diagnóstico: `npm run probe`
// Recoge TODO lo que Pulso lee de tu PC (datos crudos incluidos) y lo guarda en pulso-probe.json.
// Si algo sale mal en tu equipo, este archivo es lo que hay que revisar para arreglarlo.
// Ojo: incluye el nombre de tu PC y la lista de hardware. Míralo antes de compartirlo.
const fs = require('node:fs');
const path = require('node:path');

const windows = require('../src/main/collectors/windows');
const { runJson } = require('../src/main/collectors/powershell');
const nvidiaSmi = require('../src/main/collectors/nvidia-smi');
const lhm = require('../src/main/collectors/lhm');
const { collectSnapshot, DEFAULT_LHM_URL } = require('../src/main/collectors');
const { checkDrivers } = require('../src/main/drivers');
const { buildReport } = require('../src/main/analysis/report');

const step = (msg) => console.log(`\n▸ ${msg}`);

(async () => {
  const out = { generatedAt: new Date().toISOString(), platform: process.platform, node: process.version };

  if (process.platform === 'win32') {
    step('Consultando WMI con PowerShell (datos crudos)…');
    try { out.raw = await runJson(windows.STATIC_SCRIPT); console.log('  ok'); }
    catch (e) { out.rawError = e.message; console.log('  FALLÓ:', e.message); }
  } else {
    console.log('Aviso: no estás en Windows; se usará el recolector genérico (menos datos).');
  }

  step('Normalizando el equipo…');
  out.snapshot = await collectSnapshot({});
  const s = out.snapshot;
  console.log(`  CPU:   ${s.cpu.name}  (${s.cpu.cores}C/${s.cpu.threads}T)  ficha en la base de datos: ${s.cpu.spec ? 'sí' : 'NO'}`);
  console.log(`  GPU:   ${s.gpus.map((g) => `${g.name} ${g.driverVersion || ''}`).join(' | ') || '—'}`);
  console.log(`  RAM:   ${s.memory.modules.map((m) => `${m.capacityMB / 1024}GB ${m.type || ''} ${m.configuredMHz}/${m.ratedMHz} MHz`).join(' + ') || '—'}`);
  console.log(`  Placa: ${s.board.manufacturer} ${s.board.model}  (chipset ${s.board.chipset || '?'})`);
  console.log(`  Discos: ${s.disks.map((d) => `${d.name} [${d.type}]`).join(' | ') || '—'}`);

  step('nvidia-smi…');
  out.nvidiaSmi = await nvidiaSmi.query();
  console.log(out.nvidiaSmi ? '  ok' : '  no disponible (normal si no tienes GPU NVIDIA)');

  step(`LibreHardwareMonitor (${DEFAULT_LHM_URL})…`);
  out.lhm = await lhm.fetchSensors(DEFAULT_LHM_URL);
  console.log(out.lhm.available ? `  ok, ${out.lhm.items.length} sensores` : `  no disponible (${out.lhm.error || 'sin datos'})`);
  try { out.lhmRaw = await (await fetch(DEFAULT_LHM_URL, { signal: AbortSignal.timeout(1500) })).json(); } catch { /* opcional */ }

  step('Lecturas en vivo de la CPU (5 muestras)…');
  out.liveCpu = await new Promise((resolve) => {
    const samples = [];
    const src = process.platform === 'win32' ? windows : require('../src/main/collectors/generic');
    const stream = src.streamCpu((c) => {
      samples.push(c);
      if (samples.length >= 5) { stream.stop(); resolve(samples); }
    }, () => resolve(samples));
    setTimeout(() => { stream.stop(); resolve(samples); }, 15000);
  });
  out.liveCpu.forEach((c, i) => console.log(`  #${i + 1}: efectiva ${c.effectiveMHz} MHz, núcleo más alto ${c.maxCoreMHz} MHz, carga ${c.loadPct}%`));

  step('Drivers…');
  out.drivers = await checkDrivers({ snapshot: s });
  out.drivers.forEach((d) => console.log(`  ${d.component}: instalado ${d.installed || '—'}  último ${d.latest || '—'}  [${d.status}]${d.note ? '  ' + d.note : ''}`));

  step('Informe…');
  const peak = Math.max(0, ...out.liveCpu.map((c) => c.maxCoreMHz || 0)) || null;
  out.report = buildReport({ snapshot: s, profile: {}, session: { peakCpuMHz: peak, maxLoadPct: Math.max(0, ...out.liveCpu.map((c) => c.loadPct || 0)) }, drivers: out.drivers });
  console.log(`  OC CPU: ${out.report.cpuOc.status}   OC RAM: ${out.report.ramOc.overall}   Veredicto: ${out.report.overclock.title}`);

  const file = path.join(process.cwd(), 'pulso-probe.json');
  fs.writeFileSync(file, JSON.stringify(out, null, 2));
  console.log(`\nGuardado en ${file}`);
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
