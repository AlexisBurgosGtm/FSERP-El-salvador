/**
 * Lookup receptor SV — sin servicio MH público equivalente a Infile GT.
 * Devuelve el identificador normalizado para autocompletar NIT/DUI en formularios.
 */
function normalizeIdentificador(raw) {
  return String(raw || '')
    .trim()
    .replace(/\s+/g, '')
    .toUpperCase();
}

async function lookupContribuyente(_pool, _empnit, identificador) {
  const id = normalizeIdentificador(identificador);
  if (!id || id.length < 5) {
    const err = new Error('Identificador inválido');
    err.statusCode = 400;
    throw err;
  }
  return {
    ok: true,
    identificador: id,
    nombre: '',
    mensaje:
      'En El Salvador no hay consulta SAT automática como Guatemala. Complete nombre, NRC y régimen del cliente manualmente.',
  };
}

module.exports = { lookupContribuyente, normalizeIdentificador };
