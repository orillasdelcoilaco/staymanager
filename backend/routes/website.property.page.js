const { differenceInMonths, differenceInYears } = require('date-fns');
const { resolvePublicStayDates, computeHostingDurationLabel } = require('./website.property.helpers');
const { obtenerMasAlojamientosParaFichaSSR } = require('../services/publicWebsiteService');
const { mergeEffectiveRules, buildHouseRulesPublicView, patchJsonLdWithHouseRules } = require('../services/houseRulesService');

/** Evita tarjetas duplicadas en SSR (ids repetidos o mismo huésped/texto por datos viejos). */
function dedupeResenasLista(rows) {
    if (!Array.isArray(rows)) return [];
    const out = [];
    const seenId = new Set();
    const seenFp = new Set();
    for (const r of rows) {
        const rid = r.id != null ? String(r.id) : '';
        if (rid && seenId.has(rid)) continue;
        if (rid) seenId.add(rid);
        const name = String(r.cliente_nombre || r.nombre_huesped || '').trim();
        const txt = String(r.texto_positivo || r.texto_negativo || '').slice(0, 240);
        const fp = `${name}|${txt}|${r.punt_general}|${String(r.propiedad_id || '')}`;
        if (seenFp.has(fp)) continue;
        seenFp.add(fp);
        out.push(r);
    }
    return out;
}

function buildEmpresaAreasComunesGallery(empresa, propiedad) {
    const conf = empresa?.areas_comunes || {};
    if (!conf.activo) return [];
    const espacios = Array.isArray(conf.espacios) ? conf.espacios : [];
    const selectedIds = Array.isArray(propiedad?.areas_comunes_ids) ? propiedad.areas_comunes_ids : [];
    if (!espacios.length || !selectedIds.length) return [];

    const selectedSet = new Set(selectedIds.map((id) => String(id)));
    const out = [];
    let orderBase = 10000;
    espacios.forEach((area) => {
        const areaId = String(area?.id || '').trim();
        if (!areaId || !selectedSet.has(areaId)) return;
        const areaNombre = String(area?.nombre || 'Espacio común').trim();
        const fotos = Array.isArray(area?.fotos) ? area.fotos : [];
        fotos.forEach((foto, idx) => {
            const storagePath = String(foto?.storageUrl || foto?.storagePath || '').trim();
            if (!storagePath) return;
            const altText = String(foto?.altText || '').trim();
            out.push({
                id: `ac-${areaId}-${foto?.id || idx}`,
                imageId: `ac-${areaId}-${foto?.id || idx}`,
                storagePath,
                storageUrl: storagePath,
                thumbnailUrl: String(foto?.thumbnailUrl || storagePath),
                altText: altText || areaNombre,
                title: `${areaNombre} - ${altText || 'Espacio común'}`,
                description: altText || '',
                espacio: areaNombre,
                espacioId: `area-comun-${areaId}`,
                orden: orderBase + idx,
                areaComun: true,
                areaComunId: areaId
            });
        });
        orderBase += 100;
    });

    return out;
}

/**
 * GET /propiedad/:id — render ficha pública.
 */
