// backend/services/gestionService.js

const admin = require('firebase-admin');
const { obtenerEstados } = require('./estadosService');
const { getValoresCLP } = require('./utils/calculoValoresService');

// Función de utilidad para "trocear" arrays grandes
const splitIntoChunks = (arr, size) => {
    if (!arr || arr.length === 0) return [];
    const chunks = [];
    for (let i = 0; i < arr.length; i += size) {
        chunks.push(arr.slice(i, i + size));
    }
    return chunks;
};

const getReservasPendientes = async (db, empresaId) => {
    const reservasRef = db.collection('empresas').doc(empresaId).collection('reservas');
    
    // --- MODIFICACIÓN: Eliminada la llamada a obtenerValorDolarHoy ---

    const estadosSnapshot = await db.collection('empresas').doc(empresaId).collection('estadosReserva').where('esEstadoDeGestion', '==', true).get();
    const estadosDeGestion = estadosSnapshot.docs.map(doc => doc.data().nombre);

    const queries = [];
    if (estadosDeGestion.length > 0) {
        const estadoChunks = splitIntoChunks(estadosDeGestion, 30);
        estadoChunks.forEach(chunk => {
            queries.push(
                reservasRef
                    .where('estado', '==', 'Confirmada')
                    .where('estadoGestion', 'in', chunk)
                    .get()
            );
        });
    }
    queries.push(reservasRef.where('estado', '==', 'Desconocido').get());

    const snapshots = await Promise.all(queries);
    
    const allDocs = [];
    const docIds = new Set();

    snapshots.forEach(snapshot => {
        if(snapshot) {
            snapshot.forEach(doc => { 
                if (!docIds.has(doc.id)) {
                    allDocs.push(doc); 
                    docIds.add(doc.id); 
                }
            });
        }
    });

    if (allDocs.length === 0) {
        return { grupos: [], hasMore: false, lastVisible: null };
    }
    
    allDocs.sort((a, b) => a.data().fechaLlegada.toDate() - b.data().fechaLlegada.toDate());

    const allReservasData = allDocs.map(doc => ({ id: doc.id, ...doc.data() }));

    // --- INICIO DE LA MODIFICACIÓN: Calcular todos los valores CLP primero ---
    const allReservasConCLP = await Promise.all(
        allReservasData.map(async (reserva) => {
            // Llamamos al servicio central para obtener los CLP (flotantes o fijos)
            const valoresCLP = await getValoresCLP(db, empresaId, reserva);
            return { ...reserva, valoresCLP: valoresCLP }; // Adjuntamos los valores calculados
        })
    );
    // --- FIN DE LA MODIFICACIÓN ---

    const clienteIds = [...new Set(allReservasConCLP.map(r => r.clienteId).filter(Boolean))];
    const reservaIdsOriginales = [...new Set(allReservasConCLP.map(r => r.idReservaCanal))];

    const firestoreQueryLimit = 30;
    const clienteIdChunks = splitIntoChunks(clienteIds, firestoreQueryLimit);
    const reservaIdChunks = splitIntoChunks(reservaIdsOriginales, firestoreQueryLimit);

    // (Funciones fetchInBatches y fetchByIdBatches sin cambios)
    const fetchInBatches = async (collectionName, field, idChunks) => {
        if (idChunks.length === 0) return { docs: [] };
        const promises = idChunks.map(chunk => 
            db.collection('empresas').doc(empresaId).collection(collectionName)
              .where(field, 'in', chunk)
              .get()
        );
        const snapshots = await Promise.all(promises);
        return { docs: snapshots.flatMap(s => s.docs) };
    };
    const fetchByIdBatches = async (collectionName, idChunks) => {
        if (idChunks.length === 0) return { docs: [] };
        const promises = idChunks.map(chunk => 
            db.collection('empresas').doc(empresaId).collection(collectionName)
              .where(admin.firestore.FieldPath.documentId(), 'in', chunk)
              .get()
        );
        const snapshots = await Promise.all(promises);
        return { docs: snapshots.flatMap(s => s.docs) };
    };

    const [clientesSnapshot, notasSnapshot, transaccionesSnapshot, historialReservasSnapshot] = await Promise.all([
        fetchByIdBatches('clientes', clienteIdChunks),
        fetchInBatches('gestionNotas', 'reservaIdOriginal', reservaIdChunks),
        fetchInBatches('transacciones', 'reservaIdOriginal', reservaIdChunks),
        fetchInBatches('reservas', 'clienteId', clienteIdChunks) 
    ]);

    // --- INICIO DE LA MODIFICACIÓN: Refactorizar cálculo de 'totalGastado' ---
    // (Ahora necesitamos obtener los valores CLP para el historial del cliente también)
    const historialReservasConCLP = await Promise.all(
        historialReservasSnapshot.docs
            .map(doc => doc.data())
            .filter(reserva => reserva.estado === 'Confirmada')
            .map(async (reserva) => {
                const valoresCLP = await getValoresCLP(db, empresaId, reserva);
                return { ...reserva, valoresCLP: valoresCLP };
            })
    );
    // --- FIN DE LA MODIFICACIÓN ---

    const clientsMap = new Map();
    clientesSnapshot.docs.forEach(doc => {
        const clienteData = doc.data();
        
        // --- INICIO DE LA MODIFICACIÓN: Usar valoresCLP pre-calculados ---
        const historialCliente = historialReservasConCLP
            .filter(reservaDoc => reservaDoc.clienteId === doc.id);

        const totalGastado = historialCliente.reduce((sum, r) => {
            // Simplemente leemos el valorHuesped ya calculado (fijo o flotante)
            return sum + (r.valoresCLP.valorHuesped || 0);
        }, 0);
        // --- FIN DE LA MODIFICACIÓN ---

        const numeroDeReservas = historialCliente.length;
        
        let tipoCliente = 'Cliente Nuevo';
        if (totalGastado > 1000000) {
            tipoCliente = 'Cliente Premium';
        } else if (numeroDeReservas > 1) {
            tipoCliente = 'Cliente Frecuente';
        }

        clientsMap.set(doc.id, {
            ...clienteData,
            numeroDeReservas,
            tipoCliente
        });
    });
    
    const notesCountMap = new Map();
    notasSnapshot.docs.forEach(doc => {
        const id = doc.data().reservaIdOriginal;
        notesCountMap.set(id, (notesCountMap.get(id) || 0) + 1);
    });
    const abonosMap = new Map();
    transaccionesSnapshot.docs.forEach(doc => {
        const id = doc.data().reservaIdOriginal;
        abonosMap.set(id, (abonosMap.get(id) || 0) + (parseFloat(doc.data().monto) || 0));
    });

    const reservasAgrupadas = new Map();
    // --- INICIO DE LA MODIFICACIÓN: Usar allReservasConCLP ---
    allReservasConCLP.forEach(data => {
    // --- FIN DE LA MODIFICACIÓN ---
        const reservaId = data.idReservaCanal;
        if (!reservasAgrupadas.has(reservaId)) {
            const clienteActual = clientsMap.get(data.clienteId);
            reservasAgrupadas.set(reservaId, {
                reservaIdOriginal: reservaId,
                clienteId: data.clienteId,
                clienteNombre: clienteActual?.nombre || data.nombreCliente || 'Cliente Desconocido',
// ... (resto de campos del grupo sin cambios) ...
                telefono: clienteActual?.telefono || 'N/A',
                tipoCliente: clienteActual?.tipoCliente || 'Nuevo', 
                numeroDeReservas: clienteActual?.numeroDeReservas || 1,
               fechaLlegada: data.fechaLlegada?.toDate(),
                fechaSalida: data.fechaSalida?.toDate(),
                totalNoches: data.totalNoches,
                estado: data.estado,
                estadoGestion: data.estadoGestion,
                abonoTotal: abonosMap.get(reservaId) || 0,
               notasCount: notesCountMap.get(reservaId) || 0,
                transaccionesCount: transaccionesSnapshot.docs.filter(d => d.data().reservaIdOriginal === reservaId).length,
                reservasIndividuales: []
            });
        }
        reservasAgrupadas.get(reservaId).reservasIndividuales.push(data);
    });

    const gruposProcesados = Array.from(reservasAgrupadas.values()).map(grupo => {
        const primerReserva = grupo.reservasIndividuales[0];
        const monedaGrupo = primerReserva.moneda || 'CLP';
        const estadoGestionGrupo = primerReserva.estadoGestion;

        const valoresAgregados = grupo.reservasIndividuales.reduce((acc, r) => {
            
            // --- INICIO DE LA MODIFICACIÓN: Usar valoresCLP pre-calculados ---
            // Ya no hay lógica de cálculo aquí
            acc.valorTotalHuesped += r.valoresCLP.valorHuesped;
            acc.costoCanal += r.valoresCLP.costoCanal;
            acc.payoutFinalReal += r.valoresCLP.payout;
            // --- FIN DE LA MODIFICACIÓN ---
            
           acc.valorListaBaseTotal += r.valores?.valorOriginal || 0; // KPI (USD)
            if (r.ajusteManualRealizado) acc.ajusteManualRealizado = true;
            if (r.potencialCalculado) acc.potencialCalculado = true;
            if (r.clienteGestionado) acc.clienteGestionado = true;
            if (r.documentos) acc.documentos = { ...acc.documentos, ...r.documentos };
           return acc;
        }, { 
            valorTotalHuesped: 0, 
            costoCanal: 0, 
            payoutFinalReal: 0,
            valorListaBaseTotal: 0, 
            ajusteManualRealizado: false, 
            potencialCalculado: false, 
            clienteGestionado: false, 
            documentos: {} 
        });
        
        const resultado = {
            ...grupo,
            ...valoresAgregados,
           esUSD: monedaGrupo === 'USD', 
        };

        if (resultado.esUSD) {
            // (Lógica de valoresUSD sin cambios)
            const valorDolarParaCalculo = (estadoGestionGrupo === 'Facturado')
                ? (primerReserva.valores?.valorDolarFacturacion || valorDolarHoy) 
                : (primerReserva.valoresCLP.valorDolarUsado || valorDolarHoy); 

            const totalPayoutUSD = grupo.reservasIndividuales.reduce((sum, r) => sum + (r.valores?.valorTotalOriginal || 0), 0);
            const totalIvaUSD = grupo.reservasIndividuales.reduce((sum, r) => sum + (r.valores?.ivaOriginal || 0), 0);
            
            resultado.valoresUSD = {
                payout: totalPayoutUSD, 
                iva: totalIvaUSD,
               totalCliente: totalPayoutUSD + totalIvaUSD 
            };
        }

        return resultado;
    });
    
    return { grupos: gruposProcesados, hasMore: false, lastVisible: null };
};

