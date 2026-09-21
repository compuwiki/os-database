// UI logic: loads the data (js/data.js), then renders the filters, the grid, the detail dialog and the comparison.
import { loadData } from './data.js';
import { uiIcon } from './icons.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

const MAX_COMPARE = 10;

let data;
try {
  data = await loadData();
} catch (err) {
  $('osGrid').innerHTML = `<p class="col-span-full text-center text-rose-300 py-16">Could not load the data (${esc(err.message)}).<br>
    Serve this folder over HTTP (GitHub Pages, <code>python -m http.server</code> or Live Server) instead of opening index.html directly.</p>`;
  throw err;
}
const { osData, families, baseTypes, authors, authorKinds, basedOnTypes, deviceTypes, licenseTypes, installTiers, unixStatus, generations, dataAsOf } = data;

// [key in os.specs, label, icon]
const SPECS = [
  ['cpuCompatibility', 'CPU Support', 'cpu'],
  ['kernel', 'Kernel', 'terminal'],
  ['bootloader', 'Bootloader', 'power'],
  ['fileSystems', 'File Systems', 'drive'],
  ['graphicServer', 'Graphic Server', 'monitor'],
  ['audioServer', 'Audio Server', 'audio'],
  ['desktopEnvironment', 'Desktop / Shell', 'layout'],
  ['packageManager', 'Package Manager', 'package'],
  ['defaultShell', 'Default Shell', 'chevrons'],
  ['userland', 'Userland / Core Tools', 'tool'],
];

// Comparison table rows: [label, icon, value(os) -> text, skipDiff?]
const COMPARE_ROWS = [
  ['Known for', 'compass', (os) => os.knownFor],
  ['Pitch', 'feather', (os) => os.pitch ?? '—'],
  ['Base OS', 'layers', (os) => os.baseOS],
  ['Family', 'branch', (os) => os.distroBase ?? '—'],
  ['UNIX heritage', 'terminal', (os) => unixStatus[os.unix].label],
  ['Generation', 'layers', (os) => generations[os.generation]?.label ?? '—'],
  ['Author', 'user', (os) => joined(os.by)],
  ['Based on', 'layers', (os) => joined(os.basedOn) || '—'],
  ['Devices', 'smartphone', (os) => joined(devicesOf(os))],
  ['License', 'lock', (os) => os.license],
  ['Installs (est.)', 'drive', (os) => installTiers[os.installs]],
  ['Repository', 'code', (os) => os.source.url ?? '—', true], // URLs always differ, so don't highlight
  ...SPECS.map(([key, label, icon]) => [label, icon, (os) => joined(os.specs[key])]),
];

