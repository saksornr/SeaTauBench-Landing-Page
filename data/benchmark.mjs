export const models = [
  { id: 'kimi-k2.5', name: 'Kimi K2.5', family: 'Moonshot AI', color: '#487b2c', shape: 'circle' },
  { id: 'gpt-5-mini', name: 'GPT-5 mini', family: 'OpenAI', color: '#d12f40', shape: 'square' },
  { id: 'qwen3-235b', name: 'Qwen3 235B', family: 'Qwen · A22B-Instruct-2507', color: '#8a713b', shape: 'triangle' },
];
export const languages = {
  en: { name: 'English', native: 'English' },
  id: { name: 'Indonesian', native: 'Bahasa Indonesia' },
  th: { name: 'Thai', native: 'ไทย' },
  tl: { name: 'Filipino', native: 'Filipino' },
  vi: { name: 'Vietnamese', native: 'Tiếng Việt' },
  zh: { name: 'Mandarin Chinese', native: '中文' },
  bi: { name: 'Bilingual', native: 'Bi' },
  tri: { name: 'Trilingual', native: 'Tri' },
  quad: { name: 'Quadlingual', native: 'Quad' },
  multi: { name: 'Multilingual', native: 'Multi' },
};
export const scenarios = {
  s1: { name: 'English baseline', short: 'S1', description: 'English dialogue, tools, policies, and databases.' },
  s2: { name: 'L2 interaction', short: 'S2', description: 'Localized dialogue. Tools and domain context remain in English.' },
  s3: { name: 'L2 tools', short: 'S3', description: 'Localized tool schemas. Dialogue and domain context remain in English.' },
  s4: { name: 'L2 domain', short: 'S4', description: 'Localized dialogue, tools, policies, and databases.' },
  's3-mix': { name: 'L2 tools · mixed', short: 'S3 mix', description: 'Mixed-language tool schemas. Two models reported; dialogue stays in English.' },
};
export const metrics = { pass1: 'pass@1', pass2: 'pass²', pass3: 'pass³', rho3: 'Robustness ρ³' };
export const defaults = { domain: 'all', language: 'all', scenario: 's4', models: models.map(m => m.id), metric: 'pass1', sort: 'pass1', direction: 'desc' };
export const average = (rows, key) => rows.length ? rows.reduce((sum, r) => sum + r[key], 0) / rows.length : null;
export function filterRecords(records, state) {
  return records.filter(r => (state.domain === 'all' || r.domain === state.domain)
    && (state.language === 'all' || r.language === state.language)
    && (state.scenario === 'all' ? r.scenario !== 's3-mix' : r.scenario === state.scenario)
    && state.models.includes(r.model));
}
export function aggregateModels(records, state) {
  const filtered = filterRecords(records, state);
  return models.filter(m => state.models.includes(m.id)).map(m => {
    const rows = filtered.filter(r => r.model === m.id);
    return { ...m, count: rows.length, ...Object.fromEntries(Object.keys(metrics).map(k => [k, average(rows, k)])) };
  }).sort((a, b) => {
    if (a[state.sort] === null) return b[state.sort] === null ? a.name.localeCompare(b.name) : 1;
    if (b[state.sort] === null) return -1;
    return (a[state.sort] - b[state.sort]) * (state.direction === 'asc' ? 1 : -1) || a.name.localeCompare(b.name);
  });
}
export function readState(search) {
  const q = new URLSearchParams(search);
  const state = { ...defaults, models: [...defaults.models] };
  if (['all', 'airline', 'retail', 'telecom'].includes(q.get('domain'))) state.domain = q.get('domain');
  if (q.get('language') === 'all' || languages[q.get('language')]) state.language = q.get('language');
  if (q.get('scenario') === 'all' || scenarios[q.get('scenario')]) state.scenario = q.get('scenario');
  if (q.has('models')) state.models = [...new Set(q.get('models').split(',').filter(id => models.some(m => m.id === id)))];
  if (metrics[q.get('metric')]) state.metric = q.get('metric');
  if (metrics[q.get('sort')]) state.sort = q.get('sort');
  if (q.get('direction') === 'asc') state.direction = 'asc';
  return state;
}
export function stateToSearch(state) {
  const q = new URLSearchParams();
  for (const key of ['domain', 'language', 'scenario', 'metric', 'sort', 'direction']) if (state[key] !== defaults[key]) q.set(key, state[key]);
  if (state.models.join(',') !== defaults.models.join(',')) q.set('models', state.models.join(','));
  return q.toString();
}
export function toCsv(records) {
  const keys = ['model', 'domain', 'language', 'scenario', 'pass1', 'pass2', 'pass3', 'rho3', 'sourceTable', 'sourcePage'];
  const escape = value => `"${String(value).replaceAll('"', '""')}"`;
  return [keys, ...records.map(r => keys.map(k => r[k]))].map(row => row.map(escape).join(',')).join('\r\n');
}
