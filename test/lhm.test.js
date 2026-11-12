'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { parseLhmTree, parseValue } = require('../src/main/collectors/lhm');

test('valores con unidad y coma decimal', () => {
  assert.deepEqual(parseValue('1,296 V'), { value: 1.296, unit: 'V' });
  assert.deepEqual(parseValue('3593.2 MHz'), { value: 3593.2, unit: 'MHz' });
  assert.deepEqual(parseValue('47.5 °C'), { value: 47.5, unit: '°C' });
  assert.deepEqual(parseValue('812 RPM'), { value: 812, unit: 'RPM' });
  assert.equal(parseValue('').value, null);
});

const leaf = (Text, Value, Min = Value, Max = Value) => ({ Text, Value, Min, Max, Children: [] });
const TREE = {
  Text: 'Sensor',
  Children: [{
    Text: 'MI-PC',
    Children: [
      { Text: 'MSI B450M PRO-M2 MAX', ImageURL: 'images_icon/mainboard.png', Children: [
        { Text: 'Nuvoton NCT6797D', ImageURL: 'images_icon/chip.png', Children: [
          { Text: 'Temperatures', Children: [leaf('System', '33.0 °C')] },
          { Text: 'Fans', Children: [leaf('CPU Fan', '1100 RPM'), leaf('Case Fan #1', '810 RPM'), leaf('Fan #7', '0 RPM')] },
          { Text: 'Voltages', Children: [leaf('+12V', '12,048 V')] },
        ] },
      ] },
      { Text: 'AMD Ryzen 5 5500', ImageURL: 'images_icon/cpu.png', Children: [
        { Text: 'Temperatures', Children: [leaf('Core (Tctl/Tdie)', '47.0 °C')] },
        { Text: 'Powers', Children: [leaf('Package', '38.2 W')] },
      ] },
    ],
  }],
};

test('recorre el árbol y saca sensores con su hardware', () => {
  const items = parseLhmTree(TREE);
  const find = (name) => items.find((i) => i.name === name);
  assert.equal(items.length, 7);
  assert.deepEqual([find('CPU Fan').group, find('CPU Fan').value, find('CPU Fan').unit, find('CPU Fan').hw], ['fans', 1100, 'RPM', 'Nuvoton NCT6797D']);
  assert.equal(find('+12V').value, 12.048);
  assert.equal(find('Core (Tctl/Tdie)').hwType, 'cpu');
  assert.equal(find('Package').group, 'powers');
  assert.equal(find('Fan #7').value, 0, 'un ventilador parado (0 RPM) sigue siendo un dato');
});

test('árbol vacío o raro', () => {
  assert.deepEqual(parseLhmTree(null), []);
  assert.deepEqual(parseLhmTree({ Text: 'Sensor', Children: [] }), []);
});
