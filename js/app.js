// UI logic. Depends on data.js (osData, families, baseLogo, baseColor, authors, authorTop, deviceTypes, DATA_AS_OF) and icons.js (uiIcon).
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

const MAX_COMPARE = 10;

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
];

// Comparison table rows: [label, icon, value(os) -> text, skipDiff?]
const COMPARE_ROWS = [
  ['Base OS', 'layers', (os) => os.baseOS],
  ['Family', 'branch', (os) => os.distroBase ?? '—'],
  ['Author', 'user', (os) => joined(os.by)],
  ['Devices', 'smartphone', (os) => joined(os.devices)],
  ['License', 'lock', (os) => (os.source.type === 'closed' ? 'Proprietary' : 'Open source')],
  ['Repository', 'code', (os) => os.source.url ?? '—', true], // URLs always differ, so don't highlight
  ...SPECS.map(([key, label, icon]) => [label, icon, (os) => joined(os.specs[key])]),
];

const byId = new Map(osData.map((os) => [os.id, os]));
const bases = ['All', ...new Set(osData.map((os) => os.baseOS))];
const distros = ['All', ...Object.keys(families)];
const deviceNames = ['All', ...Object.keys(deviceTypes)];
const deviceCount = (d) => (d === 'All' ? osData.length : osData.filter((os) => os.devices.includes(d)).length);
const authorCount = {};
osData.forEach((os) => os.by.forEach((a) => { authorCount[a] = (authorCount[a] ?? 0) + 1; }));
// authorTop first (in that order), then most systems, then companies > organizations > developers, then A-Z
const TYPE_RANK = { company: 0, organization: 1, developer: 2 };
const rank = (a) => (authorTop.includes(a) ? authorTop.indexOf(a) : authorTop.length);
const authorNames = Object.keys(authors).sort((a, b) =>
  rank(a) - rank(b) || authorCount[b] - authorCount[a] || TYPE_RANK[authors[a].type] - TYPE_RANK[authors[b].type] || a.localeCompare(b));
const state = { base: 'All', distro: 'All', device: 'All', author: 'All', authorsOpen: false, query: '' };
// "Red Hat (IBM)": show the owning company next to an author that has one
const authorLabel = (a) => (authors[a].parent ? `${a} (${authors[a].parent})` : a);
const compare = []; // ids, in the order added