const byId = new Map(osData.map((os) => [os.id, os]));
const bases = ['All', ...Object.keys(baseTypes)];
const baseCount = (b) => (b === 'All' ? osData.length : osData.filter((os) => os.baseOS === b).length);
const deviceNames = ['All', ...Object.keys(deviceTypes)];
// Device tags in the order of deviceTypes (Server, Desktop, ...)
const devicesOf = (os) => Object.keys(deviceTypes).filter((d) => os.devices.includes(d));
const deviceCount = (d) => (d === 'All' ? osData.length : osData.filter((os) => os.devices.includes(d)).length);
// License pills: All / Proprietary / Open Source; Open Source reveals a second row with the license families in use
const LICENSE_OPEN = 'Open Source';
const openSource = (os) => os.licenseTags.some((t) => t !== 'Proprietary');
const licenseMatch = (os, l) => (l === 'All' ? true : l === LICENSE_OPEN ? openSource(os) : os.licenseTags.includes(l));
const licenseCount = (l, family = 'All') => osData.filter((os) => licenseMatch(os, l) && (family === 'All' || os.licenseTags.includes(family))).length;
const licenseFamilies = Object.keys(licenseTypes).filter((f) => f !== 'Proprietary' && licenseCount(LICENSE_OPEN, f));
// User pills: each system is in exactly one tier (estimates)
const installsMatch = (os, t) => t === 'All' || os.installs === t;
const installCount = (t) => osData.filter((os) => installsMatch(os, t)).length;
// "Based on" options that apply to the systems in the selected Base OS (with counts). Empty when none of them narrows the list.
const basedOnOptions = () => {
  const pool = osData.filter((os) => state.base === 'All' || os.baseOS === state.base);
  const n = Object.fromEntries(Object.keys(basedOnTypes).map((b) => [b, pool.filter((os) => os.basedOn.includes(b)).length]));
  // keep only options that narrow the list (an option matching every system in the Base OS says nothing)
  return { n, total: pool.length, options: Object.keys(n).filter((b) => n[b] > 0 && n[b] < pool.length) };
};
// "Generation" options (e.g. NT 5 / NT 6 / NT 10) when a Base OS is selected and its systems span several generations
const generationOptions = () => {
  const pool = osData.filter((os) => state.base !== 'All' && os.baseOS === state.base);
  const n = Object.fromEntries(Object.keys(generations).map((g) => [g, pool.filter((os) => os.generation === g).length]));
  const options = Object.keys(n).filter((g) => n[g] > 0);
  return { n, total: pool.length, options: options.length > 1 ? options : [] };
};
const state = { base: 'All', based: 'All', generation: 'All', device: 'All', license: 'All', family: 'All', installs: 'All', kind: 'All', author: 'All', query: '' };
// Author counts inside the selected Base OS: per author and per category
const authorStats = () => {
  const author = {}, kind = {};
  osData.forEach((os) => {
    if (state.base !== 'All' && os.baseOS !== state.base) return;
    new Set(os.by).forEach((a) => { author[a] = (author[a] ?? 0) + 1; });
    new Set(os.by.map((a) => authors[a].type)).forEach((k) => { kind[k] = (kind[k] ?? 0) + 1; });
  });
  return { author, kind };
};
// "Red Hat (IBM)": show the owning company next to an author that has one
const authorLabel = (a) => (authors[a]?.parent ? `${a} (${authors[a].parent})` : a);
const compare = []; // ids, in the order added

// Lowercased searchable text per OS, built once.
const index = osData.map((os) => ({
  os,
  text: [os.name, os.knownFor, os.pitch ?? '', os.baseOS, os.distroBase, unixStatus[os.unix].label, generations[os.generation]?.label ?? '', os.license, ...os.by, ...os.basedOn, ...os.devices, ...SPECS.flatMap(([k]) => os.specs[k])].join('\n').toLowerCase(),
}));

function joined(v) { return [].concat(v).join(', '); }

// "BlackArch" -> "BA", "Peppermint OS" -> "PO", "Slax" -> "Sl"
function initials(name) {
  const w = name.replace(/([a-z])([A-Z])/g, '$1 $2').split(/[^A-Za-z0-9]+/).filter(Boolean);
  return w.length > 1 ? (w[0][0] + w[1][0]).toUpperCase() : w[0][0].toUpperCase() + w[0][1];
}

// Logo tile: a logo file, else initials tinted with `color`.
function logoTile(file, size, initialsText, color, dir = 'logos') {
  const inner = file
    ? `<img src="assets/${dir}/${file}" alt="" loading="lazy">`
    : `<svg viewBox="0 0 24 24" aria-hidden="true"><text x="12" y="12.5" text-anchor="middle" dominant-baseline="central" font-family="system-ui, sans-serif" font-size="10.5" font-weight="700" fill="${color}">${esc(initialsText)}</text></svg>`;
  return `<span class="logo ${size}">${inner}</span>`;
}

const osIcon = (os, size) =>
  logoTile(os.logo, size, initials(os.name), families[os.distroBase]?.color ?? baseTypes[os.baseOS].color);

const cell = (v) => /^https?:\/\//.test(v)
  ? `<a href="${esc(v)}" target="_blank" rel="noopener" class="text-emerald-400 hover:underline break-all">${esc(v.replace(/^https?:\/\//, ''))}</a>`
  : esc(v);

// ---------- render ----------
function pill(kind, value, label, file, fallbackIcon, size, dir) {
  const icon = file ? logoTile(file, size, '', '', dir) : uiIcon(fallbackIcon, size);
  return `<button type="button" class="pill" data-${kind}="${esc(value)}" aria-pressed="${state[kind] === value}">${icon}${esc(label)}</button>`;
}

