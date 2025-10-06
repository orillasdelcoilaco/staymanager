// backend/services/reportesService.js

const admin = require('firebase-admin');

async function getActividadDiaria(db, empresaId, fechaStr) {
    const fecha = new Date(fechaStr + 'T00:00:00Z');
    const fechaTimestamp = admin.firestore.Timestamp.fromDate(fecha);

    const [propiedadesSnapshot, reservasSnapshot, clientesSnapshot] = await Promise.all([
        db.collection('empresas').doc(empresaId).collection('propiedades').orderBy('nombre', 'asc').get(),
        db.collection('empresas').doc(empresaId).collection('reservas')
          .where('estado', '==', 'Confirmada').get(),
        db.collection('empresas').doc(empresaId).collection('clientes').get()
    ]);

    if (propiedadesSnapshot.empty) {
        return [];
    }

    const clientesMap = new Map();
    clientesSnapshot.forEach(doc => {
        clientesMap.set(doc.id, doc.data());
    });

    const propiedades = propiedadesSnapshot.docs.map(doc => doc.data());
    const reporte = [];

    const reservasDelDia = reservasSnapshot.docs.map(doc => doc.data()).filter(r => {
        const llegada = r.fechaLlegada.toDate();
        const salida = r.fechaSalida.toDate();
        return (llegada <= fecha && salida > fecha) || salida.getTime() === fecha.getTime();
    });

    for (const propiedad of propiedades) {
        const llegadaHoy = reservasDelDia.find(r => r.alojamientoNombre === propiedad.nombre && r.fechaLlegada.toDate().getTime() === fecha.getTime());
        const salidaHoy = reservasDelDia.find(r => r.alojamientoNombre === propiedad.nombre && r.fechaSalida.toDate().getTime() === fecha.getTime());
        const enEstadia = reservasDelDia.find(r => r.alojamientoNombre === propiedad.nombre && r.fechaLlegada.toDate() < fecha && r.fechaSalida.toDate() > fecha);

        const propiedadInfo = { nombre: propiedad.nombre };

        if (salidaHoy) {
            const cliente = clientesMap.get(salidaHoy.clienteId);
            propiedadInfo.salida = {
                cliente: cliente ? cliente.nombre : 'Cliente no encontrado',
                reservaId: salidaHoy.idReservaCanal,
                fechas: `${salidaHoy.fechaLlegada.toDate().toLocaleDateString('es-CL', { timeZone: 'UTC' })} al ${salidaHoy.fechaSalida.toDate().toLocaleDateString('es-CL', { timeZone: 'UTC' })}`
            };
        }

        if (llegadaHoy) {
            const cliente = clientesMap.get(llegadaHoy.clienteId);
            propiedadInfo.llegada = {
                cliente: cliente ? cliente.nombre : 'Cliente no encontrado',
                reservaId: llegadaHoy.idReservaCanal,
                fechas: `${llegadaHoy.fechaLlegada.toDate().toLocaleDateString('es-CL', { timeZone: 'UTC' })} al ${llegadaHoy.fechaSalida.toDate().toLocaleDateString('es-CL', { timeZone: 'UTC' })}`,
                canal: llegadaHoy.canalNombre
            };
        } else if (enEstadia) {
            const cliente = clientesMap.get(enEstadia.clienteId);
            propiedadInfo.estadia = {
                cliente: cliente ? cliente.nombre : 'Cliente no encontrado',
                reservaId: enEstadia.idReservaCanal,
                fechas: `${enEstadia.fechaLlegada.toDate().toLocaleDateString('es-CL', { timeZone: 'UTC' })} al ${enEstadia.fechaSalida.toDate().toLocaleDateString('es-CL', { timeZone: 'UTC' })}`
            };
        }

        if (!llegadaHoy && !enEstadia && !salidaHoy) {
             const proximaReservaSnapshot = await db.collection('empresas').doc(empresaId).collection('reservas')
                .where('alojamientoNombre', '==', propiedad.nombre)
                .where('estado', '==', 'Confirmada')
                .where('fechaLlegada', '>=', fechaTimestamp)
                .orderBy('fechaLlegada', 'asc')
                .limit(1)
                .get();
            
            if (!proximaReservaSnapshot.empty) {
                const proxima = proximaReservaSnapshot.docs[0].data();
                const cliente = clientesMap.get(proxima.clienteId);
                const diasFaltantes = Math.ceil((proxima.fechaLlegada.toDate() - fecha) / (1000 * 60 * 60 * 24));
                propiedadInfo.proxima = {
                    fecha: proxima.fechaLlegada.toDate().toLocaleDateString('es-CL', { timeZone: 'UTC' }),
                    diasFaltantes: diasFaltantes,
                    cliente: cliente ? cliente.nombre : 'Cliente no encontrado'
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
    const fechaFin = new Date(fechaFinStr + 'T23:59:59Z');

    const [propiedadesSnapshot, tarifasSnapshot, reservasSnapshot, canalesSnapshot] = await Promise.all([
        db.collection('empresas').doc(empresaId).collection('propiedades').orderBy('nombre', 'asc').get(),
        db.collection('empresas').doc(empresaId).collection('tarifas').get(),
        db.collection('empresas').doc(empresaId).collection('reservas')
            .where('fechaSalida', '>=', admin.firestore.Timestamp.fromDate(fechaInicio))
            .where('estado', '==', 'Confirmada')
            .get(),
        db.collection('empresas').doc(empresaId).collection('canales').where('nombre', '==', 'App').limit(1).get()
    ]);

    const appCanalId = !canalesSnapshot.empty ? canalesSnapshot.docs[0].id : null;

    const propiedades = propiedadesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const allTarifas = tarifasSnapshot.docs.map(doc => doc.data());

    const reporte = propiedades.map(propiedad => {
        const tarifa = allTarifas
            .filter(t => t.alojamientoId === propiedad.id && t.fechaInicio.toDate() <= fechaFin && t.fechaTermino.toDate() >= fechaInicio)
            .sort((a, b) => b.fechaInicio.toDate() - a.fechaInicio.toDate())[0];

        if (!tarifa) {
            return null;
        }

        const reservasDePropiedad = reservasSnapshot.docs
            .map(doc => doc.data())
            .filter(r => r.alojamientoId === propiedad.id && r.fechaLlegada.toDate() < fechaFin)
            .sort((a, b) => a.fechaLlegada.toDate() - b.fechaLlegada.toDate());

        const periodosDisponibles = [];
        let cursorFecha = new Date(fechaInicio);

        reservasDePropiedad.forEach(reserva => {
            const llegada = reserva.fechaLlegada.toDate();
            if (cursorFecha < llegada) {
                periodosDisponibles.push({ inicio: new Date(cursorFecha), fin: new Date(llegada) });
            }
            cursorFecha = new Date(Math.max(cursorFecha, reserva.fechaSalida.toDate()));
        });

        if (cursorFecha < fechaFin) {
            periodosDisponibles.push({ inicio: new Date(cursorFecha), fin: new Date(fechaFin) });
        }
        
        const valor = appCanalId && tarifa.precios && tarifa.precios[appCanalId] ? tarifa.precios[appCanalId].valor : 0;

        return {
            nombre: propiedad.nombre,
            link: propiedad.linkFotos || '',
            valor: valor,
            capacidad: propiedad.capacidad,
            periodos: periodosDisponibles.map(p => ({
                inicio: p.inicio.toISOString().split('T')[0],
                fin: p.fin.toISOString().split('T')[0]
            }))
        };
    }).filter(Boolean);
    
    return reporte;
}


module.exports = {
    getActividadDiaria,
    getDisponibilidadPeriodo
};