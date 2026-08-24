const sql = require('mssql');
const { AMBIENTE } = require('./constants');

function isBlank(v) {
  return v === null || v === undefined || String(v).trim() === '';
}

async function loadDteCredenciales(pool, empnit) {
  const result = await pool
    .request()
    .input('EMPNIT', sql.VarChar, empnit)
    .query(`
      SELECT TOP 1 *
      FROM dbo.FEL_CREDENCIALES
      WHERE EMPNIT = @EMPNIT
    `);
  const row = result.recordset[0];
  if (!row) {
    const err = new Error('No hay credenciales DTE configuradas para esta empresa');
    err.statusCode = 400;
    throw err;
  }

  const required = [
    ['EMISOR_NIT', 'NIT emisor'],
    ['EMISOR_NOMBRE', 'Nombre emisor'],
    ['EMISOR_NRC', 'NRC emisor'],
    ['EMISOR_CODACTIVIDAD', 'Código actividad económica'],
  ];
  for (const [key, label] of required) {
    if (isBlank(row[key])) {
      const err = new Error(`Credenciales DTE incompletas (${label})`);
      err.statusCode = 400;
      throw err;
    }
  }

  const ambiente = String(row.AMBIENTE || AMBIENTE.PRUEBA).trim() || AMBIENTE.PRUEBA;
  row.AMBIENTE = ambiente === AMBIENTE.PRODUCCION ? AMBIENTE.PRODUCCION : AMBIENTE.PRUEBA;
  row.MODO_SIMULACION = String(row.MODO_SIMULACION || 'SI').trim().toUpperCase() === 'NO' ? 'NO' : 'SI';
  return row;
}

module.exports = { loadDteCredenciales };
