/**
 * Texto comercial mínimo solo desde inventario verificado (sin llamadas a IA).
 * Usar cuando todos los proveedores fallen por cuota u otros errores transitorios.
 */

/**
 * @param {object} buildContext — mismo shape que usa generarNarrativaDesdeContexto
 * @returns {object}
 */
function narrativaDeterministaDesdeContexto(buildContext) {
    const empresa = buildContext.empresa || {};
    const producto = buildContext.producto || {};
    const ciudad = String(empresa.ubicacion?.ciudad || '').trim();
    const region = String(empresa.ubicacion?.region || '').trim();
    const nom = String(producto.nombre || 'El alojamiento').trim();
    const espacios = producto.espacios || [];

    const loc = [ciudad, region].filter(Boolean).join(', ');
    const bloques = espacios
        .map((e) => {
            const nm = String(e.nombre || 'Espacio').trim();
            const acts = (e.activos || [])
                .map((a) => String(a.nombre || '').trim())
                .filter(Boolean)
                .slice(0, 10);
            return acts.length ? `${nm}: ${acts.join(', ')}` : nm;
        })
        .filter(Boolean)
        .join('. ');

    let desc = `${nom}${loc ? ` (${loc})` : ''} — contenido base generado desde tu inventario verificado en SuiteManager. `;
    desc += bloques
        ? `Resumen de espacios y equipamiento según datos cargados: ${bloques}. `
        : 'Completa el inventario en el panel para enriquecer esta descripción. ';
    desc +=
        'Las APIs de IA no respondieron (suele deberse a límites de cuota o facturación). Edita este texto con el tono de tu marca y vuelve a intentar «Generar con IA» más tarde.';
    desc = desc.replace(/\s+/g, ' ').trim().slice(0, 1600);

    const puntosFuertes = espacios.slice(0, 5).map((e) => {
        const n = String(e.nombre || '').trim();
        return n ? `Espacio: ${n}` : null;
    }).filter(Boolean);

    const homeH1 = `${nom}${ciudad ? ` · ${ciudad}` : ''}`.slice(0, 100);
    const homeIntro = desc.slice(0, 420);

    return {
        descripcionComercial: desc,
        puntosFuertes: puntosFuertes.length ? puntosFuertes : [`Inventario verificado: ${nom}.`],
        uniqueSellingPoints: [desc.slice(0, 180)],
        homeH1,
        homeIntro,
        espaciosDestacadosVenta: [],
        _generatedWithoutAi: true,
        generadoEn: new Date().toISOString(),
    };
}

module.exports = { narrativaDeterministaDesdeContexto };
