/** Utilidades compartidas vista Contenido Web por alojamiento */

export function esc(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function getChecks(wd, galeriaStats) {
    const total = galeriaStats?.slotsTotal || 0;
    const cumplidos = galeriaStats?.slotsCumplidos || 0;
    const fotosOk = total > 0 ? cumplidos >= total : (galeriaStats?.asignadas || 0) > 0;
    return {
        descripcion: (wd?.aiDescription || '').length > 50,
        fotos: fotosOk,
        seo: !!(wd?.metaTitle || wd?.metaDescription),
    };
}

export function calcularCompletitud(wd, galeriaStats) {
    const checks = getChecks(wd, galeriaStats);
    const ok = Object.values(checks).filter(Boolean).length;
    return Math.round((ok / 3) * 100);
}
