// frontend/src/views/components/calendario/calendario.gantt.js
// Renderiza la grilla Gantt del calendario de ocupación.

import { GANTT_STROKE_RGB } from '../../../shared/chartPaletteRgb.js';

const COLORES = GANTT_STROKE_RGB;

const DIAS_SEMANA = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];
const DIA_WIDTH = 44; // px por día

export function colorPropiedad(index) {
    return COLORES[index % COLORES.length];
}

// Retorna todos los días del mes como strings YYYY-MM-DD
export function diasDelMes(año, mes) {
    const dias = [];
    const total = new Date(año, mes + 1, 0).getDate();
    for (let d = 1; d <= total; d++) {
        const mm = String(mes + 1).padStart(2, '0');
        const dd = String(d).padStart(2, '0');
        dias.push(`${año}-${mm}-${dd}`);
    }
    return dias;
}

function formatLabel(clienteNombre, noches) {
    const partes = (clienteNombre || '').trim().split(' ');
    const apellido = partes[0] || '';
    const inicial = partes[1] ? partes[1][0] + '.' : '';
    return `${apellido}${inicial ? ', ' + inicial : ''} ${noches || ''}n`.trim();
}

function esFinDeSemana(isoDate) {
    const d = new Date(isoDate + 'T00:00:00');
    return d.getDay() === 0 || d.getDay() === 6;
}

export function renderGantt(recursos, eventos, colorMap, dias, hoy) {
    const totalDias = dias.length;
    const anchoGrilla = totalDias * DIA_WIDTH;

    // Cabecera de días
    const cabeceraDias = dias.map((iso, i) => {
        const d = new Date(iso + 'T00:00:00');
        const diaSemana = DIAS_SEMANA[d.getDay()];
        const esHoy = iso === hoy;
        const esWE = esFinDeSemana(iso);
        return `
            <div class="gantt-dia-header ${esWE ? 'gantt-weekend' : ''} ${esHoy ? 'gantt-hoy-header' : ''}"
                 style="width:${DIA_WIDTH}px;min-width:${DIA_WIDTH}px">
                <span class="gantt-dia-letra">${diaSemana}</span>
                <span class="gantt-dia-num">${d.getDate()}</span>
            </div>`;
    }).join('');

    // Filas de propiedades
    const filas = recursos.map((rec, idx) => {
        const color = colorMap[rec.id];
        const subInfo = [
            rec.capacidad ? `${rec.capacidad} huésp.` : '',
            rec.numPiezas ? `${rec.numPiezas} hab.` : ''
        ].filter(Boolean).join(' · ');

        // Eventos de esta propiedad que tocan este mes
        const eventosFila = eventos.filter(e => e.resourceId === rec.id && e.start < dias[dias.length - 1] && e.end > dias[0]);

        const bloques = eventosFila.map(ev => {
            const inicioVisible = ev.start < dias[0] ? dias[0] : ev.start;
            const finVisible   = ev.end   > dias[totalDias - 1] ? dias[totalDias - 1] : ev.end;

            const idxInicio = dias.indexOf(inicioVisible);
            const idxFin    = dias.indexOf(finVisible);
            const spanDias  = (idxFin < 0 ? totalDias : idxFin) - (idxInicio < 0 ? 0 : idxInicio);
            const left      = (idxInicio < 0 ? 0 : idxInicio) * DIA_WIDTH;
            const width     = Math.max(spanDias, 1) * DIA_WIDTH - 4;
            const p = ev.extendedProps;

            if (p.tipo === 'bloqueo') {
                return `
                <div class="gantt-bloque gantt-bloque-bloqueado"
                     style="left:${left}px;width:${width}px"
                     data-reserva='${JSON.stringify({ tipo: 'bloqueo', motivo: p.motivo, start: ev.start, end: ev.end }).replace(/'/g, "&#39;")}'>
                    <span class="gantt-bloque-label">🔒 ${p.motivo || 'Bloqueado'}</span>
                </div>`;
            }

            return `
                <div class="gantt-bloque"
                     style="left:${left}px;width:${width}px;background:${color}"
                     data-reserva='${JSON.stringify({
                         clienteNombre: p.clienteNombre,
                         alojamientoNombre: p.alojamientoNombre,
                         canalNombre: p.canalNombre,
                         start: ev.start, end: ev.end,
                         totalNoches: p.totalNoches,
                         huespedes: p.huespedes,
                         telefono: p.telefono,
                         estado: p.estado,
                         estadoGestion: p.estadoGestion,
                         idReserva: p.idReserva,
                         idReservaCanal: p.idReservaCanal
                     }).replace(/'/g, "&#39;")}'>
                    <span class="gantt-bloque-label">${formatLabel(p.clienteNombre, p.totalNoches)}</span>
                </div>`;
        }).join('');

        // Columnas de fondo (fines de semana + hoy)
        const fondoDias = dias.map((iso, i) => {
            const esWE = esFinDeSemana(iso);
            const esHoy = iso === hoy;
            if (!esWE && !esHoy) return '';
            return `<div class="gantt-fondo-dia ${esWE ? 'gantt-weekend-col' : ''} ${esHoy ? 'gantt-hoy-col' : ''}"
                         style="left:${i * DIA_WIDTH}px;width:${DIA_WIDTH}px"></div>`;
        }).join('');

        return `
            <div class="gantt-fila">
                <div class="gantt-nombre" title="${rec.title}">
                    <span class="gantt-color-dot" style="background:${color}"></span>
                    <div>
                        <p class="gantt-nombre-texto">${rec.title}</p>
                        ${subInfo ? `<p class="gantt-nombre-sub">${subInfo}</p>` : ''}
                    </div>
                </div>
                <div class="gantt-timeline" style="width:${anchoGrilla}px">
                    ${fondoDias}
                    ${bloques}
                </div>
            </div>`;
    }).join('');

    return `
        <div class="gantt-wrap">
            <!-- Cabecera fija izquierda + días -->
            <div class="gantt-header-row">
                <div class="gantt-nombre gantt-header-nombre">Alojamiento</div>
                <div class="gantt-scroll-header">
                    <div style="width:${anchoGrilla}px;display:flex">
                        ${cabeceraDias}
                    </div>
                </div>
            </div>
            <!-- Cuerpo con scroll horizontal -->
            <div class="gantt-body">
                ${filas}
            </div>
        </div>`;
}
