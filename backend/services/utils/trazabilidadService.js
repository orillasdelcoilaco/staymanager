// backend/services/utils/trazabilidadService.js
const admin = require('firebase-admin');

/**
 * Registra una entrada en el log de historial de ajustes de una reserva.
 * Esta función DEBE ser llamada dentro de una transacción de Firestore.
 *
 * @param {admin.firestore.Transaction} transaction - La transacción en curso.
 * @param {admin.firestore.Firestore} db - Instancia de Firestore (no se usa aquí pero se mantiene por consistencia).
 * @param {string} empresaId - ID de la empresa (no se usa aquí pero se mantiene por consistencia).
 * @param {admin.firestore.DocumentReference} reservaRef - La referencia al documento de reserva que se está actualizando.
 * @param {object} datosAjuste - Los detalles del ajuste.
 * @param {string} datosAjuste.fuente - De dónde provino el cambio (ej: 'Gestión Diaria (Ajustar Cobro)').
 * @param {string} datosAjuste.usuarioEmail - El email del usuario que realizó el cambio.
 * @param {number} datosAjuste.valorAnteriorUSD - El valorHuespedOriginal ANTES del cambio.
 * @param {number} datosAjuste.valorNuevoUSD - El valorHuespedOriginal DESPUÉS del cambio.
 * @param {number} datosAjuste.valorDolarUsado - El valor del dólar utilizado para la conversión.
 */
const registrarAjusteValor = async (transaction, db, empresaId, reservaRef, datosAjuste) => {
    
    // Solo registrar si hay un cambio real en el valor
    if (datosAjuste.valorAnteriorUSD === datosAjuste.valorNuevoUSD) {
        return;
    }

    const logEntry = {
        fecha: new Date(),
        fuente: datosAjuste.fuente,
        usuarioEmail: datosAjuste.usuarioEmail,
        valorAnteriorUSD: datosAjuste.valorAnteriorUSD,
        valorNuevoUSD: datosAjuste.valorNuevoUSD,
        ajusteUSD: datosAjuste.valorNuevoUSD - datosAjuste.valorAnteriorUSD,
        valorDolarUsado: datosAjuste.valorDolarUsado || null
    };

    // Usamos arrayUnion para añadir al log sin sobrescribir
    // y eliminamos los campos antiguos/obsoletos
    transaction.update(reservaRef, {
        historialAjustes: admin.firestore.FieldValue.arrayUnion(logEntry),
        ajusteManualRealizado: admin.firestore.FieldValue.delete(),
        ajustes: admin.firestore.FieldValue.delete()
    });
};

module.exports = {
    registrarAjusteValor
};