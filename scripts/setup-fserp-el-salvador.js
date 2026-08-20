/**
 * Post-clon: rebrand FS ERP + eliminar motor FEL GT (Proyecto El Salvador).
 * Uso: node scripts/setup-fserp-el-salvador.js
 * Ejecutar desde la raíz de FsERP-EL SALVADOR.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

function walkFiles(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.name === 'node_modules' || ent.name === '.git') continue;
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) walkFiles(full, acc);
    else acc.push(full);
  }
  return acc;
}

function rmRf(p) {
  if (!fs.existsSync(p)) return;
  fs.rmSync(p, { recursive: true, force: true });
  console.log('deleted', path.relative(ROOT, p));
}

function replaceInFile(file, pairs) {
  let text = fs.readFileSync(file, 'utf8');
  const orig = text;
  for (const [from, to] of pairs) {
    if (from instanceof RegExp) text = text.replace(from, to);
    else if (text.includes(from)) text = text.split(from).join(to);
  }
  if (text !== orig) {
    fs.writeFileSync(file, text, 'utf8');
    return true;
  }
  return false;
}

const FEL_DELETE = [
  'lib/fel',
  'routes/fel.js',
  'routes/credenciales-fel.js',
  'public/js/views/configuraciones/credenciales-fel.js',
  'public/js/views/operaciones/facturas-electronicas.js',
  'public/js/views/contabilidad/inventario-fiscal.js',
  'public/js/views/contabilidad/retenciones-doc-view.js',
  'public/js/views/contabilidad/retenciones-iva.js',
  'public/js/views/contabilidad/retenciones-isr.js',
  'public/js/views/contabilidad/retenciones-iva-recibidas.js',
  'public/js/views/contabilidad/retenciones-isr-recibidas.js',
  'public/css/inventario-fiscal.css',
  'public/css/retenciones-doc.css',
  'routes/inventario-fiscal.js',
  'routes/retenciones-iva.js',
  'routes/retenciones-isr.js',
  'routes/retenciones-iva-recibidas.js',
  'routes/retenciones-isr-recibidas.js',
];

const MENUS_REMOVE = new Set([
  'facturas-electronicas',
  'credenciales-fel',
  'inventario-fiscal',
  'retenciones-isr',
  'retenciones-iva',
  'retenciones-isr-recibidas',
  'retenciones-iva-recibidas',
]);

function stripMenuLines(text) {
  const lines = text.split(/\r?\n/);
  const out = lines.filter((line) => {
    for (const m of MENUS_REMOVE) {
      if (line.includes(`'${m}'`) || line.includes(`"${m}"`) || line.includes(`data-menu="${m}"`)) {
        // keep structural comments that mention them only if not a menu entry
        if (
          line.includes('data-menu=') ||
          line.includes(`'${m}'`) ||
          line.includes(`"${m}":`) ||
          line.includes(`'${m}':`) ||
          line.includes(`prefix: '/api/${m}`) ||
          line.includes(`/api/${m.split('-')[0]}`)
        ) {
          // More precise: drop lines that clearly define these menus
          if (
            line.includes(`'${m}'`) ||
            line.includes(`"${m}"`) ||
            line.includes(`data-menu="${m}"`) ||
            line.includes(`'${m}':`) ||
            line.includes(`${m}:`) ||
            line.includes(`key === '${m}'`) ||
            line.includes(`src="/js/views`) && MENUS_REMOVE.has(m)
          ) {
            return false;
          }
        }
      }
    }
    return true;
  });
  return out.join('\n');
}

function patchServerJs() {
  const file = path.join(ROOT, 'server.js');
  let text = fs.readFileSync(file, 'utf8');
  const dropPatterns = [
    /const credencialesFelRouter = require\('\.\/routes\/credenciales-fel'\);?\r?\n/,
    /const felRouter = require\('\.\/routes\/fel'\);?\r?\n/,
    /const inventarioFiscalRouter = require\('\.\/routes\/inventario-fiscal'\);?\r?\n/,
    /const retencionesIvaRouter = require\('\.\/routes\/retenciones-iva'\);?\r?\n/,
    /const retencionesIsrRouter = require\('\.\/routes\/retenciones-isr'\);?\r?\n/,
    /const retencionesIvaRecibidasRouter = require\('\.\/routes\/retenciones-iva-recibidas'\);?\r?\n/,
    /const retencionesIsrRecibidasRouter = require\('\.\/routes\/retenciones-isr-recibidas'\);?\r?\n/,
    /app\.use\('\/api\/credenciales-fel',[^\n]+\n/,
    /app\.use\('\/api\/fel',[^\n]+\n/,
    /app\.use\('\/api\/inventario-fiscal',[^\n]+\n/,
    /app\.use\('\/api\/retenciones-iva',[^\n]+\n/,
    /app\.use\('\/api\/retenciones-isr',[^\n]+\n/,
    /app\.use\('\/api\/retenciones-iva-recibidas',[^\n]+\n/,
    /app\.use\('\/api\/retenciones-isr-recibidas',[^\n]+\n/,
  ];
  for (const re of dropPatterns) text = text.replace(re, '');
  text = text
    .replace(/FS_ERP/g, 'FS_ERP')
    .replace(/FS ERP/g, 'FS ERP')
    .replace(/\[OnneB\]/g, '[FS ERP]');
  fs.writeFileSync(file, text, 'utf8');
  console.log('patched server.js');
}

function patchIndexHtml() {
  const file = path.join(ROOT, 'public', 'index.html');
  let text = fs.readFileSync(file, 'utf8');
  // Remove link/script/li lines for removed menus
  text = text
    .split(/\r?\n/)
    .filter((line) => {
      if (/inventario-fiscal\.css|retenciones-doc\.css/.test(line)) return false;
      if (/credenciales-fel\.js|inventario-fiscal\.js|retenciones-/.test(line)) return false;
      if (/facturas-electronicas\.js/.test(line)) return false;
      for (const m of MENUS_REMOVE) {
        if (line.includes(`data-menu="${m}"`)) return false;
      }
      return true;
    })
    .join('\n');
  text = text
    .replace(/FS ERP/g, 'FS ERP')
    .replace(/FS ERP/g, 'FS ERP')
    .replace(/alt="OnneB"/g, 'alt="FS ERP"')
    .replace(/FS ERP/g, 'FS ERP');
  fs.writeFileSync(file, text, 'utf8');
  console.log('patched public/index.html');
}

function patchRolesAndAccess() {
  for (const rel of ['lib/roles-usuarios.js', 'public/js/tipo-empleado-access.js', 'lib/license-modules.js', 'public/js/app.js']) {
    const file = path.join(ROOT, rel);
    if (!fs.existsSync(file)) continue;
    let text = fs.readFileSync(file, 'utf8');
    // Remove array/object entries for removed menus (line-based)
    text = text
      .split(/\r?\n/)
      .filter((line) => {
        const t = line.trim();
        for (const m of MENUS_REMOVE) {
          if (
            t === `'${m}',` ||
            t === `'${m}'` ||
            t.startsWith(`'${m}':`) ||
            t.startsWith(`${m}:`) ||
            t.includes(`'${m}':`) ||
            t.includes(`key === '${m}'`) ||
            (t.includes(`prefix: '/api/`) && (t.includes(m) || t.includes(m.replace(/-/g, '/'))))
          ) {
            return false;
          }
          // license-modules API rules
          if (t.includes(`'/api/${m}'`) || t.includes(`'/api/fel'`) || t.includes(`'/api/credenciales-fel'`)) {
            return false;
          }
          if (
            t.includes(`'/api/retenciones-`) ||
            t.includes(`'/api/inventario-fiscal'`)
          ) {
            return false;
          }
        }
        // Remove from menus arrays inline: 'facturas-electronicas',
        return true;
      })
      .join('\n');
    // Clean leftover commas in menu arrays that referenced removed items mid-array
    for (const m of MENUS_REMOVE) {
      text = text.replace(new RegExp(`\\s*'${m}',?`, 'g'), '');
      text = text.replace(new RegExp(`,\\s*'${m}'`, 'g'), '');
    }
    // Fix double commas
    text = text.replace(/,\s*,/g, ',');
    text = text.replace(/\[\s*,/g, '[');
    text = text.replace(/,\s*\]/g, ']');
    if (rel === 'public/js/app.js') {
      text = text
        .replace(/FS ERP/g, 'FS ERP')
        .replace(/FS ERP/g, 'FS ERP')
        .replace(/mainTitle\.textContent = 'FS ERP'/g, "mainTitle.textContent = 'FS ERP'");
    }
    fs.writeFileSync(file, text, 'utf8');
    console.log('patched', rel);
  }
}

function patchLicenseModulesFelApis() {
  const file = path.join(ROOT, 'lib', 'license-modules.js');
  let text = fs.readFileSync(file, 'utf8');
  text = text
    .split(/\r?\n/)
    .filter((line) => {
      if (/\/api\/fel|\/api\/credenciales-fel|\/api\/inventario-fiscal|\/api\/retenciones-/.test(line)) {
        return false;
      }
      return true;
    })
    .join('\n');
  fs.writeFileSync(file, text, 'utf8');
}

function rebrandTextFiles() {
  const pairs = [
    ['FS ERP', 'FS ERP'],
    ['FS ERP', 'FS ERP'],
    ['FS_ERP', 'FS_ERP'],
    ['FS ERP', 'FS ERP'],
    ['Sistema ERP FS ERP', 'Sistema ERP FS ERP'],
    ['FS ERP', 'FS ERP'],
    ['Generador de licencias FS ERP', 'Generador de licencias FS ERP'],
    ['FS ERP — Generador', 'FS ERP — Generador'],
  ];
  const exts = new Set(['.js', '.html', '.json', '.md', '.css', '.webmanifest']);
  let count = 0;
  for (const file of walkFiles(ROOT)) {
    const ext = path.extname(file).toLowerCase();
    if (!exts.has(ext)) continue;
    // skip large vendor-ish
    if (file.includes(`${path.sep}node_modules${path.sep}`)) continue;
    if (replaceInFile(file, pairs)) count += 1;
  }
  console.log('rebrand files touched:', count);
}

function patchPackageAndManifest() {
  const pkgPath = path.join(ROOT, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  pkg.name = 'FS_ERP';
  pkg.description = 'SPA ERP FS ERP (El Salvador) - vanilla JS, Socket.IO, MSSQL';
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');

  const manPath = path.join(ROOT, 'public', 'manifest.json');
  const man = JSON.parse(fs.readFileSync(manPath, 'utf8'));
  man.name = 'FS ERP';
  man.short_name = 'FS ERP';
  man.description = 'Sistema ERP FS ERP';
  fs.writeFileSync(manPath, JSON.stringify(man, null, 2) + '\n', 'utf8');

  for (const meta of ['public/build-meta.json', 'build-counter.json']) {
    const p = path.join(ROOT, meta);
    if (!fs.existsSync(p)) continue;
    try {
      const j = JSON.parse(fs.readFileSync(p, 'utf8'));
      j.project = 'FS_ERP';
      fs.writeFileSync(p, JSON.stringify(j, null, 2) + '\n', 'utf8');
    } catch {
      /* ignore */
    }
  }
}

