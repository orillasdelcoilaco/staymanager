export function poblarSelectAlojamientos(alojamientos, alojamientoSeleccionadoId = '') {
  const select = document.getElementById('alojamiento-select');
  if (!select) return;
  select.innerHTML = alojamientos.map(a => 
    `<option value="${a.id}" ${a.id === alojamientoSeleccionadoId ? 'selected' : ''}>${a.nombre}</option>`
  ).join('');
}

export function limpiarFormularioPrincipal() {
  const form = document.getElementById('tarifa-form');
  if (form) form.reset();
  poblarSelectAlojamientos(window.alojamientos || []);
}

export async function handleFormSubmit(e, tarifas, renderTabla, limpiarFormularioPrincipal, fetchAPI) {
  e.preventDefault();
  
  const datos = {
    alojamientoId: document.getElementById('alojamiento-select').value,
    temporada: document.getElementById('temporada-input').value,
    fechaInicio: document.getElementById('fecha-inicio-input').value,
    fechaTermino: document.getElementById('fecha-termino-input').value,
    precioBase: document.getElementById('precio-base-input').value
  };

  try {
    await fetchAPI('/tarifas', { method: 'POST', body: datos });
    tarifas = await fetchAPI('/tarifas');
    renderTabla(tarifas, window.canales, window.canalPorDefecto);
    limpiarFormularioPrincipal();
  } catch (error) {
    alert(`Error al guardar tarifa: ${error.message}`);
  }
}

export async function handleEditSubmit(e, editandoTarifa, tarifas, renderTabla, cerrarModalEditar, fetchAPI) {
  e.preventDefault();
  
  const datos = {
    temporada: e.target.elements.temporada.value,
    fechaInicio: e.target.elements.fechaInicio.value,
    fechaTermino: e.target.elements.fechaTermino.value,
    precioBase: e.target.elements.precioBase.value
  };

  try {
    await fetchAPI(`/tarifas/${editandoTarifa.id}`, { method: 'PUT', body: datos });
    tarifas = await fetchAPI('/tarifas');
    renderTabla(tarifas, window.canales, window.canalPorDefecto);
    cerrarModalEditar();
  } catch (error) {
    alert(`Error al actualizar tarifa: ${error.message}`);
  }
}

export function handleCopyClick(tarifa, canalPorDefecto) {
  poblarSelectAlojamientos(window.alojamientos, tarifa.alojamientoId);
  document.getElementById('temporada-input').value = tarifa.temporada;
  document.getElementById('fecha-inicio-input').value = tarifa.fechaInicio;
  document.getElementById('fecha-termino-input').value = tarifa.fechaTermino;
  
  const precioBaseObj = tarifa.precios[canalPorDefecto.id];
  document.getElementById('precio-base-input').value = precioBaseObj ? precioBaseObj.valorCLP : '';

  window.scrollTo(0, 0);
}

export async function handleDeleteClick(id, tarifas, renderTabla, fetchAPI) {
  if (confirm('¿Estás seguro de que quieres eliminar este período de tarifa?')) {
    try {
      await fetchAPI(`/tarifas/${id}`, { method: 'DELETE' });
      tarifas = await fetchAPI('/tarifas');
      renderTabla(tarifas, window.canales, window.canalPorDefecto);
    } catch (error) {
      alert(`Error al eliminar: ${error.message}`);
    }
  }
}