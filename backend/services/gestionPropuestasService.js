// backend/services/gestionPropuestasService.js
const admin = require('firebase-admin');
const { getAvailabilityData } = require('./propuestasService');
const { crearOActualizarCliente } = require('./clientesService');
const { marcarCuponComoUtilizado } = require('./cuponesService');
const { calcularValoresBaseDesdeReporte, recalcularValoresDesdeTotal } = require('./utils/calculoValoresService');
const { registrarAjusteValor } = require('./utils/trazabilidadService');
const { procesarPlantilla } = require('./plantillasService');
const emailService = require('./emailService');
const { registrarComunicacion } = require('./comunicacionesService');

const guardarOActualizarPropuesta = async (db, empresaId, usuarioEmail, datos, idPropuestaExistente = null) => {
    const { 
        cliente, fechaLlegada, fechaSalida, propiedades, precioFinal, noches, 
        canalId, canalNombre, moneda, valorDolarDia, valorOriginal, 
        origen, icalUid, idReservaCanal, codigoCupon, personas,
        descuentoPct, descuentoFijo, valorFinalFijado,
        plantillaId, enviarEmail
    } = datos;
    
    const idGrupo = idReservaCanal || idPropuestaExistente || db.collection('empresas').doc().id;

    let clienteId;
    let clienteData = cliente;
    
    if (cliente.id) {
        clienteId = cliente.id;
    } else if (cliente.nombre && cliente.telefono) {
        const resultadoCliente = await crearOActualizarCliente(db, empresaId, {
            nombre: cliente.nombre,
            telefono: cliente.telefono,
            email: cliente.email,
            canalNombre: canalNombre,
            idReservaCanal: idGrupo
        });
        clienteId = resultadoCliente.cliente.id;
        clienteData = resultadoCliente.cliente;
    } else {
        clienteId = null; 
    }

    const canalDoc = await db.collection('empresas').doc(empresaId).collection('canales').doc(canalId).get();
    if (!canalDoc.exists) throw new Error("El canal seleccionado no es válido.");
    const canalData = canalDoc.data();
    const configuracionIva = canalData.configuracionIva || 'incluido';
    const comisionSumable_Orig = 0; 

    // 1. Asegurar que el ANCLA (valorOriginal) esté en USD
    let ancla_Subtotal_USD = valorOriginal;
    if (moneda === 'CLP' && valorDolarDia > 0) {
        ancla_Subtotal_USD = valorOriginal / valorDolarDia;
    } else if (moneda === 'CLP' && (!valorDolarDia || valorDolarDia === 0)) {
        throw new Error("Se requiere un valor de dólar para convertir el ancla de CLP a USD.");
    }

    let ancla_Iva_USD, ancla_TotalCliente_USD;
    if (configuracionIva === 'agregar') {
        ancla_Iva_USD = ancla_Subtotal_USD * 0.19;
        ancla_TotalCliente_USD = ancla_Subtotal_USD + ancla_Iva_USD;
    } else {
        ancla_TotalCliente_USD = ancla_Subtotal_USD;
        ancla_Iva_USD = ancla_TotalCliente_USD / 1.19 * 0.19;
    }
    const ancla_Payout_USD = ancla_Subtotal_USD - comisionSumable_Orig;


    // 2. Determinar el valor ACTUAL (el modificado) en USD
    let actual_TotalCliente_USD;

    if (valorFinalFijado && valorFinalFijado > 0) {
        // valorFinalFijado es SIEMPRE CLP (desde el formulario)
        if (!valorDolarDia || valorDolarDia === 0) throw new Error("Se requiere un valor de dólar para convertir el Valor Final Fijo.");
        actual_TotalCliente_USD = valorFinalFijado / valorDolarDia;
    } else if (descuentoPct && descuentoPct > 0) {
        // % se aplica sobre el ancla USD
        actual_TotalCliente_USD = ancla_TotalCliente_USD * (1 - (descuentoPct / 100));
    } else if (descuentoFijo && descuentoFijo > 0) {
        // descuentoFijo es SIEMPRE CLP (desde el formulario)
        if (!valorDolarDia || valorDolarDia === 0) throw new Error("Se requiere un valor de dólar para convertir el Descuento Fijo.");
        const descuentoUSD = descuentoFijo / valorDolarDia;
        actual_TotalCliente_USD = ancla_TotalCliente_USD - descuentoUSD;
    } else {
        // Sin modificación
        actual_TotalCliente_USD = ancla_TotalCliente_USD;
    }

    const valoresActuales = recalcularValoresDesdeTotal(
        actual_TotalCliente_USD,
        configuracionIva,
        comisionSumable_Orig
    );
    
    await db.runTransaction(async (transaction) => {
        const reservasRef = db.collection('empresas').doc(empresaId).collection('reservas');
        
        let idCargaParaPreservar = null;

        if (idPropuestaExistente) {
            const queryExistentes = reservasRef.where('idReservaCanal', '==', idPropuestaExistente).where('estado', '==', 'Propuesta');
            const snapshotExistentes = await transaction.get(queryExistentes);
            
            if (!snapshotExistentes.empty) {
                idCargaParaPreservar = snapshotExistentes.docs[0].data().idCarga;
            }

            snapshotExistentes.forEach(doc => transaction.delete(doc.ref));
        }

        let personasAsignadas = false;

        for (const prop of propiedades) {
            const nuevaReservaRef = reservasRef.doc();
            const idUnicoReserva = `${idGrupo}-${prop.id}`;
            
            const proporcion = 1 / propiedades.length;
            
            // 'valoresActuales' contiene los valores en USD.
            // Siempre multiplicamos por valorDolarDia para obtener el CLP.
            const valorHuespedCLP = Math.round((valoresActuales.valorHuespedOriginal * proporcion) * valorDolarDia);
            const valorTotalCLP = Math.round((valoresActuales.valorTotalOriginal * proporcion) * valorDolarDia);
            const comisionCLP = Math.round((comisionSumable_Orig * proporcion) * valorDolarDia);
            const ivaCLP = Math.round((valoresActuales.ivaOriginal * proporcion) * valorDolarDia);

            const valorHuespedUSD = valoresActuales.valorHuespedOriginal * proporcion;
            const valorTotalUSD = valoresActuales.valorTotalOriginal * proporcion;
            const comisionUSD = comisionSumable_Orig * proporcion;
            const ivaUSD = valoresActuales.ivaOriginal * proporcion;

            let huespedesParaEstaReserva = 0;
            if (!personasAsignadas) {
                huespedesParaEstaReserva = personas || 0;
                personasAsignadas = true;
            }

            const datosReserva = {
                id: nuevaReservaRef.id,
                idUnicoReserva,
                idCarga: idCargaParaPreservar,
                idReservaCanal: idGrupo,
                icalUid: icalUid || null,
                clienteId,
                alojamientoId: prop.id,
                alojamientoNombre: prop.nombre,
                canalId: canalId || null,
                canalNombre: canalNombre || 'Por Defecto',
                fechaLlegada: admin.firestore.Timestamp.fromDate(new Date(fechaLlegada + 'T00:00:00Z')),
                fechaSalida: admin.firestore.Timestamp.fromDate(new Date(fechaSalida + 'T00:00:00Z')),
                totalNoches: noches,
                cantidadHuespedes: huespedesParaEstaReserva,
                estado: 'Propuesta',
                origen: origen || 'manual',
                moneda,
                valorDolarDia,
                cuponUtilizado: codigoCupon || null,
                
                valores: {
                    // --- Set "Actual" (CLP) ---
                    valorHuesped: valorHuespedCLP,
                    valorTotal: valorTotalCLP,
                    comision: comisionCLP,
                    costoCanal: 0,
                    iva: ivaCLP,
                    
                    // --- KPI (Precio Base) ---
                    valorOriginal: valorOriginal, 

                    // --- Set "Actual" (USD) ---
                    valorHuespedOriginal: valorHuespedUSD,
                    valorTotalOriginal: valorTotalUSD,
                    comisionOriginal: comisionUSD,
                    costoCanalOriginal: 0,
                    ivaOriginal: ivaUSD,

                    // --- SET DE RESPALDO / "ANCLA" (USD) ---
                    valorHuespedCalculado: ancla_TotalCliente_USD * proporcion,
                    valorTotalCalculado: ancla_Payout_USD * proporcion,
                    comisionCalculado: comisionUSD,
                    costoCanalCalculado: 0,
                    ivaCalculado: ancla_Iva_USD * proporcion,

                    // Campos de trazabilidad de Propuesta
                    descuentoPct: descuentoPct || 0,
                    descuentoFijo: descuentoFijo || 0,
                    valorFinalFijado: valorFinalFijado || 0
                },
                historialAjustes: [],
                fechaReserva: admin.firestore.FieldValue.serverTimestamp(),
                fechaCreacion: admin.firestore.FieldValue.serverTimestamp(),
                fechaActualizacion: new Date()
            };
            
            transaction.set(nuevaReservaRef, datosReserva);

            const valorAnteriorUSD = ancla_TotalCliente_USD * proporcion;
            const valorNuevoUSD = actual_TotalCliente_USD * proporcion;

            await registrarAjusteValor(transaction, db, empresaId, nuevaReservaRef, {
                fuente: idPropuestaExistente ? 'Edición Propuesta' : 'Creación Propuesta',
                usuarioEmail: usuarioEmail,
                valorAnteriorUSD: valorAnteriorUSD,
                valorNuevoUSD: valorNuevoUSD,
                valorDolarUsado: valorDolarDia
            });
        }
    });

    // --- ENVÍO DE EMAIL (después de la transacción) ---
    if (enviarEmail && plantillaId && clienteData?.email) {
        try {
            await enviarEmailPropuesta(db, empresaId, {
                plantillaId,
                cliente: clienteData,
                propiedades,
                fechaLlegada,
                fechaSalida,
                noches,
                personas,
                precioFinal,
                propuestaId: idGrupo
            });
            console.log(`✅ Email de propuesta enviado a ${clienteData.email}`);
        } catch (emailError) {
            // No fallar la operación si el email falla
            console.error('❌ Error enviando email de propuesta:', emailError.message);
        }
    }

    return { id: idGrupo };
};

