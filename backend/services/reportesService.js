// backend/services/reportesService.js

const pool = require('../db/postgres');
const admin = require('firebase-admin');

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

async function getActividadDiaria(db, empresaId, fechaStr) {
    const fecha = new Date(fechaStr + 'T00:00:00Z');
    if (pool) return _getActividadDiariaPG(empresaId, fecha, fechaStr);

    // Firestore fallback
    const fechaTimestamp = admin.firestore.Timestamp.fromDate(fecha);
    const [propiedadesSnapshot, reservasSnapshot, clientesSnapshot] = await Promise.all([
        db.collection('empresas').doc(empresaId).collection('propiedades').orderBy('nombre', 'asc').get(),
        db.collection('empresas').doc(empresaId).collection('reservas').where('estado', '==', 'Confirmada').get(),
        db.collection('empresas').doc(empresaId).collection('clientes').get(),
    ]);
    if (propiedadesSnapshot.empty) return [];

    const clientesMap = new Map();
    clientesSnapshot.forEach(doc => clientesMap.set(doc.id, doc.data()));

    const propiedades = propiedadesSnapshot.docs.map(doc => doc.data());
    const reservasDelDia = reservasSnapshot.docs.map(doc => doc.data()).filter(r => {
        const llegada = r.fechaLlegada.toDate();
        const salida  = r.fechaSalida.toDate();
        return (llegada <= fecha && salida > fecha) || salida.getTime() === fecha.getTime();
    });

    const reporte = [];
    for (const propiedad of propiedades) {
        const llegadaHoy = reservasDelDia.find(r => r.alojamientoNombre === propiedad.nombre && r.fechaLlegada.toDate().getTime() === fecha.getTime());
        const salidaHoy  = reservasDelDia.find(r => r.alojamientoNombre === propiedad.nombre && r.fechaSalida.toDate().getTime()  === fecha.getTime());
        const enEstadia  = reservasDelDia.find(r => r.alojamientoNombre === propiedad.nombre && r.fechaLlegada.toDate() < fecha && r.fechaSalida.toDate() > fecha);

        const propiedadInfo = { nombre: propiedad.nombre };
        if (salidaHoy) {
            const cliente = clientesMap.get(salidaHoy.clienteId);
            propiedadInfo.salida = {
                cliente:   cliente ? cliente.nombre : 'Cliente no encontrado',
                reservaId: salidaHoy.idReservaCanal,
                fechas:    `${salidaHoy.fechaLlegada.toDate().toLocaleDateString('es-CL', { timeZone: 'UTC' })} al ${salidaHoy.fechaSalida.toDate().toLocaleDateString('es-CL', { timeZone: 'UTC' })}`,
            };
        }
        if (llegadaHoy) {
            const cliente = clientesMap.get(llegadaHoy.clienteId);
            propiedadInfo.llegada = {
                cliente:   cliente ? cliente.nombre : 'Cliente no encontrado',
                reservaId: llegadaHoy.idReservaCanal,
                fechas:    `${llegadaHoy.fechaLlegada.toDate().toLocaleDateString('es-CL', { timeZone: 'UTC' })} al ${llegadaHoy.fechaSalida.toDate().toLocaleDateString('es-CL', { timeZone: 'UTC' })}`,
                canal:     llegadaHoy.canalNombre,
            };
        } else if (enEstadia) {
            const cliente = clientesMap.get(enEstadia.clienteId);
            propiedadInfo.estadia = {
                cliente:   cliente ? cliente.nombre : 'Cliente no encontrado',
                reservaId: enEstadia.idReservaCanal,
                fechas:    `${enEstadia.fechaLlegada.toDate().toLocaleDateString('es-CL', { timeZone: 'UTC' })} al ${enEstadia.fechaSalida.toDate().toLocaleDateString('es-CL', { timeZone: 'UTC' })}`,
            };
        }
        if (!llegadaHoy && !enEstadia && !salidaHoy) {
            const proximaSnap = await db.collection('empresas').doc(empresaId).collection('reservas')
                .where('alojamientoNombre', '==', propiedad.nombre)
                .where('estado', '==', 'Confirmada')
                .where('fechaLlegada', '>=', fechaTimestamp)
                .orderBy('fechaLlegada', 'asc')
                .limit(1)
                .get();
            if (!proximaSnap.empty) {
                const proxima = proximaSnap.docs[0].data();
                const cliente = clientesMap.get(proxima.clienteId);
                const diasFaltantes = Math.ceil((proxima.fechaLlegada.toDate() - fecha) / (1000 * 60 * 60 * 24));
                propiedadInfo.proxima = {
                    fecha:        proxima.fechaLlegada.toDate().toLocaleDateString('es-CL', { timeZone: 'UTC' }),
                    diasFaltantes,
                    cliente:      cliente ? cliente.nombre : 'Cliente no encontrado',
                };
            } else {
                propiedadInfo.estado = 'Libre';
            }
        }
        reporte.push(propiedadInfo);
    }
    return reporte;
}

async function getDisponibilidadPeriodo(db, empresaId, fechaInicioStr, fechaFinStr) {
    const fechaInicio = new Date(fechaInicioStr + 'T00:00:00Z');
    const fechaFin    = new Date(fechaFinStr    + 'T23:59:59Z');

    if (pool) {
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

    // Firestore fallback
    const [propiedadesSnapshot, tarifasSnapshot, reservasSnapshot, canalesSnapshot] = await Promise.all([
        db.collection('empresas').doc(empresaId).collection('propiedades').orderBy('nombre', 'asc').get(),
        db.collection('empresas').doc(empresaId).collection('tarifas').get(),
        db.collection('empresas').doc(empresaId).collection('reservas')
            .where('fechaSalida', '>=', admin.firestore.Timestamp.fromDate(fechaInicio))
            .where('estado', '==', 'Confirmada')
            .get(),
        db.collection('empresas').doc(empresaId).collection('canales').where('esCanalPorDefecto', '==', true).limit(1).get(),
    ]);

    const appCanalId = !canalesSnapshot.empty ? canalesSnapshot.docs[0].id : null;
    const propiedades = propiedadesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const allTarifas  = tarifasSnapshot.docs.map(doc => doc.data());

    return propiedades.map(propiedad => {
        const tarifa = allTarifas
            .filter(t => t.alojamientoId === propiedad.id && t.fechaInicio.toDate() <= fechaFin && t.fechaTermino.toDate() >= fechaInicio)
            .sort((a, b) => b.fechaInicio.toDate() - a.fechaInicio.toDate())[0];
        if (!tarifa) return null;

        const reservasDePropiedad = reservasSnapshot.docs
            .map(doc => doc.data())
            .filter(r => r.alojamientoId === propiedad.id && r.fechaLlegada.toDate() < fechaFin)
            .sort((a, b) => a.fechaLlegada.toDate() - b.fechaLlegada.toDate());

        const periodosDisponibles = [];
        let cursor = new Date(fechaInicio);
        for (const reserva of reservasDePropiedad) {
            const ll = reserva.fechaLlegada.toDate();
            if (cursor < ll) periodosDisponibles.push({ inicio: new Date(cursor), fin: new Date(ll) });
            cursor = new Date(Math.max(cursor.getTime(), reserva.fechaSalida.toDate().getTime()));
        }
        if (cursor < fechaFin) periodosDisponibles.push({ inicio: new Date(cursor), fin: new Date(fechaFin) });

        const valor = appCanalId && tarifa.precios && tarifa.precios[appCanalId] ? tarifa.precios[appCanalId].valor : 0;
        return {
            nombre:    propiedad.nombre,
            link:      propiedad.linkFotos || '',
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
