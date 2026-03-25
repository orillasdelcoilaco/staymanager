// backend/services/publicWebsiteService.js
// Lógica específica para la búsqueda y precios del sitio web público SSR.

const pool = require('../db/postgres');
const admin = require('firebase-admin');
const { obtenerValorDolar } = require('./dolarService');
const { crearOActualizarCliente } = require('./clientesService');
const { listarBloqueos } = require('./bloqueosService');
const { parseISO, isValid, differenceInDays, addDays } = require('date-fns');

// --- Helpers de Cliente ---

const crearOActualizarClientePublico = async (db, empresaId, datosCliente) => {
    return crearOActualizarCliente(db, empresaId, {
        nombre: datosCliente.nombre,
        email: datosCliente.email || '',
        telefono: datosCliente.telefono || '',
        origen: 'website',
    });
};

// --- Helpers de Disponibilidad ---

async function _fetchAvailabilityPG(empresaId, endDate) {
    const endStr = endDate.toISOString().split('T')[0];
    const [propRes, tarifaRes, reservaRes, bloqueos] = await Promise.all([
        pool.query('SELECT id, nombre, capacidad, activo, metadata FROM propiedades WHERE empresa_id = $1 AND activo = true', [empresaId]),
        pool.query('SELECT * FROM tarifas WHERE empresa_id = $1', [empresaId]),
        pool.query(
            `SELECT propiedad_id, fecha_llegada, fecha_salida FROM reservas
             WHERE empresa_id = $1 AND fecha_llegada < $2 AND estado = ANY($3)`,
            [empresaId, endStr, ['Confirmada', 'Propuesta']]
        ),
        listarBloqueos(null, empresaId),
    ]);
    const allProperties = propRes.rows.map(r => ({
        id: r.id, nombre: r.nombre, capacidad: r.capacidad, ...(r.metadata || {}),
    }));
    const allTarifas = tarifaRes.rows.map(row => {
        try {
            const fi = parseISO((row.reglas?.fechaInicio || '') + 'T00:00:00Z');
            const ft = parseISO((row.reglas?.fechaTermino || '') + 'T00:00:00Z');
            if (!isValid(fi) || !isValid(ft)) return null;
            return { ...row.reglas, alojamientoId: row.propiedad_id, fechaInicio: fi, fechaTermino: ft };
        } catch { return null; }
    }).filter(Boolean);
    const allReservas = reservaRes.rows.map(r => ({
        alojamientoId: r.propiedad_id,
        fechaLlegada: new Date(r.fecha_llegada),
        fechaSalida: new Date(r.fecha_salida),
    }));
    const allBloqueos = bloqueos.map(b => ({
        todos: b.todos, alojamientoIds: b.alojamientoIds,
        fechaInicio: new Date(b.fechaInicio + 'T00:00:00Z'),
        fechaFin:    new Date(b.fechaFin    + 'T00:00:00Z'),
    }));
    return { allProperties, allTarifas, allReservas, allBloqueos };
}

async function _fetchAvailabilityFS(db, empresaId, startDate, endDate) {
    const [propSnap, tarifaSnap, reservaSnap, bloqueos] = await Promise.all([
        db.collection('empresas').doc(empresaId).collection('propiedades').get(),
        db.collection('empresas').doc(empresaId).collection('tarifas').get(),
        db.collection('empresas').doc(empresaId).collection('reservas')
            .where('fechaLlegada', '<', admin.firestore.Timestamp.fromDate(endDate))
            .where('estado', 'in', ['Confirmada', 'Propuesta']).get(),
        listarBloqueos(db, empresaId),
    ]);
    const allProperties = propSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const allTarifas = tarifaSnap.docs.map(doc => {
        const data = doc.data();
        try {
            const fi = data.fechaInicio?.toDate ? data.fechaInicio.toDate() : parseISO(data.fechaInicio + 'T00:00:00Z');
            const ft = data.fechaTermino?.toDate ? data.fechaTermino.toDate() : parseISO(data.fechaTermino + 'T00:00:00Z');
            if (!isValid(fi) || !isValid(ft)) return null;
            return { ...data, id: doc.id, fechaInicio: fi, fechaTermino: ft };
        } catch { return null; }
    }).filter(Boolean);
    const allReservas = reservaSnap.docs.map(d => {
        const r = d.data();
        return {
            alojamientoId: r.alojamientoId,
            fechaLlegada: r.fechaLlegada?.toDate?.() || null,
            fechaSalida:  r.fechaSalida?.toDate?.()  || null,
        };
    });
    const allBloqueos = bloqueos.map(b => ({
        todos: b.todos, alojamientoIds: b.alojamientoIds,
        fechaInicio: new Date(b.fechaInicio + 'T00:00:00Z'),
        fechaFin:    new Date(b.fechaFin    + 'T00:00:00Z'),
    }));
    return { allProperties, allTarifas, allReservas, allBloqueos };
}

