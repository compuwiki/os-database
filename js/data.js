// Loads everything under data/ (see data/README.md for the layout) and returns it as one object.
// The page must be served over HTTP (GitHub Pages, `python -m http.server`, Live Server): fetch() does not work from file://.

const json = async (path) => {
  const res = await fetch(`data/${path}`);
  if (!res.ok) throw new Error(`data/${path}: HTTP ${res.status}`);
  return res.json();
};

export async function loadData() {
  const meta = await json('meta.json');
  const [baseTypes, families, basedOnTypes, deviceTypes, licenseTypes, installTiers, unixStatus, generations, authorKinds, authors, ...systemFiles] =
    await Promise.all([
      json('taxonomy/base-types.json'),
      json('taxonomy/families.json'),
      json('taxonomy/based-on.json'),
      json('taxonomy/device-types.json'),
      json('taxonomy/license-types.json'),
      json('taxonomy/install-tiers.json'),
      json('taxonomy/unix-status.json'),
      json('taxonomy/generations.json'),
      json('taxonomy/author-kinds.json'),
      json('authors.json'),
      ...meta.systemFiles.map(json),
    ]);
  return {
    dataAsOf: meta.dataAsOf,
    baseTypes, families, basedOnTypes, deviceTypes, licenseTypes, installTiers, unixStatus, generations, authorKinds, authors,
    osData: systemFiles.flat(), // in the order of meta.systemFiles
  };
}
