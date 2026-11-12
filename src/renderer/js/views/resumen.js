// Resumen: la lista de todos los componentes del equipo, con su estado de un vistazo.
import { html, setText } from '../dom.js';
import { chip } from '../components.js';
import { ghz, mem, diskSize, mhzTxt } from '../format.js';
import { gpuLive } from '../sensors.js';
import { pageHead, cpuOcChip, ramOcChip, LEVEL, driverRow } from './shared.js';

const row = (go, name, main, detail, readKey, read, chipTpl) => html`
  <button class="ledger-row" type="button" data-go="${go}">
    <span class="l-name">${name}</span>
    <span class="l-main"><b>${main}</b><span class="l-detail">${detail}</span></span>
    <span class="l-read" data-k="${readKey}">${read}</span>
    <span class="l-chip">${chipTpl}</span>
  </button>`;

const cpuRead = (s) => (s.live && s.live.cpu ? ghz(s.live.cpu.effectiveMHz) : '—');
const gpuRead = (s, g, i) => {
  const l = gpuLive(s.live, g, i);
  return l && l.coreMHz != null ? mhzTxt(l.coreMHz) : '—';
};

function driverChip(row) {
  if (!row) return chip('mute', 'Driver sin comprobar');
  if (row.status === 'outdated') return chip('warn', 'Driver desactualizado');
  if (row.status === 'uptodate') return chip('ok', 'Driver al día');
  return chip('mute', 'Driver sin comparar');
}

function boardChip(caps) {
  if (!caps || !caps.known) return chip('mute', 'Sin reglas para este chipset');
  return caps.cpuOc ? chip('ok', 'Permite overclock') : chip('warn', 'Sin overclock de CPU');
}

function render(s) {
  const { snapshot: sn, report: r } = s;
  const { cpu, memory, board } = sn;
  const caps = r.overclock.caps;
  const [lvKind, lvLabel] = LEVEL[r.overclock.level] || LEVEL.limited;
  const outdated = r.summary.outdatedDrivers;

  const mods = memory.modules;
  const ramConfigured = mods.length ? Math.max(...mods.map((m) => m.configuredMHz || 0)) : 0;
  const ramDetail = mods.length
    ? `${mods.map((m) => mem(m.capacityMB)).join(' + ')} · ${mods[0].type || 'RAM'}${memory.slotsTotal ? ` · ${mods.length} de ${memory.slotsTotal} ranuras` : ''}`
    : 'No se pudieron leer los módulos';

  const rows = [
    row('cpu', 'Procesador', cpu.name,
      `${cpu.cores || '?'} núcleos · ${cpu.threads || '?'} hilos${cpu.socket ? ` · ${cpu.socket}` : ''}`,
      'ov-cpu', cpuRead(s), cpuOcChip(r.summary.cpuOc)),
    ...sn.gpus.map((g, i) => row('gpu', 'Gráfica', g.name,
      `${g.vramMB ? mem(g.vramMB) : 'VRAM desconocida'}${g.driverVersion ? ` · driver ${g.driverVersion}` : ''}`,
      `ov-gpu-${i}`, gpuRead(s, g, i), driverChip(driverRow(s, `gpu-${i}`)))),
    row('memoria', 'Memoria', mem(memory.totalMB), ramDetail,
      'ov-ram', ramConfigured ? mhzTxt(ramConfigured) : '—', ramOcChip(r.summary.ramOc)),
    ...sn.disks.map((d) => {
      const h = r.disks.find((x) => x.id === d.id) || { status: 'unknown', label: 'Sin datos', score: null };
      const kind = { ok: 'ok', warn: 'warn', bad: 'bad' }[h.status] || 'mute';
      return row('discos', 'Disco', d.name || 'Disco sin nombre', `${d.type} · ${diskSize(d.sizeGB)}${d.bus && d.bus !== d.type ? ` · ${d.bus}` : ''}`,
        `ov-disk-${d.id}`, h.score != null ? `${h.score} %` : '—', chip(kind, h.label));
    }),
    row('placa', 'Placa base', `${board.manufacturer} ${board.model}`.trim() || 'Placa no identificada',
      `${board.chipset ? `Chipset ${board.chipset}` : 'Chipset sin identificar'}${board.bios.version ? ` · BIOS ${board.bios.version}` : ''}`,
      'ov-board', '', boardChip(caps)),
    row('drivers', 'Drivers',
      outdated ? `${outdated} con versión más nueva` : 'Ninguno desactualizado',
      'La gráfica NVIDIA se compara sola; chipset y BIOS, en la web del fabricante.',
      'ov-drivers', '', outdated ? chip('warn', 'Hay actualizaciones') : r.drivers.length ? chip('ok', 'Sin pendientes') : chip('mute', 'Comprobando…')),
    row('overclock', 'Overclock', r.overclock.title, r.overclock.summary, 'ov-oc', `${r.overclock.score} / 100`, chip(lvKind, lvLabel)),
  ];

  return html`
    ${pageHead('Resumen del equipo', 'Todo lo que Pulso ha encontrado en este PC. Pulsa un componente para ver el detalle.')}
    <div class="ledger">${rows}</div>
    <p class="note">Las lecturas de la derecha se actualizan cada segundo. El detalle de cada componente está en el menú de la izquierda.</p>`;
}

// Lo que, si cambia, obliga a repintar la lista (estados, veredicto, drivers…).
const keyOf = (s) => JSON.stringify([s.report.summary, s.report.overclock.score, s.report.drivers.map((d) => d.status), s.snapshot.gpus.length]);

function mount(root, s, ctx) {
  const shown = keyOf(s);
  return {
    update(next) {
      if (keyOf(next) !== shown) return ctx.rerender();
      setText(root, 'ov-cpu', cpuRead(next));
      next.snapshot.gpus.forEach((g, i) => setText(root, `ov-gpu-${i}`, gpuRead(next, g, i)));
      return undefined;
    },
  };
}

export default { id: 'resumen', label: 'Resumen', group: 0, render, mount, dot: () => null };