function _buildAvailabilityResult(allProperties, allTarifas, allReservas, allBloqueos, startDate, endDate) {
    const propiedadesConTarifa = allProperties.filter(prop =>
        allTarifas.some(t => t.alojamientoId === prop.id && t.fechaInicio <= endDate && t.fechaTermino >= startDate)
    );
    const availabilityMap = new Map();
    allProperties.forEach(prop => availabilityMap.set(prop.id, []));

    for (const reserva of allReservas) {
        const s = reserva.fechaSalida instanceof Date ? reserva.fechaSalida : null;
        if (s && isValid(s) && s > startDate && availabilityMap.has(reserva.alojamientoId)) {
            const st = reserva.fechaLlegada instanceof Date ? reserva.fechaLlegada : null;
            if (st && isValid(st)) availabilityMap.get(reserva.alojamientoId).push({ start: st, end: s });
        }
    }
    for (const b of allBloqueos) {
        const bInicio = b.fechaInicio instanceof Date ? b.fechaInicio : new Date(b.fechaInicio);
        const bFin    = new Date((b.fechaFin instanceof Date ? b.fechaFin : new Date(b.fechaFin)).getTime() + 86400000);
        if (bInicio >= endDate) continue;
        const ids = b.todos ? allProperties.map(p => p.id) : (b.alojamientoIds || []);
        ids.forEach(id => { if (availabilityMap.has(id)) availabilityMap.get(id).push({ start: bInicio, end: bFin }); });
    }
    const availableProperties = propiedadesConTarifa.filter(prop => {
        const reservations = availabilityMap.get(prop.id) || [];
        return !reservations.some(res => startDate < res.end && endDate > res.start);
    });
    return { availableProperties, allProperties, allTarifas, availabilityMap };
}

// --- Funciones de Propiedades (Lectura SSR) ---

const obtenerPropiedadesPorEmpresa = async (db, empresaId) => {
    if (!empresaId || typeof empresaId !== 'string' || empresaId.trim() === '') {
        console.error(`[ERROR] obtenerPropiedadesPorEmpresa (SSR) - empresaId es INVÁLIDO.`);
        throw new Error(`Se intentó obtener propiedades con un empresaId inválido.`);
    }

    if (pool) {
        const { rows } = await pool.query(
            `SELECT id, nombre, capacidad, activo, metadata FROM propiedades
             WHERE empresa_id = $1 AND activo = true
               AND (metadata->'googleHotelData'->>'isListed')::boolean = true
             ORDER BY created_at DESC`,
            [empresaId]
        );
        return rows.map(r => ({ id: r.id, nombre: r.nombre, capacidad: r.capacidad, ...(r.metadata || {}) }));
    }

    const propiedadesSnapshot = await db.collection('empresas').doc(empresaId).collection('propiedades').orderBy('fechaCreacion', 'desc').get();
    if (propiedadesSnapshot.empty) return [];
    return propiedadesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(p => p.googleHotelData?.isListed === true);
};

