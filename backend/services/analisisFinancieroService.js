// backend/services/analisisFinancieroService.js
const admin = require('firebase-admin');

const actualizarValoresGrupo = async (db, empresaId, valoresCabanas, nuevoTotalHuesped) => {
    const batch = db.batch();
    
    const docs = await Promise.all(valoresCabanas.map(item => 
        db.collection('empresas').doc(empresaId).collection('reservas').doc(item.id).get()
    ));

    let totalHuespedActual = 0;
    docs.forEach(doc => {
        if (doc.exists) {
            totalHuespedActual += doc.data().valores.valorHuesped || 0;
        }
    });

    if (totalHuespedActual === 0) throw new Error("El valor actual del grupo es cero, no se puede calcular la proporción.");

    const proporcion = parseFloat(nuevoTotalHuesped) / totalHuespedActual;

    docs.forEach(doc => {
        if (doc.exists) {
            const reserva = doc.data();
            const nuevosValores = { ...reserva.valores };
            const valorHuespedActualIndividual = nuevosValores.valorHuesped;

            if (!nuevosValores.valorHuespedOriginal || nuevosValores.valorHuespedOriginal === 0) {
                nuevosValores.valorHuespedOriginal = valorHuespedActualIndividual;
            }

            nuevosValores.valorHuesped = Math.round(valorHuespedActualIndividual * proporcion);

            batch.update(doc.ref, { 
                'valores': nuevosValores,
                'edicionesManuales.valores.valorHuesped': true,
                'ajusteManualRealizado': true
            });
        }
    });

    await batch.commit();
};

const calcularPotencialGrupo = async (db, empresaId, idsIndividuales, descuento) => {
    const batch = db.batch();
    for (const id of idsIndividuales) {
        const ref = db.collection('empresas').doc(empresaId).collection('reservas').doc(id);
        const doc = await ref.get();
        if(doc.exists) {
            const valorHuesped = doc.data().valores.valorHuesped || 0;
            if (valorHuesped > 0 && descuento > 0 && descuento < 100) {
                const valorPotencial = Math.round(valorHuesped / (1 - (parseFloat(descuento) / 100)));
                
                batch.update(ref, { 
                    'valores.valorPotencial': valorPotencial,
                    'edicionesManuales.valores.valorPotencial': true,
                    'potencialCalculado': true
                });
            }
        }
    }
    await batch.commit();
};

module.exports = {
    actualizarValoresGrupo,
    calcularPotencialGrupo
};