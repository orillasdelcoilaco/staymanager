// backend/services/publicWebsiteService.js
// Lógica específica para la búsqueda y precios del sitio web público SSR.

const pool = require('../db/postgres');
const { obtenerValorDolar } = require('./dolarService');
const { crearOActualizarCliente } = require('./clientesService');
const { listarBloqueos, getBloqueosPorPeriodo } = require('./bloqueosService');
const { isValid, differenceInDays, addDays, parseISO } = require('date-fns');
const { getPrecioBaseNoche, fetchTarifasForEmpresas } = require('../routes/website.shared');
const { obtenerResumenPorPropiedad } = require('./resenasService');

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
        pool.query(`
            SELECT t.propiedad_id, t.precios_canales, temp.fecha_inicio, temp.fecha_termino
            FROM tarifas t
            JOIN temporadas temp ON t.temporada_id = temp.id
            WHERE t.empresa_id = $1
        `, [empresaId]),
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
            const fi = row.fecha_inicio instanceof Date ? row.fecha_inicio : new Date(row.fecha_inicio);
            const ft = row.fecha_termino instanceof Date ? row.fecha_termino : new Date(row.fecha_termino);
            if (!isValid(fi) || !isValid(ft)) return null;
            // Normalizar precios_canales: extraer valorCLP para compatibilidad con calculatePrice
            const precios = {};
            if (row.precios_canales && typeof row.precios_canales === 'object') {
                Object.entries(row.precios_canales).forEach(([canalId, data]) => {
                    precios[canalId] = typeof data === 'number' ? data : (data?.valorCLP || 0);
                });
            }
            return { precios, alojamientoId: row.propiedad_id, fechaInicio: fi, fechaTermino: ft };
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
    const availableIds = new Set(availableProperties.map(p => p.id));
    const unavailableProperties = propiedadesConTarifa.filter(p => !availableIds.has(p.id));
    return { availableProperties, unavailableProperties, allProperties, allTarifas, availabilityMap };
}

/**
 * Ocupación pública para calendario de una propiedad (reservas + bloqueos).
 * Reservas: intervalo de noches [checkIn, checkOut) en fechas YYYY-MM-DD.
 * Bloqueos: días cerrados inclusive [desde, hasta].
 */
async function obtenerOcupacionCalendarioPropiedad(empresaId, propiedadId, fromIso, toIso) {
    if (!pool) return { reservas: [], bloqueos: [] };
    const from = String(fromIso || '').slice(0, 10);
    const to = String(toIso || '').slice(0, 10);
    if (from.length !== 10 || to.length !== 10 || from > to) {
        throw new Error('Rango from/to inválido (YYYY-MM-DD).');
    }
    const startDate = new Date(`${from}T12:00:00`);
    const endDate = new Date(`${to}T12:00:00`);
    if (!isValid(startDate) || !isValid(endDate)) throw new Error('Fechas inválidas.');

    const [resRows, bloqueosRaw] = await Promise.all([
        pool.query(
            `SELECT to_char(fecha_llegada::date, 'YYYY-MM-DD') AS check_in,
                    to_char(fecha_salida::date, 'YYYY-MM-DD') AS check_out
               FROM reservas
              WHERE empresa_id = $1
                AND propiedad_id = $2
                AND estado = ANY($3)
                AND fecha_llegada::date <= $4::date
                AND fecha_salida::date > $5::date`,
            [empresaId, propiedadId, ['Confirmada', 'Propuesta'], to, from]
        ),
        getBloqueosPorPeriodo(null, empresaId, startDate, endDate, propiedadId),
    ]);

    return {
        reservas: resRows.rows.map((r) => ({ checkIn: r.check_in, checkOut: r.check_out })),
        bloqueos: bloqueosRaw.map((b) => ({ desde: b.fechaInicio, hasta: b.fechaFin })),
    };
}

// --- Funciones de Propiedades (Lectura SSR) ---