const obtenerPropiedadPorId = async (db, empresaId, propiedadId) => {
    console.log(`[DEBUG] obtenerPropiedadPorId: empresaId=${empresaId}, propiedadId=${propiedadId}`);
    if (!propiedadId || typeof propiedadId !== 'string' || propiedadId.trim() === '') {
        console.error(`[publicWebsiteService] Error: ID inválido: '${propiedadId}'`);
        return null;
    }

    if (pool) {
        const { rows } = await pool.query(
            'SELECT id, nombre, capacidad, activo, metadata FROM propiedades WHERE id = $1 AND empresa_id = $2',
            [propiedadId, empresaId]
        );
        if (!rows[0]) return null;
        const row = rows[0];
        const meta = row.metadata || {};
        const fotos = meta.websiteData?.images
            ? Object.values(meta.websiteData.images).flat().filter(img => img && img.storagePath)
            : [];
        return {
            id: row.id, nombre: row.nombre, capacidad: row.capacidad,
            ...meta,
            componentes: meta.componentes || [],
            amenidades: meta.amenidades || [],
            fotosSSR: fotos,
        };
    }

    const propiedadRef = db.collection('empresas').doc(empresaId).collection('propiedades').doc(propiedadId);
    const doc = await propiedadRef.get();
    if (!doc.exists) {
        console.log(`[DEBUG] Propiedad ${propiedadId} no encontrada en la colección de la empresa ${empresaId}.`);
        return null;
    }
    const data = doc.data();

    const [componentesSnap, amenidadesSnap, fotosSnap] = await Promise.all([
        propiedadRef.collection('componentes').orderBy('orden', 'asc').get().catch(() => ({ empty: true, docs: [] })),
        propiedadRef.collection('amenidades').get().catch(() => ({ empty: true, docs: [] })),
        propiedadRef.collection('fotos').where('visibleEnSSR', '==', true).orderBy('prioridad', 'asc').get().catch(() => ({ empty: true, docs: [] }))
    ]);

    const componentes = !componentesSnap.empty
        ? componentesSnap.docs.map(d => ({ id: d.id, ...d.data() }))
        : (data.componentes || []);

    const amenidades = !amenidadesSnap.empty
        ? amenidadesSnap.docs.map(d => ({ id: d.id, ...d.data() }))
        : (data.amenidades || []);

    let fotos = [];
    if (!fotosSnap.empty) {
        fotos = fotosSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    } else if (data.websiteData?.images) {
        fotos = Object.values(data.websiteData.images).flat().filter(img => img && img.storagePath);
    }

    return { id: doc.id, ...data, componentes, amenidades, fotosSSR: fotos };
};

const obtenerDetallesEmpresa = async (db, empresaId) => {
    if (!empresaId) throw new Error('El ID de la empresa es requerido.');

    if (pool) {
        const { rows } = await pool.query(
            'SELECT id, nombre, email, plan, configuracion, dominio, subdominio FROM empresas WHERE id = $1',
            [empresaId]
        );
        if (!rows[0]) throw new Error('La empresa no fue encontrada.');
        const r = rows[0];
        return { id: r.id, nombre: r.nombre, email: r.email, plan: r.plan, dominio: r.dominio, subdominio: r.subdominio, ...(r.configuracion || {}) };
    }

    const doc = await db.collection('empresas').doc(empresaId).get();
    if (!doc.exists) throw new Error('La empresa no fue encontrada.');
    return doc.data();
};

// --- Funciones de Reservas ---

