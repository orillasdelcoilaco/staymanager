const express = require('express');
const pool = require('../db/postgres');

function registerBookingRoutes({ router, db, deps }) {
    const { obtenerPropiedadPorId, crearReservaPublica } = deps;

    router.get('/reservar', async (req, res) => {
        const empresaId = req.empresa.id;
        const empresaCompleta = req.empresaCompleta;
        try {
            const propiedadIdsQuery = req.query.propiedadId || '';
            const propiedadIds = propiedadIdsQuery.split(',').map((id) => id.trim()).filter(Boolean);
            if (propiedadIds.length === 0 || !req.query.fechaLlegada || !req.query.fechaSalida || !req.query.noches || !req.query.precioFinal || !req.query.personas) {
                return res.status(400).render('404', { title: 'Faltan Datos para Reservar', empresa: empresaCompleta });
            }
            const propiedadesPromises = propiedadIds.map((id) => obtenerPropiedadPorId(db, empresaId, id));
            const propiedadesResult = await Promise.all(propiedadesPromises);
            const propiedades = propiedadesResult.filter(Boolean);
            if (propiedades.length !== propiedadIds.length) {
                return res.status(404).render('404', { title: 'Una o más propiedades no encontradas', empresa: empresaCompleta });
            }
            const isGroupReservation = propiedades.length > 1;
            const dataToRender = isGroupReservation ? propiedades : propiedades[0];
            res.render('reservar', { title: `Completar Reserva | ${empresaCompleta.nombre}`, propiedad: dataToRender, isGroup: isGroupReservation, query: req.query });
        } catch (error) {
            res.status(500).render('404', { title: 'Error Interno del Servidor', empresa: empresaCompleta || { id: empresaId, nombre: 'Error Crítico' } });
        }
    });

    router.post('/crear-reserva-publica', express.json(), async (req, res) => {
        try {
            const empresaId = req.empresa.id;
            if (!empresaId) throw new Error('No se pudo identificar la empresa para la reserva.');
            const reserva = await crearReservaPublica(db, empresaId, req.body);
            res.status(201).json({ reservaId: reserva.idReservaCanal });
        } catch (error) {
            res.status(500).json({ error: error.message || 'Error interno al procesar la reserva.' });
        }
    });

    router.get('/confirmacion', async (req, res) => {
        const empresaId = req.empresa.id;
        const empresaCompleta = req.empresaCompleta;
        try {
            const reservaIdOriginal = req.query.reservaId;
            if (!reservaIdOriginal) return res.status(404).render('404', { title: 'Reserva No Encontrada', empresa: empresaCompleta });
            const { rows: resRows } = await pool.query(
                'SELECT * FROM reservas WHERE empresa_id = $1 AND id_reserva_canal = $2 LIMIT 1',
                [empresaId, reservaIdOriginal]
            );
            if (!resRows[0]) return res.status(404).render('404', { title: 'Reserva No Encontrada', empresa: empresaCompleta });
            const resRow = resRows[0];
            const reservaParaVista = {
                id: reservaIdOriginal,
                fechaLlegada: String(resRow.fecha_llegada).split('T')[0],
                fechaSalida: String(resRow.fecha_salida).split('T')[0],
                precioFinal: resRow.valores?.valorHuesped || 0
            };
            let clienteData = { nombre: resRow.nombre_cliente || 'Cliente' };
            if (resRow.cliente_id) {
                const { rows: cliRows } = await pool.query('SELECT nombre FROM clientes WHERE id = $1 AND empresa_id = $2', [resRow.cliente_id, empresaId]);
                if (cliRows[0]) clienteData = cliRows[0];
            }
            res.render('confirmacion', { title: `Reserva Recibida | ${empresaCompleta.nombre}`, reserva: reservaParaVista, cliente: clienteData });
        } catch (error) {
            res.status(500).render('404', { title: 'Error Interno del Servidor', empresa: empresaCompleta || { id: empresaId, nombre: 'Error Crítico' } });
        }
    });
}

module.exports = { registerBookingRoutes };
