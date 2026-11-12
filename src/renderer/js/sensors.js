// Helpers sobre la lista de sensores (LibreHardwareMonitor o demo).
export const sensorItems = (live) => (live && live.sensors && live.sensors.available ? live.sensors.items : []);

export function byGroup(live, group, hwType) {
  return sensorItems(live)
    .map((it, idx) => ({ ...it, idx }))
    .filter((it) => it.group === group && (!hwType || it.hwType === hwType));
}

// Temperatura principal de la CPU: prefiere Tctl/Tdie/Package; si no, la más alta del procesador.
export function cpuTemp(live) {
  const temps = byGroup(live, 'temps', 'cpu');
  if (!temps.length) return null;
  const preferred = temps.find((t) => /tctl|tdie|package|core max/i.test(t.name)) || temps.find((t) => /cpu/i.test(t.name));
  return preferred ? preferred.value : Math.max(...temps.map((t) => t.value));
}

export const gpuLive = (live, gpu, i) =>
  (live && live.gpus && (live.gpus.find((x) => x.name === gpu.name) || live.gpus[i])) || null;

// Verde / ámbar / rojo según la temperatura (umbrales generales, no por modelo).
export const tempKind = (c) => (c == null ? '' : c < 65 ? 'ok' : c < 80 ? 'warn' : 'bad');
