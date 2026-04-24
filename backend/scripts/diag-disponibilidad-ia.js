/**
 * Diagnóstico: misma lógica SQL y fechas que /api/disponibilidad (publicWebsiteService).
 * Uso (desde backend/):
 *   node scripts/diag-disponibilidad-ia.js orillasdelcoilaco 2026-04-24 2026-04-26
 */
/* eslint-disable no-console */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const pool = require('../db/postgres');
const { parseISO, isValid } = require('date-fns');
const { listarBloqueos } = require('../services/bloqueosService');

function buildAvailabilityResult(allProperties, allTarifas, allReservas, allBloqueos, startDate, endDate) {
    const propiedadesConTarifa = allProperties.filter((prop) =>
        allTarifas.some(
            (t) =>
                String(t.alojamientoId) === String(prop.id) &&
                t.fechaInicio <= endDate &&
                t.fechaTermino >= startDate
        )
    );
    const availabilityMap = new Map();
    allProperties.forEach((prop) => availabilityMap.set(prop.id, []));

    for (const reserva of allReservas) {
        const s = reserva.fechaSalida instanceof Date ? reserva.fechaSalida : null;
        if (s && isValid(s) && s > startDate && availabilityMap.has(reserva.alojamientoId)) {
            const st = reserva.fechaLlegada instanceof Date ? reserva.fechaLlegada : null;
            if (st && isValid(st)) availabilityMap.get(reserva.alojamientoId).push({ start: st, end: s });
        }
    }
    for (const b of allBloqueos) {
        const bInicio = b.fechaInicio instanceof Date ? b.fechaInicio : new Date(b.fechaInicio);
        const bFin = new Date(
            (b.fechaFin instanceof Date ? b.fechaFin : new Date(b.fechaFin)).getTime() + 86400000
        );
        if (bInicio >= endDate) continue;
        const ids = b.todos ? allProperties.map((p) => p.id) : b.alojamientoIds || [];
        ids.forEach((id) => {
            if (availabilityMap.has(id)) availabilityMap.get(id).push({ start: bInicio, end: bFin });
        });
    }
    const availableProperties = propiedadesConTarifa.filter((prop) => {
        const reservations = availabilityMap.get(prop.id) || [];
        return !reservations.some((res) => startDate < res.end && endDate > res.start);
    });
    const availableIds = new Set(availableProperties.map((p) => p.id));
    const unavailableProperties = propiedadesConTarifa.filter((p) => !availableIds.has(p.id));
    return { availableProperties, unavailableProperties, propiedadesConTarifa };
}

/** Igual que suitemanagerApiController + getAvailabilityData: comparación prop.id === t.alojamientoId (estricta) */
function buildAvailabilityResultStrictIds(allProperties, allTarifas, allReservas, allBloqueos, startDate, endDate) {
    const propiedadesConTarifa = allProperties.filter((prop) =>
        allTarifas.some(
            (t) => t.alojamientoId === prop.id && t.fechaInicio <= endDate && t.fechaTermino >= startDate
        )
    );
    const availabilityMap = new Map();
    allProperties.forEach((prop) => availabilityMap.set(prop.id, []));

    for (const reserva of allReservas) {
        const s = reserva.fechaSalida instanceof Date ? reserva.fechaSalida : null;
        if (s && isValid(s) && s > startDate && availabilityMap.has(reserva.alojamientoId)) {
            const st = reserva.fechaLlegada instanceof Date ? reserva.fechaLlegada : null;
            if (st && isValid(st)) availabilityMap.get(reserva.alojamientoId).push({ start: st, end: s });
        }
    }
    for (const b of allBloqueos) {
        const bInicio = b.fechaInicio instanceof Date ? b.fechaInicio : new Date(b.fechaInicio);
        const bFin = new Date(
            (b.fechaFin instanceof Date ? b.fechaFin : new Date(b.fechaFin)).getTime() + 86400000
        );
        if (bInicio >= endDate) continue;
        const ids = b.todos ? allProperties.map((p) => p.id) : b.alojamientoIds || [];
        ids.forEach((id) => {
            if (availabilityMap.has(id)) availabilityMap.get(id).push({ start: bInicio, end: bFin });
        });
    }
    const availableProperties = propiedadesConTarifa.filter((prop) => {
        const reservations = availabilityMap.get(prop.id) || [];
        return !reservations.some((res) => startDate < res.end && endDate > res.start);
    });
    const availableIds = new Set(availableProperties.map((p) => p.id));
    const unavailableProperties = propiedadesConTarifa.filter((p) => !availableIds.has(p.id));
    return { availableProperties, unavailableProperties, propiedadesConTarifa };
}

