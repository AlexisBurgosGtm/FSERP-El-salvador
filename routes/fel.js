const express = require('express');
const { isDbConfigured } = require('../config/database');
const { certificarDocumentoFel } = require('../lib/dte/certificar');
const { anularDocumentoFel } = require('../lib/dte/anular');
const { lookupContribuyente, normalizeIdentificador } = require('../lib/dte/contribuyente-lookup');
const { TIPODOC_CERTIFICABLES, TIPODOC_DTE_DESCRIPCION } = require('../lib/dte/constants');

const router = express.Router();

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

function parseCorrelativo(raw) {
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

router.get('/tipos-certificables', (_req, res) => {
  res.json({
    tipos: [...TIPODOC_CERTIFICABLES],
    descripcion: TIPODOC_DTE_DESCRIPCION,
    pais: 'SV',
    regimen: 'DTE El Salvador — FEF=01, FEC=03, FNC=05',
  });
});

router.get('/contribuyente', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (!isDbConfigured()) {
    return res.status(503).json({ error: 'Base de datos no configurada' });
  }
  const empnit = requireEmpNit(req, res);
  if (!empnit) return;

  const identificador = normalizeIdentificador(req.query.identificador || req.query.nit || req.query.cui);
  if (!identificador) {
    return res.status(400).json({ error: 'Identificador inválido (NIT o DUI)' });
  }

  try {
    const pool = await req.app.locals.getDbPool();
    const data = await lookupContribuyente(pool, empnit, identificador);
    res.json(data);
  } catch (err) {
    console.warn('[API GET /fel/contribuyente]', err.message);
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

router.post('/certificar/:coddoc/:correlativo', async (req, res) => {
  if (!isDbConfigured()) {
    return res.status(503).json({ error: 'Base de datos no configurada' });
  }
  const empnit = requireEmpNit(req, res);
  if (!empnit) return;

  const coddoc = String(req.params.coddoc || '').trim();
  const correlativo = parseCorrelativo(req.params.correlativo);
  if (!coddoc || correlativo === null) {
    return res.status(400).json({ error: 'Documento inválido' });
  }

  try {
    const pool = await req.app.locals.getDbPool();
    const result = await certificarDocumentoFel(pool, empnit, coddoc, correlativo);
    res.json(result);
  } catch (err) {
    console.warn('[API POST /fel/certificar]', err.message);
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

router.post('/anular/:coddoc/:correlativo', async (req, res) => {
  if (!isDbConfigured()) {
    return res.status(503).json({ error: 'Base de datos no configurada' });
  }
  const empnit = requireEmpNit(req, res);
  if (!empnit) return;

  const coddoc = String(req.params.coddoc || '').trim();
  const correlativo = parseCorrelativo(req.params.correlativo);
  if (!coddoc || correlativo === null) {
    return res.status(400).json({ error: 'Documento inválido' });
  }

  try {
    const pool = await req.app.locals.getDbPool();
    const result = await anularDocumentoFel(pool, empnit, coddoc, correlativo, {
      motivo: req.body?.motivo,
    });
    res.json(result);
  } catch (err) {
    console.warn('[API POST /fel/anular]', err.message);
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

module.exports = router;