async function renderPropiedadPublica(req, res, db, deps) {
    const {
        obtenerPropiedadPorId,
        calculatePrice,
        obtenerResumenResenas,
        obtenerResumenPorPropiedad,
        obtenerResenas,
        getGaleria,
        fetchTarifasYCanal,
        getPrecioBaseNoche,
        formatDateForInput,
        getNextWeekend
    } = deps;

    const empresaCompleta = req.empresaCompleta;
    const empresaId = empresaCompleta.id;
    const propiedadId = req.params.id;

    try {
        const propiedad = await obtenerPropiedadPorId(db, empresaId, propiedadId);
        if (!propiedad || !propiedad.googleHotelData?.isListed) {
            return res.status(404).render('404', { title: 'Propiedad No Encontrada', empresa: empresaCompleta });
        }

        const { allTarifas, canalPorDefectoId } = await fetchTarifasYCanal(empresaId);
        const weekendDates = getNextWeekend();
        const { checkinDate, checkoutDate, isDefaultWeekend } = resolvePublicStayDates(
            req,
            weekendDates.llegada,
            weekendDates.salida
        );

        let personas = parseInt(req.query.personas || req.query.adults, 10);
        if (!personas || isNaN(personas) || personas <= 0) personas = Math.min(2, propiedad.capacidad || 1);
        else personas = Math.min(personas, propiedad.capacidad);

        let priceData = { totalPriceCLP: 0, nights: 0, formattedTotalPrice: 'Consulta fechas' };
        if (canalPorDefectoId) {
            try {
                const p = await calculatePrice(db, empresaId, [propiedad], checkinDate, checkoutDate, allTarifas);
                if (p && p.totalPriceCLP > 0) {
                    priceData = {
                        totalPriceCLP: p.totalPriceCLP,
                        nights: p.nights,
                        formattedTotalPrice: `$${(p.totalPriceCLP || 0).toLocaleString('es-CL')} CLP`
                    };
                } else {
                    priceData.formattedTotalPrice = 'No disponible';
                    priceData.nights = p?.nights || 0;
                }
            } catch {
                priceData.formattedTotalPrice = 'Error al calcular';
            }
        } else {
            priceData.formattedTotalPrice = 'Config. requerida';
        }

        const hostingDuration = computeHostingDurationLabel(empresaCompleta, differenceInYears, differenceInMonths);

        const ogImage = propiedad.websiteData?.cardImage?.storagePath
            || (propiedad.websiteData?.images && Object.values(propiedad.websiteData.images).flat().find((i) => i?.storagePath)?.storagePath)
            || '';
        const precioBaseNoche = getPrecioBaseNoche(propiedad.id, allTarifas, canalPorDefectoId);
        let resenasResumen = null;
        try {
            resenasResumen = await obtenerResumenPorPropiedad(empresaId, propiedadId);
        } catch (_) {
            try { resenasResumen = await obtenerResumenResenas(empresaId); } catch (_2) {}
        }
        let resenas = [];
        try {
            const rp = await obtenerResenas(empresaId, { estado: 'publicada', propiedadId });
            resenas = dedupeResenasLista(rp).slice(0, 6);
        } catch (_) {}

        const websiteImgs = propiedad.websiteData?.images
            ? Object.values(propiedad.websiteData.images).flat().filter((i) => i?.storagePath)
            : [];
        let galeriaFotos = [];
        if (websiteImgs.length === 0) {
            try {
                const gRows = await getGaleria(db, empresaId, propiedadId, { estado: 'confirmado' });
                galeriaFotos = gRows.filter((f) => f.storagePath);
                if (galeriaFotos.length === 0) {
                    const gAll = await getGaleria(db, empresaId, propiedadId);
                    galeriaFotos = gAll.filter((f) => f.storagePath);
                }
            } catch (_) {}
        }
        const galeriaAreasComunes = buildEmpresaAreasComunesGallery(empresaCompleta, propiedad);

        // JSON-LD: buildContext vive en metadata pero el servicio público hace spread → propiedad.buildContext
        let schemaData =
            propiedad.buildContext?.publicacion?.jsonLd
            || propiedad.metadata?.buildContext?.publicacion?.jsonLd
            || null;

        let masAlojamientos = null;
        try {
            masAlojamientos = await obtenerMasAlojamientosParaFichaSSR({
                empresaId,
                propiedadIdActual: propiedadId,
                propiedad,
                baseUrl: req.baseUrl || '',
                protocol: req.protocol,
                allTarifasHost: allTarifas,
                canalPorDefectoIdHost: canalPorDefectoId,
                precioReferenciaNoche: precioBaseNoche,
                nombreAnfitrion: empresaCompleta.nombre || '',
                query: req.query || {},
            });
        } catch (e) {
            console.warn('[masAlojamientos SSR]', e.message);
        }

        const reglasMerged = mergeEffectiveRules(
            empresaCompleta.websiteSettings?.houseRules,
            propiedad.normasAlojamiento || {}
        );
        const reglasVista = buildHouseRulesPublicView(reglasMerged, propiedad.capacidad);
        if (schemaData) {
            schemaData = patchJsonLdWithHouseRules(schemaData, reglasMerged);
        }

        res.render('propiedad', {
            title: `${propiedad.nombre} | ${empresaCompleta.nombre}`,
            description: (propiedad.websiteData?.aiDescription || propiedad.descripcion || `Descubre ${propiedad.nombre}`).substring(0, 155),
            propiedad,
            empresa: empresaCompleta,
            baseUrl: req.baseUrl || '',
            ogImage,
            prefill: { fechaLlegada: formatDateForInput(checkinDate), fechaSalida: formatDateForInput(checkoutDate), personas },
            defaultPriceData: priceData,
            isDefaultWeekend,
            hostingDuration,
            precioBaseNoche,
            resenasResumen,
            resenas,
            galeriaFotos,
            galeriaAreasComunes,
            schemaData,
            masAlojamientos,
            reglasVista
        });
    } catch (error) {
        console.error(`Error al renderizar la propiedad ${propiedadId} para ${empresaId}:`, error);
        res.status(500).render('404', { title: 'Error Interno del Servidor', empresa: empresaCompleta || { id: empresaId, nombre: 'Error Crítico' } });
    }
}

module.exports = { renderPropiedadPublica };
