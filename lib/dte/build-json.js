const crypto = require('crypto');
const { mhTipoDte } = require('./utils');
const { CAT_TIPO_DOC_RECEPTOR } = require('./constants');
const { splitIvaFromTotal } = require('../impuestos');
const { fechaIsoFromFelFecha } = require('../documento-fecha');

function uuidV4() {
  return crypto.randomUUID();
}

function padEst(code, len = 4) {
  const s = String(code || '1').replace(/\D/g, '') || '1';
  return s.padStart(len, '0').slice(-len);
}

function buildNumeroControl(tipoDte, codEstablecimiento, correlativo) {
  const est = padEst(codEstablecimiento, 4);
  const pv = '0001';
  const corr = String(Math.trunc(Number(correlativo) || 1))
    .padStart(15, '0')
    .slice(-15);
  return `DTE-${tipoDte}-${est}${pv}-${corr}`;
}

function money(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

function fechaParts(header) {
  const raw = header.FECHA ? new Date(header.FECHA) : new Date();
  const d = Number.isNaN(raw.getTime()) ? new Date() : raw;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return { fecEmi: `${y}-${m}-${day}`, horEmi: `${hh}:${mm}:${ss}` };
}

function resolveReceptor(header) {
  const nit = String(header.DOC_NIT || header.CLI_NIT || '').trim();
  const nombre = String(header.DOC_NOMCLIE || header.CLI_NOMBRE || '').trim() || 'CONSUMIDOR FINAL';
  const tipoDoc =
    String(header.CLI_TIPODOCUMENTO_DTE || '').trim() ||
    (nit && nit.toUpperCase() !== 'CF' ? CAT_TIPO_DOC_RECEPTOR.NIT : CAT_TIPO_DOC_RECEPTOR.DUI);
  const numDoc = String(header.CLI_NUMDOCUMENTO_DTE || nit || '00000000-0').trim();
  const nrc = String(header.CLI_NRC || '').trim() || null;
  const dir = String(header.DOC_DIRCLIE || header.CLI_DIR || '').trim() || null;
  return {
    tipoDocumento: tipoDoc,
    numDocumento: numDoc,
    nrc,
    nombre,
    codActividad: String(header.CLI_COD_ACTIVIDAD || '').trim() || null,
    descActividad: String(header.CLI_DESC_ACTIVIDAD || '').trim() || null,
    direccion: dir
      ? {
          departamento: String(header.CLI_DEPARTAMENTO_MH || '06').trim() || '06',
          municipio: String(header.CLI_MUNICIPIO_MH || '14').trim() || '14',
          complemento: dir,
        }
      : null,
    telefono: String(header.CLI_TEL || '').trim() || null,
    correo: String(header.CLI_EMAIL || '').trim() || null,
  };
}

function buildCuerpoYResumen(lines, tipodoc, ivaFactor) {
  const tipoDte = mhTipoDte(tipodoc);
  const isCcf = tipoDte === '03';
  const cuerpoDocumento = [];
  let totalGravada = 0;
  let totalExenta = 0;
  let totalNoSuj = 0;

  lines.forEach((line, idx) => {
    const cant = Number(line.CANTIDAD) || 0;
    const total = money(line.TOTALPRECIO);
    const exento = Number(line.EXENTO) === 1;
    let ventaGravada = 0;
    let ventaExenta = 0;
    let ventaNoSuj = 0;
    let precioUni = money(line.PRECIO);

    if (exento) {
      ventaExenta = total;
      totalExenta += total;
    } else if (isCcf) {
      // CCF: precios con IVA → desglose base + IVA en resumen
      const split = splitIvaFromTotal(total, true, ivaFactor);
      ventaGravada = money(split.base);
      totalGravada += ventaGravada;
      precioUni = cant ? money(ventaGravada / cant) : ventaGravada;
    } else {
      // Factura 01: ventaGravada incluye IVA
      ventaGravada = total;
      totalGravada += total;
    }

    cuerpoDocumento.push({
      numItem: idx + 1,
      tipoItem: String(line.TIPOPROD || 'P').toUpperCase() === 'S' ? 2 : 1,
      cantidad: cant,
      codigo: String(line.CODPROD || '').trim() || null,
      uniMedida: 99,
      descripcion: String(line.DESPROD || line.CODPROD || 'Item').trim(),
      precioUni,
      montoDescu: 0,
      ventaNoSuj,
      ventaExenta,
      ventaGravada,
      tributos: isCcf && ventaGravada > 0 ? ['20'] : null,
    });
  });

  totalGravada = money(totalGravada);
  totalExenta = money(totalExenta);
  totalNoSuj = money(totalNoSuj);
  const subTotalVentas = money(totalNoSuj + totalExenta + totalGravada);

  let ivaTotal = 0;
  let montoTotalOperacion = subTotalVentas;
  let totalPagar = subTotalVentas;
  let tributos = null;

  if (isCcf) {
    const ivaRate = ivaFactor > 1 ? ivaFactor - 1 : 0.13;
    ivaTotal = money(totalGravada * ivaRate);
    montoTotalOperacion = money(subTotalVentas + ivaTotal);
    totalPagar = montoTotalOperacion;
    tributos = [{ codigo: '20', descripcion: 'Impuesto al Valor Agregado 13%', valor: ivaTotal }];
  }

  const resumen = {
    totalNoSuj,
    totalExenta,
    totalGravada,
    subTotalVentas,
    descuNoSuj: 0,
    descuExenta: 0,
    descuGravada: 0,
    porcentajeDescuento: 0,
    totalDescu: 0,
    tributos,
    subTotal: subTotalVentas,
    ivaRete1: 0,
    reteRenta: 0,
    montoTotalOperacion,
    totalNoGravado: 0,
    totalPagar,
    totalLetras: null,
    totalIva: isCcf ? ivaTotal : null,
    saldoFavor: 0,
    condicionOperacion: 1,
    pagos: [
      {
        codigo: '01',
        montoPago: totalPagar,
        referencia: null,
        plazo: null,
        periodo: null,
      },
    ],
    numPagoElectronico: null,
  };

  return { cuerpoDocumento, resumen, tipoDte };
}

function buildDteJson({ cred, header, lines, referencia, ivaFactor }) {
  const tipodoc = String(header.TIPODOC || '').trim().toUpperCase();
  const { cuerpoDocumento, resumen, tipoDte } = buildCuerpoYResumen(lines, tipodoc, ivaFactor);
  const { fecEmi, horEmi } = fechaParts(header);
  const codigoGeneracion = uuidV4().toUpperCase();
  const numeroControl = buildNumeroControl(
    tipoDte,
    cred.EMISOR_CODIGOESTABLECIMIENTO || cred.EMISOR_CODIGOPUNTOVENTA || '1',
    header.CORRELATIVO
  );

  const emisor = {
    nit: String(cred.EMISOR_NIT || '').replace(/[^0-9]/g, ''),
    nrc: String(cred.EMISOR_NRC || '').replace(/[^0-9]/g, ''),
    nombre: String(cred.EMISOR_NOMBRE || '').trim(),
    codActividad: String(cred.EMISOR_CODACTIVIDAD || '').trim(),
    descActividad: String(cred.EMISOR_DESCACTIVIDAD || '').trim() || 'Comercio',
    nombreComercial: String(cred.EMISOR_NOMBRECOMECIAL || cred.EMISOR_NOMBRE || '').trim() || null,
    tipoEstablecimiento: String(cred.EMISOR_TIPOESTABLECIMIENTO || '01').trim() || '01',
    direccion: {
      departamento: String(cred.EMISOR_DEPARTAMENTO || '06').trim() || '06',
      municipio: String(cred.EMISOR_MUNICIPIO || '14').trim() || '14',
      complemento: String(cred.EMISOR_DIRECCION || '').trim() || 'El Salvador',
    },
    telefono: String(cred.EMISOR_TELEFONO || '').trim() || null,
    correo: String(cred.EMISOR_CORREO || '').trim() || null,
    codEstableMH: String(cred.EMISOR_CODIGOESTABLECIMIENTO || '').trim() || null,
    codEstable: String(cred.EMISOR_CODIGOESTABLECIMIENTO || '').trim() || null,
    codPuntoVentaMH: String(cred.EMISOR_CODIGOPUNTOVENTA || '').trim() || null,
    codPuntoVenta: String(cred.EMISOR_CODIGOPUNTOVENTA || '').trim() || null,
  };

  const receptor = resolveReceptor(header);

  let documentoRelacionado = null;
  if (tipoDte === '05' && referencia?.FEL_UUDI) {
    const fechaRel = fechaIsoFromFelFecha(referencia.FEL_FECHA);
    if (!fechaRel) {
      const err = new Error(
        'El documento relacionado no tiene FEL_FECHA de certificación válida'
      );
      err.statusCode = 400;
      throw err;
    }
    documentoRelacionado = [
      {
        tipoDocumento: '03',
        tipoGeneracion: 2,
        numeroDocumento: String(referencia.FEL_UUDI).trim(),
        fechaEmision: fechaRel,
      },
    ];
  }

  const dteJson = {
    identificacion: {
      version: 1,
      ambiente: String(cred.AMBIENTE || '00'),
      tipoDte,
      numeroControl,
      codigoGeneracion,
      tipoModelo: 1,
      tipoOperacion: 1,
      tipoContingencia: null,
      motivoContin: null,
      fecEmi,
      horEmi,
      tipoMoneda: 'USD',
    },
    documentoRelacionado,
    emisor,
    receptor,
    otrosDocumentos: null,
    ventaTercero: null,
    cuerpoDocumento,
    resumen,
    extension: null,
    apendice: null,
  };

  return { dteJson, tipoDte, codigoGeneracion, numeroControl, fecEmi };
}

module.exports = { buildDteJson, uuidV4 };