const crearReservaPublica = async (db, empresaId, datosFormulario) => {
    const { propiedadId, fechaLlegada, fechaSalida, personas, precioFinal, noches, nombre, email, telefono } = datosFormulario;

    const resultadoCliente = await crearOActualizarClientePublico(db, empresaId, { nombre, email, telefono });
    const clienteId = resultadoCliente.cliente.id;
    const propiedadData = await obtenerPropiedadPorId(db, empresaId, propiedadId);
    if (!propiedadData) throw new Error('La propiedad seleccionada ya no existe.');

    if (pool) {
        const { rows: canalRows } = await pool.query(
            `SELECT id, nombre, moneda FROM canales WHERE empresa_id = $1 AND (metadata->>'esCanalPorDefecto')::boolean = true LIMIT 1`,
            [empresaId]
        );
        if (!canalRows[0]) throw new Error('No se encontró un canal por defecto.');
        const canal = canalRows[0];
        const idReservaCanal = `WEB-${Date.now().toString(36).toUpperCase().slice(-8)}`;
        const { rows: [newRow] } = await pool.query(
            `INSERT INTO reservas (empresa_id, id_reserva_canal, propiedad_id, alojamiento_nombre,
                canal_id, canal_nombre, cliente_id, total_noches, estado, estado_gestion,
                moneda, valores, cantidad_huespedes, fecha_llegada, fecha_salida, metadata)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING *`,
            [
                empresaId, idReservaCanal, propiedadId, propiedadData.nombre,
                canal.id, canal.nombre, clienteId, parseInt(noches),
                'Confirmada', 'Pendiente Bienvenida',
                'CLP', JSON.stringify({ valorHuesped: parseFloat(precioFinal) }),
                parseInt(personas), fechaLlegada, fechaSalida,
                JSON.stringify({ origen: 'website', edicionesManuales: {} }),
            ]
        );
        return { id: newRow.id, idReservaCanal, alojamientoId: propiedadId, alojamientoNombre: propiedadData.nombre };
    }

    const canalesSnapshot = await db.collection('empresas').doc(empresaId).collection('canales').where('esCanalPorDefecto', '==', true).limit(1).get();
    if (canalesSnapshot.empty) throw new Error('No se encontró un canal por defecto.');
    const canalPorDefecto = canalesSnapshot.docs[0].data();
    const canalId = canalesSnapshot.docs[0].id;

    const reservasRef = db.collection('empresas').doc(empresaId).collection('reservas');
    const nuevaReservaRef = reservasRef.doc();
    const idReservaCanal = `WEB-${nuevaReservaRef.id.substring(0, 8).toUpperCase()}`;

    const nuevaReserva = {
        id: nuevaReservaRef.id,
        idUnicoReserva: `${idReservaCanal}-${propiedadId}`,
        idReservaCanal,
        canalId, canalNombre: canalPorDefecto.nombre,
        clienteId, alojamientoId: propiedadId, alojamientoNombre: propiedadData.nombre,
        fechaLlegada: admin.firestore.Timestamp.fromDate(new Date(fechaLlegada + 'T00:00:00Z')),
        fechaSalida:  admin.firestore.Timestamp.fromDate(new Date(fechaSalida  + 'T00:00:00Z')),
        totalNoches: parseInt(noches),
        cantidadHuespedes: parseInt(personas),
        estado: 'Confirmada', estadoGestion: 'Pendiente Bienvenida',
        origen: 'website', moneda: 'CLP',
        valores: { valorHuesped: parseFloat(precioFinal) },
        fechaReserva: admin.firestore.FieldValue.serverTimestamp(),
        fechaCreacion: admin.firestore.FieldValue.serverTimestamp()
    };

    await nuevaReservaRef.set(nuevaReserva);
    return nuevaReserva;
};

// --- Funciones de Disponibilidad y Precios ---

async function getAvailabilityData(db, empresaId, startDate, endDate, sinCamarotes = false) {
    const { allProperties: rawProps, allTarifas, allReservas, allBloqueos } = pool
        ? await _fetchAvailabilityPG(empresaId, endDate)
        : await _fetchAvailabilityFS(db, empresaId, startDate, endDate);

    let allProperties = rawProps;
    if (sinCamarotes) {
        allProperties = allProperties.map(prop => {
            if (prop.camas && prop.camas.camarotes > 0) {
                return { ...prop, capacidad: Math.max(0, prop.capacidad - prop.camas.camarotes * 2) };
            }
            return prop;
        });
    }
    return _buildAvailabilityResult(allProperties, allTarifas, allReservas, allBloqueos, startDate, endDate);
}

