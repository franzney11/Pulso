'use strict';
// Sensores de placa base (ventiladores, voltajes, temperaturas) vía LibreHardwareMonitor.
//
// Windows no expone esos sensores: hay que leerlos con un driver de kernel. En vez de meter
// ese driver dentro de Pulso, nos conectamos al servidor web que trae LibreHardwareMonitor
// (gratis y de código abierto): Options → Remote Web Server → Run. Por defecto sirve
// http://localhost:8085/data.json
//
// OJO: el formato de abajo está escrito a partir de la documentación/ejemplos del proyecto
// y probado con un fixture, pero no contra una instalación real. Si algo no cuadra,
// `npm run probe` guarda el JSON crudo para ajustar el parser.
const { asArray, clean, num } = require('./util');

const GROUPS = [
  [/volt/i, 'voltages'],
  [/temp/i, 'temps'],
  [/fan/i, 'fans'],
  [/clock/i, 'clocks'],
  [/power/i, 'powers'],
  [/load/i, 'loads'],
  [/control/i, 'controls'],
];
const UNIT_RE = /\s*(°C|RPM|MHz|GHz|V|W|%|GB|MB)\s*$/;

function groupOf(text) {
  const g = GROUPS.find(([re]) => re.test(text));
  return g ? g[1] : null;
}

function hwTypeOf(node) {
  const icon = String(node.ImageURL || '').toLowerCase();
  if (/cpu/.test(icon)) return 'cpu';
  if (/mainboard/.test(icon)) return 'board';
  if (/chip/.test(icon)) return 'superio';
  if (/nvidia|ati|gpu|intel_gpu/.test(icon)) return 'gpu';
  if (/hdd|nvme|ssd/.test(icon)) return 'disk';
  if (/ram/.test(icon)) return 'ram';
  if (/fan|cooler/.test(icon)) return 'cooler';
  return null;
}

// Convierte "1,296 V" / "1.296 V" / "3593.2 MHz" en { value: 1.296, unit: 'V' }.
function parseValue(str) {
  const s = clean(str);
  const unitMatch = UNIT_RE.exec(s);
  const unit = unitMatch ? unitMatch[1] : '';
  const n = num(s.replace(UNIT_RE, '').replace(',', '.'));
  return { value: n, unit };
}

// Estructura del árbol: equipo → hardware (placa, CPU, GPU, discos…) → [chip] → grupo
// ("Temperatures", "Fans"…) → sensores (hojas con Value/Min/Max).
const isLeaf = (n) => !asArray(n && n.Children).length;
// Un "grupo" es un nodo con nombre de grupo cuyos hijos son todos hojas.
const isGroupNode = (n) => !isLeaf(n) && groupOf(clean(n.Text)) && asArray(n.Children).every(isLeaf);

function parseLhmTree(root) {
  const items = [];
  (function walk(node, hw) {
    if (!node) return;
    const children = asArray(node.Children);
    if (!children.length) return;
    if (isGroupNode(node) && hw) {
      const group = groupOf(clean(node.Text));
      for (const leaf of children) {
        if (leaf.Value == null) continue;
        const v = parseValue(leaf.Value);
        if (v.value == null) continue;
        items.push({
          hw: hw.name, hwType: hw.type, group, name: clean(leaf.Text),
          value: v.value, unit: v.unit,
          min: parseValue(leaf.Min).value, max: parseValue(leaf.Max).value,
        });
      }
      return;
    }
    // Un nodo que contiene algún grupo es un componente de hardware.
    const nextHw = children.some(isGroupNode) ? { name: clean(node.Text), type: hwTypeOf(node) } : hw;
    children.forEach((c) => walk(c, nextHw));
  })(root, null);
  return items;
}

async function fetchSensors(url, timeoutMs = 1500) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) return { available: false, source: 'lhm', items: [], error: `HTTP ${res.status}` };
    const items = parseLhmTree(await res.json());
    return { available: items.length > 0, source: 'lhm', items };
  } catch (e) {
    return { available: false, source: 'lhm', items: [], error: e.name === 'TimeoutError' ? 'sin respuesta' : e.message };
  }
}

module.exports = { fetchSensors, parseLhmTree, parseValue };
