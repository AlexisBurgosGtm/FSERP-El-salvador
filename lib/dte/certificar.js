const sql = require('mssql');
const { loadDteCredenciales } = require('./credenciales');
const { loadDocumentoDte } = require('./documento');
const { buildDteJson } = require('./build-json');
const { transmitDte } = require('./mh-client');
const { getIvaFactor } = require('../impuestos');

async function persistDteResult(pool, empnit, coddoc, correlativo, result) {
  await pool
    .request()
    .input('EMPNIT', sql.VarChar, empnit)
    .input('CODDOC', sql.VarChar, coddoc)
    .input('CORRELATIVO', sql.Decimal(18, 0), correlativo)
    .input('FEL_UUDI', sql.VarChar, result.uuid)
    .input('FEL_SERIE', sql.VarChar, result.serie || '')
    .input('FEL_NUMERO', sql.VarChar, result.numero || '')
    .input('FEL_FECHA', sql.VarChar, result.fechaCertificacion || '')
    .query(`
      UPDATE dbo.DOCUMENTOS
      SET FEL_UUDI = @FEL_UUDI,
          FEL_SERIE = @FEL_SERIE,
          FEL_NUMERO = @FEL_NUMERO,
          FEL_FECHA = @FEL_FECHA
      WHERE EMPNIT = @EMPNIT AND CODDOC = @CODDOC AND CORRELATIVO = @CORRELATIVO
    `);
}

async function certificarDocumentoFel(pool, empnit, coddoc, correlativo, opts = {}) {
  const credenciales = await loadDteCredenciales(pool, empnit);
  const documento = await loadDocumentoDte(pool, empnit, coddoc, correlativo);
  const ivaFactor = await getIvaFactor(pool);
  const built = buildDteJson({
    cred: credenciales,
    header: documento.header,
    lines: documento.lines,
    referencia: documento.referencia,
    ivaFactor,
  });

  const dteResult = await transmitDte(built.dteJson, credenciales);
  const fechaOverride = String(opts.fechaCertificacion || '').trim();
  if (fechaOverride) dteResult.fechaCertificacion = fechaOverride;

  await persistDteResult(pool, empnit, coddoc, correlativo, dteResult);

  return {
    ok: true,
    coddoc,
    correlativo,
    satTipo: built.tipoDte,
    tipoDte: built.tipoDte,
    simulated: Boolean(dteResult.simulated),
    fel: {
      uuid: dteResult.uuid,
      serie: dteResult.serie,
      numero: dteResult.numero,
      fecha: dteResult.fechaCertificacion,
      selloRecibido: dteResult.selloRecibido,
    },
  };
}

/** Alias OnneB: fraccionamiento y doc-opciones llaman certificarDocumentoFel. */
module.exports = { certificarDocumentoFel, persistDteResult, persistFelResult: persistDteResult };
