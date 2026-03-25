// backend/services/historicoImporterService.js
//
// Importa reservas históricas desde el JSON de exportación del Gestor de Reservas.
// Flujo en dos pasos:
//   1. previewImport  → analiza el JSON, auto-mapea cabañas/canales, devuelve brechas
//   2. runImport      → ejecuta el upsert con los mapeos confirmados por el usuario

const admin = require('firebase-admin');
const { crearOActualizarCliente } = require('./clientesService');
const { registrarCarga } = require('./historialCargasService');

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────

function normalizar(str) {
    return (str || '')
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .toLowerCase().trim().replace(/\s+/g, ' ');
}

// Corrige mojibake Latin-1→UTF-8 (ej: "CabaÃ±a" → "Cabaña")
function fixEncoding(str) {
    if (!str || typeof str !== 'string') return str;
    try {
        return Buffer.from(str, 'latin1').toString('utf8');
    } catch {
        return str;
    }
}

function fixReserva(r) {
    return {
        ...r,
        alojamiento:   fixEncoding(r.alojamiento),
        clienteNombre: fixEncoding(r.clienteNombre)
    };
}

function buildValores(reserva) {
    const moneda   = reserva.monedaOriginal === 'USD' ? 'USD' : 'CLP';
    const comision = reserva.comision || 0;

    if (moneda === 'CLP') {
        const vCLP = reserva.valorCLP || 0;
        return {
            moneda,
            valores: {
                valorHuesped:         vCLP,
                valorTotal:           Math.round(vCLP - comision),
                comision,
                costoCanal:           comision,
                iva:                  reserva.precioIncluyeIva ? Math.round(vCLP / 1.19 * 0.19) : 0,
                valorHuespedOriginal: 0,
                valorTotalOriginal:   0,
                comisionOriginal:     0,
                costoCanalOriginal:   0,
                ivaOriginal:          0
            }
        };
    }

    // USD
    const vOrig    = reserva.valorOriginal || 0;
    const vCLP     = reserva.valorCLP      || 0;
    const dolar    = reserva.valorDolarDia  || 950;
    const guestUSD = vOrig + comision;

    return {
        moneda,
        valores: {
            valorHuespedOriginal: guestUSD,
            valorTotalOriginal:   vOrig,
            comisionOriginal:     comision,
            costoCanalOriginal:   comision,
            ivaOriginal:          reserva.precioIncluyeIva
                                      ? Math.round(guestUSD / 1.19 * 0.19 * 100) / 100
                                      : 0,
            // CLP pre-calculado y bloqueado (nunca recalcular)
            valorHuesped: vCLP,
            valorTotal:   Math.round(vOrig * dolar),
            comision:     Math.round(comision * dolar),
            costoCanal:   Math.round(comision * dolar),
            iva:          reserva.precioIncluyeIva ? Math.round(vCLP / 1.19 * 0.19) : 0,
            // Dólar anclado a fecha de llegada — nunca se mueve
            valorDolarFacturacion: dolar
        }
    };
}

// ─────────────────────────────────────────────────────────────
// PASO 1: PREVIEW
// ─────────────────────────────────────────────────────────────

async function previewImport(db, empresaId, importData) {
    const [propSnap, canalSnap] = await Promise.all([
        db.collection('empresas').doc(empresaId).collection('propiedades').get(),
        db.collection('empresas').doc(empresaId).collection('canales').get()
    ]);

    const alojamientos = propSnap.docs.map(d => ({ id: d.id, nombre: d.data().nombre || '' }));
    const canales      = canalSnap.docs.map(d => ({ id: d.id, nombre: d.data().nombre || '', moneda: d.data().moneda || 'CLP' }));

    const cabanas  = (importData.cabanas  || []).map(c => ({ ...c, nombre: fixEncoding(c.nombre) }));
    const reservas = (importData.reservas || []).map(fixReserva);

    // Auto-mapeo por nombre normalizado
    const mapeoAlojamientos = {};
    for (const cab of cabanas) {
        const key   = normalizar(cab.nombre);
        const match = alojamientos.find(a => normalizar(a.nombre) === key);
        mapeoAlojamientos[cab.nombre] = match?.id || null;
    }

    const canalNombres = [...new Set(reservas.map(r => r.canal).filter(Boolean))];
    const mapeoCanales = {};
    for (const nombre of canalNombres) {
        const key   = normalizar(nombre);
        const match = canales.find(c => normalizar(c.nombre) === key);
        mapeoCanales[nombre] = match?.id || null;
    }

    const sinMapeoAlojamiento = Object.entries(mapeoAlojamientos).filter(([, v]) => !v).map(([k]) => k);
    const sinMapeoCanal       = Object.entries(mapeoCanales).filter(([, v]) => !v).map(([k]) => k);

    return {
        mapeoAlojamientos,
        mapeoCanales,
        // Array ordenado con índice para que el frontend no dependa de nombres con encoding especial
        cabanas: cabanas.map((c, i) => ({
            index:               i,
            nombreOrigen:        c.nombre,
            alojamientoIdMapeado: mapeoAlojamientos[c.nombre],
            alojamientoPropuesto: alojamientos.find(a => a.id === mapeoAlojamientos[c.nombre])?.nombre || null
        })),
        canalesDetectados: canalNombres.map((nombre, i) => ({
            index:          i,
            nombreOrigen:   nombre,
            canalIdMapeado: mapeoCanales[nombre],
            canalPropuesto: canales.find(c => c.id === mapeoCanales[nombre])?.nombre || null
        })),
        alojamientosDisponibles: alojamientos,
        canalesDisponibles:      canales,
        listo:       sinMapeoAlojamiento.length === 0,
        advertencias: { sinMapeoAlojamiento, sinMapeoCanal },
        totales: {
            cabanas:       cabanas.length,
            clientes:      (importData.clientes || []).length,
            reservas:      reservas.length,
            transacciones: reservas.reduce((s, r) => s + (r.transacciones || []).length, 0)
        }
    };
}

