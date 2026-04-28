const express = require('express');
const pool = require('../db/postgres');
const { mergeEffectiveRules, buildHouseRulesPublicView } = require('../services/houseRulesService');
const { normalizeBookingUrlForSsr } = require('../services/bookingSettingsSanitize');
const { resolveDepositoReservaWeb } = require('../services/depositoReservaWebService');

function registerBookingRoutes({ router, db, deps }) {
    const { obtenerPropiedadPorId, crearReservaPublica } = deps;
    const _toIsoYmd = (v) => {
        if (!v) return '';
        if (v instanceof Date && !Number.isNaN(v.getTime())) return v.toISOString().slice(0, 10);
        const s = String(v).trim();
        const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
        if (m) return m[1];
        const d = new Date(s);
        return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
    };

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
            const precioFinalNum = Math.max(0, Math.round(Number(req.query.precioFinal) || 0));
            const depositoReserva = resolveDepositoReservaWeb(
                empresaCompleta.websiteSettings?.booking,
                precioFinalNum
            );
            const propiedadNormasRef = propiedades[0];
            const reglasMerged = mergeEffectiveRules(
                empresaCompleta.websiteSettings?.houseRules,
                propiedadNormasRef.normasAlojamiento || {}
            );
            const reglasVista = buildHouseRulesPublicView(reglasMerged, propiedadNormasRef.capacidad);
            const htmlLang = empresaCompleta.websiteSettings?.email?.idiomaPorDefecto === 'en' ? 'en' : 'es';
            res.render('reservar', {
                title: `Completar Reserva | ${empresaCompleta.nombre}`,
                propiedad: dataToRender,
                isGroup: isGroupReservation,
                query: req.query,
                reglasVista,
                depositoReserva,
                htmlLang,
            });
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
            const status = Number(error.statusCode) || 500;
            const body = { error: error.message || 'Error interno al procesar la reserva.' };
            if (error.code) body.code = String(error.code);
            if (Array.isArray(error.details) && error.details.length) {
                body.details = error.details;
            }
            res.status(status).json(body);
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
            const valores = (() => {
                if (resRow.valores && typeof resRow.valores === 'object') return resRow.valores;
                if (typeof resRow.valores === 'string') {
                    try { return JSON.parse(resRow.valores); } catch { return {}; }
                }
                return {};
            })();
            const reservaParaVista = {
                id: reservaIdOriginal,
                fechaLlegada: _toIsoYmd(resRow.fecha_llegada),
                fechaSalida: _toIsoYmd(resRow.fecha_salida),
                precioFinal: Number(valores.valorHuesped) || 0,
                alojamientoNombre: String(resRow.alojamiento_nombre || '').trim(),
                totalNoches: Number(resRow.total_noches) || 0,
                cantidadHuespedes: Number(resRow.cantidad_huespedes) || 0,
            };
            let clienteData = { nombre: resRow.nombre_cliente || 'Cliente' };
            if (resRow.cliente_id) {
                const { rows: cliRows } = await pool.query('SELECT nombre FROM clientes WHERE id = $1 AND empresa_id = $2', [resRow.cliente_id, empresaId]);
                if (cliRows[0]) clienteData = cliRows[0];
            }
            const bk = empresaCompleta.websiteSettings?.booking || {};
            const depositoReserva = resolveDepositoReservaWeb(
                bk,
                Number(reservaParaVista.precioFinal) || 0
            );
            const htmlLang = empresaCompleta.websiteSettings?.email?.idiomaPorDefecto === 'en' ? 'en' : 'es';
            const guestBookingLinks = {
                manualHuespedUrl: normalizeBookingUrlForSsr(bk.manualHuespedUrl),
                manualHuespedPdfUrl: normalizeBookingUrlForSsr(bk.manualHuespedPdfUrl),
                checkinOnlineUrl: normalizeBookingUrlForSsr(bk.checkinOnlineUrl),
            };
            res.render('confirmacion', {
                title: `Reserva Recibida | ${empresaCompleta.nombre}`,
                reserva: reservaParaVista,
                cliente: clienteData,
                htmlLang,
                guestBookingLinks,
                depositoReserva,
            });
        } catch (error) {
            res.status(500).render('404', { title: 'Error Interno del Servidor', empresa: empresaCompleta || { id: empresaId, nombre: 'Error Crítico' } });
        }
    });
}

module.exports = { registerBookingRoutes };