// --- NUEVA FUNCIÓN: Enviar email de propuesta ---
const enviarEmailPropuesta = async (db, empresaId, datos) => {
    const { plantillaId, cliente, propiedades, fechaLlegada, fechaSalida, noches, personas, precioFinal, propuestaId } = datos;
    
    if (!cliente?.email) {
        throw new Error('El cliente no tiene email registrado');
    }

    // Obtener datos de la empresa
    const empresaDoc = await db.collection('empresas').doc(empresaId).get();
    const empresaData = empresaDoc.data();

    // Formatear datos para las etiquetas
    const formatearFecha = (fecha) => {
        const d = new Date(fecha + 'T00:00:00Z');
        return d.toLocaleDateString('es-CL', { timeZone: 'UTC' });
    };

    const formatearMoneda = (valor) => {
        return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(valor);
    };

    const nombresPropiedades = propiedades.map(p => p.nombre).join(', ');

    // Procesar plantilla con etiquetas
    const { contenido, asunto } = await procesarPlantilla(db, empresaId, plantillaId, {
        nombreCliente: cliente.nombre,
        reservaId: propuestaId,
        fechaLlegada: formatearFecha(fechaLlegada),
        fechaSalida: formatearFecha(fechaSalida),
        nombrePropiedad: nombresPropiedades,
        totalNoches: noches?.toString() || '',
        numeroHuespedes: personas?.toString() || '',
        saldoPendiente: formatearMoneda(precioFinal),
        propuestaId: propuestaId,
        empresaNombre: empresaData?.nombre || '',
        contactoNombre: empresaData?.contactoNombre || '',
        contactoEmail: empresaData?.contactoEmail || '',
        contactoTelefono: empresaData?.contactoTelefono || ''
    });

    // Enviar correo
    const resultado = await emailService.enviarCorreo(db, {
        to: cliente.email,
        subject: asunto,
        html: contenido,
        empresaId,
        replyTo: empresaData?.contactoEmail
    });

    if (!resultado.success) {
        throw new Error(resultado.error || 'Error al enviar correo');
    }

    // Registrar en historial de comunicaciones del cliente
    if (cliente.id) {
        try {
            await registrarComunicacion(db, empresaId, cliente.id, {
                tipo: 'email',
                evento: 'propuesta-enviada',
                asunto: asunto,
                plantillaId: plantillaId,
                destinatario: cliente.email,
                relacionadoCon: {
                    tipo: 'propuesta',
                    id: propuestaId
                },
                estado: 'enviado',
                messageId: resultado.messageId || null
            });
        } catch (logError) {
            console.warn('No se pudo registrar comunicación:', logError.message);
        }
    }

    return resultado;
};

