/**
 * Servicio para obtener el valor del dólar.
 * TODO: Conectar a una API externa como mindicador.cl
 */
const obtenerValorDolar = async (fecha) => {
    // --- Lógica de Placeholder ---
    // En el futuro, aquí se hará una llamada a una API para obtener el valor real.
    // Por ahora, usamos un valor fijo para permitir que el resto del sistema funcione.
    console.log(`[DolarService] Obteniendo valor del dólar para ${fecha} (usando valor fijo de prueba)`);
    return 950; // Valor de ejemplo
};

module.exports = {
    obtenerValorDolar
};