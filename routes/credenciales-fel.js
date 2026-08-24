const express = require('express');
const sql = require('mssql');
const { isDbConfigured } = require('../config/database');

const router = express.Router();
const TABLE = 'FEL_CREDENCIALES';

/** Campos DTE SV (tabla FEL_CREDENCIALES reutilizada + columnas nuevas del script SQL). */
const WRITABLE_FIELDS = [
  'CERTIFICACION_USUARIO',
  'CERTIFICACION_LLAVE',
  'FIRMA_ALIAS',
  'FIRMA_LLAVE',
  'AMBIENTE',
  'MODO_SIMULACION',
  'URL_AUTH',
  'URL_FIRMADOR',
  'URL_RECEPCION',
  'URL_CONSULTA',
  'EMISOR_NIT',
  'EMISOR_NRC',
  'EMISOR_NOMBRE',
  'EMISOR_NOMBRECOMECIAL',
  'EMISOR_CODACTIVIDAD',
  'EMISOR_DESCACTIVIDAD',
  'EMISOR_DIRECCION',
  'EMISOR_DEPARTAMENTO',
  'EMISOR_MUNICIPIO',
  'EMISOR_TELEFONO',
  'EMISOR_CORREO',
  'EMISOR_TIPOESTABLECIMIENTO',
  'EMISOR_CODIGOESTABLECIMIENTO',
  'EMISOR_CODIGOPUNTOVENTA',
  'EMISOR_CODIGOPOSTAL',
  'VENCE_CERTIFICADO',
];

const LIST_COLUMNS = [
  'EMPNIT',
  'CERTIFICACION_USUARIO',
  'EMISOR_NOMBRECOMECIAL',
  'EMISOR_NIT',
  'EMISOR_NRC',
  'AMBIENTE',
  'MODO_SIMULACION',
  'VENCE_CERTIFICADO',
];

function getEmpNitFromReq(req) {
  return String(req.query.empnit || req.headers['x-emp-nit'] || '').trim();
}

function requireEmpNit(req, res) {
  const empnit = getEmpNitFromReq(req);
  if (!empnit) {
    res.status(400).json({ error: 'EMPNIT requerido (empresa de la sesión)' });
    return null;
  }
  return empnit;
}

function requireMatchingEmpNit(req, res) {
  const empnit = requireEmpNit(req, res);
  if (!empnit) return null;
  const param = String(req.params.empnit ?? '').trim();
  if (param && param !== empnit) {
    res.status(403).json({ error: 'No puede modificar credenciales de otra empresa' });
    return null;
  }
  return empnit;
}

function parseFieldValue(name, raw) {
  if (raw === undefined || raw === null || raw === '') return null;
  if (name === 'VENCE_CERTIFICADO') return String(raw).trim() || null;
  return String(raw).trim();
}

function readBody(req) {
  const data = {};
  for (const name of WRITABLE_FIELDS) {
    data[name] = parseFieldValue(name, req.body[name]);
  }
  if (data.AMBIENTE !== '01') data.AMBIENTE = '00';
  if (data.MODO_SIMULACION !== 'NO') data.MODO_SIMULACION = 'SI';
  return data;
}

function validateCreate(data) {
  if (!data.EMISOR_NIT) return 'NIT emisor es obligatorio';
  if (!data.EMISOR_NOMBRE) return 'Nombre emisor es obligatorio';
  if (!data.EMISOR_NRC) return 'NRC emisor es obligatorio';
  return null;
}

function bindFields(request, data, fields) {
  for (const name of fields) {
    if (name === 'VENCE_CERTIFICADO') {
      request.input(name, sql.Date, data[name]);
    } else {
      request.input(name, sql.VarChar, data[name]);
    }
  }
}

async function countForEmpresa(pool, empnit) {
  const result = await pool
    .request()
    .input('EMPNIT', sql.VarChar, empnit)
    .query(`SELECT COUNT(*) AS total FROM dbo.[${TABLE}] WHERE EMPNIT = @EMPNIT`);
  return Number(result.recordset[0]?.total) || 0;
}