function renderPills() {
  // Pills without a logo file (All, UNIX, ...) get a UI icon instead.
  $('basePills').innerHTML =
    bases.map((b) => pill('base', b, b === 'All' ? 'All OS' : b, baseTypes[b]?.logo, baseTypes[b]?.icon ?? 'grid', 'w-5 h-5')
      .replace('<button ', `<button title="${esc(baseTypes[b]?.hint ?? 'Grouped by kernel lineage')} · ${baseCount(b)} systems" `)).join('');
  const based = basedOnOptions();
  $('basedPills').innerHTML = ['All', ...based.options].map((b) =>
    pill('based', b, b === 'All' ? 'Based on: any' : basedOnTypes[b].label, basedOnTypes[b]?.logo, basedOnTypes[b]?.icon ?? 'layers', 'w-4 h-4')
      .replace('<button ', `<button title="${esc(basedOnTypes[b]?.hint ?? 'Upstream a system is built on')} · ${b === 'All' ? based.total : based.n[b]} systems" `)).join('');
  $('basedPills').hidden = based.options.length === 0;
  const gen = generationOptions();
  $('generationPills').innerHTML = ['All', ...gen.options].map((g) =>
    pill('generation', g, g === 'All' ? 'Generation: any' : generations[g].label, null, 'layers', 'w-4 h-4')
      .replace('<button ', `<button title="${esc(generations[g]?.hint ?? 'Kernel generation')} · ${g === 'All' ? gen.total : gen.n[g]} systems" `)).join('');
  $('generationPills').hidden = gen.options.length === 0;
  $('devicePills').innerHTML =
    deviceNames.map((d) => pill('device', d, d === 'All' ? 'All Devices' : d, null, deviceTypes[d]?.icon ?? 'grid', 'w-4 h-4')
      .replace('<button ', `<button title="${esc(deviceTypes[d]?.hint ?? '')}${d === 'All' ? '' : ' · '}${deviceCount(d)} systems" `)).join('');

  const hintTitle = (hint, n) => `title="${esc(hint)}${hint ? ' · ' : ''}${n} system${n === 1 ? '' : 's'}"`;
  $('licensePills').innerHTML =
    [['All', 'All Licenses', 'grid', ''], ['Proprietary', 'Proprietary', 'lock', licenseTypes.Proprietary.hint], [LICENSE_OPEN, LICENSE_OPEN, 'unlock', 'Anything with an open-source license']]
      .map(([l, label, icon, hint]) => pill('license', l, label, null, icon, 'w-4 h-4').replace('<button ', `<button ${hintTitle(hint, licenseCount(l))} `)).join('');
  $('licenseFamilyPills').innerHTML =
    '<span class="text-slate-400 self-center font-medium mr-1">Open Source:</span>' +
    ['All', ...licenseFamilies].map((f) => pill('family', f, f === 'All' ? 'All open licenses' : licenseTypes[f].label, null, f === 'All' ? 'unlock' : licenseTypes[f].icon, 'w-4 h-4')
      .replace('<button ', `<button ${hintTitle(f === 'All' ? '' : licenseTypes[f].hint, licenseCount(LICENSE_OPEN, f))} `)).join('');
  $('licenseFamilyPills').hidden = state.license !== LICENSE_OPEN;
  $('installPills').innerHTML =
    ['All', ...Object.keys(installTiers)].map((t) => pill('installs', t, t === 'All' ? 'All Installs' : t, null, 'drive', 'w-4 h-4')
      .replace('<button ', `<button ${hintTitle(t === 'All' ? 'Rough estimates of active installs: devices, servers and long-lived VMs (not short-lived containers)' : `${installTiers[t]} installs (est.)`, installCount(t))} `)).join('');

  // Authors: category pills; picking one lists its authors below (only those with systems in the selected Base OS).
  const stats = authorStats();
  $('authorPills').innerHTML =
    pill('kind', 'All', 'All Authors', null, 'grid', 'w-4 h-4').replace('<button ', '<button title="Who makes a system (the upstream it is built on is under Based on)" ') +
    Object.keys(authorKinds).filter((k) => stats.kind[k]).map((k) => pill('kind', k, authorKinds[k].label, null, authorKinds[k].icon, 'w-4 h-4')
      .replace('<button ', `<button title="${esc(authorKinds[k].hint)} · ${stats.kind[k]} systems" `)).join('');
  const kind = authorKinds[state.kind];
  $('authorSubPills').innerHTML = !kind ? '' :
    pill('author', 'All', `All ${kind.label.toLowerCase()}`, null, kind.icon, 'w-4 h-4') +
    Object.keys(stats.author).filter((a) => authors[a].type === state.kind).sort((a, b) => stats.author[b] - stats.author[a] || a.localeCompare(b))
      .map((a) => pill('author', a, authorLabel(a), authors[a].logo, kind.icon, 'w-4 h-4', 'author')
        .replace('<button ', `<button title="${stats.author[a]} system${stats.author[a] > 1 ? 's' : ''}" `)).join('');
  $('authorSubPills').hidden = !kind;
}

