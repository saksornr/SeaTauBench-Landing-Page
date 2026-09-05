import { models, languages, scenarios, metrics, defaults, average, filterRecords, aggregateModels, readState, stateToSearch, toCsv } from './data/benchmark.mjs';

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const percent = value => value === null ? '—' : (value * 100).toFixed(1);
const capitalize = value => value.charAt(0).toUpperCase() + value.slice(1);
const colorClass = id => id.replaceAll('.', '-');
let state = readState(location.search);
let records = [];
let loaded = false;
let toastTimeout;

const icons = {
  github: '<path d="M9 19c-4 1-4-2-6-2m12 4v-3.9a3.4 3.4 0 0 0-.95-2.65c3.17-.35 6.5-1.56 6.5-7A5.4 5.4 0 0 0 19 3.7 5 5 0 0 0 18.9 0S17.7-.35 15 1.4a13.4 13.4 0 0 0-7 0C5.3-.35 4.1 0 4.1 0A5 5 0 0 0 4 3.7a5.4 5.4 0 0 0-1.55 3.75c0 5.42 3.33 6.63 6.5 7A3.4 3.4 0 0 0 8 17.1V21" transform="translate(1 1) scale(.9)"/>',
  file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6M8 13h8M8 17h6"/>',
  download: '<path d="M12 3v12m-5-5 5 5 5-5M5 16v4h14v-4"/>',
  reset: '<path d="M3 10a9 9 0 1 1 2 8M3 4v6h6"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7v1"/>',
  copy: '<rect x="8" y="8" width="12" height="13" rx="2"/><path d="M16 8V3H3v13h5"/>',
};
$$('[data-icon]').forEach(el => { el.outerHTML = `<svg class="icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${icons[el.dataset.icon] || ''}</svg>`; });

function toast(message) {
  clearTimeout(toastTimeout);
  $('#toast').textContent = message;
  $('#toast').hidden = false;
  toastTimeout = setTimeout(() => { $('#toast').hidden = true; }, 3500);
}

