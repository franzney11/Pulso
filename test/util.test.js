'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const u = require('../src/main/collectors/util');

test('versión NVIDIA de Windows → versión que ve el usuario', () => {
  assert.equal(u.nvidiaUserVersion('32.0.15.8157'), '581.57');
  assert.equal(u.nvidiaUserVersion('31.0.15.4601'), '546.01');
  assert.equal(u.nvidiaUserVersion('1.2'), null);
  assert.equal(u.nvidiaUserVersion(null), null);
});

test('limpia el nombre de la CPU', () => {
  assert.equal(u.cleanCpuName('AMD Ryzen 5 5500 6-Core Processor'), 'AMD Ryzen 5 5500');
  assert.equal(u.cleanCpuName('12th Gen Intel(R) Core(TM) i5-12400F'), 'Intel Core i5-12400F');
  assert.equal(u.cleanCpuName('Intel(R) Core(TM) i7-10700K CPU @ 3.80GHz'), 'Intel Core i7-10700K');
});

test('saca el chipset del nombre de la placa', () => {
  assert.equal(u.chipsetFromBoard('B450M PRO-M2 MAX (MS-7B98)'), 'B450');
  assert.equal(u.chipsetFromBoard('ROG STRIX Z790-E GAMING WIFI'), 'Z790');
  assert.equal(u.chipsetFromBoard('PRIME B650E-PLUS'), 'B650E');
  assert.equal(u.chipsetFromBoard('Vivobook'), null);
  assert.equal(u.chipsetFromBoard(null), null);
});

test('nombres cortos de fabricante de placa', () => {
  assert.equal(u.shortBoardVendor('Micro-Star International Co., Ltd.'), 'MSI');
  assert.equal(u.shortBoardVendor('ASUSTeK COMPUTER INC.'), 'ASUS');
});

test('fechas de PowerShell 5.1 y 7', () => {
  assert.equal(u.toIsoDate('/Date(1700000000000)/'), '2023-11-14');
  assert.equal(u.toIsoDate('2024-03-14T00:00:00'), '2024-03-14');
  assert.equal(u.toIsoDate(null), null);
});

test('fabricantes de RAM por código JEDEC', () => {
  assert.equal(u.memoryVendor('029E'), 'Corsair');
  assert.equal(u.memoryVendor('Kingston'), 'Kingston');
});

test('asArray / num', () => {
  assert.deepEqual(u.asArray(null), []);
  assert.deepEqual(u.asArray({ a: 1 }), [{ a: 1 }]);
  assert.deepEqual(u.asArray([1, 2]), [1, 2]);
  assert.equal(u.num(''), null);
  assert.equal(u.num('3600'), 3600);
  assert.equal(u.num('x'), null);
});