function _haversineKm(lat1, lng1, lat2, lng2) {
    if (![lat1, lng1, lat2, lng2].every((x) => typeof x === 'number' && Number.isFinite(x))) return null;
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

function _extractGeoCityFromPropiedad(prop) {
    const meta = prop?.metadata || prop || {};
    const bc = meta.buildContext || prop?.buildContext || {};
    const pub = bc.publicacion?.jsonLd || {};
    const geo = pub.geo || {};
    const la = parseFloat(geo.latitude);
    const lo = parseFloat(geo.longitude);
    const addr = prop?.googleHotelData?.address || meta.googleHotelData?.address || {};
    const city = String(addr.city || addr.locality || '').trim();
    return {
        lat: Number.isFinite(la) ? la : null,
        lng: Number.isFinite(lo) ? lo : null,
        cityKey: city.toLowerCase(),
    };
}

function _pickCardTitleFromPropiedad(p) {
    const meta = p.metadata || p;
    const bc = meta.buildContext || p.buildContext || {};
    const h1 = String(bc.narrativa?.homeH1 || '').trim();
    if (h1) return h1.slice(0, 140);
    const ai = String(meta.websiteData?.aiDescription || p.websiteData?.aiDescription || '').trim();
    if (ai) return ai.replace(/\s+/g, ' ').slice(0, 140);
    return String(p.nombre || '').trim().slice(0, 140);
}

function _cardImageFromPropiedad(p) {
    const meta = p.metadata || p;
    const wd = meta.websiteData || p.websiteData || {};
    const card = wd.cardImage?.storagePath;
    if (card) return String(card).trim();
    const imgs = wd.images || {};
    const flat = Object.values(imgs).flat().filter((i) => i && i.storagePath);
    if (flat[0]?.storagePath) return String(flat[0].storagePath).trim();
    return '';
}

function _buildPublicPropertyUrl(empresaRow, propiedadId, protocol) {
    const pro = String(protocol || 'https').replace(/:$/, '');
    let dom = String(empresaRow.dominio || '').trim().replace(/^https?:\/\//i, '');
    if (dom && !/^localhost/i.test(dom)) return `${pro}://${dom}/propiedad/${propiedadId}`;
    const sub = String(empresaRow.subdominio || '').trim().toLowerCase();
    const root = process.env.PUBLIC_SITES_ROOT_DOMAIN || 'suitemanagers.com';
    if (sub) return `${pro}://${sub}.${root}/propiedad/${propiedadId}`;
    return '';
}

function _fmtPrecioDesde(px) {
    const n = Math.round(Number(px) || 0);
    if (n <= 0) return 'Consultar precio';
    return `Desde $${n.toLocaleString('es-CL')} / noche`;
}

/**
 * Carrusel SSR "más alojamientos": primero otros del mismo anfitrión; si no hay, descubrimiento StayManager
 * (misma ciudad o cercanía por coordenadas + rango de precio similar al alojamiento actual).
 *
 * @param {object} opts
 * @param {string} opts.empresaId
 * @param {string} opts.propiedadIdActual
 * @param {object} opts.propiedad — objeto enriquecido como en obtenerPropiedadPorId
 * @param {string} opts.baseUrl — origen del sitio actual (mismos anfitriones)
 * @param {string} [opts.protocol] — req.protocol
 * @param {Array} opts.allTarifasHost — tarifas del anfitrión actual (fetchTarifasYCanal)
 * @param {string|null} opts.canalPorDefectoIdHost
 * @param {number} opts.precioReferenciaNoche — getPrecioBaseNoche del alojamiento actual
 * @param {string} opts.nombreAnfitrion
 * @returns {Promise<{ modo: 'misma_empresa'|'descubrimiento', titulo: string, subtitulo: string, items: object[] }|null>}
 */
async function obtenerMasAlojamientosParaFichaSSR(opts) {
    if (!pool) return null;
    const {
        empresaId,
        propiedadIdActual,
        propiedad,
        baseUrl,
        protocol,
        allTarifasHost,
        canalPorDefectoIdHost,
        precioReferenciaNoche,
        nombreAnfitrion,
    } = opts;

    const refPx = Math.max(0, Number(precioReferenciaNoche) || 0);
    const { lat: refLat, lng: refLng, cityKey } = _extractGeoCityFromPropiedad(propiedad);
    const qSuffix = ['fechaLlegada', 'fechaSalida', 'personas']
        .map((k) => {
            const v = opts.query && opts.query[k];
            return v ? `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}` : '';
        })
        .filter(Boolean)
        .join('&');
    const queryStr = qSuffix ? `?${qSuffix}` : '';
    const appendQuery = (absoluteUrl) => {
        if (!qSuffix) return absoluteUrl;
        const sep = String(absoluteUrl || '').includes('?') ? '&' : '?';
        return `${absoluteUrl}${sep}${qSuffix}`;
    };

    const todas = await obtenerPropiedadesPorEmpresa(null, empresaId);
    const hermanas = todas.filter((p) => p.id !== propiedadIdActual);
    const MAX = 8;

    if (hermanas.length > 0) {
        const slice = hermanas.slice(0, MAX);
        const resumenes = await Promise.all(slice.map((p) => obtenerResumenPorPropiedad(empresaId, p.id)));
        const items = slice.map((p, i) => {
            const px = canalPorDefectoIdHost
                ? getPrecioBaseNoche(p.id, allTarifasHost, canalPorDefectoIdHost)
                : 0;
            const rs = resumenes[i] || {};
            const rating =
                rs.promedio_general != null && Number(rs.total) > 0
                    ? `★ ${Number(rs.promedio_general).toFixed(1)}`
                    : null;
            const base = String(baseUrl || '').replace(/\/$/, '');
            const href = base ? `${base}/propiedad/${p.id}${queryStr}` : `/propiedad/${p.id}${queryStr}`;
            return {
                href,
                target: null,
                rel: null,
                imagen: _cardImageFromPropiedad(p),
                titulo: _pickCardTitleFromPropiedad(p),
                precioLabel: _fmtPrecioDesde(px),
                ratingLabel: rating,
                reviewCount: Number(rs.total) || 0,
                esExterno: false,
            };
        });
        return {
            modo: 'misma_empresa',
            titulo: `Más alojamientos de ${nombreAnfitrion || 'este anfitrión'}`,
            subtitulo: 'Otros espacios publicados por el mismo anfitrión.',
            items,
        };
    }

    const cityParam = cityKey || null;
    const { rows } = await pool.query(
        `SELECT p.id, p.empresa_id, p.nombre, p.metadata
         FROM propiedades p
         WHERE p.activo = true
           AND (p.metadata->'googleHotelData'->>'isListed')::boolean = true
           AND p.id::text <> $1::text
           AND p.empresa_id::text <> $2::text
           AND (
             $3::text IS NULL OR trim($3::text) = '' OR
             lower(trim(coalesce(p.metadata #>> '{googleHotelData,address,city}', ''))) = lower(trim($3::text))
           )
         ORDER BY p.updated_at DESC NULLS LAST
         LIMIT 120`,
        [String(propiedadIdActual), String(empresaId), cityParam]
    );

    if (!rows.length) return null;

    const empIds = [...new Set(rows.map((r) => r.empresa_id))];
    const { allTarifas, defaultCanalByEmpresa } = await fetchTarifasForEmpresas(empIds);
    const { rows: empRows } = await pool.query(
        `SELECT id, nombre, dominio, subdominio FROM empresas WHERE id::text = ANY($1::text[])`,
        [empIds.map(String)]
    );
    const empById = new Map(empRows.map((e) => [String(e.id), e]));

    const band = 0.5;
    const scored = [];
    for (const r of rows) {
        const meta = r.metadata || {};
        const p = { id: r.id, nombre: r.nombre, empresa_id: r.empresa_id, metadata: meta, websiteData: meta.websiteData, buildContext: meta.buildContext, googleHotelData: meta.googleHotelData };
        const canalId = defaultCanalByEmpresa.get(String(r.empresa_id))?.id || null;
        const minPx = canalId ? getPrecioBaseNoche(r.id, allTarifas, canalId) : 0;
        if (refPx > 0 && minPx > 0) {
            const relDiff = Math.abs(minPx - refPx) / refPx;
            if (relDiff > band) continue;
        }
        const g = _extractGeoCityFromPropiedad(p);
        let distKm = null;
        if (refLat != null && refLng != null && g.lat != null && g.lng != null) {
            distKm = _haversineKm(refLat, refLng, g.lat, g.lng);
        }
        const empRow = empById.get(String(r.empresa_id)) || {};
        const absUrl = _buildPublicPropertyUrl(empRow, r.id, protocol);
        if (!absUrl) continue;
        scored.push({
            p,
            minPx,
            distKm: distKm != null && Number.isFinite(distKm) ? distKm : 1e9,
            absUrl,
        });
    }

    scored.sort((a, b) => {
        const imgA = _cardImageFromPropiedad(a.p) ? 1 : 0;
        const imgB = _cardImageFromPropiedad(b.p) ? 1 : 0;
        if (imgB !== imgA) return imgB - imgA;
        const finiteA = a.distKm < 1e8;
        const finiteB = b.distKm < 1e8;
        if (finiteA && finiteB && a.distKm !== b.distKm) return a.distKm - b.distKm;
        if (refPx > 0 && a.minPx > 0 && b.minPx > 0) {
            return Math.abs(a.minPx - refPx) - Math.abs(b.minPx - refPx);
        }
        return 0;
    });

    const picked = scored.slice(0, MAX);
    if (!picked.length) return null;

    const items = await Promise.all(
        picked.map(async ({ p, minPx, absUrl }) => {
            const rs = await obtenerResumenPorPropiedad(p.empresa_id, p.id);
            const rating =
                rs.promedio_general != null && Number(rs.total) > 0
                    ? `★ ${Number(rs.promedio_general).toFixed(1)}`
                    : null;
            return {
                href: appendQuery(absUrl),
                target: '_blank',
                rel: 'noopener noreferrer',
                imagen: _cardImageFromPropiedad(p),
                titulo: _pickCardTitleFromPropiedad(p),
                precioLabel: _fmtPrecioDesde(minPx),
                ratingLabel: rating,
                reviewCount: Number(rs.total) || 0,
                esExterno: true,
            };
        })
    );

    const sub = cityKey
        ? `En ${cityKey} y precio similar al de esta estadía.`
        : 'Selección en StayManager con precio similar al de esta estadía.';
    return {
        modo: 'descubrimiento',
        titulo: 'Más alojamientos a tu alrededor',
        subtitulo: sub,
        items,
    };
}

const obtenerPropiedadesPorEmpresa = async (_db, empresaId) => {
    if (!empresaId || typeof empresaId !== 'string' || empresaId.trim() === '') {
        console.error(`[ERROR] obtenerPropiedadesPorEmpresa (SSR) - empresaId es INVÁLIDO.`);
        throw new Error(`Se intentó obtener propiedades con un empresaId inválido.`);
    }
    const { rows } = await pool.query(
        `SELECT id, nombre, capacidad, activo, metadata, updated_at FROM propiedades
         WHERE empresa_id = $1 AND activo = true
           AND (metadata->'googleHotelData'->>'isListed')::boolean = true
         ORDER BY created_at DESC`,
        [empresaId]
    );
    return rows.map((r) => ({
        id: r.id,
        nombre: r.nombre,
        capacidad: r.capacidad,
        updatedAt: r.updated_at,
        ...(r.metadata || {}),
    }));
};

const obtenerPropiedadPorId = async (_db, empresaId, propiedadId) => {
    console.log(`[DEBUG] obtenerPropiedadPorId: empresaId=${empresaId}, propiedadId=${propiedadId}`);
    if (!propiedadId || typeof propiedadId !== 'string' || propiedadId.trim() === '') {
        console.error(`[publicWebsiteService] Error: ID inválido: '${propiedadId}'`);
        return null;
    }
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
};

const obtenerDetallesEmpresa = async (_db, empresaId) => {
    if (!empresaId) throw new Error('El ID de la empresa es requerido.');
    const { rows } = await pool.query(
        'SELECT id, nombre, email, plan, configuracion, dominio, subdominio FROM empresas WHERE id = $1',
        [empresaId]
    );
    if (!rows[0]) throw new Error('La empresa no fue encontrada.');
    const r = rows[0];
    return { id: r.id, nombre: r.nombre, email: r.email, plan: r.plan, dominio: r.dominio, subdominio: r.subdominio, ...(r.configuracion || {}) };
};

// --- Funciones de Reservas ---

const crearReservaPublica = async (db, empresaId, datosFormulario) => {
    const { propiedadId, fechaLlegada, fechaSalida, personas, precioFinal, noches, nombre, email, telefono } = datosFormulario;

    const startR = parseISO(String(fechaLlegada || '').slice(0, 10) + 'T12:00:00');
    const endR = parseISO(String(fechaSalida || '').slice(0, 10) + 'T12:00:00');
    if (!isValid(startR) || !isValid(endR) || endR <= startR) {
        throw new Error('Las fechas de la reserva no son válidas.');
    }
    const propiedadData = await obtenerPropiedadPorId(db, empresaId, propiedadId);
    if (!propiedadData) throw new Error('La propiedad seleccionada ya no existe.');
    const empresaDet = await obtenerDetallesEmpresa(db, empresaId);
    const minNochesR = Math.max(1, parseInt(String(
        propiedadData?.websiteData?.booking?.minNoches
        ?? empresaDet?.websiteSettings?.booking?.minNoches
        ?? '1'
    ), 10) || 1);
    if (differenceInDays(endR, startR) < minNochesR) {
        throw new Error(`La estadía debe ser de al menos ${minNochesR} noche(s).`);
    }

    const resultadoCliente = await crearOActualizarClientePublico(db, empresaId, { nombre, email, telefono });
    const clienteId = resultadoCliente.cliente.id;

    const { rows: canalRows } = await pool.query(
        `SELECT id, nombre, COALESCE(metadata->>'moneda', 'CLP') AS moneda FROM canales WHERE empresa_id = $1 AND (metadata->>'esCanalPorDefecto')::boolean = true LIMIT 1`,
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
};

// --- Funciones de Disponibilidad y Precios ---

async function getAvailabilityData(_db, empresaId, startDate, endDate, sinCamarotes = false) {
    const { allProperties: rawProps, allTarifas, allReservas, allBloqueos } =
        await _fetchAvailabilityPG(empresaId, endDate);

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

async function calculatePrice(_db, empresaId, items, startDate, endDate, allTarifas, valorDolarDiaOverride = null) {
    const { rows } = await pool.query(
        `SELECT id, nombre, COALESCE(metadata->>'moneda', 'CLP') AS moneda FROM canales WHERE empresa_id = $1 AND (metadata->>'esCanalPorDefecto')::boolean = true LIMIT 1`,
        [empresaId]
    );
    if (!rows[0]) throw new Error("No se ha configurado un canal por defecto.");
    const canalPorDefecto = rows[0];

    const valorDolarDia = valorDolarDiaOverride ??
        (canalPorDefecto.moneda === 'USD' ? await obtenerValorDolar(_db, empresaId, startDate) : null);

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
    obtenerOcupacionCalendarioPropiedad,
    obtenerMasAlojamientosParaFichaSSR,
};
