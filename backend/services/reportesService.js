// backend/services/reportesService.js

const pool = require('../db/postgres');

function _clasificarReservaPG(reservasDelDia, propiedad, fechaTime) {
    const enPropiedad = r => r.propiedad_id === propiedad.id;
    return {
        llegadaHoy: reservasDelDia.find(r => enPropiedad(r) && new Date(r.fecha_llegada).getTime() === fechaTime),
        salidaHoy:  reservasDelDia.find(r => enPropiedad(r) && new Date(r.fecha_salida).getTime()  === fechaTime),
        enEstadia:  reservasDelDia.find(r => enPropiedad(r) && new Date(r.fecha_llegada).getTime() < fechaTime && new Date(r.fecha_salida).getTime() > fechaTime),
    };
}

function _fmtFechasPG(r) {
    return `${new Date(r.fecha_llegada).toLocaleDateString('es-CL', { timeZone: 'UTC' })} al ${new Date(r.fecha_salida).toLocaleDateString('es-CL', { timeZone: 'UTC' })}`;
}

async function _getActividadDiariaPG(empresaId, fecha, fechaStr) {
    const [{ rows: propiedades }, { rows: reservas }, { rows: clientes }] = await Promise.all([
        pool.query('SELECT id, nombre FROM propiedades WHERE empresa_id = $1 AND activo = true ORDER BY nombre ASC', [empresaId]),
        pool.query(
            `SELECT r.id, r.id_reserva_canal, r.propiedad_id, r.canal_nombre, r.cliente_id, r.fecha_llegada, r.fecha_salida
             FROM reservas r WHERE r.empresa_id = $1 AND r.estado = 'Confirmada' AND r.fecha_salida >= $2`,
            [empresaId, fechaStr]
        ),
        pool.query('SELECT id, nombre FROM clientes WHERE empresa_id = $1', [empresaId]),
    ]);
    if (!propiedades.length) return [];

    const clientesMap  = new Map(clientes.map(c => [c.id, c]));
    const fechaTime    = fecha.getTime();
    const reservasDelDia = reservas.filter(r => {
        const ll = new Date(r.fecha_llegada).getTime();
        const sa = new Date(r.fecha_salida).getTime();
        return (ll <= fechaTime && sa > fechaTime) || sa === fechaTime;
    });

    const reporte = [];
    for (const propiedad of propiedades) {
        const { llegadaHoy, salidaHoy, enEstadia } = _clasificarReservaPG(reservasDelDia, propiedad, fechaTime);
        const propiedadInfo = { nombre: propiedad.nombre };

        if (salidaHoy) {
            const c = clientesMap.get(salidaHoy.cliente_id);
            propiedadInfo.salida = { cliente: c ? c.nombre : 'Cliente no encontrado', reservaId: salidaHoy.id_reserva_canal, fechas: _fmtFechasPG(salidaHoy) };
        }
        if (llegadaHoy) {
            const c = clientesMap.get(llegadaHoy.cliente_id);
            propiedadInfo.llegada = { cliente: c ? c.nombre : 'Cliente no encontrado', reservaId: llegadaHoy.id_reserva_canal, fechas: _fmtFechasPG(llegadaHoy), canal: llegadaHoy.canal_nombre };
        } else if (enEstadia) {
            const c = clientesMap.get(enEstadia.cliente_id);
            propiedadInfo.estadia = { cliente: c ? c.nombre : 'Cliente no encontrado', reservaId: enEstadia.id_reserva_canal, fechas: _fmtFechasPG(enEstadia) };
        }

        if (!llegadaHoy && !enEstadia && !salidaHoy) {
            const { rows: proximas } = await pool.query(
                `SELECT id_reserva_canal, cliente_id, fecha_llegada FROM reservas
                 WHERE empresa_id = $1 AND propiedad_id = $2 AND estado = 'Confirmada' AND fecha_llegada >= $3
                 ORDER BY fecha_llegada ASC LIMIT 1`,
                [empresaId, propiedad.id, fechaStr]
            );
            if (proximas.length) {
                const c = clientesMap.get(proximas[0].cliente_id);
                propiedadInfo.proxima = {
                    fecha: new Date(proximas[0].fecha_llegada).toLocaleDateString('es-CL', { timeZone: 'UTC' }),
                    diasFaltantes: Math.ceil((new Date(proximas[0].fecha_llegada).getTime() - fechaTime) / (1000 * 60 * 60 * 24)),
                    cliente: c ? c.nombre : 'Cliente no encontrado',
                };
            } else {
                propiedadInfo.estado = 'Libre';
            }
        }
        reporte.push(propiedadInfo);
    }
    return reporte;
}