function patchEnvPort() {
  const envPath = path.join(ROOT, '.env');
  if (!fs.existsSync(envPath)) return;
  let text = fs.readFileSync(envPath, 'utf8');
  if (/^PORT=/m.test(text)) text = text.replace(/^PORT=.*/m, 'PORT=6501');
  else text += '\nPORT=6501\n';
  fs.writeFileSync(envPath, text, 'utf8');
  console.log('PORT=6501 in .env');
}

function patchGenerateIconsSource() {
  const file = path.join(ROOT, 'scripts', 'generate-icons.js');
  if (!fs.existsSync(file)) return;
  let text = fs.readFileSync(file, 'utf8');
  // Prefer iconos.png as source
  text = text.replace(
    "const SOURCE = path.join(ROOT, 'logo.png');",
    "const SOURCE = fs.existsSync(path.join(ROOT, 'iconos.png'))\n  ? path.join(ROOT, 'iconos.png')\n  : path.join(ROOT, 'logo.png');"
  );
  fs.writeFileSync(file, text, 'utf8');
}

function patchDbName() {
  const file = path.join(ROOT, 'public', 'js', 'db.js');
  if (!fs.existsSync(file)) return;
  replaceInFile(file, [["const DB_NAME = 'FS_ERP_db';", "const DB_NAME = 'FS_ERP_db';"]]);
}

function writeReadmeNote() {
  const p = path.join(ROOT, 'PROYECTO-EL-SALVADOR.md');
  fs.writeFileSync(
    p,
    `# FS ERP — Proyecto El Salvador

Clon de OnneB para El Salvador. **No** incluye motor FEL de Guatemala (Infile/SAT).

- Nombre comercial: **FS ERP**
- Icono instalable: \`iconos.png\` → \`public/icons/*\` vía \`npm run icons\`
- Puerto por defecto: **6501** (OnneB GT usa 6500)
- Licencias: sección aparte en Mariandre (**Licencias FS ERP**), catálogo desde este \`MENU_GROUPS\`
- Fiscal SV (DTE): fase posterior

Repo / historial independientes de OnneB-ERP.
`,
    'utf8'
  );
}

function main() {
  console.log('ROOT', ROOT);
  for (const rel of FEL_DELETE) rmRf(path.join(ROOT, rel));
  patchServerJs();
  patchIndexHtml();
  patchRolesAndAccess();
  patchLicenseModulesFelApis();
  patchPackageAndManifest();
  patchEnvPort();
  patchGenerateIconsSource();
  patchDbName();
  rebrandTextFiles();
  writeReadmeNote();
  console.log('done');
}

main();
