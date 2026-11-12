'use strict';
// Salud / vida útil de cada disco a partir de los datos SMART que entrega Windows.
const { clamp } = require('../collectors/util');

const HOURS_PER_YEAR = 8760;

// Devuelve { status: ok|warn|bad|unknown, score: 0-100|null, label, notes[] }
function diskHealth(disk) {
  const s = disk.smart || {};
  const notes = [];
  let score = null;
  let status = 'unknown';
  const isSolidState = disk.type === 'SSD' || disk.type === 'NVMe';

  // Los SSD reportan el desgaste (% de vida gastada). Los HDD no tienen ese dato.
  if (isSolidState && s.wearPct != null) {
    score = clamp(100 - s.wearPct, 0, 100);
    // Un SSD con poca vida restante avisa mucho antes de fallar: solo es "mal" cuando queda menos del 10 %.
    status = score >= 60 ? 'ok' : score >= 10 ? 'warn' : 'bad';
    notes.push(`Desgaste del ${s.wearPct} %: queda un ${score} % de vida útil estimada.`);
  } else if (isSolidState) {
    notes.push('Este SSD no informa de su desgaste a Windows.');
  } else if (disk.type === 'HDD') {
    notes.push('Los discos duros no reportan un porcentaje de vida: se juzga por su estado SMART, errores y horas de uso.');
  }

  const health = String(s.status || '');
  if (/unhealthy/i.test(health)) {
    status = 'bad';
    notes.unshift('Windows marca este disco como no saludable. Haz copia de seguridad ya.');
  } else if (/warning/i.test(health)) {
    if (status !== 'bad') status = 'warn';
    notes.unshift('Windows avisa de un problema en este disco. Haz copia de seguridad.');
  } else if (/healthy/i.test(health) && status === 'unknown') {
    status = 'ok';
  }

  const unc = s.uncorrectedErrors;
  if (unc != null && unc > 0) {
    if (unc > 50) status = 'bad';
    else if (status !== 'bad') status = 'warn';
    notes.push(`${unc} errores de lectura/escritura sin corregir.`);
  }

  if (s.tempC != null) {
    const limit = disk.type === 'HDD' ? 50 : 70;
    if (s.tempC > limit) {
      if (status === 'ok') status = 'warn';
      notes.push(`Temperatura alta: ${s.tempC} °C.`);
    }
  }

  if (s.powerOnHours != null) {
    const years = s.powerOnHours / HOURS_PER_YEAR;
    notes.push(`${s.powerOnHours.toLocaleString('es-ES')} horas encendido (${years.toFixed(1).replace('.', ',')} años de uso continuo).`);
    if (disk.type === 'HDD' && s.powerOnHours > 5 * HOURS_PER_YEAR && status === 'ok') {
      status = 'warn';
      notes.push('Pasa de 5 años de uso: a partir de aquí conviene tener copia de seguridad.');
    }
  }

  if (status === 'unknown') {
    notes.push('Windows no entrega datos SMART de este disco (a veces hace falta ejecutar Pulso como administrador).');
  }

  const label = { ok: 'Sano', warn: 'Revisar', bad: 'Crítico', unknown: 'Sin datos' }[status];
  return { status, score, label, notes };
}

module.exports = { diskHealth };