const guardarPresupuesto = async (db, empresaId, datos) => {
    const { id, cliente, fechaLlegada, fechaSalida, propiedades, precioFinal, noches, texto } = datos;
    const presupuestosRef = db.collection('empresas').doc(empresaId).collection('presupuestos');
    
    let clienteId = cliente.id;
    if (!clienteId && cliente.nombre) {
         const resultadoCliente = await crearOActualizarCliente(db, empresaId, {
            nombre: cliente.nombre,
            telefono: cliente.telefono,
            email: cliente.email
        });
        clienteId = resultadoCliente.cliente.id;
    }

    const datosPresupuesto = {
        clienteId,
        clienteNombre: cliente.nombre,
        fechaLlegada,
        fechaSalida,
        propiedades,
        monto: precioFinal,
        noches,
        texto,
        estado: 'Borrador',
        fechaActualizacion: admin.firestore.FieldValue.serverTimestamp()
    };

    if (id) {
        await presupuestosRef.doc(id).update(datosPresupuesto);
        return { id };
    } else {
        datosPresupuesto.fechaCreacion = admin.firestore.FieldValue.serverTimestamp();
        const docRef = await presupuestosRef.add(datosPresupuesto);
        return { id: docRef.id };
    }
};

const obtenerPropuestasYPresupuestos = async (db, empresaId) => {
    const [propuestasSnapshot, presupuestosSnapshot] = await Promise.all([
        db.collection('empresas').doc(empresaId).collection('reservas').where('estado', '==', 'Propuesta').orderBy('fechaCreacion', 'desc').get(),
        db.collection('empresas').doc(empresaId).collection('presupuestos').where('estado', 'in', ['Borrador', 'Enviado']).orderBy('fechaCreacion', 'desc').get()
    ]);

    const allItems = [];
    propuestasSnapshot.forEach(doc => allItems.push({ doc, type: 'propuesta' }));
    presupuestosSnapshot.forEach(doc => allItems.push({ doc, type: 'presupuesto' }));

    if (allItems.length === 0) return [];

    const neededClientIds = new Set(allItems.map(item => item.doc.data().clienteId).filter(Boolean));
    const allPropiedadesIds = new Set();
    allItems.forEach(item => {
        const data = item.doc.data();
        if (data.propiedades) {
            data.propiedades.forEach(p => allPropiedadesIds.add(p.id));
        }
        if (data.alojamientoId) {
            allPropiedadesIds.add(data.alojamientoId);
        }
    });
    
    const fetchInBatches = async (collection, ids) => {
        const results = new Map();
        const idBatches = [];
        for (let i = 0; i < ids.length; i += 30) {
            idBatches.push(ids.slice(i, i + 30));
        }
        for (const batch of idBatches) {
            if (batch.length > 0) {
                const snapshot = await db.collection('empresas').doc(empresaId).collection(collection).where(admin.firestore.FieldPath.documentId(), 'in', batch).get();
                snapshot.forEach(doc => results.set(doc.id, doc.data()));
            }
        }
        return results;
    };
    
    const [clientesMap, propiedadesMap] = await Promise.all([
        fetchInBatches('clientes', Array.from(neededClientIds)),
        fetchInBatches('propiedades', Array.from(allPropiedadesIds)),
    ]);
    
    const propuestasAgrupadas = new Map();
    allItems.filter(item => item.type === 'propuesta').forEach(item => {
        const data = item.doc.data();
        const id = data.idReservaCanal;
        if (!id) return; 

        if (!propuestasAgrupadas.has(id)) {
            propuestasAgrupadas.set(id, {
                id: id,
                tipo: 'propuesta',
                origen: data.origen || 'manual',
                clienteId: data.clienteId,
                clienteNombre: data.clienteNombre,
                canalId: data.canalId,
                canalNombre: data.canalNombre,
                idReservaCanal: data.idReservaCanal,
                icalUid: data.icalUid || null,
                fechaLlegada: data.fechaLlegada.toDate().toISOString().split('T')[0],
                fechaSalida: data.fechaSalida.toDate().toISOString().split('T')[0],
                monto: 0,
                propiedades: [],
                idsReservas: [],
                personas: 0
            });
        }
        const grupo = propuestasAgrupadas.get(id);
        grupo.monto += data.valores?.valorHuesped || 0;
        const propiedad = propiedadesMap.get(data.alojamientoId) || { nombre: data.alojamientoNombre, capacidad: 0 };
        grupo.propiedades.push({ id: data.alojamientoId, nombre: propiedad.nombre, capacidad: propiedad.capacidad });
        
        grupo.idsReservas.push(item.doc.id);
        
        grupo.personas += data.cantidadHuespedes || 0;
    });

    const presupuestos = allItems.filter(item => item.type === 'presupuesto').map(item => {
        const data = item.doc.data();
        const propiedadesConCapacidad = data.propiedades.map(p => {
            const propiedad = propiedadesMap.get(p.id);
            return { ...p, capacidad: propiedad ? propiedad.capacidad : 0 };
        });
        const cliente = clientesMap.get(data.clienteId);
        
        const totalPersonas = propiedadesConCapacidad.reduce((sum, p) => sum + (p.capacidad || 0), 0);

        return { 
            id: item.doc.id, 
            tipo: 'presupuesto',
            ...data, 
            propiedades: propiedadesConCapacidad, 
            clienteNombre: cliente?.nombre || data.clienteNombre,
            personas: totalPersonas
        };
    });

    const resultado = [...propuestasAgrupadas.values(), ...presupuestos];
    
    resultado.forEach(item => {
        if(item.clienteId && clientesMap.has(item.clienteId)) {
            item.clienteNombre = clientesMap.get(item.clienteId).nombre;
        }
        item.propiedadesNombres = item.propiedades.map(p => p.nombre).join(', ');
        
    });

    return resultado;
};


