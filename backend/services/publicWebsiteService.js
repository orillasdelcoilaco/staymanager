// backend/services/publicWebsiteService.js
// Lógica específica para la búsqueda y precios del sitio web público SSR.

const pool = require('../db/postgres');
const { obtenerValorDolar } = require('./dolarService');
const { crearOActualizarCliente, buscarClienteIdPorEmail } = require('./clientesService');
const { listarBloqueos, getBloqueosPorPeriodo } = require('./bloqueosService');
const { isValid, differenceInDays, addDays, parseISO, format } = require('date-fns');
const { getPrecioBaseNoche, fetchTarifasForEmpresas, fetchTarifasYCanal } = require('../routes/website.shared');
const { obtenerResumenPorPropiedad } = require('./resenasService');
const { aplicarPromocionesDisplayCompleto, precioNocheConPromoTarifa } = require('./promocionesDisplayService');
const { buildDesglosePrecioCheckout } = require('./checkoutDesgloseService');
const {
    listTarifaIdsPorNocheEstadia,
    listTarifaIdsUnionGrupoEstadia,
    mergeLegalConPoliticaTarifaUnica,
    snapshotPoliticaCancelacionParaMetadata,
} = require('./politicaCancelacionTarifaService');
const { validarCupon, marcarCuponComoUtilizado } = require('./cuponesService');
const {
    validarRestriccionesFechasReservaWeb,
    evaluarRestriccionesReservaWebCodigo,
} = require('./reservaWebRestriccionesService');
const { obtenerNombreEstadoGestionInicialReservaConfirmada } = require('./estadosService');
const {
    enviarPorDisparador,
    construirVariablesDesdeReserva,
    resolverLinkResenaOutbound,
} = require('./transactionalEmailService');

// --- Helpers de Cliente ---

const crearOActualizarClientePublico = async (db, empresaId, datosCliente) => {
    return crearOActualizarCliente(db, empresaId, {
        nombre: datosCliente.nombre,
        email: datosCliente.email || '',
        telefono: datosCliente.telefono || '',
        origen: 'website',
    });
};

function _normalizarTelefonoPublico(rawTelefono) {
    const raw = String(rawTelefono || '').trim().replace(/\s+/g, '');
    if (!raw) return '';
    const clean = raw.replace(/[^\d+]/g, '');
    if (/^\+569\d{8}$/.test(clean)) return clean;
    if (/^569\d{8}$/.test(clean)) return `+${clean}`;
    if (/^9\d{8}$/.test(clean)) return `+56${clean}`;
    return null;
}

function _calcularDvRut(cuerpo) {
    let suma = 0;
    let multiplicador = 2;
    for (let i = cuerpo.length - 1; i >= 0; i -= 1) {
        suma += Number(cuerpo[i]) * multiplicador;
        multiplicador = multiplicador === 7 ? 2 : multiplicador + 1;
    }
    const resto = 11 - (suma % 11);
    if (resto === 11) return '0';
    if (resto === 10) return 'K';
    return String(resto);
}

