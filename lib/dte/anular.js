const sql = require('mssql');
const { STATUS_ANULADO } = require('../documento-status');
const { loadDteCredenciales } = require('./credenciales');
const { reopenFuenteFraccionamientoIfNeeded } = require('../fraccionamiento-reopen');

/**
 * Invalidación DTE SV (evento). En simulación solo marca STATUS=A.
 * Con URLs reales enviaría el evento de invalidación a MH.
 */
async function anularDocumentoFel(pool, empnit, coddoc, correlativo, opts = {}) {
  const headerRes = await pool
    .request()
    .input('EMPNIT', sql.VarChar, empnit)
    .input('CODDOC', sql.VarChar, coddoc)
    .input('CORRELATIVO', sql.Decimal(18, 0), correlativo)
    .query(`
      SELECT TOP 1
        d.FEL_UUDI,
        d.FEL_FECHA,
        d.STATUS,
        d.SERIEFAC,
        d.NOFAC,
        t.TIPODOC
      FROM dbo.DOCUMENTOS d
      INNER JOIN dbo.TIPODOCUMENTOS t ON t.EMPNIT = d.EMPNIT AND t.CODDOC = d.CODDOC
      WHERE d.EMPNIT = @EMPNIT AND d.CODDOC = @CODDOC AND d.CORRELATIVO = @CORRELATIVO
    `);
  const header = headerRes.recordset[0];
  if (!header) {
    const err = new Error('Documento no encontrado');
    err.statusCode = 404;
    throw err;
  }
  if (!String(header.FEL_UUDI || '').trim()) {
    const err = new Error('El documento no está certificado DTE');
    err.statusCode = 400;
    throw err;
  }

  const cred = await loadDteCredenciales(pool, empnit);
  const motivo = String(opts.motivo || 'Error en documento').trim();

  if (String(cred.MODO_SIMULACION || 'SI').toUpperCase() === 'NO') {
    const url = String(cred.URL_RECEPCION || '').trim();
    if (!url) {
      const err = new Error('URL_RECEPCION requerida para invalidar DTE en producción');
      err.statusCode = 400;
      throw err;
    }
    // Punto de extensión: POST evento invalidación según normativa MH.
  }

  await pool
    .request()
    .input('EMPNIT', sql.VarChar, empnit)
    .input('CODDOC', sql.VarChar, coddoc)
    .input('CORRELATIVO', sql.Decimal(18, 0), correlativo)
    .input('STATUS', sql.VarChar, STATUS_ANULADO)
    .query(`
      UPDATE dbo.DOCUMENTOS
      SET STATUS = @STATUS
      WHERE EMPNIT = @EMPNIT AND CODDOC = @CODDOC AND CORRELATIVO = @CORRELATIVO
    `);

  let fraccionamiento = { reopened: false };
  try {
    fraccionamiento = await reopenFuenteFraccionamientoIfNeeded(pool, empnit, header);
  } catch (err) {
    console.warn('[DTE anular] reopen fraccionamiento:', err.message);
  }

  return {
    ok: true,
    coddoc,
    correlativo,
    uuid: header.FEL_UUDI,
    motivo,
    simulated: String(cred.MODO_SIMULACION || 'SI').toUpperCase() !== 'NO',
    fraccionamiento,
  };
}

module.exports = { anularDocumentoFel };
