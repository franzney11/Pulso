'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { lookupCpu, inferUnlocked } = require('../src/main/analysis/cpu-db');
const { cpus } = require('../src/main/data/cpus.json');

test('encuentra la ficha por el nombre que reporta Windows', () => {
  assert.equal(lookupCpu('AMD Ryzen 5 5500 6-Core Processor').model, 'Ryzen 5 5500');
  assert.equal(lookupCpu('12th Gen Intel(R) Core(TM) i5-12400F').model, 'i5-12400F');
  assert.equal(lookupCpu('Intel(R) Core(TM) i7-10700K CPU @ 3.80GHz').model, 'i7-10700K');
});

test('no confunde modelos parecidos', () => {
  assert.equal(lookupCpu('AMD Ryzen 5 5600X 6-Core Processor').model, 'Ryzen 5 5600X');
  assert.equal(lookupCpu('AMD Ryzen 5 5600 6-Core Processor').model, 'Ryzen 5 5600');
  assert.equal(lookupCpu('AMD Ryzen 7 5800X3D 8-Core Processor').model, 'Ryzen 7 5800X3D');
  assert.equal(lookupCpu('AMD Ryzen 5 5500U with Radeon Graphics'), null, 'la 5500U es otra CPU');
  assert.equal(lookupCpu('Intel(R) Core(TM) i5-12400'), null, 'sin F no está en la base de datos');
});

test('la base de datos es coherente', () => {
  for (const c of cpus) {
    assert.ok(c.boostMHz >= c.baseMHz, `${c.model}: el boost no puede ser menor que la base`);
    assert.ok(c.threads >= c.cores, `${c.model}: hilos >= núcleos`);
    assert.ok(c.tdpW > 0, `${c.model}: TDP`);
    assert.equal(typeof c.unlocked, 'boolean', `${c.model}: unlocked`);
  }
  const models = cpus.map((c) => c.model.toLowerCase());
  assert.equal(new Set(models).size, models.length, 'sin modelos repetidos');
});

test('adivina si el multiplicador está desbloqueado cuando no hay ficha', () => {
  assert.equal(inferUnlocked('Intel(R) Core(TM) i9-11900K', 'Intel'), true);
  assert.equal(inferUnlocked('Intel(R) Core(TM) i9-11900KF', 'Intel'), true);
  assert.equal(inferUnlocked('Intel(R) Core(TM) i5-11400F', 'Intel'), false);
  assert.equal(inferUnlocked('AMD Ryzen 9 7900X', 'AMD'), true);
  assert.equal(inferUnlocked('AMD Ryzen 7 9800X3D', 'AMD'), false);
  assert.equal(inferUnlocked('Algo raro', ''), null);
});