function syncControls() {
  for (const key of ['domain', 'language', 'scenario']) $(`#${key}`).value = state[key];
  $$('input[name=models]').forEach(input => { input.checked = state.models.includes(input.value); });
  $('#model-count').textContent = state.models.length === models.length ? 'All 3 models' : `${state.models.length} model${state.models.length === 1 ? '' : 's'} selected`;
  $$('[data-metric]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.metric === state.metric)));
  $('#scenario-context').textContent = state.scenario === 'all' ? 'All four core settings. English is counted once; mixed-language tools are separate.' : scenarios[state.scenario].description;
  $$('[data-sort-heading]').forEach(th => {
    const active = th.dataset.sortHeading === state.sort;
    th.setAttribute('aria-sort', active ? state.direction === 'desc' ? 'descending' : 'ascending' : 'none');
    th.querySelector('.sort-arrow').textContent = active ? state.direction === 'desc' ? '↓' : '↑' : '↕';
  });
}

function emptyMessage() {
  if (!state.models.length) return 'Select at least one model to explore its results.';
  if (state.language === 'en' && !['s1', 'all'].includes(state.scenario)) return 'English is reported in S1 only. Select “S1 · English baseline” or another language.';
  if (state.scenario === 's1' && !['all', 'en'].includes(state.language)) return 'S1 uses English only. Select English or all languages to see the baseline.';
  if (['bi', 'tri', 'quad', 'multi'].includes(state.language) && state.scenario !== 's3-mix') return 'Mixed-language configurations are reported under “S3 · Mixed-language tools”.';
  return 'No reported results match these filters. Try another language, scenario, or model.';
}

function modelPlot(aggregated) {
  const shown = [...aggregated].filter(m => m.count).sort((a, b) => b[state.metric] - a[state.metric]);
  const container = $('#model-chart');
  if (!shown.length) { container.innerHTML = `<p class="chart-placeholder">${escape(emptyMessage())}</p>`; return; }
  container.innerHTML = `<div class="bar-chart" role="img" aria-label="${escape(metrics[state.metric])} by model: ${escape(shown.map(m => `${m.name} ${percent(m[state.metric])}%`).join('; '))}">${shown.map(m => `<div class="bar-entry" tabindex="0" data-tooltip="${escape(`${m.name}\n${metrics[state.metric]}: ${percent(m[state.metric])}%\n${m.count} reported result cells`)}"><span class="bar-name"><span class="model-dot ${colorClass(m.id)}"></span>${m.name}</span><div class="bar-track"><div class="bar-fill" style="width:${m[state.metric] * 100}%;background:${m.color}"></div></div><span class="bar-score">${percent(m[state.metric])}</span></div>`).join('')}</div><div class="bar-axis" aria-hidden="true"><span>0</span><span>25</span><span>50</span><span>75</span><span>100</span></div>`;
  $('#model-caption').textContent = `${metrics[state.metric]} · Equal weight per matching result cell.`;
}

function languagePlot(filtered) {
  const container = $('#language-chart');
  const selectedModels = models.filter(m => state.models.includes(m.id));
  $('#chart-legend').innerHTML = selectedModels.map(m => `<span class="legend-item"><span class="model-dot ${colorClass(m.id)}"></span>${m.name}</span>`).join('');
  const available = Object.keys(languages).filter(lang => filtered.some(r => r.language === lang));
  if (!available.length) { container.innerHTML = `<p class="chart-placeholder">${escape(emptyMessage())}</p>`; return; }
  const width = Math.max(container.clientWidth, 250), height = 228;
  const margin = { left: 35, right: 8, top: 18, bottom: 32 };
  const plotW = width - margin.left - margin.right, plotH = height - margin.top - margin.bottom;
  const groupW = plotW / available.length;
  const barW = Math.min(22, (groupW - Math.min(14, groupW * .2)) / Math.max(selectedModels.length, 1));
  const y = score => margin.top + (1 - score) * plotH;
  let svg = `<svg viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="language-plot-title language-plot-desc"><title id="language-plot-title">${escape(metrics[state.metric])} by language</title><desc id="language-plot-desc">Grouped bars for the selected models. Hover or focus each bar for exact values. All values are also available in the individual results table.</desc>`;
  for (const tick of [0, .25, .5, .75, 1]) {
    svg += `<line x1="${margin.left}" x2="${width - margin.right}" y1="${y(tick)}" y2="${y(tick)}" stroke="#e5eae1" stroke-dasharray="${tick === 0 ? '0' : '3 4'}"/><text x="${margin.left - 9}" y="${y(tick) + 4}" fill="#626960" text-anchor="end" font-family="Geist Mono,monospace" font-size="12">${tick * 100}</text>`;
  }
  available.forEach((lang, i) => {
    const center = margin.left + groupW * (i + .5);
    selectedModels.forEach((model, j) => {
      const rows = filtered.filter(r => r.language === lang && r.model === model.id);
      if (!rows.length) return;
      const score = average(rows, state.metric);
      const x = center - selectedModels.length * barW / 2 + j * barW;
      const label = `${languages[lang].name} · ${model.name}\n${metrics[state.metric]}: ${percent(score)}%\n${rows.length} reported result cells`;
      svg += `<rect class="plot-bar" x="${x + 1}" y="${y(score)}" width="${Math.max(barW - 3, 2)}" height="${Math.max(score * plotH, 1)}" rx="2" fill="${model.color}" tabindex="0" role="graphics-symbol" aria-label="${escape(label.replaceAll('\n', ', '))}" data-tooltip="${escape(label)}"><title>${escape(label)}</title></rect>`;
    });
    svg += `<text x="${center}" y="${height - 8}" fill="#626960" text-anchor="middle" font-family="Geist, sans-serif" font-size="12">${escape(lang.toUpperCase())}</text>`;
  });
  container.innerHTML = svg + '</svg>';
}

function renderTable(aggregated, filtered) {
  const valid = aggregated.filter(m => m.count);
  $('#leaderboard-count').textContent = `${valid.length} model${valid.length === 1 ? '' : 's'}`;
  const scope = [state.domain === 'all' ? 'All domains' : capitalize(state.domain), state.language === 'all' ? 'All available languages' : languages[state.language].name, state.scenario === 'all' ? 'Core scenarios' : scenarios[state.scenario].short];
  $('#result-summary').textContent = `${scope.join(' · ')} · ${filtered.length} result cells`;
  $('#export').disabled = !filtered.length;
  const maxima = Object.fromEntries(Object.keys(metrics).map(key => [key, Math.max(...valid.map(m => m[key]))]));
  let rank = 0;
  let priorScore;
  $('#leaderboard-body').innerHTML = !filtered.length ? `<tr><td colspan="7" class="empty-cell">${escape(emptyMessage())}</td></tr>` : aggregated.map((m, index) => {
    if (m.count && m[state.sort] !== priorScore) rank = index + 1;
    priorScore = m[state.sort];
    return `<tr><td class="rank"><span class="${rank === 1 && m.count ? 'rank-first' : ''}">${m.count ? String(rank).padStart(2, '0') : '—'}</span></td><td><div class="model-cell"><span class="model-avatar ${m.id.startsWith('gpt') ? 'gpt' : m.id.startsWith('qwen') ? 'qwen' : ''}">${m.id.startsWith('kimi') ? 'K' : m.id.startsWith('gpt') ? 'G' : 'Q'}</span><div><div class="model-name">${m.name}</div><div class="model-family">${m.family}</div></div></div></td>${Object.keys(metrics).map(key => `<td class="numeric ${m[key] === maxima[key] ? 'best-value' : ''} ${key === state.sort ? 'score-selected' : ''}">${percent(m[key])}</td>`).join('')}<td class="numeric">${m.count || 'Not reported'}</td></tr>`;
  }).join('');
  $('#source-count').textContent = `(${filtered.length} cells)`;
  $('#source-body').innerHTML = !filtered.length ? '<tr><td colspan="9" class="empty-cell">No matching source results.</td></tr>' : filtered.map(r => `<tr><td>${models.find(m => m.id === r.model).name}</td><td>${capitalize(r.domain)}</td><td>${languages[r.language].name}</td><td>${scenarios[r.scenario].short}</td>${['pass1', 'pass2', 'pass3', 'rho3'].map(key => `<td>${percent(r[key])}</td>`).join('')}<td><a href="https://github.com/SEACrowd/SEATauBench/blob/main/SEATauBench_v1.pdf" target="_blank" rel="noopener">Table ${r.sourceTable} ↗</a></td></tr>`).join('');
}

function render(saveUrl = true) {
  syncControls();
  if (!loaded) return;
  const filtered = filterRecords(records, state);
  const aggregated = aggregateModels(records, state);
  modelPlot(aggregated);
  languagePlot(filtered);
  renderTable(aggregated, filtered);
  $('#chart-tooltip').hidden = true;
  if (saveUrl) {
    const search = stateToSearch(state);
    history.replaceState(null, '', `${location.pathname}${search ? '?' + search : ''}${location.hash}`);
  }
}

async function loadData() {
  $('#load-error').hidden = true;
  $('#results').setAttribute('aria-busy', 'true');
  try {
    const response = await fetch(new URL('./data/results.json', import.meta.url));
    if (!response.ok) throw new Error(`Results request failed: ${response.status}`);
    const data = await response.json();
    if (!Array.isArray(data.records) || !data.records.length) throw new Error('No records found');
    if (data.records.some(r => !models.some(m => m.id === r.model) || !languages[r.language] || !scenarios[r.scenario] || !['airline', 'retail', 'telecom'].includes(r.domain) || !Object.keys(metrics).every(k => Number.isFinite(r[k]) && r[k] >= 0 && r[k] <= 1))) throw new Error('Invalid result record');
    records = data.records;
    loaded = true;
    $$('select').forEach(select => { select.disabled = false; });
    render(false);
  } catch (error) {
    console.error(error);
    $('#load-error').hidden = false;
    $$('.chart-surface').forEach(el => { el.innerHTML = '<p class="chart-placeholder">Results unavailable. Please try again.</p>'; });
    $('#result-summary').textContent = 'Results are currently unavailable.';
  } finally { $('#results').setAttribute('aria-busy', 'false'); }
}

for (const key of ['domain', 'language', 'scenario']) $(`#${key}`).addEventListener('change', event => { state[key] = event.target.value; render(); });
$$('input[name=models]').forEach(input => input.addEventListener('change', () => { state.models = models.filter(m => $(`input[value="${m.id}"]`).checked).map(m => m.id); render(); }));
$('#select-all').addEventListener('click', () => { state.models = models.map(m => m.id); render(); });
$('#clear-models').addEventListener('click', () => { state.models = []; render(); });
$('#reset').addEventListener('click', () => { state = { ...defaults, models: [...defaults.models] }; $('#model-picker').open = false; render(); });
$('#retry').addEventListener('click', loadData);
$$('[data-metric]').forEach(button => button.addEventListener('click', () => { state.metric = button.dataset.metric; state.sort = state.metric; state.direction = 'desc'; render(); }));
$$('[data-sort]').forEach(button => button.addEventListener('click', () => { const key = button.dataset.sort; state.direction = state.sort === key && state.direction === 'desc' ? 'asc' : 'desc'; state.sort = key; render(); }));
$$('[data-scenario-link]').forEach(button => button.addEventListener('click', () => { state.scenario = button.dataset.scenarioLink; state.language = 'all'; render(); location.hash = 'explore'; $('#scenario').focus({ preventScroll: true }); }));
window.addEventListener('popstate', () => { state = readState(location.search); render(false); });

$('#export').addEventListener('click', () => {
  const selected = filterRecords(records, state);
  if (!selected.length) return;
  const url = URL.createObjectURL(new Blob(['\uFEFF', toCsv(selected)], { type: 'text/csv;charset=utf-8;' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `seataubench-${state.scenario}-${state.domain}-${state.language}.csv`;
  document.body.append(anchor); anchor.click(); anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast(`Exported ${selected.length} result cells.`);
});

$('#copy-citation').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText($('#bibtex').textContent); toast('BibTeX copied to clipboard.'); }
  catch { $('.citation').open = true; toast('Select and copy the citation below.'); }
});

$('#menu-toggle').addEventListener('click', () => {
  const open = $('#menu-toggle').getAttribute('aria-expanded') !== 'true';
  $('#menu-toggle').setAttribute('aria-expanded', String(open));
  $('#menu-toggle').setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
  $('#navigation').classList.toggle('open', open);
});
function closeNavigation() {
  $('#navigation').classList.remove('open');
  $('#menu-toggle').setAttribute('aria-expanded', 'false');
  $('#menu-toggle').setAttribute('aria-label', 'Open navigation');
}
$$('#navigation a').forEach(link => link.addEventListener('click', closeNavigation));
document.addEventListener('click', event => { if (!$('#model-picker').contains(event.target)) $('#model-picker').open = false; });
document.addEventListener('keydown', event => {
  if (event.key !== 'Escape') return;
  $('#chart-tooltip').hidden = true;
  if ($('#model-picker').open) { $('#model-picker').open = false; $('#model-picker summary').focus(); }
  if ($('#navigation').classList.contains('open')) { closeNavigation(); $('#menu-toggle').focus(); }
});

function showTooltip(target, event) {
  const tooltip = $('#chart-tooltip');
  tooltip.textContent = target.dataset.tooltip;
  tooltip.hidden = false;
  const rect = target.getBoundingClientRect();
  const x = event.clientX || rect.left + rect.width / 2;
  const y = event.clientY || rect.top;
  tooltip.style.left = `${Math.max(8, Math.min(x + 12, innerWidth - tooltip.offsetWidth - 12))}px`;
  tooltip.style.top = `${Math.max(8, Math.min(y - tooltip.offsetHeight - 10, innerHeight - tooltip.offsetHeight - 12))}px`;
}
$('#results').addEventListener('pointerover', event => { const target = event.target.closest('[data-tooltip]'); if (target) showTooltip(target, event); });
$('#results').addEventListener('focusin', event => { const target = event.target.closest('[data-tooltip]'); if (target) showTooltip(target, event); });
$('#results').addEventListener('pointerout', () => { $('#chart-tooltip').hidden = true; });
$('#results').addEventListener('focusout', () => { $('#chart-tooltip').hidden = true; });
let previousWidth = 0;
new ResizeObserver(entries => {
  const width = Math.round(entries[0].contentRect.width);
  if (width === previousWidth) return;
  previousWidth = width;
  if (loaded) languagePlot(filterRecords(records, state));
}).observe($('#language-chart'));

syncControls();
loadData();
