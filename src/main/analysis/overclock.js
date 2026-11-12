'use strict';
// Detección de overclock y estimación de margen. Todo son reglas explícitas (sin IA):
// cada veredicto lista los factores que lo causan para que se pueda discutir y mejorar.

const TOL = 0.025; // la frecuencia en vivo oscila: 2,5 % de margen antes de hablar de OC

const fmtMHz = (mhz) => `${(mhz / 1000).toFixed(2).replace('.', ',')} GHz`;

// ---------------------------------------------------------------------------
// ¿Está overclockeada? CPU
// ---------------------------------------------------------------------------
// Compara el pico de frecuencia medido en esta sesión con el boost oficial de la ficha.
// Limitación conocida: sin driver de kernel no vemos voltajes ni el multiplicador; solo la
// frecuencia efectiva. Un OC a un valor por debajo del boost de fábrica no se detecta.
function detectCpuOc(cpu, session = {}) {
  const spec = cpu.spec || null;
  const baseMHz = spec ? spec.baseMHz : cpu.reportedBaseMHz || null;
  const boostMHz = spec ? spec.boostMHz : null;
  const peakMHz = session.peakCpuMHz != null ? session.peakCpuMHz : null;
  const loaded = (session.maxLoadPct || 0) >= 50;
  const reasons = [];
  let status = 'unknown';
  let confidence = 'none';

  if (!spec) {
    reasons.push('Esta CPU no está en la base de datos de Pulso, así que no hay referencia de fábrica con la que comparar.');
  } else if (peakMHz == null) {
    reasons.push('Esperando las primeras lecturas en vivo.');
  } else if (peakMHz > boostMHz * (1 + TOL)) {
    status = 'oc';
    confidence = 'high';
    reasons.push(`Se ha medido ${fmtMHz(peakMHz)}, ${fmtMHz(peakMHz - boostMHz)} por encima del boost oficial (${fmtMHz(boostMHz)}).`);
  } else {
    status = 'stock';
    confidence = loaded ? 'high' : 'low';
    reasons.push(
      loaded
        ? `El pico medido (${fmtMHz(peakMHz)}) está dentro del boost oficial (${fmtMHz(boostMHz)}).`
        : `El pico medido (${fmtMHz(peakMHz)}) es normal, pero la CPU aún no ha trabajado a fondo. Ponla a rendir (un juego o un benchmark) para confirmarlo.`
    );
  }

  return {
    status, confidence, baseMHz, boostMHz, peakMHz,
    deltaMHz: spec && peakMHz != null ? Math.max(0, Math.round(peakMHz - boostMHz)) : null,
    specKnown: !!spec,
    reasons,
  };
}

// ---------------------------------------------------------------------------
// ¿Está overclockeada? RAM
// ---------------------------------------------------------------------------
// "Nominal" = la velocidad máxima que anuncia el propio módulo (SPD/XMP). Si la configurada es
// mayor, alguien la ha subido a mano; si es menor, el perfil XMP/DOCP está apagado.
function detectRamOc(memory) {
  const modules = (memory.modules || []).map((m) => {
    let status = 'unknown';
    let deltaMHz = null;
    if (m.ratedMHz && m.configuredMHz) {
      deltaMHz = m.configuredMHz - m.ratedMHz;
      status = m.configuredMHz > m.ratedMHz * 1.02 ? 'oc' : m.configuredMHz < m.ratedMHz * 0.98 ? 'below' : 'stock';
    }
    return { ...m, status, deltaMHz };
  });
  let overall = 'unknown';
  if (modules.some((m) => m.status === 'oc')) overall = 'oc';
  else if (modules.some((m) => m.status === 'below')) overall = 'below';
  else if (modules.length && modules.every((m) => m.status === 'stock')) overall = 'stock';
  return { overall, modules };
}

