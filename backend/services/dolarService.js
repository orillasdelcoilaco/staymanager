const admin = require('firebase-admin');
const csv = require('csv-parser');
const stream = require('stream');

const monthMap = {
    'ene': 0, 'feb': 1, 'mar': 2, 'abr': 3, 'may': 4, 'jun': 5,
    'jul': 6, 'ago': 7, 'sep': 8, 'oct': 9, 'nov': 10, 'dic': 11
};

const processDolarCsv = (db, empresaId, buffer, year) => {
    return new Promise((resolve, reject) => {
        const recordsToSave = [];
        const readableStream = new stream.Readable();
        readableStream._read = () => {};
        readableStream.push(buffer);
        readableStream.push(null);

        readableStream
            .pipe(csv({ separator: ';' }))
            .on('data', (row) => {
                const day = parseInt(row[Object.keys(row)[0]]);
                if (isNaN(day)) return;

                for (const monthName of Object.keys(row).slice(1)) {
                    const monthKey = monthName.trim().toLowerCase().substring(0, 3);
                    const monthIndex = monthMap[monthKey];
                    if (monthIndex !== undefined) {
                        const valorStr = row[monthName];
                        if (valorStr && valorStr.trim() !== '') {
                            const valor = parseFloat(valorStr.replace(/\./g, '').replace(',', '.'));
                            if (!isNaN(valor)) {
                                const fecha = new Date(Date.UTC(year, monthIndex, day));
                                if (fecha.getUTCMonth() === monthIndex) {
                                    recordsToSave.push({ fecha, valor });
                                }
                            }
                        }
                    }
                }
            })
            .on('end', async () => {
                if (recordsToSave.length === 0) {
                    return resolve({ processed: 0, errors: 0, message: "No se encontraron registros válidos." });
                }
                const collectionRef = db.collection('empresas').doc(empresaId).collection('valoresDolar');
                const batch = db.batch();
                let processedCount = 0;

                for (const record of recordsToSave) {
                    const dateId = record.fecha.toISOString().split('T')[0];
                    const docRef = collectionRef.doc(dateId);
                    const doc = await docRef.get();
                    if (!doc.exists || !doc.data().modificadoManualmente) {
                        batch.set(docRef, {
                            valor: record.valor,
                            fecha: admin.firestore.Timestamp.fromDate(record.fecha),
                            modificadoManualmente: false
                        });
                        processedCount++;
                    }
                }
                if (processedCount > 0) await batch.commit();
                resolve({ processed: processedCount, errors: 0 });
            })
            .on('error', (error) => reject(error));
    });
};

const actualizarValorDolarApi = async (db, empresaId) => {
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0];
    const dolarRef = db.collection('empresas').doc(empresaId).collection('valoresDolar').doc(dateStr);
    const doc = await dolarRef.get();
    if (doc.exists) return doc.data().valor;

    try {
        const response = await fetch('https://mindicador.cl/api/dolar');
        if (!response.ok) throw new Error('No se pudo conectar a la API de mindicador.cl');
        const data = await response.json();
        const valor = data.serie[0]?.valor;
        if (valor) {
            await dolarRef.set({
                valor: valor,
                fecha: admin.firestore.Timestamp.fromDate(new Date(dateStr + 'T00:00:00Z')),
                modificadoManualmente: false
            });
            return valor;
        }
    } catch (error) {
        console.error(`[DolarService] Error al actualizar desde API: ${error.message}`);
        return null;
    }
};

const obtenerValorDolar = async (db, empresaId, targetDate) => {
    if (!(targetDate instanceof Date) || isNaN(targetDate)) return 950;
    
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    // Si la fecha es futura, usar el valor más reciente disponible (el de hoy)
    if (targetDate > today) {
        let valorHoy = await actualizarValorDolarApi(db, empresaId);
        if (valorHoy) return valorHoy;
    }

    const dateStr = targetDate.toISOString().split('T')[0];
    const dolarRef = db.collection('empresas').doc(empresaId).collection('valoresDolar').doc(dateStr);
    const doc = await dolarRef.get();
    if (doc.exists && doc.data().valor) return doc.data().valor;

    const q = db.collection('empresas').doc(empresaId).collection('valoresDolar')
        .where('fecha', '<=', admin.firestore.Timestamp.fromDate(targetDate))
        .orderBy('fecha', 'desc').limit(1);
    const snapshot = await q.get();
    if (!snapshot.empty) {
        const ultimoValor = snapshot.docs[0].data().valor;
        await dolarRef.set({ valor: ultimoValor, fecha: admin.firestore.Timestamp.fromDate(targetDate), modificadoManualmente: false });
        return ultimoValor;
    }
    
    console.warn(`[DolarService] No se encontró valor para ${dateStr} o anteriores. Usando valor por defecto.`);
    return 950;
};

const getValoresPorMes = async (db, empresaId, year, month) => {
    const startDate = new Date(Date.UTC(year, month - 1, 1));
    const endDate = new Date(Date.UTC(year, month, 0));
    const startTimestamp = admin.firestore.Timestamp.fromDate(startDate);
    const endTimestamp = admin.firestore.Timestamp.fromDate(endDate);
    const snapshot = await db.collection('empresas').doc(empresaId).collection('valoresDolar')
        .where('fecha', '>=', startTimestamp)
        .where('fecha', '<=', endTimestamp)
        .orderBy('fecha', 'asc').get();
    if (snapshot.empty) return [];
    return snapshot.docs.map(doc => ({ id: doc.id, fecha: doc.id, valor: doc.data().valor, modificadoManualmente: doc.data().modificadoManualmente || false }));
};

const guardarValorDolar = async (db, empresaId, data) => {
    const { fecha, valor } = data;
    if (!fecha || valor === undefined) throw new Error("Fecha y valor son requeridos.");
    const docRef = db.collection('empresas').doc(empresaId).collection('valoresDolar').doc(fecha);
    await docRef.set({
        valor: parseFloat(valor),
        fecha: admin.firestore.Timestamp.fromDate(new Date(fecha + 'T00:00:00Z')),
        modificadoManualmente: true
    });
    return { id: docRef.id, fecha, valor, modificadoManualmente: true };
};

const eliminarValorDolar = async (db, empresaId, fecha) => {
    if (!fecha) throw new Error("Fecha es requerida.");
    const docRef = db.collection('empresas').doc(empresaId).collection('valoresDolar').doc(fecha);
    await docRef.delete();
};

module.exports = {
    processDolarCsv,
    obtenerValorDolar,
    getValoresPorMes,
    guardarValorDolar,
    eliminarValorDolar,
    actualizarValorDolarApi
};