function _normalizarRutPublico(rawRut) {
    const val = String(rawRut || '').trim().toUpperCase();
    if (!val) return '';
    if (val.includes('.')) return null;
    if (!/^\d{7,8}-[\dK]$/.test(val)) return null;
    const [cuerpo, dv] = val.split('-');
    if (_calcularDvRut(cuerpo) !== dv) return null;
    return `${cuerpo}-${dv}`;
}

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
 * Multi-tenant: todas las lecturas filtran por `empresaId` (reservas + bloqueos).
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
 * @param {number} opts.precioReferenciaNoche — referencia por noche para el filtro ±50% (idealmente alineada al precio mostrado en la ficha, p. ej. noche con promo).
 * @param {string} [opts.fechaEstanciaLlegada] — YYYY-MM-DD para promos de tarifa (si no hay en `query`, p. ej. mismo fin de semana que la ficha).
 * @param {string} [opts.fechaEstanciaSalida] — checkout exclusivo, mismo criterio que SSR ficha.
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
    const fechaLlegadaQ = opts.fechaEstanciaLlegada
        || (opts.query?.fechaLlegada ? String(opts.query.fechaLlegada).slice(0, 10) : null);
    const fechaSalidaQ = opts.fechaEstanciaSalida
        || (opts.query?.fechaSalida ? String(opts.query.fechaSalida).slice(0, 10) : null);
    const marketingPromos = Array.isArray(opts.marketingPromos) ? opts.marketingPromos : [];
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
            const conPromo = aplicarPromocionesDisplayCompleto(
                { id: p.id, pricing: null, precioBaseNoche: px },
                {
                    promos: marketingPromos,
                    fechaLlegada: fechaLlegadaQ,
                    fechaSalida: fechaSalidaQ,
                    allTarifas: allTarifasHost,
                    canalPorDefectoId: canalPorDefectoIdHost,
                }
            );
            const pxMostrar = conPromo.promoDisplay?.precioPromo || px;
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
                precioLabel: _fmtPrecioDesde(pxMostrar),
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
        `SELECT id, nombre, dominio, subdominio,
                COALESCE(configuracion->'websiteSettings'->'marketing'->'promocionesDestacadas', '[]'::jsonb) AS marketing_promos
         FROM empresas WHERE id::text = ANY($1::text[])`,
        [empIds.map(String)]
    );
    const promosByEmpresa = new Map();
    empRows.forEach((er) => {
        const raw = er.marketing_promos;
        const arr = Array.isArray(raw) ? raw : [];
        promosByEmpresa.set(String(er.id), arr);
    });
    const empById = new Map(empRows.map((e) => [String(e.id), e]));

    const band = 0.5;
    const scored = [];
    for (const r of rows) {
        const meta = r.metadata || {};
        const p = { id: r.id, nombre: r.nombre, empresa_id: r.empresa_id, metadata: meta, websiteData: meta.websiteData, buildContext: meta.buildContext, googleHotelData: meta.googleHotelData };
        const canalId = defaultCanalByEmpresa.get(String(r.empresa_id))?.id || null;
        const minPxBase = canalId ? getPrecioBaseNoche(r.id, allTarifas, canalId) : 0;
        const promosEmp = promosByEmpresa.get(String(r.empresa_id)) || [];
        const conPx = aplicarPromocionesDisplayCompleto(
            { id: r.id, pricing: null, precioBaseNoche: minPxBase },
            {
                promos: promosEmp,
                fechaLlegada: fechaLlegadaQ,
                fechaSalida: fechaSalidaQ,
                allTarifas,
                canalPorDefectoId: canalId,
            }
        );
        const minPx = conPx.promoDisplay?.precioPromo || minPxBase;
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

/** Misma tolerancia que en tests (`test-reconciliacion-precio-reserva-web.js`). */
const PRECIO_WEB_RECONCILIACION_TOLERANCIA_CLP = 1;

/**
 * Recargo CLP total por menores y camas extra (por unidad y noche de estadía).
 * Solo aplica si `solicitudMenoresCamasActivo`; montos en `websiteSettings.booking`.
 */
function computeRecargoMenoresCamasCLP(booking, menores, camasExtra, noches) {
    const b = booking && typeof booking === 'object' ? booking : {};
    if (!b.solicitudMenoresCamasActivo) return 0;
    const n = Math.max(0, Math.min(366, parseInt(String(noches ?? 0), 10) || 0));
    const m = Math.max(0, parseInt(String(menores ?? 0), 10) || 0);
    const c = Math.max(0, parseInt(String(camasExtra ?? 0), 10) || 0);
    const rm = Math.max(0, Math.round(Number(b.recargoMenorNocheCLP) || 0));
    const rc = Math.max(0, Math.round(Number(b.recargoCamaExtraNocheCLP) || 0));
    return (rm * m + rc * c) * n;
}

/**
 * Aplica cupón de checkout web: `porcentaje` o `monto_fijo` (valor en columna `descuento` del cupón, CLP).
 * @param {{ tipoDescuento?: string, porcentajeDescuento: number }} cup — salida de `validarCupon` (`porcentajeDescuento` mapea `descuento`).
 * @returns {{ ok: true, esperadoCLP: number, cuponSnapshot: object } | { ok: false, error: string }}
 */
function aplicarCuponWebCheckout(cup, sumTotal, codigoCupon) {
    const tipoRaw = String(cup.tipoDescuento || 'porcentaje')
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '_');
    const esMontoFijo = tipoRaw === 'monto_fijo' || tipoRaw === 'montofijo';
    if (esMontoFijo) {
        const monto = Math.max(0, Math.round(Number(cup.porcentajeDescuento) || 0));
        const esperadoCLP = Math.max(0, Math.round(sumTotal) - monto);
        return {
            ok: true,
            esperadoCLP,
            cuponSnapshot: {
                codigo: codigoCupon,
                tipoDescuento: 'monto_fijo',
                montoDescuentoCLP: monto,
                totalAntesDescuentoCLP: sumTotal,
                totalEsperadoTrasCuponCLP: esperadoCLP,
            },
        };
    }
    if (tipoRaw === 'porcentaje' || tipoRaw === '') {
        const pct = Math.min(100, Math.max(0, Number(cup.porcentajeDescuento) || 0));
        const esperadoCLP = Math.round(sumTotal * (1 - pct / 100));
        return {
            ok: true,
            esperadoCLP,
            cuponSnapshot: {
                codigo: codigoCupon,
                tipoDescuento: 'porcentaje',
                porcentajeDescuento: pct,
                totalAntesDescuentoCLP: sumTotal,
                totalEsperadoTrasCuponCLP: esperadoCLP,
            },
        };
    }
    return {
        ok: false,
        error: 'Este tipo de cupón no se puede aplicar aún en la reserva web. Contacta al anfitrión.',
    };
}