const aprobarPropuesta = async (db, empresaId, idsReservas) => {
    if (!idsReservas || idsReservas.length === 0) {
        throw new Error("No se proporcionaron IDs de reserva para aprobar.");
    }
    
    const reservasRefs = idsReservas.map(id => db.collection('empresas').doc(empresaId).collection('reservas').doc(id));
    
    await db.runTransaction(async (transaction) => {
        const reservasDocs = await transaction.getAll(...reservasRefs);

        if (reservasDocs.some(doc => !doc.exists)) {
            throw new Error('Una o más reservas de la propuesta no fueron encontradas.');
        }

        const propuestaReservas = reservasDocs.map(d => d.data());
        const primeraReserva = propuestaReservas[0];
        const startDate = primeraReserva.fechaLlegada.toDate();
        const endDate = primeraReserva.fechaSalida.toDate();
        const codigoCupon = primeraReserva.cuponUtilizado;
    
        const { availableProperties } = await getAvailabilityData(db, empresaId, startDate, endDate);
        const availableIds = new Set(availableProperties.map(p => p.id));
    
        for (const reserva of propuestaReservas) {
            if (!availableIds.has(reserva.alojamientoId)) {
                const reservasConflictivas = await db.collection('empresas').doc(empresaId).collection('reservas')
                    .where('alojamientoId', '==', reserva.alojamientoId)
                    .where('estado', '==', 'Confirmada')
                    .where('fechaLlegada', '<', reserva.fechaSalida)
                    .get();

                const conflicto = reservasConflictivas.docs.find(doc => doc.data().fechaSalida.toDate() > startDate);
                if (conflicto) {
                    const dataConflicto = conflicto.data();
                    const idReserva = dataConflicto.idReservaCanal || 'Desconocido';
                    const fechaReservaTimestamp = dataConflicto.fechaCreacion || dataConflicto.fechaReserva;
                    const fechaReserva = fechaReservaTimestamp ? fechaReservaTimestamp.toDate().toLocaleDateString('es-CL') : 'una fecha no registrada';
                    throw new Error(`La cabaña ${reserva.alojamientoNombre} ya no está disponible. Fue reservada por la reserva ${idReserva} del canal ${dataConflicto.canalNombre}, creada el ${fechaReserva}.`);
                }
            }
        }

        if (codigoCupon) {
            await marcarCuponComoUtilizado(transaction, db, empresaId, codigoCupon, primeraReserva.id, primeraReserva.clienteId);
        }

        reservasDocs.forEach(doc => {
            transaction.update(doc.ref, { estado: 'Confirmada', estadoGestion: 'Pendiente Bienvenida' });
        });
    });
};