function card(os) {
  const badge = os.source.type === 'closed'
    ? `<span class="badge badge-closed">${uiIcon('lock')} Proprietary</span>`
    : `<span class="badge badge-open">${uiIcon('branch')} Open Source</span>`;
  return `
    <article class="glass-card rounded-xl p-4 flex flex-col items-center justify-between text-center">
      <button type="button" class="card-hit" data-action="open" data-id="${os.id}" aria-label="${esc(os.name)} details"></button>
      <button type="button" class="cmp-toggle" data-action="toggle" data-id="${os.id}"></button>
      <div class="mb-3">${osIcon(os, 'w-14 h-14')}</div>
      <div>
        <h3 class="font-bold text-slate-100 text-sm">${esc(os.name)}</h3>
        <span class="tag">${esc(os.distroBase ?? os.baseOS)}</span>
      </div>
      <div class="mt-3 text-xs">${badge}</div>
    </article>`;
}

function renderGrid() {
  const q = state.query.trim().toLowerCase();
  const shown = index.filter(({ os, text }) =>
    (state.base === 'All' || os.baseOS === state.base) &&
    (state.device === 'All' || os.devices.includes(state.device)) &&
    licenseMatch(os, state.license) && (state.family === 'All' || os.licenseTags.includes(state.family)) &&
    installsMatch(os, state.installs) &&
    (state.based === 'All' || os.basedOn.includes(state.based)) &&
    (state.generation === 'All' || os.generation === state.generation) &&
    (state.kind === 'All' || os.by.some((a) => authors[a].type === state.kind && (state.author === 'All' || a === state.author))) &&
    text.includes(q)).map(({ os }) => os);

  $('osGrid').innerHTML = shown.map(card).join('');
  $('empty').hidden = shown.length > 0;
  $('count').textContent = `${shown.length} of ${osData.length} systems`;
  syncToggles($('osGrid'));
}

