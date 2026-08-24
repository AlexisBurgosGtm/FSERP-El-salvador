/**
 * DTE El Salvador — tipodocs internos (mismo flujo documental) → tipoDte MH.
 * FEF/FEC/FNC se mantienen como códigos de TIPODOCUMENTOS para no romper menús/filtros.
 */
const TIPODOC_CERTIFICABLES = new Set(['FEF', 'FEC', 'FNC']);
const TIPODOC_INTERNO = new Set(['FAC']);
const TIPODOC_NO_DTE = new Set(['FES', 'FNA']);

/** TIPODOC ERP → código tipoDte Ministerio de Hacienda. */
const MH_TIPO_BY_TIPODOC = {
  FEF: '01', // Factura electrónica
  FEC: '03', // Comprobante de Crédito Fiscal
  FNC: '05', // Nota de Crédito
};

const TIPODOC_DTE_DESCRIPCION = {
  FEF: 'Factura electrónica (DTE 01)',
  FEC: 'Comprobante de Crédito Fiscal (DTE 03)',
  FNC: 'Nota de Crédito electrónica (DTE 05)',
  FES: 'No certificable DTE en este sistema',
  FNA: 'Nota de abono interna — no DTE',
  FAC: 'Documento interno — no certificable',
};

/** CAT-022 tipo documento receptor (parcial). */
const CAT_TIPO_DOC_RECEPTOR = {
  NIT: '36',
  DUI: '13',
  PASAPORTE: '03',
  OTRO: '37',
};

const AMBIENTE = {
  PRUEBA: '00',
  PRODUCCION: '01',
};

module.exports = {
  TIPODOC_CERTIFICABLES,
  TIPODOC_INTERNO,
  TIPODOC_NO_DTE,
  MH_TIPO_BY_TIPODOC,
  TIPODOC_DTE_DESCRIPCION,
  CAT_TIPO_DOC_RECEPTOR,
  AMBIENTE,
};
