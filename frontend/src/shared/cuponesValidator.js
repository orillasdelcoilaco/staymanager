// frontend/src/shared/cuponesValidator.js

import { fetchAPI } from '../api.js';

/**
 * Estado del cupón aplicado (se exporta para que utils.js pueda acceder)
 */
export let cuponAplicado = null;

/**
 * Setter para actualizar el cupón aplicado desde otros módulos
 * @param {object|null} cupon - Objeto del cupón o null para limpiar
 */
export function setCuponAplicado(cupon) {
  cuponAplicado = cupon;
}

/**
 * Maneja el cambio en el campo de cupón y valida contra el backend
 * @param {Function} updateSummaryCallback - Callback para actualizar el resumen de precios
 * @param {object} currentPricing - Objeto con el pricing actual
 * @returns {Promise<void>}
 */
export async function handleCuponChange(updateSummaryCallback, currentPricing) {
  const codigoInput = document.getElementById('cupon-input');
  const statusEl = document.getElementById('cupon-status');
  
  if (!codigoInput || !statusEl) {
    console.warn('Elementos de cupón no encontrados en el DOM');
    return;
  }

  const codigo = codigoInput.value.trim();
  
  if (!codigo) {
    cuponAplicado = null;
    statusEl.textContent = '';
    updateSummaryCallback(currentPricing);
    return;
  }

  try {
    statusEl.textContent = 'Validando...';
    statusEl.className = 'text-xs mt-1 text-gray-600';
    
    cuponAplicado = await fetchAPI(`/crm/cupones/validar/${codigo}`);
    
    statusEl.textContent = `Cupón válido: ${cuponAplicado.porcentajeDescuento}% de descuento.`;
    statusEl.className = 'text-xs mt-1 text-green-600';
    
    updateSummaryCallback(currentPricing);
  } catch (error) {
    cuponAplicado = null;
    statusEl.textContent = `${error.message}`;
    statusEl.className = 'text-xs mt-1 text-red-600';
    
    updateSummaryCallback(currentPricing);
  }
}

/**
 * Limpia el cupón aplicado y resetea el UI
 * @param {Function} updateSummaryCallback - Callback para actualizar el resumen
 * @param {object} currentPricing - Objeto con el pricing actual
 */
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

/**
 * Obtiene el cupón actualmente aplicado
 * @returns {object|null} - Objeto del cupón o null
 */
export function getCuponAplicado() {
  return cuponAplicado;
}