// ─────────────────────────────────────────────────────────────
// PASO 2: IMPORTAR
// ─────────────────────────────────────────────────────────────

async function runImport(db, empresaId, importData, mapeoCabanas, mapeoCanales, meta = {}) {
    const resultado = { creadas: 0, actualizadas: 0, clientesCreados: 0, transacciones: 0, errores: [], idCarga: null };

    // Registrar en historial de cargas (permite eliminar después)
    const nombreArchivo = meta.nombreArchivo || `historico_${new Date().toISOString().split('T')[0]}`;
    const idCarga = await registrarCarga(db, empresaId, null, nombreArchivo, meta.usuarioEmail || 'importador');
    resultado.idCarga = idCarga;

    // Mapa de alojamiento id → nombre para almacenar en la reserva
    const propSnap   = await db.collection('empresas').doc(empresaId).collection('propiedades').get();
    const alojNombres = Object.fromEntries(propSnap.docs.map(d => [d.id, d.data().nombre || '']));

    const clientesMap = Object.fromEntries((importData.clientes || []).map(c => [c.id, c]));

    for (const rawReserva of (importData.reservas || [])) {
        const reserva = fixReserva(rawReserva);
        try {
            const alojamientoId = mapeoCabanas[reserva.alojamiento];
            if (!alojamientoId) {
                resultado.errores.push({ id: reserva.reservaIdOriginal, error: `Sin mapeo: ${reserva.alojamiento}` });
                continue;
            }

            const canalId = mapeoCanales?.[reserva.canal] || null;

            // ── Cliente ──────────────────────────────────────────
            const clienteOrigen = clientesMap[reserva.clienteId] || {};
            const { cliente, status: cStatus } = await crearOActualizarCliente(db, empresaId, {
                nombre:      reserva.clienteNombre,
                telefono:    reserva.telefono,
                email:       reserva.correo || clienteOrigen.email || '',
                calificacion: clienteOrigen.calificacion || 0,
                notas:       clienteOrigen.notas || '',
                idCompuesto: `import_${reserva.clienteId}`
            });
            if (cStatus === 'creado') resultado.clientesCreados++;

            // ── Valores ──────────────────────────────────────────
            const { moneda, valores } = buildValores(reserva);

            // ── Doc reserva ──────────────────────────────────────
            const idReservaCanal = reserva.reservaIdOriginal;
            const idUnicoReserva = `${idReservaCanal}-${alojamientoId}`;
            const totalNoches    = reserva.totalNoches || 1;

            const docData = {
                idUnicoReserva,
                idReservaCanal,
                idCarga,
                canalId:          canalId || '',
                canalNombre:      reserva.canal || '',
                alojamientoId,
                alojamientoNombre: alojNombres[alojamientoId] || '',
                clienteId:        cliente.id,
                moneda,
                estado:           reserva.estado        || 'Confirmada',
                estadoGestion:    reserva.estadoGestion || 'Pendiente Bienvenida',
                fechaLlegada:     admin.firestore.Timestamp.fromDate(new Date(reserva.fechaLlegada)),
                fechaSalida:      admin.firestore.Timestamp.fromDate(new Date(reserva.fechaSalida)),
                fechaReserva:     reserva.fechaReserva
                                      ? admin.firestore.Timestamp.fromDate(new Date(reserva.fechaReserva))
                                      : null,
                numHuespedes:     reserva.invitados || 1,
                totalNoches,
                valores,
                origen:           'historico',
                boleta:           reserva.boleta  || false,
                pagado:           reserva.pagado  || false,
                documentos: {
                    enlaceReserva: reserva.documentos?.enlaceReserva || null,
                    enlaceBoleta:  reserva.documentos?.enlaceBoleta  || null
                }
            };

            // ── Upsert reserva ───────────────────────────────────
            const reservasRef = db.collection('empresas').doc(empresaId).collection('reservas');
            const snap        = await reservasRef.where('idUnicoReserva', '==', idUnicoReserva).get();

            if (snap.empty) {
                const ref = reservasRef.doc();
                await ref.set({ id: ref.id, ...docData, fechaCreacion: admin.firestore.FieldValue.serverTimestamp() });
                resultado.creadas++;
            } else {
                await snap.docs[0].ref.update({ ...docData, fechaActualizacion: admin.firestore.FieldValue.serverTimestamp() });
                resultado.actualizadas++;
            }

            // ── Transacciones ────────────────────────────────────
            if (reserva.transacciones?.length) {
                const transRef = db.collection('empresas').doc(empresaId).collection('transacciones');
                for (const t of reserva.transacciones) {
                    const tSnap = await transRef.where('idOrigenImport', '==', t.id).get();
                    if (tSnap.empty) {
                        await transRef.add({
                            idOrigenImport:    t.id,
                            reservaIdOriginal: idReservaCanal,
                            monto:             t.monto,
                            medioDePago:       t.medioDePago,
                            tipo:              t.tipo,
                            fecha:             admin.firestore.Timestamp.fromDate(new Date(t.fecha)),
                            enlaceComprobante: t.enlaceComprobante || null,
                            origen:            'historico'
                        });
                        resultado.transacciones++;
                    }
                }
            }

        } catch (err) {
            resultado.errores.push({ id: reserva.reservaIdOriginal || '?', error: err.message });
        }
    }

    return resultado;
}

module.exports = { previewImport, runImport };
