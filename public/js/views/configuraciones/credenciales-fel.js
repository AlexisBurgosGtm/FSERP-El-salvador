/**
 * Credenciales DTE (El Salvador) — CRUD sobre dbo.FEL_CREDENCIALES (1 fila por EMPNIT).
 */
const CredencialesFelViewBase = createCatalogoEmpresaView({
  slug: 'credenciales-fel',
  apiPath: '/api/credenciales-fel',
  icon: 'fa-key',
  viewTitle: 'Credenciales DTE',
  labelSingular: 'credencial DTE',
  labelPlural: 'credencial(es) DTE',
  idKey: 'EMPNIT',
  dataAttr: 'empnit',
  formWidth: 820,
  maxRecords: 1,
  searchPlaceholder: 'Buscar por NIT, NRC o nombre…',
  searchKeys: ['EMISOR_NIT', 'EMISOR_NRC', 'EMISOR_NOMBRECOMECIAL', 'CERTIFICACION_USUARIO'],
  formFields: [],
  createKeys: [],
  updateKeys: [],
  tableColumns: [
    { key: 'EMISOR_NIT', label: 'NIT' },
    { key: 'EMISOR_NRC', label: 'NRC' },
    { key: 'EMISOR_NOMBRECOMECIAL', label: 'Nombre comercial' },
    { key: 'AMBIENTE', label: 'Ambiente' },
    { key: 'MODO_SIMULACION', label: 'Simulación' },
  ],
  getRowLabel(row) {
    return row?.EMISOR_NOMBRECOMECIAL || row?.EMISOR_NIT || row?.EMPNIT || '';
  },
});