async function getActividadDiaria(_db, empresaId, fechaStr) {
    const fecha = new Date(fechaStr + 'T00:00:00Z');
    return _getActividadDiariaPG(empresaId, fecha, fechaStr);
}

async function getDisponibilidadPeriodo(_db, empresaId, fechaInicioStr, fechaFinStr) {
    const fechaInicio = new Date(fechaInicioStr + 'T00:00:00Z');
    const fechaFin    = new Date(fechaFinStr    + 'T23:59:59Z');

    const [{ rows: propiedades }, { rows: tarifas }, { rows: reservas }, { rows: canales }] = await Promise.all([
        pool.query(
            'SELECT id, nombre, capacidad, metadata FROM propiedades WHERE empresa_id = $1 AND activo = true ORDER BY nombre ASC',
            [empresaId]
        ),
        pool.query('SELECT * FROM tarifas WHERE empresa_id = $1', [empresaId]),
        pool.query(
            `SELECT propiedad_id, fecha_llegada, fecha_salida
             FROM reservas
             WHERE empresa_id = $1 AND estado = 'Confirmada' AND fecha_salida >= $2`,
            [empresaId, fechaInicioStr]
        ),
        pool.query(
            `SELECT id FROM canales WHERE empresa_id = $1 AND (metadata->>'esCanalPorDefecto')::boolean = true LIMIT 1`,
            [empresaId]
        ),
    ]);

    const appCanalId = canales[0]?.id || null;

    return propiedades.map(propiedad => {
        const tarifa = tarifas
            .filter(t => {
                const reglas = t.reglas || {};
                return t.propiedad_id === propiedad.id
                    && reglas.fechaInicio && new Date(reglas.fechaInicio + 'T00:00:00Z') <= fechaFin
                    && reglas.fechaTermino && new Date(reglas.fechaTermino + 'T00:00:00Z') >= fechaInicio;
            })
            .sort((a, b) => new Date(b.reglas.fechaInicio) - new Date(a.reglas.fechaInicio))[0];

        if (!tarifa) return null;

        const reservasDePropiedad = reservas
            .filter(r => r.propiedad_id === propiedad.id && new Date(r.fecha_llegada) < fechaFin)
            .sort((a, b) => new Date(a.fecha_llegada) - new Date(b.fecha_llegada));

        const periodosDisponibles = [];
        let cursor = new Date(fechaInicio);
        for (const r of reservasDePropiedad) {
            const ll = new Date(r.fecha_llegada);
            if (cursor < ll) periodosDisponibles.push({ inicio: new Date(cursor), fin: new Date(ll) });
            cursor = new Date(Math.max(cursor.getTime(), new Date(r.fecha_salida).getTime()));
        }
        if (cursor < fechaFin) periodosDisponibles.push({ inicio: new Date(cursor), fin: new Date(fechaFin) });

        const reglas = tarifa.reglas || {};
        const valor  = appCanalId && reglas.precios?.[appCanalId] ? reglas.precios[appCanalId].valor : 0;

        return {
            nombre:    propiedad.nombre,
            link:      propiedad.metadata?.linkFotos || '',
            valor,
            capacidad: propiedad.capacidad,
            periodos:  periodosDisponibles.map(p => ({
                inicio: p.inicio.toISOString().split('T')[0],
                fin:    p.fin.toISOString().split('T')[0],
            })),
        };
    }).filter(Boolean);
}

module.exports = { getActividadDiaria, getDisponibilidadPeriodo };