const actualizarEstadoGrupo = async (db, empresaId, idsIndividuales, nuevoEstado) => {
    
    // --- INICIO DE LA MODIFICACIÓN: Lógica de Estados Inteligente ---
    
    // 1. Obtener todas las definiciones de estados que creaste en "gestionarEstados"
    const allEstados = await obtenerEstados(db, empresaId);
    
    // 2. Encontrar la definición del estado que el usuario seleccionó (ej. "No Presentado")
    const estadoDef = allEstados.find(e => e.nombre === nuevoEstado);

    const updateData = {};

    if (estadoDef) {
        // 3. Aplicar la lógica basada en el tipo de estado
        
        if (estadoDef.esEstadoPrincipal) {
            // Si es un estado Principal (ej. "No Presentado", "Cancelada", "Confirmada")
            // Actualizamos el 'estado' principal de la reserva.
            updateData.estado = nuevoEstado;
        }

        if (estadoDef.esEstadoDeGestion) {
            // Si es un estado de Gestión (ej. "Pendiente Check-in", "En Casa")
            // Actualizamos el 'estadoGestion'.
            updateData.estadoGestion = nuevoEstado;
        } else if (estadoDef.esEstadoPrincipal) {
            // Si es Principal PERO NO de Gestión (ej. "No Presentado")
            // Limpiamos el estado de gestión, sacándolo del flujo.
            updateData.estadoGestion = null;
        }

    } else {
        // Fallback para estados especiales no definidos en la colección 
        // (como "Facturado", que se maneja en reservasService)
        console.warn(`[actualizarEstadoGrupo] El estado "${nuevoEstado}" no se encontró en 'estadosReserva'. Actualizando solo 'estadoGestion'.`);
        updateData.estadoGestion = nuevoEstado;
    }
    // --- FIN DE LA MODIFICACIÓN ---

    // 4. Aplicar la actualización a todas las reservas del grupo
    const batch = db.batch();
    idsIndividuales.forEach(id => {
        const ref = db.collection('empresas').doc(empresaId).collection('reservas').doc(id);
        batch.update(ref, updateData);
    });
    await batch.commit();
};


