import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { defaults, filterRecords, aggregateModels, average, readState, stateToSearch, toCsv } from '../data/benchmark.mjs';
const { records } = JSON.parse(readFileSync(new URL('../data/results.json', import.meta.url)));
const state = overrides => ({ ...defaults, models: [...defaults.models], ...overrides });

test('paper snapshot has 168 unique, bounded result cells across Tables 17–21', () => {
  assert.equal(records.length, 168);
  assert.equal(new Set(records.map(r => [r.model, r.domain, r.language, r.scenario].join('/'))).size, 168);
  assert.deepEqual([17,18,19,20,21].map(table => records.filter(r => r.sourceTable === table).length), [9,45,45,24,45]);
  for (const r of records) {
    for (const key of ['pass1', 'pass2', 'pass3', 'rho3']) assert.ok(r[key] >= 0 && r[key] <= 1);
    assert.ok(r.pass1 >= r.pass2 && r.pass2 >= r.pass3);
    // Allow table rounding, while catching column shifts during extraction.
    assert.ok(Math.abs(r.pass3 / r.pass1 - r.rho3) < .003, JSON.stringify(r));
  }
});
test('known Appendix Table 17 values survive extraction', () => {
  const cell = filterRecords(records, state({ scenario: 's1', domain: 'telecom', language: 'en', models: ['kimi-k2.5'] }));
  assert.equal(cell.length, 1);
  assert.deepEqual([cell[0].pass1,cell[0].pass2,cell[0].pass3,cell[0].rho3], [.997,.953,.930,.933]);
});
test('all four filters intersect and recover the Thai retail S4 GPT cell', () => {
  const selected = filterRecords(records, state({ domain: 'retail', language: 'th', models: ['gpt-5-mini'] }));
  assert.equal(selected.length, 1);
  assert.equal(selected[0].pass1, .325);
  assert.equal(selected[0].sourceTable, 21);
});
test('default S4 model ranking and macro denominator are correct', () => {
  const ranked = aggregateModels(records, state());
  assert.deepEqual(ranked.map(m => m.id), ['kimi-k2.5', 'gpt-5-mini', 'qwen3-235b']);
  assert.ok(ranked.every(m => m.count === 15));
  // Independent manual sum of all 15 Kimi S4 appendix values.
  const expected = (.560+.547+.600+.660+.600+.567+.327+.433+.607+.444+.699+.693+.798+.863+.743)/15;
  assert.ok(Math.abs(ranked[0].pass1 - expected) < 1e-12);
});
test('English baseline is not copied into non-English results', () => {
  assert.equal(filterRecords(records, state({ scenario: 's1', language: 'th' })).length, 0);
  assert.equal(filterRecords(records, state({ language: 'en' })).length, 0);
  assert.equal(filterRecords(records, state({ scenario: 's1' })).length, 9);
  assert.equal(filterRecords(records, state({ scenario: 'all' })).length, 144);
});
test('missing mixed-language Kimi result is null, never zero', () => {
  const ranked = aggregateModels(records, state({ scenario: 's3-mix' }));
  assert.equal(ranked.find(m => m.id === 'kimi-k2.5').pass1, null);
  assert.equal(filterRecords(records, state({ scenario: 's3-mix' })).length, 24);
  assert.equal(average([], 'pass1'), null);
});
test('empty model selections persist through shareable URLs', () => {
  const value = state({ models: [], language: 'vi', metric: 'rho3', sort: 'rho3', direction: 'asc' });
  assert.deepEqual(readState(stateToSearch(value)), value);
  assert.equal(filterRecords(records, value).length, 0);
});
test('untrusted URL values are ignored and duplicates removed', () => {
  assert.equal(readState('?scenario=invalid&metric=bad').scenario, 's4');
  assert.deepEqual(readState('?models=kimi-k2.5,kimi-k2.5,invalid').models, ['kimi-k2.5']);
});
test('sorting changes order and places missing results last', () => {
  const ranked = aggregateModels(records, state({ scenario: 's3-mix', sort: 'rho3', direction: 'asc' }));
  assert.equal(ranked.at(-1).id, 'kimi-k2.5');
  assert.ok(ranked[0].rho3 < ranked[1].rho3);
});
test('CSV exports only the selected source records, with provenance', () => {
  const rows = filterRecords(records, state({ domain: 'airline', language: 'zh' }));
  const csv = toCsv(rows);
  assert.equal(csv.split('\r\n').length, 4);
  assert.ok(csv.includes('"sourceTable"'));
  assert.ok(csv.includes('"21","24"'));
  assert.ok(!csv.includes('retail'));
});