router.get('/', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (!isDbConfigured()) return res.status(503).json({ error: 'Base de datos no configurada' });
  const empnit = requireEmpNit(req, res);
  if (!empnit) return;
  try {
    const pool = await req.app.locals.getDbPool();
    const result = await pool
      .request()
      .input('EMPNIT', sql.VarChar, empnit)
      .query(`SELECT * FROM dbo.[${TABLE}] WHERE EMPNIT = @EMPNIT`);
    const rows = (result.recordset || []).map((r) => {
      const out = {};
      for (const c of LIST_COLUMNS) out[c] = r[c] ?? null;
      return out;
    });
    res.json({ rows, total: rows.length, empnit });
  } catch (err) {
    console.warn('[API GET /credenciales-fel]', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.get('/adendas', (_req, res) => {
  res.json({ version: 1, slots: {}, options: [], mensaje: 'Adendas FEL GT no aplican en DTE SV' });
});

router.put('/adendas', (_req, res) => {
  res.json({ ok: true, version: 1, slots: {}, options: [] });
});

router.get('/:empnit', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (!isDbConfigured()) return res.status(503).json({ error: 'Base de datos no configurada' });
  const empnit = requireMatchingEmpNit(req, res);
  if (!empnit) return;
  try {
    const pool = await req.app.locals.getDbPool();
    const result = await pool
      .request()
      .input('EMPNIT', sql.VarChar, empnit)
      .query(`SELECT * FROM dbo.[${TABLE}] WHERE EMPNIT = @EMPNIT`);
    if (!result.recordset.length) {
      return res.status(404).json({ error: 'Credenciales no encontradas' });
    }
    res.json({ row: result.recordset[0] });
  } catch (err) {
    console.warn('[API GET /credenciales-fel/:empnit]', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  if (!isDbConfigured()) return res.status(503).json({ error: 'Base de datos no configurada' });
  const empnit = requireEmpNit(req, res);
  if (!empnit) return;
  const data = readBody(req);
  const errReq = validateCreate(data);
  if (errReq) return res.status(400).json({ error: errReq });

  try {
    const pool = await req.app.locals.getDbPool();
    if ((await countForEmpresa(pool, empnit)) > 0) {
      return res.status(409).json({
        error: 'Ya existe un registro de credenciales DTE para esta empresa. Edítelo o elimínelo.',
      });
    }
    // Insert solo columnas que existan en la tabla
    const colsRes = await pool.request().query(`
      SELECT COLUMN_NAME AS name
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = '${TABLE}'
    `);
    const existing = new Set((colsRes.recordset || []).map((r) => String(r.name).toUpperCase()));
    const fields = WRITABLE_FIELDS.filter((f) => existing.has(f.toUpperCase()));
    const insertCols = ['EMPNIT', ...fields];
    const request = pool.request().input('EMPNIT', sql.VarChar, empnit);
    bindFields(request, data, fields);
    await request.query(`
      INSERT INTO dbo.[${TABLE}] (${insertCols.join(', ')})
      VALUES (${insertCols.map((c) => `@${c}`).join(', ')})
    `);
    res.status(201).json({ ok: true, EMPNIT: empnit, ...data });
  } catch (err) {
    console.warn('[API POST /credenciales-fel]', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.put('/:empnit', async (req, res) => {
  if (!isDbConfigured()) return res.status(503).json({ error: 'Base de datos no configurada' });
  const empnit = requireMatchingEmpNit(req, res);
  if (!empnit) return;
  const data = readBody(req);
  const errReq = validateCreate(data);
  if (errReq) return res.status(400).json({ error: errReq });

  try {
    const pool = await req.app.locals.getDbPool();
    const colsRes = await pool.request().query(`
      SELECT COLUMN_NAME AS name
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = '${TABLE}'
    `);
    const existing = new Set((colsRes.recordset || []).map((r) => String(r.name).toUpperCase()));
    const fields = WRITABLE_FIELDS.filter((f) => existing.has(f.toUpperCase()));
    if (!fields.length) {
      return res.status(500).json({ error: 'Tabla FEL_CREDENCIALES sin columnas actualizables' });
    }
    const request = pool.request().input('EMPNIT', sql.VarChar, empnit);
    bindFields(request, data, fields);
    const sets = fields.map((f) => `${f} = @${f}`).join(', ');
    const result = await request.query(`
      UPDATE dbo.[${TABLE}] SET ${sets} WHERE EMPNIT = @EMPNIT
    `);
    if (!result.rowsAffected?.[0]) {
      return res.status(404).json({ error: 'Credenciales no encontradas' });
    }
    res.json({ ok: true, EMPNIT: empnit, ...data });
  } catch (err) {
    console.warn('[API PUT /credenciales-fel/:empnit]', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:empnit', async (req, res) => {
  if (!isDbConfigured()) return res.status(503).json({ error: 'Base de datos no configurada' });
  const empnit = requireMatchingEmpNit(req, res);
  if (!empnit) return;
  try {
    const pool = await req.app.locals.getDbPool();
    const result = await pool
      .request()
      .input('EMPNIT', sql.VarChar, empnit)
      .query(`DELETE FROM dbo.[${TABLE}] WHERE EMPNIT = @EMPNIT`);
    if (!result.rowsAffected?.[0]) {
      return res.status(404).json({ error: 'Credenciales no encontradas' });
    }
    res.json({ ok: true });
  } catch (err) {
    console.warn('[API DELETE /credenciales-fel/:empnit]', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