function openModal(id) {
  const os = byId.get(id);
  const chip = (inner, hint = '') => `<span class="info-chip"${hint ? ` title="${esc(hint)}"` : ''}>${inner}</span>`;
  // an owner already shown inside its child's label (Red Hat (IBM)) is not repeated
  const owners = os.by.filter((a) => !os.by.some((b) => authors[b].parent === a));
  const source = os.source.type === 'closed'
    ? chip(`${uiIcon('lock', 'w-3.5 h-3.5')}Proprietary / closed source`, 'No public source code')
    : `<a href="${esc(os.source.url)}" target="_blank" rel="noopener" class="info-link">${uiIcon('branch', 'w-4 h-4')}${esc(os.source.url.replace(/^https?:\/\//, ''))}</a>`;

  // label -> value (falsy rows are skipped)
  const facts = [
    ['Author', owners.map((a) => chip(`${logoTile(authors[a].logo, 'w-4 h-4', initials(a), '#5b6472', 'author')}${esc(authorLabel(a))}`)).join('')],
    ['Base', chip(esc(os.baseOS + (os.distroBase ? ` · ${os.distroBase}` : ''))) +
      (os.generation ? chip(esc(generations[os.generation].label), generations[os.generation].hint) : '') +
      chip(esc(unixStatus[os.unix].label), unixStatus[os.unix].hint)],
    os.basedOn.length && ['Based on', os.basedOn.map((b) => chip(
      `${basedOnTypes[b].logo ? logoTile(basedOnTypes[b].logo, 'w-4 h-4') : uiIcon(basedOnTypes[b].icon, 'w-3.5 h-3.5')}${esc(b)}`, basedOnTypes[b].hint)).join('')],
    ['Devices', devicesOf(os).map((d) => chip(`${uiIcon(deviceTypes[d].icon, 'w-3.5 h-3.5 text-sky-400')}${d}`, deviceTypes[d].hint)).join('')],
    ['License', esc(os.license)],
    ['Installs', `<span title="Rough estimate of active installs: devices, servers and long-lived VMs">${esc(installTiers[os.installs])} <span class="text-slate-500">(est.)</span></span>`],
    ['Source', source],
  ].filter(Boolean);

  $('modalContent').innerHTML = `
    <header class="flex items-start gap-4 pr-10">
      ${osIcon(os, 'w-16 h-16')}
      <div class="min-w-0">
        <h2 class="text-2xl font-bold text-white leading-tight">${esc(os.name)}</h2>
        <p class="text-sm font-semibold text-sky-300 mt-1">${esc(os.knownFor)}</p>
        ${os.pitch ? `<p class="text-sm italic text-slate-400 mt-1">“${esc(os.pitch)}”</p>` : ''}
      </div>
    </header>

    <dl class="facts mt-5 pt-5 border-t border-slate-800">
      ${facts.map(([label, value]) => `<dt>${label}</dt><dd>${value}</dd>`).join('')}
    </dl>
    <button type="button" class="btn mt-5" data-action="toggle" data-id="${os.id}" data-text></button>

    <h3 class="mt-6 pt-5 border-t border-slate-800 mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Specifications</h3>
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
      ${SPECS.map(([key, label, icon]) => `
        <div class="bg-slate-800/50 p-3 rounded-lg">
          <strong class="text-slate-200 flex items-center gap-1.5">${uiIcon(icon, 'w-4 h-4 text-sky-400')} ${label}</strong>
          <div class="text-slate-400 mt-1">${esc(joined(os.specs[key]))}</div>
        </div>`).join('')}
    </div>`;
  syncToggles($('modalContent'));
  $('detailModal').showModal();
  $('detailScroll').scrollTop = 0; // reopened dialogs start at the top
}

// ---------- comparison (add / remove / clear / view) ----------
// Add/remove buttons ([data-action="toggle"]) are stateless markup; this fills in icon, label and disabled state.
function syncToggles(root) {
  const full = compare.length >= MAX_COMPARE;
  root.querySelectorAll('[data-action="toggle"]').forEach((b) => {
    const on = compare.includes(b.dataset.id);
    b.setAttribute('aria-pressed', on);
    b.disabled = !on && full;
    b.title = b.disabled ? `Comparison is full (max ${MAX_COMPARE})` : `${on ? 'Remove from' : 'Add to'} comparison`;
    b.setAttribute('aria-label', `${on ? 'Remove' : 'Add'} ${byId.get(b.dataset.id).name} ${on ? 'from' : 'to'} comparison`);
    b.innerHTML = uiIcon(on ? 'minus' : 'plus') + ('text' in b.dataset ? `<span>${on ? 'Remove from' : 'Add to'} comparison</span>` : '');
  });
}

function renderBar() {
  $('compareBar').hidden = compare.length === 0;
  $('compareCount').textContent = `${compare.length}/${MAX_COMPARE} selected`;
  $('compareChips').innerHTML = compare.map((id) => {
    const os = byId.get(id);
    return `<li class="chip">${osIcon(os, 'w-6 h-6')}<span>${esc(os.name)}</span>
      <button type="button" class="icon-btn" data-action="remove" data-id="${id}" aria-label="Remove ${esc(os.name)} from comparison" title="Remove">${uiIcon('close', 'w-3.5 h-3.5')}</button></li>`;
  }).join('');
  $('compareBtn').disabled = compare.length < 2;
  $('compareBtn').title = compare.length < 2 ? 'Select at least 2 systems' : '';
}

