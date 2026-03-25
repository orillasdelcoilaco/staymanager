// backend/services/crmService.js
const pool = require('../db/postgres');

const PUNTOS = {
    recencia:   [{ dias: 30, puntos: 5 }, { dias: 90, puntos: 4 }, { dias: 180, puntos: 3 }, { dias: 365, puntos: 2 }, { dias: Infinity, puntos: 1 }],
    frecuencia: [{ compras: 5, puntos: 5 }, { compras: 4, puntos: 4 }, { compras: 3, puntos: 3 }, { compras: 2, puntos: 2 }, { compras: Infinity, puntos: 1 }],
    monetario:  [{ valor: 2000000, puntos: 5 }, { valor: 1000000, puntos: 4 }, { valor: 500000, puntos: 3 }, { valor: 250000, puntos: 2 }, { valor: Infinity, puntos: 1 }]
};

const getPuntos = (valor, tipo) => {
    const umbrales = PUNTOS[tipo];
    for (const umbral of umbrales) {
        if (valor <= umbral[Object.keys(umbral)[0]]) return umbral.puntos;
    }
    return 1;
};

const _toDate = (v) => v?.toDate ? v.toDate() : (v instanceof Date ? v : new Date(v));

const segmentarClienteRFM = (historialReservas, totalGastado) => {
    if (!historialReservas || historialReservas.length === 0) return 'Sin Reservas';

    const ahora = new Date();
    const fechaField = (r) => r.fechaSalida || r.fecha_salida;
    const ultimaReserva = historialReservas.sort((a, b) => _toDate(fechaField(b)) - _toDate(fechaField(a)))[0];
    const diasDesdeUltimaCompra = Math.round((ahora - _toDate(fechaField(ultimaReserva))) / (1000 * 60 * 60 * 24));

    const puntajeTotal = getPuntos(diasDesdeUltimaCompra, 'recencia')
        + getPuntos(historialReservas.length, 'frecuencia')
        + getPuntos(totalGastado, 'monetario');

    if (puntajeTotal >= 13) return '🏆 Campeones';
    if (puntajeTotal >= 10) return '❤️ Leales';
    if (puntajeTotal >= 7)  return '🤝 Potenciales';
    if (puntajeTotal >= 4)  return '😟 En Riesgo';
    return '🥶 Hibernando';
};

const obtenerClientesPorSegmento = async (db, empresaId, segmento) => {
    if (pool) {
        const params = [empresaId];
        let query = `SELECT id, nombre, email, telefono, metadata FROM clientes WHERE empresa_id=$1`;
        if (segmento && segmento !== 'Todos') {
            query += ` AND metadata->>'rfmSegmento' = $2`;
            params.push(segmento);
        }
        query += ' ORDER BY nombre';
        const { rows } = await pool.query(query, params);
        return rows.map(r => ({ id: r.id, nombre: r.nombre, email: r.email, telefono: r.telefono, ...(r.metadata || {}) }));
    }

    const clientesRef = db.collection('empresas').doc(empresaId).collection('clientes');
    const snapshot = await (segmento && segmento !== 'Todos'
        ? clientesRef.where('rfmSegmento', '==', segmento).orderBy('nombre').get()
        : clientesRef.orderBy('nombre').get());
    if (snapshot.empty) return [];
    return snapshot.docs.map(doc => doc.data());
};

module.exports = { segmentarClienteRFM, obtenerClientesPorSegmento };
