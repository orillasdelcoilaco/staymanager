const express = require('express');
const { parseISO, isValid, differenceInDays } = require('date-fns');
const { renderPropiedadPublica } = require('./website.property.page');
const { obtenerValorDolar } = require('../services/dolarService');

function registerPropertyRoutes({ router, db, deps }) {
    const {
        obtenerPropiedadPorId,
        calculatePrice,
        obtenerResenas,
        hydrateInventory,
        fetchTarifasYCanal,
        obtenerOcupacionCalendarioPropiedad,
        computeNightlyPricesForRange,
    } = deps;

    router.get('/propiedad/:id/calendario-ocupacion', async (req, res) => {
        try {
            const empresaId = req.empresa?.id;
            if (!empresaId) return res.status(400).json({ error: 'Empresa no resuelta.' });
            const propiedadId = req.params.id;
            const { from, to } = req.query;
            if (!from || !to) return res.status(400).json({ error: 'Parámetros from y to (YYYY-MM-DD) son requeridos.' });
            const propiedad = await obtenerPropiedadPorId(db, empresaId, propiedadId);
            if (!propiedad) return res.status(404).json({ error: 'Propiedad no encontrada' });
            const [data, { allTarifas, canalPorDefectoId, canalMoneda }] = await Promise.all([
                obtenerOcupacionCalendarioPropiedad(empresaId, propiedadId, from, to),
                fetchTarifasYCanal(empresaId),
            ]);
            let nightly = [];
            let valorDolarDia = null;
            if (canalPorDefectoId) {
                nightly = computeNightlyPricesForRange(propiedadId, from, to, allTarifas, canalPorDefectoId);
                if (canalMoneda === 'USD') {
                    valorDolarDia = await obtenerValorDolar(db, empresaId, parseISO(`${from}T12:00:00`));
                }
            }
            res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=120');
            res.json({
                ...data,
                nightly,
                currency: canalMoneda || 'CLP',
                valorDolarDia,
            });
        } catch (error) {
            console.error(`Error calendario-ocupacion ${req.params.id}:`, error);
            res.status(500).json({ error: error.message || 'Error interno.' });
        }
    });

    router.get('/propiedad/:id', async (req, res) => {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        await renderPropiedadPublica(req, res, db, deps);
    });

    router.get('/propiedad/:id/json', async (req, res) => {
        const empresaId = req.empresaCompleta.id;
        const propiedadId = req.params.id;
        try {
            const propiedad = await obtenerPropiedadPorId(db, empresaId, propiedadId);
            if (!propiedad) return res.status(404).json({ error: 'Propiedad no encontrada' });
            const aiContext = hydrateInventory(propiedad.componentes || []);
            res.status(200).json({ ...propiedad, ai_context: aiContext, _meta: { generated_at: new Date().toISOString(), version: '1.0.0' } });
        } catch (error) {
            console.error(`Error al obtener JSON de propiedad ${propiedadId}:`, error);
            res.status(500).json({ error: 'Error interno del servidor' });
        }
    });

    router.post('/propiedad/:id/calcular-precio', express.json(), async (req, res) => {
        try {
            const empresaId = req.empresa.id;
            if (!empresaId) throw new Error('ID de empresa no encontrado en la solicitud.');
            const propiedadId = req.params.id;
            const { fechaLlegada, fechaSalida } = req.body;
            if (!fechaLlegada || !fechaSalida || new Date(fechaSalida) <= new Date(fechaLlegada)) return res.status(400).json({ error: 'Fechas inválidas.' });
            const propiedad = await obtenerPropiedadPorId(db, empresaId, propiedadId);
            if (!propiedad) return res.status(404).json({ error: 'Propiedad no encontrada' });
            const startDate = parseISO(fechaLlegada + 'T00:00:00Z');
            const endDate = parseISO(fechaSalida + 'T00:00:00Z');
            if (!isValid(startDate) || !isValid(endDate)) return res.status(400).json({ error: 'Fechas inválidas.' });
            const minNoches = Math.max(1, parseInt(String(
                propiedad?.websiteData?.booking?.minNoches
                ?? req.empresaCompleta?.websiteSettings?.booking?.minNoches
                ?? '1'
            ), 10) || 1);
            if (differenceInDays(endDate, startDate) < minNoches) {
                return res.status(400).json({ error: `La estadía debe ser de al menos ${minNoches} noche(s).` });
            }
            const { allTarifas, canalPorDefectoId: defCanal } = await fetchTarifasYCanal(empresaId);
            if (!defCanal) throw new Error('No hay canal por defecto configurado.');
            const pricing = await calculatePrice(db, empresaId, [propiedad], startDate, endDate, allTarifas);
            res.json({
                totalPrice: pricing.totalPriceCLP,
                numNoches: pricing.nights,
                formattedTotalPrice: `$${(pricing.totalPriceCLP || 0).toLocaleString('es-CL')} CLP`,
                currencyOriginal: pricing.currencyOriginal || 'CLP',
                totalPriceOriginal: pricing.totalPriceOriginal ?? null,
                valorDolarDia: pricing.valorDolarDia ?? null,
            });
        } catch (error) {
            console.error(`Error calculando precio AJAX para propiedad ${req.params.id}:`, error);
            res.status(500).json({ error: error.message || 'Error interno al calcular precio.' });
        }
    });
}

module.exports = { registerPropertyRoutes };