function findNormalCombination(availableProperties, requiredCapacity) {
    const sortedCabanas = availableProperties.sort((a, b) => b.capacidad - a.capacidad);

    for (const prop of sortedCabanas) {
        if (prop.capacidad >= requiredCapacity) {
            return { combination: [prop], capacity: prop.capacidad };
        }
    }

    let currentCombination = [];
    let currentCapacity = 0;
    for (const prop of sortedCabanas) {
        if (currentCapacity < requiredCapacity) {
            currentCombination.push(prop);
            currentCapacity += prop.capacidad;
        }
    }

    if (currentCapacity >= requiredCapacity) {
        return { combination: currentCombination, capacity: currentCapacity };
    }
    return { combination: [], capacity: 0 };
}

async function calculatePrice(db, empresaId, items, startDate, endDate, allTarifas, valorDolarDiaOverride = null) {
    let canalPorDefecto;
    if (pool) {
        const { rows } = await pool.query(
            `SELECT id, nombre, moneda FROM canales WHERE empresa_id = $1 AND (metadata->>'esCanalPorDefecto')::boolean = true LIMIT 1`,
            [empresaId]
        );
        if (!rows[0]) throw new Error("No se ha configurado un canal por defecto.");
        canalPorDefecto = rows[0];
    } else {
        const snap = await db.collection('empresas').doc(empresaId).collection('canales').where('esCanalPorDefecto', '==', true).limit(1).get();
        if (snap.empty) throw new Error("No se ha configurado un canal por defecto.");
        canalPorDefecto = { id: snap.docs[0].id, ...snap.docs[0].data() };
    }

    const valorDolarDia = valorDolarDiaOverride ??
        (canalPorDefecto.moneda === 'USD' ? await obtenerValorDolar(db, empresaId, startDate) : null);

    const totalNights = differenceInDays(endDate, startDate);
    if (totalNights <= 0) {
        return { totalPriceCLP: 0, totalPriceOriginal: 0, currencyOriginal: canalPorDefecto.moneda, valorDolarDia, nights: 0, details: [] };
    }

    let totalPrecioEnMonedaDefecto = 0;
    const priceDetails = [];

    for (const prop of items) {
        let propPrecioBaseTotal = 0;
        for (let d = new Date(startDate); d < endDate; d = addDays(d, 1)) {
            const currentDate = new Date(d);
            const tarifasDelDia = allTarifas.filter(t =>
                t.alojamientoId === prop.id && t.fechaInicio <= currentDate && t.fechaTermino >= currentDate
            );
            if (tarifasDelDia.length > 0) {
                const tarifa = tarifasDelDia.sort((a, b) => b.fechaInicio - a.fechaInicio)[0];
                const precioBaseObj = tarifa.precios?.[canalPorDefecto.id];
                propPrecioBaseTotal += (typeof precioBaseObj === 'number' ? precioBaseObj : 0);
            }
        }
        totalPrecioEnMonedaDefecto += propPrecioBaseTotal;
        priceDetails.push({
            nombre: prop.nombre, id: prop.id,
            precioTotal: propPrecioBaseTotal,
            precioPorNoche: totalNights > 0 ? propPrecioBaseTotal / totalNights : 0,
        });
    }

    let totalPriceCLP = totalPrecioEnMonedaDefecto;
    if (canalPorDefecto.moneda === 'USD') {
        if (valorDolarDia === null || valorDolarDia <= 0) {
            return { totalPriceCLP: 0, totalPriceOriginal: totalPrecioEnMonedaDefecto, currencyOriginal: canalPorDefecto.moneda, valorDolarDia, nights: totalNights, details: priceDetails, error: "Missing dollar value" };
        }
        totalPriceCLP = totalPrecioEnMonedaDefecto * valorDolarDia;
    }

    return {
        totalPriceCLP: Math.round(totalPriceCLP),
        totalPriceOriginal: totalPrecioEnMonedaDefecto,
        currencyOriginal: canalPorDefecto.moneda,
        valorDolarDia,
        nights: totalNights,
        details: priceDetails,
    };
}

module.exports = {
    getAvailabilityData,
    findNormalCombination,
    calculatePrice,
    obtenerPropiedadesPorEmpresa,
    obtenerPropiedadPorId,
    obtenerDetallesEmpresa,
    crearReservaPublica,
};