async function resolveEmpresaPgId(empresaId) {
    if (!empresaId) return empresaId;
    const { rows } = await pool.query(
        'SELECT id, subdominio, nombre FROM empresas WHERE id::text = $1 OR LOWER(subdominio) = LOWER($1) LIMIT 1',
        [empresaId]
    );
    return { resolvedId: rows[0]?.id || empresaId, row: rows[0] || null };
}

async function fetchAvailabilityPg(empresaId, endDate) {
    const endStr = endDate.toISOString().split('T')[0];
    const [propRes, tarifaRes, reservaRes, bloqueos] = await Promise.all([
        pool.query(
            'SELECT id, nombre, capacidad, activo, metadata FROM propiedades WHERE empresa_id = $1 AND activo = true',
            [empresaId]
        ),
        pool.query(
            `SELECT t.propiedad_id, t.precios_canales, temp.fecha_inicio, temp.fecha_termino
             FROM tarifas t
             JOIN temporadas temp ON t.temporada_id = temp.id
             WHERE t.empresa_id = $1`,
            [empresaId]
        ),
        pool.query(
            `SELECT propiedad_id, fecha_llegada, fecha_salida FROM reservas
             WHERE empresa_id = $1 AND fecha_llegada < $2 AND estado = ANY($3)`,
            [empresaId, endStr, ['Confirmada', 'Propuesta']]
        ),
        listarBloqueos(null, empresaId),
    ]);

    const allProperties = propRes.rows.map((r) => ({
        id: r.id,
        nombre: r.nombre,
        capacidad: r.capacidad,
        ...(r.metadata || {}),
    }));
    const rawMapped = tarifaRes.rows.map((row) => {
        try {
            const fi = row.fecha_inicio instanceof Date ? row.fecha_inicio : new Date(row.fecha_inicio);
            const ft = row.fecha_termino instanceof Date ? row.fecha_termino : new Date(row.fecha_termino);
            if (!isValid(fi) || !isValid(ft)) return { drop: 'invalid_date', row };
            const precios = {};
            if (row.precios_canales && typeof row.precios_canales === 'object') {
                Object.entries(row.precios_canales).forEach(([canalId, data]) => {
                    precios[canalId] = typeof data === 'number' ? data : (data?.valorCLP || 0);
                });
            }
            return { ok: true, t: { precios, alojamientoId: row.propiedad_id, fechaInicio: fi, fechaTermino: ft } };
        } catch (e) {
            return { drop: 'catch', err: e.message, row };
        }
    });
    const drops = rawMapped.filter((x) => x && !x.ok);
    const allTarifas = rawMapped.filter((x) => x && x.ok).map((x) => x.t);

    const allReservas = reservaRes.rows.map((r) => ({
        alojamientoId: r.propiedad_id,
        fechaLlegada: new Date(r.fecha_llegada),
        fechaSalida: new Date(r.fecha_salida),
    }));
    const allBloqueos = bloqueos.map((b) => ({
        todos: b.todos,
        alojamientoIds: b.alojamientoIds,
        fechaInicio: new Date(b.fechaInicio + 'T00:00:00Z'),
        fechaFin: new Date(b.fechaFin + 'T00:00:00Z'),
    }));

    return { allProperties, allTarifas, allReservas, allBloqueos, drops };
}

