const admin = require('firebase-admin');
const csv = require('csv-parser');
const stream = require('stream');

// Mapeo para convertir los nombres de los meses del CSV a números (0-11)
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
                const day = parseInt(row['Día']);
                if (isNaN(day)) return;

                for (const monthName of Object.keys(row).slice(1)) {
                    const monthKey = monthName.trim().toLowerCase().substring(0, 3);
                    const monthIndex = monthMap[monthKey];
                    if (monthIndex !== undefined) {
                        const valorStr = row[monthName];
                        if (valorStr && valorStr.trim() !== '') {
                            // Reemplazar el punto de los miles y la coma decimal
                            const valor = parseFloat(valorStr.replace(/\./g, '').replace(',', '.'));
                            if (!isNaN(valor)) {
                                const fecha = new Date(Date.UTC(year, monthIndex, day));
                                // Validar que la fecha es correcta (ej. no es 31 de Febrero)
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
        return 950; // Retornar un valor por defecto si la fecha es inválida
    }

    const dateStr = targetDate.toISOString().split('T')[0];
    const dolarRef = db.collection('empresas').doc(empresaId).collection('valoresDolar').doc(dateStr);

    const doc = await dolarRef.get();
    if (doc.exists && doc.data().valor) {
        return doc.data().valor;
    }

    // Si no se encuentra, buscar el valor en la fecha más cercana anterior.
    const q = db.collection('empresas').doc(empresaId).collection('valoresDolar')
        .where('fecha', '<=', admin.firestore.Timestamp.fromDate(targetDate))
        .orderBy('fecha', 'desc')
        .limit(1);

    const snapshot = await q.get();

    if (!snapshot.empty) {
        const ultimoValor = snapshot.docs[0].data().valor;
        // Opcional: Guardar este valor para la fecha faltante para futuras consultas más rápidas
        await dolarRef.set({
            valor: ultimoValor,
            fecha: admin.firestore.Timestamp.fromDate(targetDate)
        });
        return ultimoValor;
    }

    // Si no hay ningún valor anterior, usar un default y registrar una advertencia.
    console.warn(`[DolarService] No se encontró valor del dólar para la fecha ${dateStr} o anteriores. Usando valor por defecto.`);
    return 950;
};


module.exports = {
    processDolarCsv,
    obtenerValorDolar
};