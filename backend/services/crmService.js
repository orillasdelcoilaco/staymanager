// backend/services/crmService.js
const admin = require('firebase-admin');

const PUNTOS = {
    recencia: [
        { dias: 30, puntos: 5 },
        { dias: 90, puntos: 4 },
        { dias: 180, puntos: 3 },
        { dias: 365, puntos: 2 },
        { dias: Infinity, puntos: 1 }
    ],
    frecuencia: [
        { compras: 5, puntos: 5 },
        { compras: 4, puntos: 4 },
        { compras: 3, puntos: 3 },
        { compras: 2, puntos: 2 },
        { compras: Infinity, puntos: 1 }
    ],
    monetario: [
        { valor: 2000000, puntos: 5 },
        { valor: 1000000, puntos: 4 },
        { valor: 500000, puntos: 3 },
        { valor: 250000, puntos: 2 },
        { valor: Infinity, puntos: 1 }
    ]
};

const getPuntos = (valor, tipo) => {
    const umbrales = PUNTOS[tipo];
    for (const umbral of umbrales) {
        if (valor <= umbral[Object.keys(umbral)[0]]) {
            return umbral.puntos;
        }
    }
    return 1;
};

const segmentarClienteRFM = (historialReservas, totalGastado) => {
    if (!historialReservas || historialReservas.length === 0) {
        return 'Sin Reservas';
    }

    const ahora = new Date();
    const ultimaReserva = historialReservas.sort((a, b) => b.fechaSalida.toDate() - a.fechaSalida.toDate())[0];
    const diasDesdeUltimaCompra = Math.round((ahora - ultimaReserva.fechaSalida.toDate()) / (1000 * 60 * 60 * 24));

    const recencia = getPuntos(diasDesdeUltimaCompra, 'recencia');
    const frecuencia = getPuntos(historialReservas.length, 'frecuencia');
    const monetario = getPuntos(totalGastado, 'monetario');
    
    const puntajeTotal = recencia + frecuencia + monetario;

    if (puntajeTotal >= 13) return '🏆 Campeones';
    if (puntajeTotal >= 10) return '❤️ Leales';
    if (puntajeTotal >= 7) return '🤝 Potenciales';
    if (puntajeTotal >= 4) return '😟 En Riesgo';
    
    return '🥶 Hibernando';
};

const obtenerClientesPorSegmento = async (db, empresaId, segmento) => {
    const clientesRef = db.collection('empresas').doc(empresaId).collection('clientes');
    let query = clientesRef;

    if (segmento && segmento !== 'Todos') {
        query = query.where('rfmSegmento', '==', segmento);
    }
    
    const snapshot = await query.orderBy('nombre').get();
    
    if (snapshot.empty) {
        return [];
    }
    return snapshot.docs.map(doc => doc.data());
};

module.exports = {
    segmentarClienteRFM,
    obtenerClientesPorSegmento
};