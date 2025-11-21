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
    statusEl.className = 'text-xs mt-1 text-green-600 font-medium';
    
    updateSummaryCallback(currentPricing);

  } catch (error) {
    cuponAplicado = null;
    statusEl.className = 'text-xs mt-1 text-red-600';
    
    // Detectamos si es un error de "No encontrado"
    if (onNotFoundAction && (error.status === 404 || error.message.toLowerCase().includes('no existe'))) {
        statusEl.innerHTML = `
            <span>🚫 ${error.message}</span>
            <button id="btn-crear-cupon-rapido" class="ml-1 text-indigo-600 hover:underline font-bold focus:outline-none">
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
  
  if (updateSummaryCallback && currentPricing) {
    updateSummaryCallback(currentPricing);
  }
}