export function initModals() {
  // Modal ya está en el HTML, solo aseguramos que esté oculto
  const modal = document.getElementById('tarifa-modal-edit');
  if (modal) modal.classList.add('hidden');
}

export function abrirModalEditar(tarifa, canalPorDefecto) {
  const modal = document.getElementById('tarifa-modal-edit');
  const form = document.getElementById('tarifa-form-edit');
  if (!modal || !form) return;

  const precioBaseObj = tarifa.precios[canalPorDefecto.id];

  form.alojamientoNombre.value = tarifa.alojamientoNombre;
  form.temporada.value = tarifa.temporada;
  form.fechaInicio.value = tarifa.fechaInicio;
  form.fechaTermino.value = tarifa.fechaTermino;
  form.precioBase.value = precioBaseObj ? precioBaseObj.valorCLP : 0;

  modal.classList.remove('hidden');
}

export function cerrarModalEditar() {
  const modal = document.getElementById('tarifa-modal-edit');
  if (modal) modal.classList.add('hidden');
}