// Lowercased searchable text per OS, built once.
const index = osData.map((os) => ({
  os,
  text: [os.name, os.baseOS, os.distroBase, ...os.by, ...os.devices, ...SPECS.flatMap(([k]) => os.specs[k])].join('\n').toLowerCase(),
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
  logoTile(os.logo, size, initials(os.name), families[os.distroBase]?.color ?? baseColor[os.baseOS]);

const cell = (v) => /^https?:\/\//.test(v)
  ? `<a href="${esc(v)}" target="_blank" rel="noopener" class="text-emerald-400 hover:underline break-all">${esc(v.replace(/^https?:\/\//, ''))}</a>`
  : esc(v);

// ---------- render ----------
// Pills without a logo file (All, and base OSes with no logo) get a UI icon instead.
const BASE_PILL_ICON = { All: 'grid', UNIX: 'terminal', Independent: 'compass' };

function pill(kind, value, label, file, fallbackIcon, size, dir) {
  const icon = file ? logoTile(file, size, '', '', dir) : uiIcon(fallbackIcon, size);
  return `<button type="button" class="pill" data-${kind}="${esc(value)}" aria-pressed="${state[kind] === value}">${icon}${esc(label)}</button>`;
}

function renderPills() {
  $('basePills').innerHTML = bases.map((b) =>
    pill('base', b, b === 'All' ? 'All OS' : b, baseLogo[b], BASE_PILL_ICON[b], 'w-5 h-5')).join('');
  $('distroPills').innerHTML =
    '<span class="text-slate-400 self-center font-medium mr-1">Distro Base:</span>' +
    distros.map((d) =>
      pill('distro', d, d === 'All' ? 'All Distros' : families[d].label, families[d]?.logo, 'grid', 'w-4 h-4')).join('');
  $('distroPills').hidden = state.base !== 'Linux';
  $('devicePills').innerHTML =
    '<span class="text-slate-400 self-center font-medium mr-1">Device:</span>' +
    deviceNames.map((d) => pill('device', d, d === 'All' ? 'All Devices' : d, null, deviceTypes[d]?.icon ?? 'grid', 'w-4 h-4')
      .replace('<button ', `<button title="${deviceCount(d)} systems" `)).join('');

  // Authors: collapsed to authorTop (plus the selected one) until expanded.
  const shown = state.authorsOpen ? authorNames
    : authorNames.filter((a) => authorTop.includes(a) || a === state.author);
  $('authorPills').innerHTML =
    '<span class="text-slate-400 self-center font-medium mr-1" title="Primary author, plus the upstream projects it is built on">Author / upstream:</span>' +
    pill('author', 'All', 'All Authors', null, 'grid', 'w-4 h-4') +
    shown.map((a) => pill('author', a, authorLabel(a), authors[a].logo, 'user', 'w-4 h-4', 'author').replace('<button ', `<button title="${esc(authors[a].type)} · ${authorCount[a]} system${authorCount[a] > 1 ? 's' : ''}" `)).join('') +
    `<button type="button" class="pill pill-more" data-more-authors>${state.authorsOpen ? 'Show fewer' : `Show all ${authorNames.length}`}</button>`;
}

function card(os) {
  const badge = os.source.type === 'closed'
    ? `<span class="badge badge-closed">${uiIcon('lock')} Proprietary</span>`
    : `<a href="${esc(os.source.url)}" target="_blank" rel="noopener" class="badge badge-open">${uiIcon('branch')} FOSS Repo</a>`;
  return `
    <article class="glass-card rounded-xl p-4 flex flex-col items-center justify-between text-center">
      <button type="button" class="card-hit" data-action="open" data-id="${os.id}" aria-label="${esc(os.name)} details"></button>
      <button type="button" class="cmp-toggle" data-action="toggle" data-id="${os.id}"></button>
      <div class="mb-3">${osIcon(os, 'w-14 h-14')}</div>
      <div>
        <h3 class="font-bold text-slate-100 text-sm">${esc(os.name)}</h3>
        <span class="tag">${esc(os.distroBase ?? os.baseOS)}</span>
      </div>
      <div class="mt-3 text-xs relative">${badge}</div>
    </article>`;
}

function renderGrid() {
  const q = state.query.trim().toLowerCase();
  const shown = index.filter(({ os, text }) =>
    (state.base === 'All' || os.baseOS === state.base) &&
    (state.base !== 'Linux' || state.distro === 'All' || os.distroBase === state.distro) &&
    (state.device === 'All' || os.devices.includes(state.device)) &&
    (state.author === 'All' || os.by.includes(state.author)) &&
    text.includes(q)).map(({ os }) => os);

  $('osGrid').innerHTML = shown.map(card).join('');
  $('empty').hidden = shown.length > 0;
  $('count').textContent = `${shown.length} of ${osData.length} systems`;
  syncToggles($('osGrid'));
}

function openModal(id) {
  const os = byId.get(id);
  const source = os.source.type === 'closed'
    ? `<span class="text-rose-400 font-semibold flex items-center gap-1">${uiIcon('lock')} Proprietary / Closed Source</span>`
    : `<a href="${esc(os.source.url)}" target="_blank" rel="noopener" class="text-emerald-400 hover:underline flex items-center gap-1">${uiIcon('branch')} Open Source Repository</a>`;

  $('modalContent').innerHTML = `
    <div class="flex items-center gap-4 mb-6 pb-4 border-b border-slate-800">
      ${osIcon(os, 'w-16 h-16')}
      <div>
        <h2 class="text-2xl font-bold text-white">${esc(os.name)}</h2>
        <p class="text-sm text-slate-400 mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">${os.by.filter((a) => !os.by.some((b) => authors[b].parent === a)).map((a, i) => `<span class="flex items-center gap-1.5${i ? '' : ' text-slate-200'}">${logoTile(authors[a].logo, 'w-5 h-5', initials(a), '#5b6472', 'author')}${esc(authorLabel(a))}</span>`).join('')}</p>
        <div class="flex flex-wrap gap-x-2 items-center text-sm mt-1">
          <span class="text-slate-400">Base: ${esc(os.baseOS)}${os.distroBase ? ` (${esc(os.distroBase)})` : ''}</span> • ${source}
        </div>
        <p class="text-sm text-slate-400 mt-1 flex flex-wrap gap-x-3 items-center">${os.devices.map((d) => `<span class="flex items-center gap-1">${uiIcon(deviceTypes[d].icon, 'w-4 h-4 text-sky-400')}${d}</span>`).join('')}</p>
        <button type="button" class="btn mt-3" data-action="toggle" data-id="${os.id}" data-text></button>
      </div>
    </div>
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
      ${SPECS.map(([key, label, icon]) => `
        <div class="bg-slate-800/50 p-3 rounded-lg">
          <strong class="text-slate-200 flex items-center gap-1.5">${uiIcon(icon, 'w-4 h-4 text-sky-400')} ${label}</strong>
          <div class="text-slate-400 mt-1">${esc(joined(os.specs[key]))}</div>
        </div>`).join('')}
    </div>`;
  syncToggles($('modalContent'));
  $('detailModal').showModal();
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
  if ('moreAuthors' in btn.dataset) state.authorsOpen = !state.authorsOpen;
  else if (btn.dataset.base) { state.base = btn.dataset.base; state.distro = 'All'; }
  else if (btn.dataset.device) state.device = btn.dataset.device;
  else if (btn.dataset.author) state.author = btn.dataset.author;
  else state.distro = btn.dataset.distro;
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
$('asOf').textContent = `Kernel and release versions as of ${DATA_AS_OF}. Systems without a version could not be confirmed.`;
renderPills();
renderGrid();
renderBar();
