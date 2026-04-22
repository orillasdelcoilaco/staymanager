// frontend/src/shared/cuponesValidator.js

import { fetchAPI } from '../api.js';

/**
 * Estado del cupón aplicado
 */
export let cuponAplicado = null;

export function setCuponAplicado(cupon) {
  cuponAplicado = cupon;
}

export function getCuponAplicado() {
  return cuponAplicado;
}

/**
 * Maneja el cambio en el campo de cupón
 * @param {Function} updateSummaryCallback - Para actualizar precios
 * @param {object} currentPricing - Precios actuales
 * @param {Function} [onNotFoundAction] - (Opcional) Callback si el cupón no existe
 */
export async function handleCuponChange(updateSummaryCallback, currentPricing, onNotFoundAction = null) {
  const codigoInput = document.getElementById('cupon-input');
  const statusEl = document.getElementById('cupon-status');
  
  if (!codigoInput || !statusEl) return;

  const codigo = codigoInput.value.trim();
  
  if (!codigo) {
    cuponAplicado = null;
    statusEl.textContent = '';
    statusEl.className = 'text-xs mt-1';
    updateSummaryCallback(currentPricing);
    return;
  }

  try {
    statusEl.textContent = 'Validando...';
    statusEl.className = 'text-xs mt-1 text-gray-500';
    
    // Si el cupón no existe, fetchAPI lanzará un error (generalmente 404)
    cuponAplicado = await fetchAPI(`/crm/cupones/validar/${codigo}`);
    
    statusEl.textContent = `✅ Cupón válido: ${cuponAplicado.porcentajeDescuento}% OFF`;
    statusEl.className = 'text-xs mt-1 text-success-600 font-medium';
    
    updateSummaryCallback(currentPricing);

  } catch (error) {
    cuponAplicado = null;
    statusEl.className = 'text-xs mt-1 text-danger-600';
    
    // Detectamos si es un error de "No encontrado"
    if (onNotFoundAction && (error.status === 404 || error.message.toLowerCase().includes('no existe'))) {
        statusEl.innerHTML = `
            <span>🚫 ${error.message}</span>
            <button id="btn-crear-cupon-rapido" class="ml-1 text-primary-600 hover:underline font-bold focus:outline-none">
                ¿Crearlo?
            </button>
        `;
        
        // Asignamos el evento al botón recién creado
        document.getElementById('btn-crear-cupon-rapido').addEventListener('click', (e) => {
            e.preventDefault();
            onNotFoundAction(codigo);
        });
    } else {
        statusEl.textContent = `🚫 ${error.message}`;
    }
    
    updateSummaryCallback(currentPricing);
  }
}

export function clearCupon(updateSummaryCallback, currentPricing) {
  cuponAplicado = null;
  
  const codigoInput = document.getElementById('cupon-input');
  const statusEl = document.getElementById('cupon-status');
  
  if (codigoInput) codigoInput.value = '';
  if (statusEl) {
    statusEl.textContent = '';
    statusEl.className = 'text-xs mt-1';
  }
  // Limpiar sugerencia de cupón detectado
  document.getElementById('cupon-detectado-container')?.remove();
  
  if (updateSummaryCallback && currentPricing) {
    updateSummaryCallback(currentPricing);
  }
}

/**
 * Auto-detecta cupones del cliente seleccionado.
 * Si tiene cupones activos, muestra un banner con botón "Aplicar Cupón".
 * @param {string} clienteId
 * @param {Function} onAplicarCallback - Se llama con el código del cupón para rellenar el input
 */
export async function detectarCuponCliente(clienteId, onAplicarCallback) {
  document.getElementById('cupon-detectado-container')?.remove();
  if (!clienteId) return;

  try {
    const cupones = await fetchAPI(`/crm/cupones/cliente/${clienteId}`);
    if (!cupones || cupones.length === 0) return;

    const cuponInput = document.getElementById('cupon-input');
    if (!cuponInput) return;

    const container = document.createElement('div');
    container.id = 'cupon-detectado-container';
    container.className = 'mt-2 space-y-2';
    container.innerHTML = cupones.map(c => {
      const usosRestantes = Math.max(0, (c.usosMaximos || 1) - (c.usosActuales || 0));
      const vigencia = c.vigenciaHasta
        ? `Vence: ${new Date(c.vigenciaHasta).toLocaleDateString('es-CL')}`
        : 'Sin vencimiento';
      return `
        <div class="flex items-center justify-between gap-3 p-2.5 bg-primary-50 border border-primary-200 rounded-lg">
          <div class="flex items-center gap-2 text-sm">
            <span class="text-lg">🎟️</span>
            <div>
              <span class="font-mono font-bold text-primary-700">${c.codigo}</span>
              <span class="text-primary-600 font-semibold ml-1">${c.porcentajeDescuento}% OFF</span>
              <p class="text-xs text-gray-500">${usosRestantes} uso${usosRestantes !== 1 ? 's' : ''} restante${usosRestantes !== 1 ? 's' : ''} · ${vigencia}</p>
            </div>
          </div>
          <button class="btn-cupon-aplicar btn-primary text-xs py-1 px-3" data-codigo="${c.codigo}">Aplicar Cupón</button>
        </div>`;
    }).join('');
    cuponInput.parentElement.appendChild(container);

    container.addEventListener('click', (e) => {
      const btn = e.target.closest('.btn-cupon-aplicar');
      if (!btn) return;
      const codigo = btn.dataset.codigo;
      cuponInput.value = codigo;
      container.remove();
      if (onAplicarCallback) onAplicarCallback(codigo);
    });
  } catch {
    // Silencioso — no es crítico
  }
}