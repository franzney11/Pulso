// Ventiladores y sensores. Windows no los expone: se leen con LibreHardwareMonitor.
import { html } from '../dom.js';
import { chip, sensorsHelp } from '../components.js';
import { sensorItems } from '../sensors.js';
import { pageHead, sensorRowHtml, updateSensorRows, COOLER_TYPES } from './shared.js';

const GROUPS = [['fans', 'Ventiladores'], ['temps', 'Temperaturas'], ['voltages', 'Voltajes'], ['powers', 'Potencia']];

const idxList = (s) => sensorItems(s.live).map((it, idx) => (GROUPS.some(([g]) => g === it.group) ? idx : -1)).filter((i) => i >= 0);

function cooler(profile) {
  if (profile && profile.cooler) {
    return html`<p style="margin:0"><b style="font:600 20px var(--font-display)">${profile.cooler}</b> ${chip('mute', COOLER_TYPES[profile.coolerType] || 'Tipo sin indicar')}
      <button class="btn btn--small" type="button" data-go="equipo" style="margin-left:8px">Cambiar</button></p>`;
  }
  return html`<div class="empty"><h3>Disipador sin indicar</h3>
    <p style="margin:0 0 10px">Los disipadores no se identifican por software (no tienen ningún chip que Windows pueda leer). Dinos cuál llevas y Pulso lo tendrá en cuenta en la estimación de overclock.</p>
    <button class="btn btn--small" type="button" data-go="equipo">Indicarlo en Mi equipo</button></div>`;
}

function render(s) {
  const on = s.live && s.live.sensors && s.live.sensors.available;
  const items = sensorItems(s.live).map((it, idx) => ({ ...it, idx }));
  const sections = GROUPS.map(([g, title]) => {
    const list = items.filter((it) => it.group === g);
    if (!list.length) return '';
    const byHw = [...new Set(list.map((it) => it.hw))];
    return html`
      <section class="section">
        <h2 class="section-title">${title}</h2>
        ${byHw.map((hw) => html`
          <p class="note" style="margin:10px 0 0"><b>${hw}</b></p>
          <div>${list.filter((it) => it.hw === hw).map((it) => sensorRowHtml('ss-', it))}</div>`)}
      </section>`;
  });
  return html`
    ${pageHead('Ventiladores y sensores', 'Velocidad de los ventiladores, temperaturas y voltajes de la placa base.')}
    <section><h2 class="section-title">Refrigeración</h2>${cooler(s.profile)}</section>
    <div class="section">${on ? html`${sections}` : sensorsHelp()}</div>`;
}

function mount(root, s, ctx) {
  const shown = `${s.live && s.live.sensors && s.live.sensors.available}|${idxList(s).join()}|${(s.profile && s.profile.cooler) || ''}`;
  return {
    update(next) {
      const now = `${next.live && next.live.sensors && next.live.sensors.available}|${idxList(next).join()}|${(next.profile && next.profile.cooler) || ''}`;
      if (now !== shown) return ctx.rerender();
      updateSensorRows(root, 'ss-', next, idxList(next));
      return undefined;
    },
  };
}

export default { id: 'sensores', label: 'Ventiladores', group: 1, render, mount, dot: () => null };