// ---------------------------------------------------------------------------
// ¿Qué permite la placa base?
// ---------------------------------------------------------------------------
const BOARD_RULES = {
  // AMD AM4
  A320: { cpuOc: false, ramOc: 'limited', note: 'Las A320 no permiten overclock de CPU y la RAM depende del modelo.' },
  B350: { cpuOc: true, ramOc: true }, X370: { cpuOc: true, ramOc: true },
  B450: { cpuOc: true, ramOc: true }, X470: { cpuOc: true, ramOc: true },
  A520: { cpuOc: false, ramOc: true, note: 'Las A520 no permiten subir el multiplicador, pero sí RAM (DOCP) y PBO.' },
  B550: { cpuOc: true, ramOc: true }, X570: { cpuOc: true, ramOc: true },
  // AMD AM5
  A620: { cpuOc: false, ramOc: true, note: 'Las A620 no permiten overclock de CPU; sí perfiles EXPO de RAM.' },
  B650: { cpuOc: true, ramOc: true }, B650E: { cpuOc: true, ramOc: true },
  X670: { cpuOc: true, ramOc: true }, X670E: { cpuOc: true, ramOc: true },
  X870: { cpuOc: true, ramOc: true }, X870E: { cpuOc: true, ramOc: true }, B850: { cpuOc: true, ramOc: true },
  B840: { cpuOc: false, ramOc: true, note: 'Las B840 no permiten overclock de CPU.' },
  // Intel: solo las Z permiten subir el multiplicador de las CPU con K
  Z370: { cpuOc: true, ramOc: true }, Z390: { cpuOc: true, ramOc: true }, Z490: { cpuOc: true, ramOc: true },
  Z590: { cpuOc: true, ramOc: true }, Z690: { cpuOc: true, ramOc: true }, Z790: { cpuOc: true, ramOc: true },
  Z890: { cpuOc: true, ramOc: true },
  B660: { cpuOc: false, ramOc: true, note: 'Las B660 no permiten overclock de CPU, pero sí de RAM.' },
  B760: { cpuOc: false, ramOc: true, note: 'Las B760 no permiten overclock de CPU, pero sí de RAM.' },
  B860: { cpuOc: false, ramOc: true, note: 'Las B860 no permiten overclock de CPU, pero sí de RAM.' },
  B560: { cpuOc: false, ramOc: true, note: 'Las B560 no permiten overclock de CPU, pero sí de RAM.' },
  H610: { cpuOc: false, ramOc: false }, H670: { cpuOc: false, ramOc: false }, H810: { cpuOc: false, ramOc: false },
  H510: { cpuOc: false, ramOc: false }, H410: { cpuOc: false, ramOc: false }, B460: { cpuOc: false, ramOc: false },
  H310: { cpuOc: false, ramOc: false }, B360: { cpuOc: false, ramOc: false }, H370: { cpuOc: false, ramOc: false },
};

function boardCapabilities(chipset) {
  return chipset && BOARD_RULES[chipset] ? { known: true, ...BOARD_RULES[chipset] } : { known: false, cpuOc: null, ramOc: null };
}

// ---------------------------------------------------------------------------
// Veredicto
// ---------------------------------------------------------------------------
const WEIGHTS = { cpu: 30, board: 20, cooling: 20, psu: 10, temps: 15, ram: 5 };
const POINTS = { ok: 1, warn: 0.55, unknown: 0.5, bad: 0 };

