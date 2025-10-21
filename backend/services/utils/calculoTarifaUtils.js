// backend/services/utils/calculoTarifaUtils.js

/**
 * Calcula el precio detallado de una estadía basándose en las tarifas aplicables.
 * ESTA FUNCIÓN ASUME QUE LAS TARIFAS PROPORCIONADAS YA ESTÁN CALCULADAS PARA EL CANAL REQUERIDO Y EN CLP.
 * La lógica compleja de modificadores y conversión de moneda se maneja en otros servicios (propuestasService, tarifasService).
 *
 * @param {Array} tarifas - Array de objetos de tarifa que aplican al rango de fechas y propiedad. Se espera que contengan el precio diario calculado.
 * @param {number} noches - El número total de noches de la estadía.
 * @param {number} comisionAgenciaPct - El porcentaje de comisión de agencia (ej. 15 para 15%).
 * @param {string} canalIdParaPrecio - El ID del canal cuyo precio CLP se debe usar (generalmente el canal por defecto o 'App').
 * @returns {object} - Objeto con { precioTotalCLP, precioPromedioNocheCLP, comisionTotalCLP }.
 */
function calcularPrecioDetallado(tarifas, noches, comisionAgenciaPct = 0, canalIdParaPrecio) {
    // Validación inicial
    if (!Array.isArray(tarifas) || noches <= 0 || !canalIdParaPrecio) {
        console.warn('[calculoTarifaUtils] Datos inválidos recibidos:', { tarifas, noches, canalIdParaPrecio });
        return { precioTotalCLP: 0, precioPromedioNocheCLP: 0, comisionTotalCLP: 0 };
    }

    // Simplificación: Asumimos que las tarifas proporcionadas cubren todo el rango.
    // La lógica más compleja de buscar tarifa día por día está en propuestasService.calculatePrice.
    // Aquí promediamos las tarifas encontradas que aplican al rango.
    // Filtramos para asegurarnos de que solo consideramos tarifas con el precio del canal requerido.
    const tarifasValidas = tarifas.filter(t => t.precios && t.precios[canalIdParaPrecio] && (t.precios[canalIdParaPrecio].valorCLP !== undefined || typeof t.precios[canalIdParaPrecio] === 'number'));

    if (tarifasValidas.length === 0) {
        console.warn(`[calculoTarifaUtils] No se encontraron tarifas válidas con precio para el canal ${canalIdParaPrecio}.`);
        return { precioTotalCLP: 0, precioPromedioNocheCLP: 0, comisionTotalCLP: 0 };
    }

    // Calcular el precio promedio por noche basado en las tarifas encontradas
    let sumaPreciosNoche = 0;
    tarifasValidas.forEach(t => {
        const precioObj = t.precios[canalIdParaPrecio];
        // Manejar ambas estructuras: { valorCLP: X } o simplemente el valor numérico
        sumaPreciosNoche += (typeof precioObj === 'number' ? precioObj : precioObj.valorCLP) || 0;
    });

    const precioPromedioNocheCLP = Math.round(sumaPreciosNoche / tarifasValidas.length);
    const precioTotalCLP = Math.round(precioPromedioNocheCLP * noches);

    // Calcular comisión si aplica
    const comisionTotalCLP = comisionAgenciaPct > 0
        ? Math.round(precioTotalCLP * (comisionAgenciaPct / 100))
        : 0;

    return {
        precioTotalCLP,
        precioPromedioNocheCLP,
        comisionTotalCLP
    };
}

module.exports = {
    calcularPrecioDetallado
};