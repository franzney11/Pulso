// Gráfica: relojes, temperatura, ventilador, potencia y VRAM (NVIDIA vía nvidia-smi) + driver.
import { html, setText, setWidth } from '../dom.js';
import { chip, meterRow, driverCompare } from '../components.js';
import { mem, mhzTxt, deg, nf, ratio } from '../format.js';
import { gpuLive, tempKind } from '../sensors.js';
import { pageHead, driverRow, driversKey } from './shared.js';

const pctTxt = (v) => (v == null ? '—' : `${nf(v)} %`);

// Una definición por medidor: qué texto, qué porcentaje de barra y qué color.
function rowsFor(l) {
  return [
    { k: 'core', label: 'Reloj del núcleo', text: mhzTxt(l.coreMHz), pct: ratio(l.coreMHz, l.coreMaxMHz), kind: '' },
    { k: 'mem', label: 'Reloj de la memoria', text: mhzTxt(l.memMHz), pct: ratio(l.memMHz, l.memMaxMHz), kind: '' },
    { k: 'temp', label: 'Temperatura', text: deg(l.tempC), pct: ratio(l.tempC, 100), kind: tempKind(l.tempC) },
    { k: 'fan', label: 'Ventilador', text: l.fanPct == null ? '—' : l.fanPct === 0 ? 'Parado (0 %)' : pctTxt(l.fanPct), pct: l.fanPct, kind: 'ice' },
    { k: 'power', label: 'Potencia', text: l.powerW == null ? '—' : `${nf(l.powerW)} / ${nf(l.powerLimitW)} W`, pct: ratio(l.powerW, l.powerLimitW), kind: '' },
    { k: 'load', label: 'Carga', text: pctTxt(l.loadPct), pct: l.loadPct, kind: 'ice' },
    { k: 'vram', label: 'VRAM en uso', text: l.vramTotalMB ? `${mem(l.vramUsedMB)} / ${mem(l.vramTotalMB)}` : '—', pct: ratio(l.vramUsedMB, l.vramTotalMB), kind: 'ice' },
  ];
}

function render(s) {
  const gpus = s.snapshot.gpus;
  if (!gpus.length) {
    return html`${pageHead('Gráfica', 'No se ha detectado ninguna tarjeta gráfica.')}<div class="empty"><h3>Sin gráfica</h3><p style="margin:0">Windows no lista ningún adaptador de vídeo físico.</p></div>`;
  }
  return html`
    ${pageHead(gpus.length > 1 ? 'Gráficas' : 'Gráfica', 'Relojes, temperatura y consumo en vivo, y comparación del driver.')}
    ${gpus.map((g, i) => {
      const l = gpuLive(s.live, g, i);
      const rep = s.report.gpus[i] || {};
      return html`
        <section class="section" style="margin-top:${i ? 44 : 0}px">
          <h2 class="section-title" style="font-size:26px">${g.name}</h2>
          <p style="margin:0 0 16px">
            ${chip('mute', g.vendor || 'Fabricante desconocido')}
            ${g.vramMB ? chip('mute', `${mem(g.vramMB)} de VRAM${g.vramApprox ? ' (aprox.)' : ''}`) : ''}
            ${rep.powerLimitRaised ? chip('oc', 'Límite de potencia subido') : ''}
          </p>
          ${l
            ? html`<div>${rowsFor(l).map((r) => meterRow(`g${i}-${r.k}`, r.label, r.pct, r.text, r.kind))}</div>
                   ${rep.powerHeadroomW > 0 ? html`<p class="note">Margen de potencia sin tocar: ${nf(rep.powerHeadroomW)} W hasta el máximo que permite la tarjeta.</p>` : ''}
                   ${rep.powerHeadroomW === 0 ? html`<p class="note">El límite de potencia ya está en el máximo que permite la tarjeta.</p>` : ''}`
            : html`<div class="empty"><h3>Sin lecturas en vivo</h3>
                <p style="margin:0">Pulso lee relojes, temperatura y ventilador de las gráficas NVIDIA con <code>nvidia-smi</code>, que viene con el driver. Para AMD o Intel, conecta los sensores desde la pestaña Ventiladores.</p></div>`}
          <h3 class="section-title" style="margin-top:28px;font-size:17px">Driver</h3>
          ${driverCompare(driverRow(s, `gpu-${i}`))}
          <p><button class="btn btn--small" type="button" data-action="check-drivers">Comprobar ahora</button></p>
        </section>`;
    })}`;
}

function mount(root, s, ctx) {
  const presence = (st) => st.snapshot.gpus.map((g, i) => !!gpuLive(st.live, g, i)).join();
  const shown = { p: presence(s), d: driversKey(s) };
  return {
    update(next) {
      if (presence(next) !== shown.p || driversKey(next) !== shown.d) return ctx.rerender();
      next.snapshot.gpus.forEach((g, i) => {
        const l = gpuLive(next.live, g, i);
        if (!l) return;
        rowsFor(l).forEach((r) => {
          setText(root, `g${i}-${r.k}`, r.text);
          setWidth(root, `g${i}-${r.k}-bar`, r.pct);
          const bar = root.querySelector(`[data-k="g${i}-${r.k}-bar"]`);
          if (bar && bar.parentElement) bar.parentElement.className = `meter${r.kind ? ` meter--${r.kind}` : ''}`;
        });
      });
      return undefined;
    },
  };
}

export default {
  id: 'gpu', label: 'Gráfica', group: 1, render, mount,
  dot: (s) => (s.report.drivers.some((d) => d.id.startsWith('gpu-') && d.status === 'outdated') ? 'warn' : null),
};