const CredencialesFelView = {
  ...CredencialesFelViewBase,

  formatDate(value) {
    if (!value) return '—';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return this.escapeHtml(String(value));
    return d.toLocaleDateString('es-SV');
  },

  dateInputValue(value) {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value).slice(0, 10);
    return d.toISOString().slice(0, 10);
  },

  formatCell(value, col) {
    if (col?.key === 'VENCE_CERTIFICADO') return this.formatDate(value);
    if (col?.key === 'AMBIENTE') {
      return value === '01' ? 'Producción' : 'Prueba';
    }
    return CredencialesFelViewBase.formatCell.call(this, value, col);
  },

  inputField(name, label, value, attrs = {}) {
    const req = attrs.required ? 'required' : '';
    const ro = attrs.readonly ? 'readonly' : '';
    const type = attrs.type || 'text';
    const placeholder = attrs.placeholder ? `placeholder="${this.escapeHtml(attrs.placeholder)}"` : '';
    const val = value ?? '';
    return `
      <label class="form-label small mb-0">${this.escapeHtml(label)}</label>
      <input type="${type}" class="form-control form-control-sm" name="${name}"
        value="${this.escapeHtml(val)}" ${req} ${ro} ${placeholder} autocomplete="off">
    `;
  },

  selectField(name, label, options, value) {
    const opts = options
      .map(
        (o) =>
          `<option value="${this.escapeHtml(o.value)}"${String(value) === String(o.value) ? ' selected' : ''}>${this.escapeHtml(o.label)}</option>`
      )
      .join('');
    return `
      <label class="form-label small mb-0">${this.escapeHtml(label)}</label>
      <select class="form-select form-select-sm" name="${name}">${opts}</select>
    `;
  },

  sectionTitle(text) {
    return `<h6 class="small fw-semibold text-primary mt-2 mb-1">${this.escapeHtml(text)}</h6>`;
  },

  rowCols(cols) {
    const n = cols.length;
    const colClass = n === 3 ? 'col-md-4' : n === 2 ? 'col-md-6' : 'col-12';
    return `
      <div class="row g-2 mb-2">
        ${cols.map((html) => `<div class="${colClass}">${html}</div>`).join('')}
      </div>
    `;
  },

  buildFormHtml(row = {}, isEdit = false) {
    const r = row || {};
    return [
      this.sectionTitle('Ambiente y transmisión'),
      this.rowCols([
        this.selectField(
          'AMBIENTE',
          'Ambiente MH',
          [
            { value: '00', label: '00 — Prueba' },
            { value: '01', label: '01 — Producción' },
          ],
          r.AMBIENTE || '00'
        ),
        this.selectField(
          'MODO_SIMULACION',
          'Modo simulación',
          [
            { value: 'SI', label: 'SI — no envía a MH (pruebas ERP)' },
            { value: 'NO', label: 'NO — firmador + recepción reales' },
          ],
          r.MODO_SIMULACION || 'SI'
        ),
        this.inputField('VENCE_CERTIFICADO', 'Vence certificado', this.dateInputValue(r.VENCE_CERTIFICADO), {
          type: 'date',
        }),
      ]),
      this.sectionTitle('Autenticación MH / API'),
      this.rowCols([
        this.inputField('CERTIFICACION_USUARIO', 'Usuario / API user', r.CERTIFICACION_USUARIO),
        this.inputField('CERTIFICACION_LLAVE', 'Contraseña / API key', r.CERTIFICACION_LLAVE, {
          required: !isEdit,
        }),
      ]),
      this.sectionTitle('Firmador'),
      this.rowCols([
        this.inputField('FIRMA_ALIAS', 'Usuario firmador / alias', r.FIRMA_ALIAS),
        this.inputField('FIRMA_LLAVE', 'Password certificado / llave', r.FIRMA_LLAVE),
      ]),
      this.sectionTitle('URLs servicio'),
      this.rowCols([
        this.inputField('URL_AUTH', 'URL autenticación', r.URL_AUTH, {
          placeholder: 'https://…/auth',
        }),
      ]),
      this.rowCols([
        this.inputField('URL_FIRMADOR', 'URL firmador', r.URL_FIRMADOR, {
          placeholder: 'https://…/firmardocumento',
        }),
      ]),
      this.rowCols([
        this.inputField('URL_RECEPCION', 'URL recepción MH', r.URL_RECEPCION, {
          placeholder: 'https://…/recepciondte',
        }),
      ]),
      this.rowCols([
        this.inputField('URL_CONSULTA', 'URL consulta DTE (opcional)', r.URL_CONSULTA),
      ]),
      this.sectionTitle('Emisor'),
      this.rowCols([
        this.inputField('EMISOR_NIT', 'NIT emisor', r.EMISOR_NIT, { required: true }),
        this.inputField('EMISOR_NRC', 'NRC emisor', r.EMISOR_NRC, { required: true }),
      ]),
      this.rowCols([
        this.inputField('EMISOR_NOMBRE', 'Nombre / razón social', r.EMISOR_NOMBRE, { required: true }),
        this.inputField('EMISOR_NOMBRECOMECIAL', 'Nombre comercial', r.EMISOR_NOMBRECOMECIAL),
      ]),
      this.rowCols([
        this.inputField('EMISOR_CODACTIVIDAD', 'Cód. actividad (CAT-019)', r.EMISOR_CODACTIVIDAD, {
          required: true,
        }),
        this.inputField('EMISOR_DESCACTIVIDAD', 'Desc. actividad', r.EMISOR_DESCACTIVIDAD),
      ]),
      this.rowCols([this.inputField('EMISOR_DIRECCION', 'Dirección (complemento)', r.EMISOR_DIRECCION)]),
      this.rowCols([
        this.inputField('EMISOR_DEPARTAMENTO', 'Depto MH (CAT)', r.EMISOR_DEPARTAMENTO, {
          placeholder: '06',
        }),
        this.inputField('EMISOR_MUNICIPIO', 'Municipio/Distrito MH', r.EMISOR_MUNICIPIO, {
          placeholder: '14',
        }),
      ]),
      this.rowCols([
        this.inputField('EMISOR_TELEFONO', 'Teléfono', r.EMISOR_TELEFONO),
        this.inputField('EMISOR_CORREO', 'Correo', r.EMISOR_CORREO, { type: 'email' }),
      ]),
      this.rowCols([
        this.inputField('EMISOR_TIPOESTABLECIMIENTO', 'Tipo establecimiento', r.EMISOR_TIPOESTABLECIMIENTO, {
          placeholder: '01',
        }),
        this.inputField('EMISOR_CODIGOESTABLECIMIENTO', 'Cód. establecimiento', r.EMISOR_CODIGOESTABLECIMIENTO),
        this.inputField('EMISOR_CODIGOPUNTOVENTA', 'Cód. punto de venta', r.EMISOR_CODIGOPUNTOVENTA),
      ]),
      `<p class="small text-muted mb-0 mt-2">Tipodocs: <strong>FEF</strong>=Factura 01, <strong>FEC</strong>=CCF 03, <strong>FNC</strong>=NC 05. Con simulación=SI se guarda código de generación sin llamar a MH.</p>`,
    ].join('');
  },

  readFormData() {
    const names = [
      'CERTIFICACION_USUARIO',
      'CERTIFICACION_LLAVE',
      'FIRMA_ALIAS',
      'FIRMA_LLAVE',
      'AMBIENTE',
      'MODO_SIMULACION',
      'URL_AUTH',
      'URL_FIRMADOR',
      'URL_RECEPCION',
      'URL_CONSULTA',
      'EMISOR_NIT',
      'EMISOR_NRC',
      'EMISOR_NOMBRE',
      'EMISOR_NOMBRECOMECIAL',
      'EMISOR_CODACTIVIDAD',
      'EMISOR_DESCACTIVIDAD',
      'EMISOR_DIRECCION',
      'EMISOR_DEPARTAMENTO',
      'EMISOR_MUNICIPIO',
      'EMISOR_TELEFONO',
      'EMISOR_CORREO',
      'EMISOR_TIPOESTABLECIMIENTO',
      'EMISOR_CODIGOESTABLECIMIENTO',
      'EMISOR_CODIGOPUNTOVENTA',
      'EMISOR_CODIGOPOSTAL',
      'VENCE_CERTIFICADO',
    ];
    const data = {};
    names.forEach((name) => {
      const input = document.querySelector(`.swal2-html-container [name="${name}"]`);
      if (!input) return;
      data[name] = input.value.trim();
    });
    return data;
  },

  mapFormToApi(data) {
    const payload = { ...data };
    Object.keys(payload).forEach((key) => {
      if (payload[key] === '') payload[key] = null;
    });
    return payload;
  },

  validateForm(data) {
    if (!data.EMISOR_NIT) return 'El NIT emisor es obligatorio';
    if (!data.EMISOR_NRC) return 'El NRC emisor es obligatorio';
    if (!data.EMISOR_NOMBRE) return 'El nombre emisor es obligatorio';
    if (!data.EMISOR_CODACTIVIDAD) return 'El código de actividad es obligatorio';
    return null;
  },

  async showForm(title, row = {}, isEdit = false) {
    return CatalogosUI.fireForm({
      title,
      html: this.buildFormHtml(row, isEdit),
      width: 820,
      preConfirm: () => {
        const data = this.readFormData();
        const err = this.validateForm(data);
        if (err) {
          Swal.showValidationMessage(err);
          return false;
        }
        return this.mapFormToApi(data);
      },
    });
  },

  async fetchRowFull(empnit) {
    const data = await F.fetchJson(this.apiBase(`/${encodeURIComponent(empnit)}`));
    return data.row;
  },

  async onNuevo() {
    if (this._rows.length >= 1) {
      F.toast('Ya existe un registro de credenciales DTE para esta empresa', 'warning');
      return;
    }
    const payload = await this.showForm('Nueva credencial DTE');
    if (!payload) return;
    try {
      await F.fetchJson(this.apiBase(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      F.toast('Credencial DTE creada', 'success');
      await this.load(this._container);
    } catch (err) {
      F.alert('Error', err.message, 'error');
    }
  },

  async onEditar(id) {
    try {
      const row = await this.fetchRowFull(id);
      const payload = await this.showForm('Editar credencial DTE', row, true);
      if (!payload) return;
      await F.fetchJson(this.apiBase(`/${encodeURIComponent(id)}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      F.toast('Credencial DTE actualizada', 'success');
      await this.load(this._container);
    } catch (err) {
      F.alert('Error', err.message, 'error');
    }
  },

  async load(container) {
    await CredencialesFelViewBase.load.call(this, container);
  },
};
