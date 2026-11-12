'use strict';
// Helpers para sacar valores concretos de la lista de sensores (LibreHardwareMonitor o demo).

function byGroup(sensors, group, hwType) {
  return ((sensors && sensors.items) || []).filter((s) => s.group === group && (!hwType || s.hwType === hwType));
}

// Temperatura "buena" de la CPU: prefiere Tctl/Tdie/Package; si no, la mayor del procesador.
function cpuTempFrom(sensors) {
  const temps = byGroup(sensors, 'temps', 'cpu');
  if (!temps.length) return null;
  const preferred = temps.find((t) => /tctl|tdie|package|core max/i.test(t.name)) || temps.find((t) => /cpu/i.test(t.name));
  return preferred ? preferred.value : Math.max(...temps.map((t) => t.value));
}

module.exports = { byGroup, cpuTempFrom };