const getNotas = async (db, empresaId, reservaIdOriginal) => {
    const snapshot = await db.collection('empresas').doc(empresaId).collection('gestionNotas')
        .where('reservaIdOriginal', '==', reservaIdOriginal)
        .orderBy('fecha', 'desc')
        .get();
    if (snapshot.empty) return [];
    return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id, fecha: doc.data().fecha.toDate().toLocaleString('es-CL') }));
};

const addNota = async (db, empresaId, notaData) => {
    const nota = { ...notaData, fecha: admin.firestore.FieldValue.serverTimestamp() };
    const docRef = await db.collection('empresas').doc(empresaId).collection('gestionNotas').add(nota);
    return { id: docRef.id, ...nota };
};

const getTransacciones = async (db, empresaId, idsIndividuales) => {
    const transaccionesRef = db.collection('empresas').doc(empresaId).collection('transacciones');
    const reservaDoc = await db.collection('empresas').doc(empresaId).collection('reservas').doc(idsIndividuales[0]).get();
    if (!reservaDoc.exists) return [];
    
    const reservaIdOriginal = reservaDoc.data().idReservaCanal;
    
    const snapshot = await transaccionesRef
        .where('reservaIdOriginal', '==', reservaIdOriginal)
        .get();

    if (snapshot.empty) return [];

    const transacciones = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
            id: doc.id,
            ...data,
            fecha: data.fecha ? data.fecha.toDate() : new Date()
        };
    });
    transacciones.sort((a, b) => b.fecha - a.fecha);
    return transacciones;
};

const marcarClienteComoGestionado = async (db, empresaId, reservaIdOriginal) => {
    const reservasRef = db.collection('empresas').doc(empresaId).collection('reservas');
    const q = reservasRef.where('idReservaCanal', '==', reservaIdOriginal);
    const snapshot = await q.get();

    if (snapshot.empty) {
        throw new Error('No se encontraron reservas para marcar al cliente como gestionado.');
    }

    const batch = db.batch();
    let estadoActual = '';
    snapshot.forEach(doc => {
        estadoActual = doc.data().estadoGestion;
        const updateData = { clienteGestionado: true };
        if (estadoActual === 'Pendiente Cliente') {
            updateData.estadoGestion = 'Facturado';
        }
        batch.update(doc.ref, updateData);
    });
    
    await batch.commit();
};

module.exports = {
    getReservasPendientes,
    actualizarEstadoGrupo,
    getNotas,
    addNota,
    getTransacciones,
    marcarClienteComoGestionado
};