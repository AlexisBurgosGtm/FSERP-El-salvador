/**
 * Despacho → Despachos en Cocina (vista en definición).
 */
const DespachosEnCocinaView = {
  _container: null,

  load(container) {
    this._container = container;
    container.innerHTML = `
      <div class="catalogo-empresa-view w-100">
        <div class="d-flex justify-content-between align-items-start mb-3 flex-wrap gap-2">
          <div>
            <h5 class="mb-0">Despachos en Cocina</h5>
            <p class="small text-muted mb-0">Esta vista se definirá a continuación.</p>
          </div>
        </div>
        <div class="card shadow-sm">
          <div class="card-body text-center text-muted py-5">
            <i class="fa-solid fa-kitchen-set fa-2x mb-3 d-block"></i>
            Próximamente: despachos en cocina.
          </div>
        </div>
      </div>`;
  },
};