const rechazarPropuesta = async (db, empresaId, idsReservas) => {
    if (!idsReservas || idsReservas.length === 0) {
        throw new Error("No se proporcionaron IDs de reserva para rechazar.");
    }
    const batch = db.batch();
    idsReservas.forEach(id => {
        const ref = db.collection('empresas').doc(empresaId).collection('reservas').doc(id);
        batch.delete(ref);
    });
    await batch.commit();
};

const aprobarPresupuesto = async (db, empresaId, presupuestoId) => {
    const presupuestoRef = db.collection('empresas').doc(empresaId).collection('presupuestos').doc(presupuestoId);
    const presupuestoDoc = await presupuestoRef.get();
    if (!presupuestoDoc.exists) throw new Error('El presupuesto no fue encontrado.');

    const presupuesto = presupuestoDoc.data();
    const startDate = new Date(presupuesto.fechaLlegada + 'T00:00:00Z');
    const endDate = new Date(presupuesto.fechaSalida + 'T00:00:00Z');

    const { availableProperties } = await getAvailabilityData(db, empresaId, startDate, endDate);
    const availableIds = new Set(availableProperties.map(p => p.id));

    for (const prop of presupuesto.propiedades) {
        if (!availableIds.has(prop.id)) {
            const reservasConflictivas = await db.collection('empresas').doc(empresaId).collection('reservas')
                .where('alojamientoId', '==', prop.id)
                .where('estado', '==', 'Confirmada')
                .where('fechaLlegada', '<', admin.firestore.Timestamp.fromDate(endDate))
                .get();
            const conflicto = reservasConflictivas.docs.find(doc => doc.data().fechaSalida.toDate() > startDate);
            if (conflicto) {
                const dataConflicto = conflicto.data();
                const idReserva = dataConflicto.idReservaCanal || 'Desconocido';
                const fechaReservaTimestamp = dataConflicto.fechaCreacion || dataConflicto.fechaReserva;
                const fechaReserva = fechaReservaTimestamp ? fechaReservaTimestamp.toDate().toLocaleDateString('es-CL') : 'una fecha no registrada';
                throw new Error(`La cabaña ${prop.nombre} ya no está disponible. Fue reservada por la reserva ${idReserva} del canal ${dataConflicto.canalNombre}, creada el ${fechaReserva}.`);
            }
        }
    }

    const canalesSnapshot = await db.collection('empresas').doc(empresaId).collection('canales').where('esCanalPorDefecto', '==', true).limit(1).get();
    if (canalesSnapshot.empty) {
        throw new Error("No se ha configurado un canal por defecto. Por favor, marque uno en 'Gestionar Canales' para poder aprobar presupuestos.");
    }
    const canalPorDefecto = canalesSnapshot.docs[0].data();
    const canalPorDefectoId = canalesSnapshot.docs[0].id;

    const batch = db.batch();
    const idUnicoPresupuesto = presupuestoId;

    for (const prop of presupuesto.propiedades) {
        const reservaRef = db.collection('empresas').doc(empresaId).collection('reservas').doc();
        const datosReserva = {
            id: reservaRef.id,
            idUnicoReserva: `${idUnicoPresupuesto}-${prop.id}`,
            idReservaCanal: idUnicoPresupuesto,
            clienteId: presupuesto.clienteId,
            alojamientoId: prop.id,
            alojamientoNombre: prop.nombre,
            canalId: canalPorDefectoId,
            canalNombre: canalPorDefecto.nombre,
            fechaLlegada: admin.firestore.Timestamp.fromDate(startDate),
            fechaSalida: admin.firestore.Timestamp.fromDate(endDate),
            totalNoches: presupuesto.noches,
            cantidadHuespedes: prop.capacidad,
            estado: 'Confirmada',
            estadoGestion: 'Pendiente Bienvenida',
            valores: {
                valorHuesped: Math.round(presupuesto.monto / presupuesto.propiedades.length)
            },
            fechaCreacion: admin.firestore.FieldValue.serverTimestamp()
        };
        batch.set(reservaRef, datosReserva);
    }
    
    batch.update(presupuestoRef, { estado: 'Aprobado' });
    await batch.commit();
};

const rechazarPresupuesto = async (db, empresaId, presupuestoId) => {
    const presupuestoRef = db.collection('empresas').doc(empresaId).collection('presupuestos').doc(presupuestoId);
    await presupuestoRef.update({ estado: 'Rechazado' });
};

module.exports = {
    guardarOActualizarPropuesta,
    guardarPresupuesto,
    obtenerPropuestasYPresupuestos,
    aprobarPropuesta,
    rechazarPropuesta,
    aprobarPresupuesto,
    rechazarPresupuesto,
    enviarEmailPropuesta
};