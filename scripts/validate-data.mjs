// Checks that the JSON under data/ is consistent: `node scripts/validate-data.mjs` (exit code 1 on problems).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => JSON.parse(fs.readFileSync(path.join(root, 'data', rel), 'utf8'));
const exists = (rel) => fs.existsSync(path.join(root, rel));
const errors = [];
const err = (msg) => errors.push(msg);

const meta = read('meta.json');
const t = Object.fromEntries(['base-types', 'families', 'based-on', 'device-types', 'license-types', 'install-tiers', 'author-kinds'].map((n) => [n, read(`taxonomy/${n}.json`)]));
const authors = read('authors.json');

// systems: every listed file exists, every file under data/systems is listed
const listed = new Set(meta.systemFiles);
const onDisk = (dir) => fs.readdirSync(path.join(root, 'data', dir), { withFileTypes: true })
  .flatMap((e) => (e.isDirectory() ? onDisk(`${dir}/${e.name}`) : [`${dir}/${e.name}`]));
for (const f of onDisk('systems')) if (!listed.has(f)) err(`${f}: not listed in meta.json systemFiles`);
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const SPEC_KEYS = ['cpuCompatibility', 'kernel', 'bootloader', 'fileSystems', 'graphicServer', 'audioServer', 'desktopEnvironment', 'packageManager', 'defaultShell', 'userland'];
const ids = new Set();
const systems = [];
for (const f of meta.systemFiles) {
  if (!exists(`data/${f}`)) { err(`${f}: listed in meta.json but missing`); continue; }
  const list = read(f);
  for (const o of list) {
    systems.push(o);
    const at = (m) => err(`${f} > ${o.id ?? '?'}: ${m}`);
    if (ids.has(o.id)) at('duplicate id');
    ids.add(o.id);
    const expected = o.baseOS === 'Linux' ? `systems/linux/${slug(o.distroBase ?? '')}.json` : `systems/${slug(o.baseOS)}.json`;
    if (f !== expected) at(`belongs in ${expected}`);
    if (!t['base-types'][o.baseOS]) at('unknown baseOS ' + o.baseOS);
    if (o.baseOS === 'Linux' ? !t.families[o.distroBase] : o.distroBase != null) at('bad distroBase ' + o.distroBase);
    if (!o.name) at('no name');
    if (!o.by?.length) at('no authors');
    for (const a of o.by ?? []) if (!authors[a]) at('unknown author ' + a);
    for (const b of o.basedOn ?? []) if (!t['based-on'][b]) at('unknown basedOn ' + b);
    if (!Array.isArray(o.basedOn)) at('basedOn must be an array (can be empty)');
    if (!o.devices?.length) at('no devices');
    for (const d of o.devices ?? []) if (!t['device-types'][d]) at('unknown device ' + d);
    if (!o.license || !o.licenseTags?.length) at('no license');
    for (const l of o.licenseTags ?? []) if (!t['license-types'][l]) at('unknown license tag ' + l);
    if (!(o.installs in t['install-tiers'])) at('unknown installs tier ' + o.installs);
    if (o.logo && !exists(`assets/logos/${o.logo}`)) at('missing logo file ' + o.logo);
    if (!['open-source', 'closed'].includes(o.source?.type)) at('bad source');
    if (o.source?.type === 'open-source' && !/^https?:\/\//.test(o.source.url ?? '')) at('bad source url');
    for (const k of SPEC_KEYS) {
      const v = o.specs?.[k];
      if (v == null || (Array.isArray(v) && !v.length) || (!Array.isArray(v) && typeof v !== 'string')) at('missing or malformed spec ' + k);
    }
  }
}

for (const [name, a] of Object.entries(authors)) {
  if (!t['author-kinds'][a.type]) err(`author ${name}: unknown type ${a.type}`);
  if (a.logo && !exists(`assets/author/${a.logo}`)) err(`author ${name}: missing logo file ${a.logo}`);
  if (a.parent && !authors[a.parent]) err(`author ${name}: unknown parent ${a.parent}`);
  if (!systems.some((o) => o.by.includes(name))) err(`author ${name}: not used by any system`);
}
for (const [group, list] of [['families', t.families], ['base-types', t['base-types']], ['based-on', t['based-on']]])
  for (const [k, v] of Object.entries(list)) if (v.logo && !exists(`assets/logos/${v.logo}`)) err(`${group} > ${k}: missing logo ${v.logo}`);

const usedLogos = new Set([...systems.map((o) => o.logo), ...Object.values(t.families).map((v) => v.logo), ...Object.values(t['base-types']).map((v) => v.logo), ...Object.values(t['based-on']).map((v) => v.logo)]);
const usedAuthorLogos = new Set(Object.values(authors).map((a) => a.logo));
const unused = [
  ...fs.readdirSync(path.join(root, 'assets/logos')).filter((f) => !usedLogos.has(f)).map((f) => `assets/logos/${f}`),
  ...fs.readdirSync(path.join(root, 'assets/author')).filter((f) => !usedAuthorLogos.has(f)).map((f) => `assets/author/${f}`),
];

console.log(`${systems.length} systems in ${meta.systemFiles.length} files, ${Object.keys(authors).length} authors`);
if (unused.length) console.log('unreferenced files (harmless):', unused.join(' '));
if (errors.length) { console.error(`\n${errors.length} problem(s):\n- ` + errors.join('\n- ')); process.exit(1); }
console.log('data OK');
