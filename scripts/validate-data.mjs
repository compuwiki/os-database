// Checks that the JSON under data/ is consistent: `node scripts/validate-data.mjs` (exit code 1 on problems).
// Shape and types are described by data/schema/systems.schema.json (for the editor); this script checks what a schema cannot:
// references between files, file placement, and rules that span several fields.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => JSON.parse(fs.readFileSync(path.join(root, 'data', rel), 'utf8'));
const exists = (rel) => fs.existsSync(path.join(root, rel));
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const errors = [];
const err = (msg) => errors.push(msg);

const meta = read('meta.json');
const authors = read('authors.json');
const lookup = { authors }; // name of a set of valid keys -> the set (taxonomy files are added below)
for (const n of ['base-types', 'families', 'based-on', 'device-types', 'license-types', 'install-tiers', 'unix-status', 'generations', 'author-kinds', 'lifecycle'])
  lookup[n] = read(`taxonomy/${n}.json`);

// Fields of a system that must hold keys of one of the sets above.
//   one: a single required key    optional: a key or absent    list: a non-empty array    maybeEmpty: an array that may be empty
const REFS = [
  ['baseOS', 'base-types', 'one'],
  ['by', 'authors', 'list'],
  ['basedOn', 'based-on', 'maybeEmpty'],
  ['unix', 'unix-status', 'one'],
  ['generation', 'generations', 'optional'],
  ['devices', 'device-types', 'list'],
  ['licenseTags', 'license-types', 'list'],
  ['installs', 'install-tiers', 'one'],
  ['lifecycle', 'lifecycle', 'optional'],
];
const SPEC_KEYS = ['cpuCompatibility', 'kernel', 'bootloader', 'fileSystems', 'graphicServer', 'audioServer', 'desktopEnvironment', 'packageManager', 'defaultShell', 'userland'];

function checkRefs(o, at) {
  for (const [field, set, kind] of REFS) {
    const v = o[field];
    if (kind === 'optional' && v == null) continue;
    const many = kind === 'list' || kind === 'maybeEmpty';
    if (many && !Array.isArray(v)) { at(`${field} must be an array`); continue; }
    if (kind === 'list' && !v.length) at(`${field} must not be empty`);
    for (const key of many ? v : [v]) if (!(key in lookup[set])) at(`unknown ${field}: ${key}`);
  }
}

function checkSource(o, at) {
  // the Proprietary / Open Source filters must agree with the card badge: closed <=> tags are exactly ['Proprietary']
  const proprietary = o.licenseTags?.includes('Proprietary');
  switch (o.source?.type) {
    case 'open-source':
      if (!/^https?:\/\//.test(o.source.url ?? '')) at('bad source url');
      if (proprietary) at("open source: licenseTags must not contain 'Proprietary' (note proprietary parts in the license text)");
      break;
    case 'closed':
      if (o.licenseTags?.length !== 1 || !proprietary) at("closed source: licenseTags must be exactly ['Proprietary']");
      break;
    default:
      at(`bad source type: ${o.source?.type}`);
  }
}

// ---- systems: every listed file exists, every file under data/systems is listed
const listed = new Set(meta.systemFiles);
const onDisk = (dir) => fs.readdirSync(path.join(root, 'data', dir), { withFileTypes: true })
  .flatMap((e) => (e.isDirectory() ? onDisk(`${dir}/${e.name}`) : [`${dir}/${e.name}`]));
for (const f of onDisk('systems')) if (!listed.has(f)) err(`${f}: not listed in meta.json systemFiles`);

const ids = new Set();
const systems = [];
for (const f of meta.systemFiles) {
  if (!exists(`data/${f}`)) { err(`${f}: listed in meta.json but missing`); continue; }
  for (const o of read(f)) {
    systems.push(o);
    const at = (m) => err(`${f} > ${o.id ?? '?'}: ${m}`);
    if (ids.has(o.id)) at('duplicate id');
    ids.add(o.id);

    const inFile = o.baseOS === 'Linux' ? `systems/linux/${slug(o.distroBase ?? '')}.json` : `systems/${slug(o.baseOS)}.json`;
    if (f !== inFile) at(`belongs in ${inFile}`);
    if (o.baseOS === 'Linux' ? !(o.distroBase in lookup.families) : o.distroBase != null) at(`bad distroBase: ${o.distroBase}`);
    if (o.baseOS === 'Linux' && !o.basedOn?.includes('Linux kernel')) at('a Linux system should be based on the Linux kernel');

    checkRefs(o, at);
    checkSource(o, at);
    if (!o.name) at('no name');
    if (!o.knownFor) at('no knownFor');
    if (o.pitch != null && typeof o.pitch !== 'string') at('pitch must be a string');
    const thisYear = new Date().getFullYear();
    if (!Number.isInteger(o.released) || o.released < 1960 || o.released > thisYear) at(`bad released year: ${o.released}`);
    if (!o.license) at('no license text');
    if (/\(discontinued\)/i.test(o.name ?? '')) at('use lifecycle: "discontinued" instead of (discontinued) in name');
    if (o.logo && !exists(`assets/logos/${o.logo}`)) at(`missing logo file: ${o.logo}`);
    for (const k of SPEC_KEYS) {
      const v = o.specs?.[k];
      if (v == null || (Array.isArray(v) ? !v.length : typeof v !== 'string')) at(`missing or malformed spec: ${k}`);
    }
  }
}

// ---- authors and taxonomy logos
for (const [name, a] of Object.entries(authors)) {
  if (!(a.type in lookup['author-kinds'])) err(`author ${name}: unknown type ${a.type}`);
  if (a.logo && !exists(`assets/author/${a.logo}`)) err(`author ${name}: missing logo file ${a.logo}`);
  if (a.parent && !(a.parent in authors)) err(`author ${name}: unknown parent ${a.parent}`);
  if (!systems.some((o) => o.by.includes(name))) err(`author ${name}: not used by any system`);
}
for (const set of ['base-types', 'based-on'])
  for (const [key, v] of Object.entries(lookup[set])) if (v.logo && !exists(`assets/logos/${v.logo}`)) err(`${set} > ${key}: missing logo ${v.logo}`);

// ---- unreferenced logo files (harmless, just reported)
const usedLogos = new Set([...systems, ...Object.values(lookup['base-types']), ...Object.values(lookup['based-on'])].map((v) => v.logo));
const usedAuthorLogos = new Set(Object.values(authors).map((a) => a.logo));
const unused = [
  ...fs.readdirSync(path.join(root, 'assets/logos')).filter((f) => !usedLogos.has(f)).map((f) => `assets/logos/${f}`),
  ...fs.readdirSync(path.join(root, 'assets/author')).filter((f) => !usedAuthorLogos.has(f)).map((f) => `assets/author/${f}`),
];

console.log(`${systems.length} systems in ${meta.systemFiles.length} files, ${Object.keys(authors).length} authors`);
if (unused.length) console.log('unreferenced files (harmless):', unused.join(' '));
if (errors.length) { console.error(`\n${errors.length} problem(s):\n- ` + errors.join('\n- ')); process.exit(1); }
console.log('data OK');