async function main() {
    const [, , slug, checkin, checkout] = process.argv;
    if (!pool) {
        console.log('ERROR: PostgreSQL no disponible (DATABASE_URL).');
        process.exit(1);
    }
    if (!slug || !checkin || !checkout) {
        console.log('Uso: node scripts/diag-disponibilidad-ia.js <empresa_id|subdominio> <checkin> <checkout>');
        process.exit(1);
    }

    const inicio = parseISO(`${checkin}T00:00:00Z`);
    const fin = parseISO(`${checkout}T00:00:00Z`);
    if (!isValid(inicio) || !isValid(fin) || inicio >= fin) {
        console.log('ERROR: fechas inválidas');
        process.exit(1);
    }

    const { resolvedId, row: empRow } = await resolveEmpresaPgId(slug);
    console.log('--- Empresa ---');
    console.log('Input:', slug);
    console.log('Resuelto id:', resolvedId);
    console.log('Fila empresas:', empRow || '(no encontrada → se usa input literal en queries)');

    const empresaId = resolvedId;

    const { allProperties, allTarifas, allReservas, allBloqueos, drops } = await fetchAvailabilityPg(empresaId, fin);

    if (drops.length) {
        console.log('\n--- Tarifas descartadas en map (igual que catch en producción) ---');
        console.log('Cantidad:', drops.length);
        drops.slice(0, 5).forEach((d) => console.log(JSON.stringify(d, null, 0).slice(0, 200)));
    }

    console.log('\n--- Conteos (misma carga que API) ---');
    console.log('propiedades activas:', allProperties.length);
    console.log('tarifas mapeadas:', allTarifas.length);

    const strict = buildAvailabilityResultStrictIds(allProperties, allTarifas, allReservas, allBloqueos, inicio, fin);
    const loose = buildAvailabilityResult(allProperties, allTarifas, allReservas, allBloqueos, inicio, fin);

    console.log('\n--- Resultado motor (=== prop.id como en producción) ---');
    console.log('propiedadesConTarifa (solape temporada):', strict.propiedadesConTarifa.length);
    strict.propiedadesConTarifa.forEach((p) => console.log(' ', p.id, p.nombre));
    console.log('disponibles:', strict.availableProperties.length);
    console.log('ocupadas/bloqueadas en rango:', strict.unavailableProperties.length);

    if (strict.propiedadesConTarifa.length === 0 && allProperties.length && allTarifas.length) {
        console.log('\n--- Diagnóstico: por qué 0 propiedadesConTarifa ---');
        const pid = (p) => String(p.id);
        const tid = (t) => String(t.alojamientoId);
        for (const prop of allProperties.slice(0, 5)) {
            const tar = allTarifas.filter((t) => tid(t) === pid(prop));
            const overlap = tar.filter((t) => t.fechaInicio <= fin && t.fechaTermino >= inicio);
            console.log('Prop', pid(prop), 'tarifas misma id:', tar.length, 'con solape:', overlap.length);
            if (tar.length && !overlap.length) {
                const t0 = tar[0];
                console.log(
                    '  ejemplo fechas tarifa:',
                    t0.fechaInicio.toISOString(),
                    t0.fechaTermino.toISOString(),
                    'check rango:',
                    inicio.toISOString(),
                    fin.toISOString()
                );
            }
            if (tar.length && overlap.length) {
                const t0 = overlap[0];
                const eq = t0.alojamientoId === prop.id;
                console.log('  strict === match tarifa vs prop:', eq, 'prop.id type', typeof prop.id, 'tarifa type', typeof t0.alojamientoId);
            }
        }
        if (loose.propiedadesConTarifa.length > 0) {
            console.log('\n*** Si con String() hay coincidencias pero con === no, el bug es tipo UUID vs string en prop.id pisado por metadata.');
            loose.propiedadesConTarifa.forEach((p) => console.log(' ', p.id, p.nombre));
        }
    }

    await pool.end();
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