function assessOverclock({ snapshot, profile = {}, live = null, session = {}, ramOc }) {
  const { cpu, board } = snapshot;
  const caps = boardCapabilities(board.chipset);
  const factors = [];
  const add = (id, label, status, detail) => factors.push({ id, label, status, detail });

  // 1. CPU
  if (cpu.unlocked === true) add('cpu', 'Procesador', 'ok', `${cpu.name} tiene el multiplicador desbloqueado.`);
  else if (cpu.unlocked === false) {
    add('cpu', 'Procesador', 'bad', cpu.spec && /X3D/.test(cpu.spec.model)
      ? `${cpu.name} (3D V-Cache) tiene el multiplicador bloqueado. Solo admite ajustes finos como Curve Optimizer.`
      : `${cpu.name} tiene el multiplicador bloqueado: no se puede subir su frecuencia.`);
  } else add('cpu', 'Procesador', 'unknown', 'No se sabe si el multiplicador está desbloqueado.');

  // 2. Placa base
  if (!board.chipset) add('board', 'Placa base', 'unknown', 'No se pudo identificar el chipset de la placa.');
  else if (!caps.known) add('board', 'Placa base', 'unknown', `Chipset ${board.chipset}: Pulso aún no tiene reglas para él.`);
  else if (caps.cpuOc) add('board', 'Placa base', 'ok', `El chipset ${board.chipset} permite overclock de CPU y RAM.`);
  else add('board', 'Placa base', 'bad', caps.note || `El chipset ${board.chipset} no permite overclock de CPU.`);

  // 3. Refrigeración (dato manual: Windows no sabe qué disipador llevas)
  const tdp = (cpu.spec && cpu.spec.tdpW) || null;
  if (profile.coolerType === 'stock') {
    add('cooling', 'Refrigeración', tdp && tdp >= 105 ? 'bad' : 'warn',
      `El disipador de caja (${profile.cooler || 'stock'}) está dimensionado para el rendimiento de fábrica; al subir voltaje se queda corto.`);
  } else if (profile.coolerType === 'tower' || profile.coolerType === 'aio') {
    add('cooling', 'Refrigeración', 'ok', `${profile.cooler || (profile.coolerType === 'aio' ? 'Refrigeración líquida' : 'Torre de aire')}: margen suficiente para empezar.`);
  } else {
    add('cooling', 'Refrigeración', 'unknown',
      cpu.spec && cpu.spec.stockCooler
        ? `No sabemos qué disipador llevas. Esta CPU trae ${cpu.spec.stockCooler} de serie; si es el que usas, será tu principal límite. Indícalo en Mi equipo.`
        : 'No sabemos qué disipador llevas: Windows no puede detectarlo. Indícalo en Mi equipo.');
  }

  // 4. Fuente de alimentación (dato manual)
  const gpuW = (live && live.gpus && live.gpus[0] && live.gpus[0].powerMaxW) || 200;
  const need = Math.round((tdp || 95) * 1.6 + gpuW + 100);
  if (profile.psuWatts) {
    const ratio = profile.psuWatts / need;
    add('psu', 'Fuente', ratio >= 1.4 ? 'ok' : ratio >= 1.15 ? 'warn' : 'bad',
      `Con CPU overclockeada y tu GPU, el equipo pide unos ${need} W en pico; tu fuente da ${profile.psuWatts} W${ratio >= 1.4 ? ': hay holgura' : ratio >= 1.15 ? ': va justa' : ': se queda corta'}.`);
  } else add('psu', 'Fuente', 'unknown', `Consumo estimado en pico: unos ${need} W. Indica los vatios de tu fuente en Mi equipo.`);

  // 5. Temperaturas bajo carga (requiere sensores)
  if (session.maxCpuTempLoadedC != null) {
    const t = session.maxCpuTempLoadedC;
    add('temps', 'Temperatura', t < 70 ? 'ok' : t < 82 ? 'warn' : 'bad',
      `${Math.round(t)} °C con la CPU trabajando${t < 70 ? ': hay margen térmico' : t < 82 ? ': el margen es pequeño' : ': ya está caliente de fábrica'}.`);
  } else add('temps', 'Temperatura', 'unknown', 'No hay lectura de temperatura. Conecta LibreHardwareMonitor para medirla bajo carga.');

  // 6. RAM
  if (!snapshot.memory.modules.length) add('ram', 'Memoria RAM', 'unknown', 'No se pudieron leer los módulos de RAM.');
  else if (caps.known && caps.ramOc === false) add('ram', 'Memoria RAM', 'warn', 'Esta placa no permite subir la velocidad de la RAM.');
  else if (ramOc.overall === 'oc') add('ram', 'Memoria RAM', 'ok', 'Ya está overclockeada y estable (arranca y funciona).');
  else if (ramOc.overall === 'below') add('ram', 'Memoria RAM', 'ok', 'Va por debajo de su velocidad nominal: activar XMP/DOCP en la BIOS es el primer paso, sin riesgo.');
  else add('ram', 'Memoria RAM', 'ok', 'La placa permite subir su velocidad.');

  // Puntuación y nivel
  const score = Math.round(factors.reduce((s, f) => s + WEIGHTS[f.id] * POINTS[f.status], 0));
  const cpuBlocked = factors.find((f) => f.id === 'cpu').status === 'bad' || factors.find((f) => f.id === 'board').status === 'bad';
  const soft = factors.filter((f) => ['cooling', 'psu', 'temps'].includes(f.id));
  const hasUnknown = soft.some((f) => f.status === 'unknown');
  const hasWarn = soft.some((f) => f.status === 'warn' || f.status === 'bad');

  let level = score >= 75 ? 'good' : score >= 45 ? 'limited' : 'poor';
  if (level === 'good' && (hasUnknown || hasWarn)) level = 'limited';
  if (cpuBlocked) level = 'poor';

  const worst = factors.filter((f) => f.status === 'bad' || f.status === 'warn').map((f) => f.label.toLowerCase());
  let title; let summary;
  if (cpuBlocked) {
    title = 'La CPU no admite overclock';
    summary = 'Lo que sí puedes ajustar es la memoria RAM y la gráfica.';
  } else if (level === 'good') {
    title = 'Buen candidato para overclock';
    summary = 'Procesador, placa, refrigeración y fuente dan margen para subir frecuencias.';
  } else if (level === 'limited') {
    const unknowns = soft.filter((f) => f.status === 'unknown').length;
    title = hasWarn ? 'Se puede, pero con margen justo' : 'Probable, pero faltan datos';
    summary = hasWarn
      ? `El freno principal es ${worst[0]}. Antes de subir voltajes conviene mejorarlo.`
      : `Faltan ${unknowns} dato${unknowns === 1 ? '' : 's'} (Mi equipo / sensores) para afinar el veredicto.`;
  } else {
    title = 'No compensa por ahora';
    summary = `Hay demasiados límites: ${worst.slice(0, 2).join(' y ') || 'varios factores'}.`;
  }

  // Qué se puede tocar
  const targets = [];
  // Curve Optimizer llegó con Zen 3 (Ryzen 5000); Zen 2 (Ryzen 3000) solo tiene PBO y multiplicador fijo.
  const arch = (cpu.spec && cpu.spec.arch) || '';
  const zen3 = /Zen 3/.test(arch) || /Ryzen \d 5\d{3}/.test(cpu.name);
  const zen2 = !zen3 && (/Zen 2/.test(arch) || /Ryzen \d 3\d{3}/.test(cpu.name));
  targets.push({
    id: 'cpu', label: 'CPU', viable: !cpuBlocked && cpu.unlocked !== null ? true : cpuBlocked ? false : null,
    note: cpuBlocked ? 'Multiplicador bloqueado o placa sin soporte.'
      : zen3 ? 'En Ryzen 5000 el multiplicador fijo suele rendir menos que PBO con Curve Optimizer: con el fijo pierdes el boost de un solo núcleo.'
      : zen2 ? 'En Ryzen 3000 no hay Curve Optimizer: las opciones son PBO o un multiplicador fijo (que pierde el boost de un solo núcleo).'
      : 'Se puede subir el multiplicador, con voltaje y temperatura vigilados.',
  });
  const mem = snapshot.memory.modules[0];
  const sweet = cpu.vendor === 'AMD' && /DDR4/.test((mem && mem.type) || '') && mem.configuredMHz && mem.configuredMHz < 3600;
  targets.push({
    id: 'ram', label: 'RAM', viable: caps.known ? caps.ramOc !== false : null,
    note: ramOc.overall === 'oc' ? `Ya la tienes a ${mem.configuredMHz} MHz (nominal ${mem.ratedMHz} MHz).${sweet ? ' En Ryzen con DDR4, 3600 MHz es el punto dulce, si tus chips lo aguantan.' : ''}`
      : ramOc.overall === 'below' ? 'Activa XMP/DOCP en la BIOS: ahora va más lenta de lo que anuncia el módulo.'
      : sweet ? 'En Ryzen con DDR4, 3600 MHz es el punto dulce, si tus chips lo aguantan.' : 'Se puede probar con perfil XMP/DOCP o manualmente.',
  });
  const g = live && live.gpus && live.gpus[0];
  const powerMaxed = g && g.powerLimitW && g.powerMaxW && g.powerLimitW >= g.powerMaxW;
  targets.push({
    id: 'gpu', label: 'GPU', viable: snapshot.gpus.length ? true : null,
    note: powerMaxed ? `Su límite de potencia ya está en el máximo permitido (${g.powerMaxW} W): el margen es pequeño y viene de la curva de voltaje/frecuencia.`
      : 'Ajustando la curva de voltaje/frecuencia y el límite de potencia (por ejemplo con MSI Afterburner). Pulso aún no lo mide.',
  });

  return { level, score, title, summary, factors, targets, estimatedPeakW: need, chipset: board.chipset, caps };
}

module.exports = { detectCpuOc, detectRamOc, assessOverclock, boardCapabilities, fmtMHz, TOL };
