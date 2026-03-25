export function initModals() {
  const modal = document.getElementById('tarifa-modal-edit');
  if (modal) modal.classList.add('hidden');
}

function calcularPrecioCanal(precioBase, canal, canalPorDefecto, valorDolarDia) {
  let valor = precioBase;
  if (canal.moneda === 'USD' && canalPorDefecto.moneda === 'CLP' && valorDolarDia > 0) {
    valor = precioBase / valorDolarDia;
  } else if (canal.moneda === 'CLP' && canalPorDefecto.moneda === 'USD' && valorDolarDia > 0) {
    valor = precioBase * valorDolarDia;
  }
  if (canal.id !== canalPorDefecto.id && canal.modificadorValor) {
    if (canal.modificadorTipo === 'porcentaje') {
      valor *= (1 + canal.modificadorValor / 100);
    } else if (canal.modificadorTipo === 'fijo') {
      valor += canal.modificadorValor;
    }
  }
  return { valor, moneda: canal.moneda };
}

function renderPreciosPreview(canales, canalPorDefecto, precioBase, valorDolarDia) {
  const container = document.getElementById('precios-canales-preview');
  if (!container) return;
  container.innerHTML = canales.map(canal => {
    const { valor, moneda } = calcularPrecioCanal(precioBase, canal, canalPorDefecto, valorDolarDia);
    const label = moneda === 'USD'
      ? `USD ${valor.toFixed(2)}`
      : `CLP ${Math.round(valor).toLocaleString('es-CL')}`;
    const esBase = canal.id === canalPorDefecto.id;
    return `
      <div class="flex justify-between items-center py-1 border-b border-gray-100 text-sm last:border-0">
        <span class="text-gray-600">${canal.nombre}${esBase ? ' ⭐' : ''}</span>
        <span class="font-semibold ${esBase ? 'text-primary-700' : 'text-gray-800'}">${label}</span>
      </div>`;
  }).join('');
}

export function abrirModalEditar(tarifa, canalPorDefecto, canales) {
  const modal = document.getElementById('tarifa-modal-edit');
  const form = document.getElementById('tarifa-form-edit');
  if (!modal || !form) return;

  const precioBaseObj = tarifa.precios[canalPorDefecto.id];
  const precioBaseVal = precioBaseObj ? precioBaseObj.valorCLP : 0;

  form.alojamientoNombre.value = tarifa.alojamientoNombre;
  form.temporada.value = tarifa.temporada;
  form.fechaInicio.value = tarifa.fechaInicio;
  form.fechaTermino.value = tarifa.fechaTermino;
  form.precioBase.value = precioBaseVal;

  renderPreciosPreview(canales, canalPorDefecto, precioBaseVal, tarifa.valorDolarDia);

  // Reemplazar input para limpiar listeners anteriores
  const oldInput = form.querySelector('[name="precioBase"]');
  const newInput = oldInput.cloneNode(true);
  oldInput.parentNode.replaceChild(newInput, oldInput);
  newInput.addEventListener('input', () => {
    renderPreciosPreview(canales, canalPorDefecto, parseFloat(newInput.value) || 0, tarifa.valorDolarDia);
  });

  modal.classList.remove('hidden');
}

export function cerrarModalEditar() {
  const modal = document.getElementById('tarifa-modal-edit');
  if (modal) modal.classList.add('hidden');
}