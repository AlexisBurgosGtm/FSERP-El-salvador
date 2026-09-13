const fs = require('fs');
const path = require('path');
const {
  buildCounterPath,
  buildMetaWritablePath,
  publicDir,
  isPackaged,
} = require('../lib/app-paths');

function formatDateDDMMYYYY(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
}

const counterPath = buildCounterPath();
const metaWritable = buildMetaWritablePath();
const metaPublic = path.join(publicDir(), 'build-meta.json');

let count = 0;
if (fs.existsSync(counterPath)) {
  try {
    const data = JSON.parse(fs.readFileSync(counterPath, 'utf8'));
    count = Number(data.buildCount) || 0;
  } catch {
    count = 0;
  }
}

count += 1;
const now = new Date();
const meta = {
  buildCount: count,
  lastBuild: now.toISOString(),
  buildDate: formatDateDDMMYYYY(now),
  project: 'FS_ERP',
};

fs.writeFileSync(counterPath, JSON.stringify(meta, null, 2));
fs.writeFileSync(metaWritable, JSON.stringify(meta, null, 2));
if (!isPackaged()) {
  fs.mkdirSync(path.dirname(metaPublic), { recursive: true });
  fs.writeFileSync(metaPublic, JSON.stringify(meta, null, 2));
}

console.log(`[Build] Compilación #${count}`);
