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
                // --- INICIO DEL CAMBIO ---
                // Se accede a la primera columna por su posición, no por su nombre.
                const day = parseInt(row[Object.keys(row)[0]]);
                // --- FIN DEL CAMBIO ---
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

                const batch = db.batch();
                recordsToSave.forEach(record => {
                    const dateId = record.fecha.toISOString().split('T')[0];
                    const docRef = db.collection('empresas').doc(empresaId).collection('valoresDolar').doc(dateId);
                    batch.set(docRef, {
                        valor: record.valor,
                        fecha: admin.firestore.Timestamp.fromDate(record.fecha),
                    });
                });

                try {
                    await batch.commit();
                    resolve({ processed: recordsToSave.length, errors: 0 });
                } catch (error) {
                    reject(error);
                }
            })
            .on('error', (error) => reject(error));
    });
};

const obtenerValorDolar = async (db, empresaId, targetDate) => {
    if (!(targetDate instanceof Date) || isNaN(targetDate)) {
        return 950;
    }

    const dateStr = targetDate.toISOString().split('T')[0];
    const dolarRef = db.collection('empresas').doc(empresaId).collection('valoresDolar').doc(dateStr);

    const doc = await dolarRef.get();
    if (doc.exists && doc.data().valor) {
        return doc.data().valor;
    }

    const q = db.collection('empresas').doc(empresaId).collection('valoresDolar')
        .where('fecha', '<=', admin.firestore.Timestamp.fromDate(targetDate))
        .orderBy('fecha', 'desc')
        .limit(1);

    const snapshot = await q.get();

    if (!snapshot.empty) {
        const ultimoValor = snapshot.docs[0].data().valor;
        await dolarRef.set({
            valor: ultimoValor,
            fecha: admin.firestore.Timestamp.fromDate(targetDate)
        });
        return ultimoValor;
    }

    console.warn(`[DolarService] No se encontró valor del dólar para la fecha ${dateStr} o anteriores. Usando valor por defecto.`);
    return 950;
};


module.exports = {
    processDolarCsv,
    obtenerValorDolar
};