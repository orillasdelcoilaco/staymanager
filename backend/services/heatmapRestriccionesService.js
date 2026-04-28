const { parseISO, isValid, addDays, format } = require('date-fns');

function _clampInt(v, min, max, fallback) {
    const n = parseInt(String(v ?? ''), 10);
    if (!Number.isFinite(n)) return fallback;
    return Math.min(max, Math.max(min, n));
}

function _normDate(v) {
    const s = String(v || '').trim().slice(0, 10);
    if (!s) return null;
    const d = parseISO(`${s}T00:00:00`);
    if (!isValid(d)) return null;
    return { s, d };
}

function _sanitizeEvento(ev) {
    if (!ev || typeof ev !== 'object') return null;
    const from = _normDate(ev.desde || ev.fechaInicio);
    const to = _normDate(ev.hasta || ev.fechaFin);
    if (!from || !to || to.d < from.d) return null;
    return {
        nombre: String(ev.nombre || ev.motivo || 'Evento local').trim().slice(0, 120),
        desde: from.s,
        hasta: to.s,
        nivel: _clampInt(ev.nivel, 1, 5, 3),
        minNochesLlegada: _clampInt(ev.minNochesLlegada, 1, 30, 2),
    };
}

function sanitizeHeatmapEventosDemanda(raw) {
    if (!Array.isArray(raw)) return [];
    const out = raw
        .map(_sanitizeEvento)
        .filter(Boolean)
        .slice(0, 200);
    // Orden estable por fecha inicio.
    out.sort((a, b) => String(a.desde).localeCompare(String(b.desde)));
    return out;
}

function buildHeatmapForRange(bookingCfg, fromIso, toIso) {
    const from = _normDate(fromIso);
    const to = _normDate(toIso);
    if (!from || !to || to.d < from.d) return [];
    const eventos = sanitizeHeatmapEventosDemanda(bookingCfg?.eventosDemandaMapaCalor || []);
    if (!eventos.length) return [];

    const out = [];
    for (let d = new Date(from.d); d <= to.d; d = addDays(d, 1)) {
        const iso = format(d, 'yyyy-MM-dd');
        const activos = eventos.filter((ev) => ev.desde <= iso && ev.hasta >= iso);
        if (!activos.length) continue;
        const nivel = Math.max(...activos.map((a) => a.nivel));
        const minNochesLlegada = Math.max(...activos.map((a) => a.minNochesLlegada));
        const nombres = Array.from(new Set(activos.map((a) => a.nombre).filter(Boolean)));
        out.push({
            fecha: iso,
            nivel,
            minNochesLlegada,
            motivos: nombres,
        });
    }
    return out;
}

/**
 * Noches mínimas exigidas por reglas de mapa de demanda para una fecha de llegada (YYYY-MM-DD).
 * Si no hay evento activo ese día, devuelve 1 (no añade restricción por sí sola; combinar con minNoches base en el caller).
 */
function minNochesLlegadaParaFecha(bookingCfg, llegadaYmd) {
    const lleg = String(llegadaYmd || '').trim().slice(0, 10);
    if (!lleg) return 1;
    const row = buildHeatmapForRange(bookingCfg, lleg, lleg);
    const hit = row.find((r) => r.fecha === lleg);
    return hit ? Math.max(1, hit.minNochesLlegada) : 1;
}

module.exports = {
    sanitizeHeatmapEventosDemanda,
    buildHeatmapForRange,
    minNochesLlegadaParaFecha,
};
