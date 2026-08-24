/**
 * Cliente de transmisión DTE SV.
 * MODO_SIMULACION=SI: genera sello local (pruebas sin MH).
 * MODO_SIMULACION=NO: POST a URL_AUTH / URL_FIRMADOR / URL_RECEPCION configuradas.
 */
async function postJson(url, body, headers = {}) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    const msg = data.mensaje || data.message || data.error || res.statusText || 'Error HTTP';
    const err = new Error(`DTE (${res.status}): ${msg}`);
    err.statusCode = 502;
    err.payload = data;
    throw err;
  }
  return data;
}

async function transmitDte(dteJson, credenciales) {
  const codigoGeneracion = dteJson?.identificacion?.codigoGeneracion;
  const numeroControl = dteJson?.identificacion?.numeroControl;
  const fecEmi = dteJson?.identificacion?.fecEmi;

  if (String(credenciales.MODO_SIMULACION || 'SI').toUpperCase() !== 'NO') {
    return {
      uuid: codigoGeneracion,
      serie: String(numeroControl || '').split('-')[1] || 'DTE',
      numero: String(numeroControl || '').split('-').pop() || '',
      fechaCertificacion: `${fecEmi}T${dteJson.identificacion.horEmi}`,
      selloRecibido: `SIM-${codigoGeneracion}`,
      simulated: true,
      dteJson,
    };
  }

  const urlAuth = String(credenciales.URL_AUTH || '').trim();
  const urlFirmador = String(credenciales.URL_FIRMADOR || '').trim();
  const urlRecepcion = String(credenciales.URL_RECEPCION || '').trim();
  if (!urlFirmador || !urlRecepcion) {
    const err = new Error(
      'Configure URL_FIRMADOR y URL_RECEPCION en Credenciales DTE, o active MODO_SIMULACION=SI'
    );
    err.statusCode = 400;
    throw err;
  }

  let token = '';
  if (urlAuth) {
    const auth = await postJson(urlAuth, {
      user: credenciales.CERTIFICACION_USUARIO,
      pwd: credenciales.CERTIFICACION_LLAVE,
      nit: String(credenciales.EMISOR_NIT || '').replace(/[^0-9]/g, ''),
    });
    token = auth.token || auth.body?.token || auth.accessToken || '';
  }

  const firmado = await postJson(
    urlFirmador,
    {
      nit: String(credenciales.EMISOR_NIT || '').replace(/[^0-9]/g, ''),
      activo: true,
      passwordPri: credenciales.FIRMA_LLAVE,
      dteJson,
    },
    token ? { Authorization: token } : {}
  );

  const documentoFirmado = firmado.body || firmado.documento || firmado;
  const recepcion = await postJson(
    urlRecepcion,
    {
      ambiente: credenciales.AMBIENTE,
      idEnvio: Date.now(),
      version: dteJson.identificacion.version,
      tipoDte: dteJson.identificacion.tipoDte,
      documento: typeof documentoFirmado === 'string' ? documentoFirmado : JSON.stringify(documentoFirmado),
      codigoGeneracion,
    },
    token ? { Authorization: token } : {}
  );

  const sello =
    recepcion.selloRecibido ||
    recepcion.body?.selloRecibido ||
    recepcion.fhProcesamiento ||
    '';

  if (!sello && String(recepcion.estado || '').toUpperCase() === 'RECHAZADO') {
    const err = new Error(recepcion.descripcionMsg || recepcion.mensaje || 'DTE rechazado por MH');
    err.statusCode = 400;
    err.payload = recepcion;
    throw err;
  }

  return {
    uuid: codigoGeneracion,
    serie: String(numeroControl || '').split('-')[1] || 'DTE',
    numero: String(numeroControl || '').split('-').pop() || '',
    fechaCertificacion: recepcion.fhProcesamiento || `${fecEmi}T${dteJson.identificacion.horEmi}`,
    selloRecibido: sello || `OK-${codigoGeneracion}`,
    simulated: false,
    dteJson,
    recepcion,
  };
}

module.exports = { transmitDte };
