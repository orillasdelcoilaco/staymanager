// frontend/src/shared/formatters.js

/**
 * Formatea valores monetarios según la moneda especificada
 * @param {number} value - Valor a formatear
 * @param {string} currency - Código de moneda ('CLP' o 'USD')
 * @returns {string} - Valor formateado con símbolo de moneda
 */
export function formatCurrency(value, currency = 'CLP') {
  if (currency === 'USD') {
    return `$${(value || 0).toLocaleString('en-US', { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 2 
    })}`;
  }
  return `$${(Math.round(value) || 0).toLocaleString('es-CL')}`;
}