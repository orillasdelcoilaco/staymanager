const express = require('express');
const { parseISO, isValid, differenceInDays } = require('date-fns');
const { renderPropiedadPublica } = require('./website.property.page');
const { obtenerValorDolar } = require('../services/dolarService');
const pool = require('../db/postgres');
const { calcularComparadorOtaTotales } = require('../services/comparadorOtaService');
const { buildHeatmapForRange, minNochesLlegadaParaFecha } = require('../services/heatmapRestriccionesService');

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

    // Ocupación + heatmap: siempre scoped al tenant (req.empresa.id) y propiedad validada con empresa_id en PG.
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
            let heatmap = [];
            if (canalPorDefectoId) {
                nightly = computeNightlyPricesForRange(propiedadId, from, to, allTarifas, canalPorDefectoId);
                if (canalMoneda === 'USD') {
                    valorDolarDia = await obtenerValorDolar(db, empresaId, parseISO(`${from}T12:00:00`));
                }
            }
            const bookingCfg = req.empresaCompleta?.websiteSettings?.booking || {};
            heatmap = buildHeatmapForRange(bookingCfg, from, to);
            res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=120');
            res.json({
                ...data,
                nightly,
                heatmap,
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
            const minBase = Math.max(1, parseInt(String(
                propiedad?.websiteData?.booking?.minNoches
                ?? req.empresaCompleta?.websiteSettings?.booking?.minNoches
                ?? '1'
            ), 10) || 1);
            const bookingCfg = req.empresaCompleta?.websiteSettings?.booking || {};
            const minHeat = minNochesLlegadaParaFecha(bookingCfg, fechaLlegada);
            const minNoches = Math.max(minBase, minHeat);
            if (differenceInDays(endDate, startDate) < minNoches) {
                const extra = minHeat > minBase
                    ? ' (incluye noches mínimas por periodo de mayor demanda para esa llegada).'
                    : '';
                return res.status(400).json({ error: `La estadía debe ser de al menos ${minNoches} noche(s).${extra}` });
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
                totalPrecioListaCLP: pricing.totalPrecioListaCLP ?? null,
                totalDescuentoPromoCLP: pricing.totalDescuentoPromoCLP ?? null,
                promoEtiqueta: pricing.promoEtiqueta ?? null,
            });
        } catch (error) {
            console.error(`Error calculando precio AJAX para propiedad ${req.params.id}:`, error);
            res.status(500).json({ error: error.message || 'Error interno al calcular precio.' });
        }
    });

    router.get('/propiedad/:id/comparador-ota.json', async (req, res) => {
        try {
            const empresaId = req.empresa?.id;
            if (!empresaId) return res.status(400).json({ error: 'Empresa no resuelta.' });
            const propiedadId = req.params.id;
            const fechaLlegada = String(req.query.fechaLlegada || '').trim();
            const fechaSalida = String(req.query.fechaSalida || '').trim();
            const canalIdQuery = String(req.query.canalId || '').trim();
            if (!fechaLlegada || !fechaSalida) {
                return res.status(400).json({ error: 'Parámetros fechaLlegada y fechaSalida son requeridos.' });
            }
            const startDate = parseISO(`${fechaLlegada}T00:00:00Z`);
            const endDate = parseISO(`${fechaSalida}T00:00:00Z`);
            if (!isValid(startDate) || !isValid(endDate) || endDate <= startDate) {
                return res.status(400).json({ error: 'Fechas inválidas.' });
            }

            const propiedad = await obtenerPropiedadPorId(db, empresaId, propiedadId);
            if (!propiedad) return res.status(404).json({ error: 'Propiedad no encontrada' });
            const { allTarifas } = await fetchTarifasYCanal(empresaId);

            const { rows: canalesRows } = await pool.query(
                `SELECT id, nombre, COALESCE(metadata->>'moneda', 'CLP') AS moneda,
                        COALESCE((metadata->>'esCanalPorDefecto')::boolean, false) AS es_canal_por_defecto
                 FROM canales
                 WHERE empresa_id = $1
                 ORDER BY CASE WHEN (metadata->>'esCanalPorDefecto')::boolean THEN 0 ELSE 1 END, nombre ASC`,
                [empresaId],
            );
            const canales = canalesRows.map((r) => ({
                id: r.id,
                nombre: r.nombre,
                moneda: r.moneda || 'CLP',
                esCanalPorDefecto: !!r.es_canal_por_defecto,
            }));
            const canalDirecto = canales.find((c) => c.esCanalPorDefecto);
            if (!canalDirecto) {
                return res.status(400).json({ error: 'No hay canal por defecto configurado.' });
            }
            const canalComparado = canalIdQuery
                ? canales.find((c) => c.id === canalIdQuery && c.id !== canalDirecto.id)
                : canales.find((c) => c.id !== canalDirecto.id);
            if (!canalComparado) {
                return res.status(400).json({ error: 'No hay canal comparado disponible.' });
            }

            const cmp = calcularComparadorOtaTotales({
                allTarifas,
                propiedadId,
                startDate,
                endDate,
                canalDirectoId: canalDirecto.id,
                canalComparadoId: canalComparado.id,
            });
            if (!cmp.ok) {
                return res.status(400).json({ error: cmp.error || 'No se pudo calcular comparador OTA.' });
            }

            const comparableComplete = cmp.nochesSinTarifaComparada === 0;
            const monitorEvent = {
                event: 'comparador_ota_consulta',
                empresaId: String(empresaId),
                propiedadId: String(propiedad.id),
                fechaLlegada,
                fechaSalida,
                noches: cmp.nights,
                canalDirectoId: canalDirecto.id,
                canalComparadoId: canalComparado.id,
                comparableComplete,
                nochesSinTarifaComparada: cmp.nochesSinTarifaComparada,
                ahorroCLP: cmp.ahorroCLP,
                ahorroPctSobreComparado: cmp.pctSobreComparado,
                requestedAt: new Date().toISOString(),
            };
            console.log('[comparador-ota]', JSON.stringify(monitorEvent));
            return res.json({
                ok: true,
                propiedad: { id: propiedad.id, nombre: propiedad.nombre || '' },
                rango: { fechaLlegada, fechaSalida, noches: cmp.nights },
                canalDirecto: { id: canalDirecto.id, nombre: canalDirecto.nombre, moneda: canalDirecto.moneda },
                canalComparado: { id: canalComparado.id, nombre: canalComparado.nombre, moneda: canalComparado.moneda },
                canalesComparables: canales
                    .filter((c) => c.id !== canalDirecto.id)
                    .map((c) => ({ id: c.id, nombre: c.nombre, moneda: c.moneda })),
                totales: {
                    directoCLP: cmp.totalDirectoCLP,
                    comparadoCLP: cmp.totalComparadoCLP,
                    ahorroCLP: cmp.ahorroCLP,
                    ahorroPctSobreComparado: cmp.pctSobreComparado,
                },
                comparableComplete,
                nochesSinTarifaComparada: cmp.nochesSinTarifaComparada,
                // Referencia para UI/copy: no reemplaza ninguna fuente financiera persistida.
                disclaimer: 'Comparador referencial para decisión comercial; no modifica valores de reservas.',
                legalCopy:
                    'Comparación estimada entre canales para las fechas seleccionadas. Puede variar por disponibilidad, promociones, comisiones, impuestos o condiciones comerciales externas.',
            });
        } catch (error) {
            console.error(`Error comparador OTA propiedad ${req.params.id}:`, error);
            return res.status(500).json({ error: error.message || 'Error interno al calcular comparador OTA.' });
        }
    });
}

module.exports = { registerPropertyRoutes };