/**
 * Suma de `calculatePrice` por propiedad (fechas UTC medianoche), misma regla que el checkout web.
 * @param {object[]|undefined} propiedadesPrecargadas — misma longitud y orden que los ids
 */
async function calcularSumaTarifaReservaWeb(db, empresaId, datosFormulario, propiedadesPrecargadas) {
    const { propiedadId, fechaLlegada, fechaSalida } = datosFormulario;
    const ids = String(propiedadId || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    if (!ids.length) {
        return { ok: false, errors: ['Falta el alojamiento para verificar el precio.'] };
    }
    const llegS = String(fechaLlegada || '').slice(0, 10);
    const salS = String(fechaSalida || '').slice(0, 10);
    const startDate = parseISO(`${llegS}T00:00:00Z`);
    const endDate = parseISO(`${salS}T00:00:00Z`);
    if (!isValid(startDate) || !isValid(endDate) || endDate <= startDate) {
        return { ok: false, errors: ['Las fechas no son válidas para verificar el precio.'] };
    }

    const propsList = [];
    if (Array.isArray(propiedadesPrecargadas) && propiedadesPrecargadas.length === ids.length) {
        for (let i = 0; i < ids.length; i++) {
            if (!propiedadesPrecargadas[i]) {
                return { ok: false, errors: ['No se encontró uno de los alojamientos para verificar el precio.'] };
            }
            propsList.push(propiedadesPrecargadas[i]);
        }
    } else {
        for (const id of ids) {
            const prop = await obtenerPropiedadPorId(db, empresaId, id);
            if (!prop) {
                return { ok: false, errors: ['No se encontró el alojamiento para verificar el precio.'] };
            }
            propsList.push(prop);
        }
    }

    const { allTarifas } = await fetchTarifasYCanal(empresaId);
    let nightsRef = null;
    let valorDolarRef = null;
    let monedaRef = null;
    const porPropiedad = [];
    let sumTotal = 0;

    for (let i = 0; i < ids.length; i++) {
        const prop = propsList[i];
        const pricing = await calculatePrice(db, empresaId, [prop], startDate, endDate, allTarifas);
        if (pricing.error) {
            return {
                ok: false,
                errors: [
                    'No se pudo verificar el precio (tipo de cambio o canal). Revisa la configuración del canal por defecto e intenta de nuevo.',
                ],
            };
        }
        if (nightsRef == null) {
            nightsRef = pricing.nights;
        } else if (pricing.nights > 0 && nightsRef > 0 && pricing.nights !== nightsRef) {
            return {
                ok: false,
                errors: ['Inconsistencia de noches entre alojamientos. Actualiza la página de reserva.'],
            };
        }
        valorDolarRef = pricing.valorDolarDia ?? valorDolarRef;
        monedaRef = pricing.currencyOriginal || monedaRef;
        const sub = Math.round(Number(pricing.totalPriceCLP) || 0);
        sumTotal += sub;
        porPropiedad.push({ propiedadId: ids[i], nombre: prop.nombre || '', totalCLP: sub });
    }

    return {
        ok: true,
        sumTotal,
        nightsRef,
        porPropiedad,
        ids,
        llegS,
        salS,
        valorDolarRef,
        monedaRef,
        propsList,
    };
}

/**
 * Mismas fechas que `POST /propiedad/:id/calcular-precio` (UTC medianoche).
 * Una o varias propiedades: suma de `calculatePrice` por cada id (como búsqueda grupo en home).
 * Cupón opcional: `porcentaje` o `monto_fijo` (CLP) vía `validarCupon`. Si el cupón tiene `clienteId`, debe coincidir con el huésped.
 * @param {{ clienteId?: string, propiedadesPrecargadas?: object[] }} [opts]
 * @returns {{ ok: true, snapshot?: object } | { ok: false, errors: string[] }}
 */
async function verificarReconciliacionPrecioReservaPublica(db, empresaId, datosFormulario, opts = {}) {
    const {
        propiedadId,
        fechaLlegada,
        fechaSalida,
        precioFinal,
        noches,
        codigoCupon: rawCupon,
        menores: rawMenoresRec,
        camasExtra: rawCamasRec,
    } = datosFormulario;
    const { clienteId, propiedadesPrecargadas, checkoutWeb: checkoutWebOpt } = opts;
    const codigoCupon = rawCupon != null ? String(rawCupon).trim() : '';

    const precioEnviado = Math.round(Number(precioFinal) || 0);
    if (precioEnviado <= 0) {
        return { ok: false, errors: ['El precio enviado no es válido.'] };
    }

    const calc = await calcularSumaTarifaReservaWeb(
        db,
        empresaId,
        { propiedadId, fechaLlegada, fechaSalida },
        propiedadesPrecargadas
    );
    if (!calc.ok) return calc;

    const {
        sumTotal,
        nightsRef,
        porPropiedad,
        ids,
        llegS,
        salS,
        valorDolarRef,
        monedaRef,
        propsList,
    } = calc;

    const empresaRecVal = await obtenerDetallesEmpresa(db, empresaId);
    const bkRecVal = checkoutWebOpt || empresaRecVal.websiteSettings?.booking || {};
    const hlRecVal = empresaRecVal.websiteSettings?.email?.idiomaPorDefecto === 'en' ? 'en' : 'es';
    const restrRec = validarRestriccionesFechasReservaWeb(bkRecVal, propsList, fechaLlegada, fechaSalida, hlRecVal);
    if (restrRec) return { ok: false, errors: [restrRec] };

    if (sumTotal <= 0 && precioEnviado > 0) {
        return {
            ok: false,
            errors: [
                'No hay tarifa publicada para las fechas elegidas; no se puede confirmar el precio. Elige otras fechas o contacta al anfitrión.',
            ],
        };
    }

    const menoresRec = Math.max(0, parseInt(String(rawMenoresRec ?? '0'), 10) || 0);
    const camasExtraRec = Math.max(0, parseInt(String(rawCamasRec ?? '0'), 10) || 0);
    const bkRec = checkoutWebOpt || empresaRecVal.websiteSettings?.booking || {};
    const recargoMc = computeRecargoMenoresCamasCLP(bkRec, menoresRec, camasExtraRec, nightsRef);
    const subtotalLista = sumTotal + recargoMc;

    const nochesInt = parseInt(String(noches), 10);
    if (
        Number.isFinite(nochesInt)
        && nochesInt > 0
        && nightsRef > 0
        && nochesInt !== nightsRef
    ) {
        return {
            ok: false,
            errors: [
                'El número de noches no coincide con las fechas. Actualiza la página de reserva e intenta de nuevo.',
            ],
        };
    }

    let esperadoCLP = subtotalLista;
    let cuponSnapshot = null;
    if (codigoCupon) {
        let cup;
        try {
            cup = await validarCupon(db, empresaId, codigoCupon);
        } catch (e) {
            const msg = e && typeof e === 'object' && e.message ? e.message : 'Cupón no válido.';
            return { ok: false, errors: [msg] };
        }
        if (cup.clienteId) {
            if (!clienteId) {
                return {
                    ok: false,
                    errors: [
                        'Este cupón está vinculado a un huésped. Completa el formulario (nombre y correo) e intenta de nuevo.',
                    ],
                };
            }
            if (String(cup.clienteId) !== String(clienteId)) {
                return {
                    ok: false,
                    errors: [
                        'Este cupón no está asociado a tu cuenta. Usa el mismo contacto (email) con el que recibiste el cupón.',
                    ],
                };
            }
        }
        const aplicado = aplicarCuponWebCheckout(cup, subtotalLista, codigoCupon);
        if (!aplicado.ok) {
            return { ok: false, errors: [aplicado.error] };
        }
        esperadoCLP = aplicado.esperadoCLP;
        cuponSnapshot = aplicado.cuponSnapshot;
    }

    if (esperadoCLP <= 0 && precioEnviado > 0) {
        return {
            ok: false,
            errors: ['El precio con cupón no pudo calcularse. Revisa el cupón o las fechas.'],
        };
    }

    if (Math.abs(precioEnviado - esperadoCLP) > PRECIO_WEB_RECONCILIACION_TOLERANCIA_CLP) {
        const refTxt = esperadoCLP.toLocaleString('es-CL');
        return {
            ok: false,
            errors: [
                codigoCupon
                    ? `El precio con cupón no coincide con el valor esperado (${refTxt} CLP). Actualiza la página o revisa el código.`
                    : `El precio ya no coincide con la tarifa vigente (${refTxt} CLP). Actualiza la página o vuelve a elegir las fechas.`,
            ],
        };
    }

    return {
        ok: true,
        snapshot: {
            totalTarificadorCLP: sumTotal,
            recargoMenoresCamasCLP: recargoMc,
            subtotalListaCLP: subtotalLista,
            menoresIndicados: menoresRec,
            camasExtraIndicadas: camasExtraRec,
            precioEnviadoCLP: precioEnviado,
            totalEsperadoCLP: esperadoCLP,
            toleranciaCLP: PRECIO_WEB_RECONCILIACION_TOLERANCIA_CLP,
            noches: nightsRef,
            fechaLlegada: llegS,
            fechaSalida: salS,
            propiedadIds: ids,
            propiedadIdPrincipal: ids[0],
            esGrupo: ids.length > 1,
            porPropiedad: ids.length > 1 ? porPropiedad : undefined,
            valorDolarDia: valorDolarRef ?? null,
            monedaCanal: monedaRef || null,
            cupon: cuponSnapshot,
            verificadoAt: new Date().toISOString(),
        },
    };
}

/**
 * Antes del POST final: alinea `precioFinal` con tarifa + cupón (`porcentaje` o `monto_fijo` en CLP).
 * Cupón ligado a cliente: el email debe corresponder a un cliente existente en el tenant.
 */
async function previewPrecioReservaCheckoutWeb(db, empresaId, body) {
    const {
        propiedadId,
        fechaLlegada,
        fechaSalida,
        noches,
        codigoCupon: rawCupon,
        email: rawEmail,
        menores: rawMenoresPrev,
        camasExtra: rawCamasPrev,
    } = body || {};
    const codigoCupon = rawCupon != null ? String(rawCupon).trim() : '';
    const email = rawEmail != null ? String(rawEmail).trim() : '';

    const calc = await calcularSumaTarifaReservaWeb(
        db,
        empresaId,
        { propiedadId, fechaLlegada, fechaSalida },
        undefined
    );
    if (!calc.ok) return calc;

    const { sumTotal, nightsRef, ids, propsList } = calc;
    const empresaPrev = await obtenerDetallesEmpresa(db, empresaId);
    const bkPrev = empresaPrev.websiteSettings?.booking || {};
    const hlPrev = empresaPrev.websiteSettings?.email?.idiomaPorDefecto === 'en' ? 'en' : 'es';
    const restrPrev = validarRestriccionesFechasReservaWeb(bkPrev, propsList, fechaLlegada, fechaSalida, hlPrev);
    if (restrPrev) return { ok: false, errors: [restrPrev] };

    const menoresPrev = Math.max(0, parseInt(String(rawMenoresPrev ?? '0'), 10) || 0);
    const camasPrev = Math.max(0, parseInt(String(rawCamasPrev ?? '0'), 10) || 0);
    const recargoPrev = computeRecargoMenoresCamasCLP(bkPrev, menoresPrev, camasPrev, nightsRef);
    const subtotalLista = sumTotal + recargoPrev;
    let precioFinalCLP = subtotalLista;
    let cuponSnapshot = null;

    if (codigoCupon) {
        if (!email) {
            return { ok: false, errors: ['Indica tu correo para validar el cupón.'] };
        }
        const clienteId = await buscarClienteIdPorEmail(db, empresaId, email);
        let cup;
        try {
            cup = await validarCupon(db, empresaId, codigoCupon);
        } catch (e) {
            const msg = e && typeof e === 'object' && e.message ? e.message : 'Cupón no válido.';
            return { ok: false, errors: [msg] };
        }
        if (cup.clienteId) {
            if (!clienteId) {
                return {
                    ok: false,
                    errors: [
                        'Este cupón está vinculado a un huésped. Usa el correo con el que recibiste el cupón (debe existir en la base del alojamiento).',
                    ],
                };
            }
            if (String(cup.clienteId) !== String(clienteId)) {
                return {
                    ok: false,
                    errors: [
                        'Este cupón no está asociado a tu cuenta. Usa el mismo contacto (email) con el que recibiste el cupón.',
                    ],
                };
            }
        }
        const aplicado = aplicarCuponWebCheckout(cup, subtotalLista, codigoCupon);
        if (!aplicado.ok) {
            return { ok: false, errors: [aplicado.error] };
        }
        precioFinalCLP = aplicado.esperadoCLP;
        cuponSnapshot = aplicado.cuponSnapshot;
    }

    const nochesInt = parseInt(String(noches), 10);
    if (
        Number.isFinite(nochesInt)
        && nochesInt > 0
        && nightsRef > 0
        && nochesInt !== nightsRef
    ) {
        return {
            ok: false,
            errors: [
                'El número de noches no coincide con las fechas. Actualiza la página de reserva e intenta de nuevo.',
            ],
        };
    }

    if (precioFinalCLP <= 0 && subtotalLista > 0 && codigoCupon) {
        return { ok: false, errors: ['El precio con cupón no pudo calcularse. Revisa el cupón o las fechas.'] };
    }

    return {
        ok: true,
        precioFinalCLP,
        totalSinCuponCLP: subtotalLista,
        totalTarifaAlojamientosCLP: sumTotal,
        recargoMenoresCamasCLP: recargoPrev,
        noches: nightsRef,
        cupon: cuponSnapshot,
        esGrupo: ids.length > 1,
    };
}

const crearReservaPublica = async (db, empresaId, datosFormulario) => {
    const {
        propiedadId,
        fechaLlegada,
        fechaSalida,
        personas,
        precioFinal,
        noches,
        nombre,
        email,
        telefono,
        rut,
        codigoCupon: rawCuponForm,
        menores: rawMenores,
        camasExtra: rawCamasExtra,
    } = datosFormulario;
    const codigoCuponForm = rawCuponForm != null ? String(rawCuponForm).trim() : '';
    const menores = Math.max(0, parseInt(String(rawMenores ?? '0'), 10) || 0);
    const camasExtra = Math.max(0, parseInt(String(rawCamasExtra ?? '0'), 10) || 0);

    const ids = String(propiedadId || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    if (!ids.length) {
        throw new Error('Falta el alojamiento.');
    }

    const startR = parseISO(String(fechaLlegada || '').slice(0, 10) + 'T12:00:00');
    const endR = parseISO(String(fechaSalida || '').slice(0, 10) + 'T12:00:00');
    if (!isValid(startR) || !isValid(endR) || endR <= startR) {
        throw new Error('Las fechas de la reserva no son válidas.');
    }

    const telefonoNormalizado = _normalizarTelefonoPublico(telefono);
    if (!telefonoNormalizado) {
        const err = new Error('El teléfono debe tener formato +56912345678.');
        err.statusCode = 400;
        err.code = 'telefono_invalido';
        throw err;
    }
    const rutNormalizado = _normalizarRutPublico(rut);
    if (String(rut || '').trim() && !rutNormalizado) {
        const err = new Error('El RUT debe tener formato 12345678-9 (sin puntos) y dígito verificador válido.');
        err.statusCode = 400;
        err.code = 'rut_invalido';
        throw err;
    }

    const propsData = [];
    for (const id of ids) {
        const p = await obtenerPropiedadPorId(db, empresaId, id);
        if (!p) throw new Error('Uno de los alojamientos seleccionados ya no existe.');
        propsData.push(p);
    }

    const empresaDet = await obtenerDetallesEmpresa(db, empresaId);
    const bkWeb = empresaDet.websiteSettings?.booking || {};
    const hl = empresaDet.websiteSettings?.email?.idiomaPorDefecto === 'en' ? 'en' : 'es';
    const restrEval = evaluarRestriccionesReservaWebCodigo(bkWeb, propsData, fechaLlegada, fechaSalida);
    if (!restrEval.ok) {
        const restrErr = validarRestriccionesFechasReservaWeb(bkWeb, propsData, fechaLlegada, fechaSalida, hl);
        const err = new Error(restrErr || restrEval.mensaje_es || 'No se pudo validar las restricciones de reserva.');
        err.statusCode = 400;
        err.code = restrEval.codigo || 'restriccion_reserva';
        err.details = [restrEval.mensaje_es || err.message].filter(Boolean);
        throw err;
    }

    if (bkWeb.solicitudMenoresCamasActivo) {
        const maxM = Math.min(20, Math.max(0, parseInt(String(bkWeb.menoresMax ?? 10), 10) || 10));
        const maxC = Math.min(10, Math.max(0, parseInt(String(bkWeb.camasExtraMax ?? 5), 10) || 5));
        if (menores > maxM) {
            throw new Error(`En esta reserva puedes indicar como máximo ${maxM} menor(es).`);
        }
        if (camasExtra > maxC) {
            throw new Error(`En esta reserva puedes solicitar como máximo ${maxC} cama(s) extra.`);
        }
    } else if (menores > 0 || camasExtra > 0) {
        throw new Error('Menores o camas extra no están habilitados para este sitio web.');
    }

    const tcCfg = empresaDet.websiteSettings?.terminosCondiciones;
    if (tcCfg && tcCfg.publicado === true) {
        const v = datosFormulario.aceptoTerminosCondiciones;
        const ok = v === true || v === 'true' || v === '1' || v === 'on' || v === 1;
        if (!ok) {
            const hlTc = empresaDet.websiteSettings?.email?.idiomaPorDefecto === 'en' ? 'en' : 'es';
            const err = new Error(hlTc === 'en'
                ? 'You must accept the terms and conditions to complete your booking.'
                : 'Debes aceptar los términos y condiciones para completar la reserva.');
            err.statusCode = 400;
            err.code = 'terminos_no_aceptados';
            throw err;
        }
    }

    const resultadoCliente = await crearOActualizarClientePublico(db, empresaId, { nombre, email, telefono: telefonoNormalizado });
    const clienteId = resultadoCliente.cliente.id;

    const datosConCupon = { ...datosFormulario, codigoCupon: codigoCuponForm };
    const recPrecio = await verificarReconciliacionPrecioReservaPublica(db, empresaId, datosConCupon, {
        clienteId,
        propiedadesPrecargadas: propsData,
        checkoutWeb: bkWeb,
    });
    if (!recPrecio.ok) {
        const err = new Error(recPrecio.errors[0]);
        err.statusCode = 409;
        err.code = 'precio_desalineado';
        err.details = recPrecio.errors;
        throw err;
    }

    const { rows: canalRows } = await pool.query(
        `SELECT id, nombre, COALESCE(metadata->>'moneda', 'CLP') AS moneda FROM canales WHERE empresa_id = $1 AND (metadata->>'esCanalPorDefecto')::boolean = true LIMIT 1`,
        [empresaId]
    );
    if (!canalRows[0]) throw new Error('No se encontró un canal por defecto.');
    const canal = canalRows[0];
    const idReservaCanal = `WEB-${Date.now().toString(36).toUpperCase().slice(-8)}`;
    const legalCfg = empresaDet.websiteSettings?.legal || {};
    const hlRes = empresaDet.websiteSettings?.email?.idiomaPorDefecto === 'en' ? 'en' : 'es';
    const des = buildDesglosePrecioCheckout(parseFloat(precioFinal), legalCfg, hlRes, {
        noches: parseInt(noches, 10) || 0,
        huespedes: Math.max(1, parseInt(String(personas ?? '1'), 10) || 1),
    });
    const propiedadIdInsert = ids[0];
    const nombreAlojamientos = propsData.map((p) => p.nombre).filter(Boolean).join(' + ');
    const valoresObj = { valorHuesped: parseFloat(precioFinal) };
    if (des.mostrar && des.netoCLP != null && des.ivaCLP != null) {
        valoresObj.valorTotal = des.netoCLP;
        valoresObj.iva = des.ivaCLP;
    }
    if (codigoCuponForm && recPrecio.snapshot?.cupon) {
        const lista = recPrecio.snapshot.subtotalListaCLP != null
            ? recPrecio.snapshot.subtotalListaCLP
            : recPrecio.snapshot.totalTarificadorCLP;
        valoresObj.codigoCupon = codigoCuponForm;
        valoresObj.descuentoCupon = Math.max(0, Math.round(Number(lista) || 0) - Math.round(Number(precioFinal) || 0));
    }
    const { allTarifas: allTarifasPc } = await fetchTarifasYCanal(empresaId);
    const llegPc = String(fechaLlegada).slice(0, 10);
    const salPc = String(fechaSalida).slice(0, 10);
    const idsPc = ids.length > 1
        ? listTarifaIdsUnionGrupoEstadia(ids, llegPc, salPc, allTarifasPc)
        : listTarifaIdsPorNocheEstadia(propiedadIdInsert, llegPc, salPc, allTarifasPc);
    const legalEff = mergeLegalConPoliticaTarifaUnica(legalCfg, allTarifasPc, idsPc);

    const metadataReserva = {
        origen: 'website',
        edicionesManuales: {},
        garantiaOperacion: {
            modo: bkWeb.garantiaModo || 'abono_manual',
            detalle: String(bkWeb.garantiaDetalleOperacion || '').trim() || null,
            registradaEnCheckoutAt: new Date().toISOString(),
        },
        politicaCancelacionCheckout: snapshotPoliticaCancelacionParaMetadata(legalEff),
        ...(tcCfg && tcCfg.publicado
            ? {
                aceptacionTerminos: {
                    aceptadoAt: new Date().toISOString(),
                    plantillaVersion: tcCfg.plantillaVersion || null,
                },
            }
            : {}),
        ...(recPrecio.snapshot ? { precioCheckoutVerificado: recPrecio.snapshot } : {}),
        ...(bkWeb.solicitudMenoresCamasActivo
            ? {
                reservaWebCheckout: {
                    menores,
                    camasExtra,
                    recargoCLP: recPrecio.snapshot?.recargoMenoresCamasCLP ?? 0,
                },
            }
            : {}),
        ...(ids.length > 1
            ? {
                reservaWebGrupo: {
                    propiedadIds: ids,
                    alojamientosNombres: propsData.map((p) => p.nombre || ''),
                },
            }
            : {}),
    };

    const nombreEstadoGestion = await obtenerNombreEstadoGestionInicialReservaConfirmada(empresaId);
    if (!nombreEstadoGestion) {
        const err = new Error(
            'La empresa no tiene estados de gestión configurados; no se puede completar la reserva web.'
        );
        err.statusCode = 422;
        throw err;
    }

    const insertSql = `INSERT INTO reservas (empresa_id, id_reserva_canal, propiedad_id, alojamiento_nombre,
            canal_id, canal_nombre, cliente_id, total_noches, estado, estado_gestion,
            moneda, valores, cantidad_huespedes, fecha_llegada, fecha_salida, metadata)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING *`;
    const insertParams = [
        empresaId,
        idReservaCanal,
        propiedadIdInsert,
        nombreAlojamientos || propsData[0].nombre,
        canal.id,
        canal.nombre,
        clienteId,
        parseInt(noches, 10),
        'Confirmada',
        nombreEstadoGestion,
        'CLP',
        JSON.stringify(valoresObj),
        parseInt(personas, 10),
        fechaLlegada,
        fechaSalida,
        JSON.stringify(metadataReserva),
    ];

    const pgClient = await pool.connect();
    let newRow;
    try {
        await pgClient.query('BEGIN');
        const ins = await pgClient.query(insertSql, insertParams);
        newRow = ins.rows[0];
        if (codigoCuponForm) {
            await marcarCuponComoUtilizado(null, db, empresaId, codigoCuponForm, idReservaCanal, clienteId, pgClient);
        }
        await pgClient.query('COMMIT');
    } catch (e) {
        try {
            await pgClient.query('ROLLBACK');
        } catch (_) {
            /* ignore rollback errors */
        }
        throw e;
    } finally {
        pgClient.release();
    }

    // No bloquea la creación de la reserva: si el envío falla, la reserva ya quedó persistida.
    try {
        const valoresFila = (() => {
            if (newRow?.valores && typeof newRow.valores === 'object') return newRow.valores;
            if (typeof newRow?.valores === 'string') {
                try { return JSON.parse(newRow.valores); } catch { return {}; }
            }
            return {};
        })();
        const rowForEmail = {
            id: newRow.id,
            id_reserva_canal: idReservaCanal,
            cliente_id: clienteId,
            alojamiento_nombre: nombreAlojamientos || propsData[0].nombre,
            fecha_llegada: String(fechaLlegada || '').slice(0, 10),
            fecha_salida: String(fechaSalida || '').slice(0, 10),
            total_noches: parseInt(noches, 10) || 0,
            cantidad_huespedes: Math.max(1, parseInt(String(personas ?? '1'), 10) || 1),
            valores: valoresFila,
            propiedad_id: propiedadIdInsert,
        };
        const linkResena = await resolverLinkResenaOutbound(empresaId, {
            reservaRef: idReservaCanal,
            nombreHuesped: String(nombre || '').trim(),
            propiedadIdFallback: propiedadIdInsert,
        });
        const variablesCorreo = await construirVariablesDesdeReserva(empresaId, rowForEmail, {
            clienteNombre: String(nombre || '').trim(),
            linkResena,
        });
        const envio = await enviarPorDisparador(null, empresaId, 'reserva_confirmada', {
            clienteId,
            destinatarioOverride: String(email || '').trim() || undefined,
            variables: variablesCorreo,
            relacionadoCon: { tipo: 'reserva', id: idReservaCanal },
            eventoComunicacion: 'reserva-confirmada',
        });
        if (!envio.sent) {
            console.warn('[crearReservaPublica] Correo de confirmación no enviado:', envio.reason || 'sin motivo');
        } else {
            console.log('[crearReservaPublica] Correo de confirmación enviado:', envio.messageId || '(sin messageId)');
        }
        const adminEmail = String(variablesCorreo.contactoEmail || '').trim().toLowerCase();
        const clienteEmail = String(email || '').trim().toLowerCase();
        if (adminEmail && adminEmail !== clienteEmail) {
            const envioAdmin = await enviarPorDisparador(null, empresaId, 'reserva_confirmada', {
                clienteId: null,
                destinatarioOverride: adminEmail,
                variables: {
                    ...variablesCorreo,
                    clienteNombre: String(nombre || '').trim() || variablesCorreo.clienteNombre || 'Huésped',
                    nombreCliente: String(nombre || '').trim() || variablesCorreo.nombreCliente || 'Huésped',
                },
                relacionadoCon: { tipo: 'reserva', id: idReservaCanal },
                eventoComunicacion: 'reserva-confirmada-admin',
                skipRegistro: true,
            });
            if (!envioAdmin.sent) {
                console.warn('[crearReservaPublica] Correo admin no enviado:', envioAdmin.reason || 'sin motivo');
            } else {
                console.log('[crearReservaPublica] Correo admin enviado:', envioAdmin.messageId || '(sin messageId)');
            }
        }
    } catch (mailErr) {
        console.warn('[crearReservaPublica] Error enviando correo de confirmación:', mailErr.message);
    }

    return {
        id: newRow.id,
        idReservaCanal,
        alojamientoId: propiedadId,
        alojamientoNombre: nombreAlojamientos || propsData[0].nombre,
        clienteId,
        propiedadesEmail: propsData.map((p) => ({ nombre: p.nombre || p.id })),
        fechaLlegada,
        fechaSalida,
        noches: parseInt(noches, 10) || 0,
        personas: Math.max(1, parseInt(String(personas ?? '1'), 10) || 1),
        precioFinal: parseFloat(precioFinal) || 0,
    };
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
    const llegStr = format(startDate, 'yyyy-MM-dd');
    const salStr = format(endDate, 'yyyy-MM-dd');
    const monedaCanal = canalPorDefecto.moneda === 'USD' ? 'USD' : 'CLP';

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
                let base = 0;
                if (typeof precioBaseObj === 'number') base = precioBaseObj;
                else if (precioBaseObj && typeof precioBaseObj === 'object') {
                    base = monedaCanal === 'USD'
                        ? (Number(precioBaseObj.valorUSD) || 0)
                        : (Number(precioBaseObj.valorCLP) || 0);
                }
                propPrecioBaseTotal += precioNocheConPromoTarifa(base, tarifa.metadata?.promo, llegStr, salStr);
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
    previewPrecioReservaCheckoutWeb,
    verificarReconciliacionPrecioReservaPublica,
    obtenerOcupacionCalendarioPropiedad,
    obtenerMasAlojamientosParaFichaSSR,
};
