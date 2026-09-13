const sql = require('mssql');
const { STATUS_OPERADO } = require('../documento-status');
const { assertCertificableTipodoc } = require('./utils');

async function enrichClienteDte(pool, empnit, codcliente, header) {
  if (!codcliente) return header;
  try {
    const res = await pool
      .request()
      .input('EMPNIT', sql.VarChar, empnit)
      .input('CODCLIENTE', sql.Int, Number(codcliente))
      .query(`
        SELECT TOP 1
          NRC AS CLI_NRC,
          TIPODOCUMENTO_DTE AS CLI_TIPODOCUMENTO_DTE,
          NUMDOCUMENTO_DTE AS CLI_NUMDOCUMENTO_DTE,
          COD_ACTIVIDAD AS CLI_COD_ACTIVIDAD,
          DESC_ACTIVIDAD AS CLI_DESC_ACTIVIDAD,
          REGIMEN_DTE AS CLI_REGIMEN_DTE,
          DEPARTAMENTO_MH AS CLI_DEPARTAMENTO_MH,
          MUNICIPIO_MH AS CLI_MUNICIPIO_MH,
          DISTRITO_MH AS CLI_DISTRITO_MH
        FROM dbo.CLIENTES
        WHERE EMPNIT = @EMPNIT AND CODCLIENTE = @CODCLIENTE
      `);
    const row = res.recordset[0];
    if (row) Object.assign(header, row);
  } catch {
    // Columnas DTE aún no aplicadas en BD — continuar con datos básicos.
  }
  return header;
}

async function loadDocumentoDte(pool, empnit, coddoc, correlativo) {
  const headerRes = await pool
    .request()
    .input('EMPNIT', sql.VarChar, empnit)
    .input('CODDOC', sql.VarChar, coddoc)
    .input('CORRELATIVO', sql.Decimal(18, 0), correlativo)
    .query(`
      SELECT d.*, t.DESDOC, t.TIPODOC,
        c.NEGOCIO AS CLI_NEGOCIO, c.TIPONEGOCIO AS CLI_TIPONEGOCIO,
        c.NOMBRECLIENTE AS CLI_NOMBRE, c.DIRCLIENTE AS CLI_DIR, c.NIT AS CLI_NIT,
        c.EMAILCLIENTE AS CLI_EMAIL, c.TELEFONOCLIENTE AS CLI_TEL
      FROM dbo.DOCUMENTOS d
      JOIN dbo.TIPODOCUMENTOS t ON d.CODDOC = t.CODDOC AND d.EMPNIT = t.EMPNIT
      LEFT JOIN dbo.CLIENTES c ON c.EMPNIT = d.EMPNIT AND c.CODCLIENTE = d.CODCLIENTE
      WHERE d.EMPNIT = @EMPNIT AND d.CODDOC = @CODDOC AND d.CORRELATIVO = @CORRELATIVO
    `);

  if (!headerRes.recordset.length) {
    const err = new Error('Documento no encontrado');
    err.statusCode = 404;
    throw err;
  }

  let header = headerRes.recordset[0];
  assertCertificableTipodoc(header.TIPODOC);

  if (String(header.STATUS || '').trim().toUpperCase() !== STATUS_OPERADO) {
    const err = new Error('Solo se pueden certificar documentos en estado operado');
    err.statusCode = 400;
    throw err;
  }
  if (String(header.FEL_UUDI || '').trim()) {
    const err = new Error('El documento ya está certificado (DTE)');
    err.statusCode = 409;
    throw err;
  }

  header = await enrichClienteDte(pool, empnit, header.CODCLIENTE, header);

  const linesRes = await pool
    .request()
    .input('EMPNIT', sql.VarChar, empnit)
    .input('CODDOC', sql.VarChar, coddoc)
    .input('CORRELATIVO', sql.Decimal(18, 0), correlativo)
    .query(`
      SELECT Id AS ID, CODPROD, DESPROD, CODMEDIDA, CANTIDAD, EQUIVALE, PRECIO, COSTO,
        TOTALPRECIO, TOTALCOSTO, TOTALUNIDADES, TIPOPRECIO, ISNULL(EXENTO, 0) AS EXENTO,
        ISNULL(TIPOPROD, 'P') AS TIPOPROD
      FROM dbo.DOCPRODUCTOS
      WHERE EMPNIT = @EMPNIT AND CODDOC = @CODDOC AND CORRELATIVO = @CORRELATIVO
      ORDER BY Id
    `);

  const lines = linesRes.recordset || [];
  if (!lines.length) {
    const err = new Error('El documento no tiene líneas');
    err.statusCode = 400;
    throw err;
  }

  let referencia = null;
  const tipodoc = String(header.TIPODOC || '').trim().toUpperCase();
  if (tipodoc === 'FNC') {
    const refCod = String(header.CODDOC_REL || '').trim();
    const refCorr = Number(header.CORRELATIVO_REL || 0);
    if (refCod && refCorr) {
      const refRes = await pool
        .request()
        .input('EMPNIT', sql.VarChar, empnit)
        .input('CODDOC', sql.VarChar, refCod)
        .input('CORRELATIVO', sql.Decimal(18, 0), refCorr)
        .query(`
          SELECT TOP 1 d.FEL_UUDI, d.FEL_SERIE, d.FEL_NUMERO, d.FEL_FECHA, d.FECHA, t.TIPODOC
          FROM dbo.DOCUMENTOS d
          JOIN dbo.TIPODOCUMENTOS t ON t.EMPNIT = d.EMPNIT AND t.CODDOC = d.CODDOC
          WHERE d.EMPNIT = @EMPNIT AND d.CODDOC = @CODDOC AND d.CORRELATIVO = @CORRELATIVO
        `);
      referencia = refRes.recordset[0] || null;
      if (!String(referencia?.FEL_UUDI || '').trim()) {
        const err = new Error('La nota de crédito requiere documento relacionado ya certificado');
        err.statusCode = 400;
        throw err;
      }
      const { fechaIsoFromFelFecha } = require('../documento-fecha');
      if (!fechaIsoFromFelFecha(referencia.FEL_FECHA)) {
        const err = new Error(
          'El documento relacionado no tiene FEL_FECHA de certificación; no se puede emitir la nota'
        );
        err.statusCode = 400;
        throw err;
      }
    }
  }

  return { header, lines, referencia };
}

module.exports = { loadDocumentoDte };
