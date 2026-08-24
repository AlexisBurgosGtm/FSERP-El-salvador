const { TIPODOC_CERTIFICABLES, MH_TIPO_BY_TIPODOC, TIPODOC_DTE_DESCRIPCION } = require('./constants');

function normalizeTipodoc(tipodoc) {
  return String(tipodoc || '')
    .trim()
    .toUpperCase();
}

function assertCertificableTipodoc(tipodoc) {
  const t = normalizeTipodoc(tipodoc);
  if (!TIPODOC_CERTIFICABLES.has(t)) {
    const err = new Error(
      `El tipo ${t || '(vacío)'} no es certificable DTE SV. Permitidos: ${[...TIPODOC_CERTIFICABLES].join(', ')} (${TIPODOC_DTE_DESCRIPCION[t] || 'sin descripción'})`
    );
    err.statusCode = 400;
    throw err;
  }
  return t;
}

function mhTipoDte(tipodoc) {
  const t = assertCertificableTipodoc(tipodoc);
  return MH_TIPO_BY_TIPODOC[t];
}

module.exports = { normalizeTipodoc, assertCertificableTipodoc, mhTipoDte };