function renderTable() {
  const cols = compare.map((id) => byId.get(id));
  $('compareTitle').textContent = `Compare systems (${cols.length}/${MAX_COMPARE})`;
  const head = cols.map((os) => `
    <th scope="col"><div class="flex items-center gap-2">
      ${osIcon(os, 'w-8 h-8')}<span class="flex-1 text-slate-100">${esc(os.name)}</span>
      <button type="button" class="icon-btn" data-action="remove" data-id="${os.id}" aria-label="Remove ${esc(os.name)} from comparison" title="Remove">${uiIcon('close')}</button>
    </div></th>`).join('');
  const body = COMPARE_ROWS.map(([label, icon, get, skipDiff]) => {
    const vals = cols.map(get);
    const differs = !skipDiff && new Set(vals).size > 1;
    return `<tr${differs ? ' class="diff"' : ''}>
      <th scope="row"><span class="flex items-center gap-1.5">${uiIcon(icon, 'w-4 h-4 text-sky-400')}${label}</span></th>
      ${vals.map((v) => `<td>${cell(v)}</td>`).join('')}</tr>`;
  }).join('');
  $('compareTable').innerHTML = `<thead><tr><th><span class="sr-only">Property</span></th>${head}</tr></thead><tbody>${body}</tbody>`;
}

function syncCompare() {
  syncToggles(document);
  renderBar();
  if (!$('compareModal').open) return;
  if (compare.length === 0) return $('compareModal').close();
  renderTable();
  $('compareTable').querySelector('[data-action="remove"]').focus(); // the clicked button was re-rendered
}

function toggleCompare(id) {
  const i = compare.indexOf(id);
  if (i >= 0) compare.splice(i, 1);
  else if (compare.length < MAX_COMPARE) compare.push(id);
  syncCompare();
}

const actions = {
  open: openModal,
  toggle: toggleCompare,
  remove: toggleCompare,
  clear: () => { compare.length = 0; syncCompare(); },
  compare: () => { renderTable(); $('compareModal').showModal(); },
  close: (_, el) => el.closest('dialog').close(),
};

// ---------- events ----------
$('filters').addEventListener('click', (e) => {
  const btn = e.target.closest('.pill');
  if (!btn) return;
  if (btn.dataset.base) {
    state.base = btn.dataset.base;
    const st = authorStats(); // drop an author / category that has nothing in this Base OS
    if (state.kind !== 'All' && !st.kind[state.kind]) { state.kind = 'All'; state.author = 'All'; }
    else if (state.author !== 'All' && !(state.author in st.author)) state.author = 'All';
    if (state.based !== 'All' && !basedOnOptions().options.includes(state.based)) state.based = 'All';
    if (state.generation !== 'All' && !generationOptions().options.includes(state.generation)) state.generation = 'All';
  }
  else if (btn.dataset.based) state.based = btn.dataset.based;
  else if (btn.dataset.generation) state.generation = btn.dataset.generation;
  else if (btn.dataset.device) state.device = btn.dataset.device;
  else if (btn.dataset.license) { state.license = btn.dataset.license; state.family = 'All'; }
  else if (btn.dataset.family) state.family = btn.dataset.family;
  else if (btn.dataset.installs) state.installs = btn.dataset.installs;
  else if (btn.dataset.kind) { state.kind = btn.dataset.kind; state.author = 'All'; }
  else if (btn.dataset.author) state.author = btn.dataset.author;
  renderPills();
  renderGrid();
});

$('searchInput').addEventListener('input', (e) => { state.query = e.target.value; renderGrid(); });

// One delegated handler for every [data-action]. <dialog> gives Esc + focus trap; a click on the dialog itself is the backdrop.
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (el) actions[el.dataset.action](el.dataset.id, el);
  else if (e.target instanceof HTMLDialogElement) e.target.close();
});

window.addEventListener('keydown', (e) => {
  if (e.key === '/' && !e.target.matches('input, textarea') && !document.querySelector('dialog[open]')) {
    e.preventDefault();
    $('searchInput').focus();
  }
});

// ---------- init ----------
document.querySelectorAll('[data-icon]').forEach((el) => { el.innerHTML = uiIcon(el.dataset.icon, el.dataset.size ?? 'w-4 h-4'); });
$('asOf').textContent = `Kernel and release versions as of ${dataAsOf}. Systems without a version could not be confirmed. Install counts are rough estimates of active devices, servers and long-lived VMs.`;
renderPills();
renderGrid();
renderBar();
