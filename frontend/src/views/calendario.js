// frontend/src/views/calendario.js
import { fetchAPI } from '../api.js';
import { handleNavigation } from '../router.js';
import { renderGantt, colorPropiedad, diasDelMes } from './components/calendario/calendario.gantt.js';

let todosEventos = [];
let todosRecursos = [];
let metricas = {};
let colorMap = {};
let mesActual = new Date();
mesActual.setDate(1);

function hoyISO() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function nombreMes(fecha) {
    return fecha.toLocaleDateString('es-CL', { month: 'long', year: 'numeric' });
}

function renderMetricas() {
    const ocupPct = metricas.totalPropiedades
        ? Math.round((metricas.ocupados / metricas.totalPropiedades) * 100)
        : 0;

    return `
        <div class="cal-metricas">
            <div class="cal-metrica-card">
                <p class="cal-metrica-val">${metricas.reservasActivas ?? 0}</p>
                <p class="cal-metrica-label">Reservas activas</p>
            </div>
            <div class="cal-metrica-card">
                <p class="cal-metrica-val text-success-600">${ocupPct}%</p>
                <p class="cal-metrica-label">Ocupación hoy</p>
            </div>
            <div class="cal-metrica-card">
                <p class="cal-metrica-val text-warning-600">${metricas.checkinHoy ?? 0}</p>
                <p class="cal-metrica-label">Check-ins hoy</p>
            </div>
            <div class="cal-metrica-card">
                <p class="cal-metrica-val">${metricas.checkoutHoy ?? 0}</p>
                <p class="cal-metrica-label">Check-outs hoy</p>
            </div>
        </div>`;
}

function renderLeyenda() {
    return `
        <div class="cal-leyenda">
            ${todosRecursos.map(r => `
                <span class="cal-leyenda-item">
                    <span class="cal-leyenda-dot" style="background:${colorMap[r.id]}"></span>
                    ${r.title}
                </span>`).join('')}
        </div>`;
}

function renderNavegacion() {
    return `
        <div class="cal-nav">
            <button id="cal-prev" class="cal-nav-btn" type="button" aria-label="Mes anterior">‹</button>
            <button id="cal-hoy" class="cal-nav-btn cal-nav-today" type="button">Hoy</button>
            <button id="cal-next" class="cal-nav-btn" type="button" aria-label="Mes siguiente">›</button>
            <h3 id="cal-mes-label" class="cal-nav-titulo">${nombreMes(mesActual)}</h3>
        </div>`;
}


function actualizarGantt() {
    const año = mesActual.getFullYear();
    const mes = mesActual.getMonth();
    const dias = diasDelMes(año, mes);
    const hoy  = hoyISO();

    const contenedor = document.getElementById('gantt-contenedor');
    if (!contenedor) return;
    contenedor.innerHTML = renderGantt(todosRecursos, todosEventos, colorMap, dias, hoy);

    document.getElementById('cal-mes-label').textContent = nombreMes(mesActual);

    // Sincronizar scroll del header con el body (el header tiene overflow:hidden, se mueve por JS)
    const scrollArea   = contenedor.querySelector('.gantt-body');
    const scrollHeader = contenedor.querySelector('.gantt-scroll-header');
    if (scrollArea && scrollHeader) {
        scrollArea.addEventListener('scroll', () => {
            scrollHeader.scrollLeft = scrollArea.scrollLeft;
        });
    }

    // Scroll al día de hoy si estamos en el mes actual
    const esHoy = año === new Date().getFullYear() && mes === new Date().getMonth();
    if (esHoy) {
        setTimeout(() => {
            const diaHoy = new Date().getDate() - 1;
            const scrollTo = Math.max(0, diaHoy * 44 - 100);
            if (scrollArea)   scrollArea.scrollLeft   = scrollTo;
            if (scrollHeader) scrollHeader.scrollLeft = scrollTo;
        }, 50);
    }

    adjuntarEventosGantt();
}

function adjuntarEventosGantt() {
    const tooltip = document.getElementById('cal-tooltip');

    document.querySelectorAll('.gantt-bloque').forEach(bloque => {
        const data = JSON.parse(bloque.dataset.reserva);

        bloque.addEventListener('mouseenter', () => {
            if (tooltip) {
                const fmt = iso => new Date(iso + 'T00:00:00').toLocaleDateString('es-CL');
                if (data.tipo === 'bloqueo') {
                    tooltip.innerHTML = `
                        <p class="cal-tooltip-nombre"><i class="fa-solid fa-lock mr-1"></i>Alojamiento Bloqueado</p>
                        <p class="cal-tooltip-aloj">${data.motivo || 'Sin motivo especificado'}</p>
                        <div class="cal-tooltip-grid">
                            <span>Desde</span><span>${fmt(data.start)}</span>
                            <span>Hasta</span><span>${fmt(data.end)}</span>
                        </div>`;
                } else {
                    tooltip.innerHTML = `
                        <p class="cal-tooltip-nombre">${data.clienteNombre}</p>
                        <p class="cal-tooltip-aloj">${data.alojamientoNombre}</p>
                        <div class="cal-tooltip-grid">
                            <span>Canal</span><span>${data.canalNombre || '—'}</span>
                            <span>Ingreso</span><span>${fmt(data.start)}</span>
                            <span>Salida</span><span>${fmt(data.end)}</span>
                            <span>Noches</span><span>${data.totalNoches}</span>
                            <span>Huésp.</span><span>${data.huespedes}</span>
                            <span>Teléfono</span><span>${data.telefono || '—'}</span>
                        </div>`;
                }
                tooltip.classList.remove('hidden');
            }
        });

        bloque.addEventListener('mousemove', (e) => {
            if (tooltip) {
                tooltip.style.left = `${e.pageX + 12}px`;
                tooltip.style.top  = `${e.pageY - 10}px`;
            }
        });

        bloque.addEventListener('mouseleave', () => {
            if (tooltip) tooltip.classList.add('hidden');
        });

        bloque.addEventListener('click', () => { if (data.tipo !== 'bloqueo') abrirModal(data); });
    });
}

function abrirModal(data) {
    const fmt = iso => new Date(iso + 'T00:00:00').toLocaleDateString('es-CL');
    const modal = document.getElementById('cal-modal');
    document.getElementById('cal-modal-body').innerHTML = `
        <dl class="cal-modal-dl">
            <div><dt>Huésped</dt><dd>${data.clienteNombre}</dd></div>
            <div><dt>Alojamiento</dt><dd>${data.alojamientoNombre}</dd></div>
            <div><dt>Canal</dt><dd>${data.canalNombre || '—'}</dd></div>
            <div><dt>Ingreso</dt><dd>${fmt(data.start)}</dd></div>
            <div><dt>Salida</dt><dd>${fmt(data.end)}</dd></div>
            <div><dt>Noches</dt><dd>${data.totalNoches}</dd></div>
            <div><dt>Huéspedes</dt><dd>${data.huespedes}</dd></div>
            <div><dt>Teléfono</dt><dd>${data.telefono || '—'}</dd></div>
            <div><dt>Estado Reserva</dt><dd>${data.estado}</dd></div>
            <div><dt>Estado Gestión</dt><dd>${data.estadoGestion || 'N/A'}</dd></div>
        </dl>
        <div class="mt-5 pt-4 border-t flex justify-end">
            <button id="cal-modal-ir-reserva" class="btn-primary text-sm flex items-center gap-1.5">
                Ver Reserva <i class="fa-solid fa-arrow-right"></i>
            </button>
        </div>`;

    modal.classList.remove('hidden');

    document.getElementById('cal-modal-ir-reserva').addEventListener('click', () => {
        modal.classList.add('hidden');
        const canalId = data.idReservaCanal || data.idReserva;
        if (data.estadoGestion?.startsWith('Pendiente')) {
            sessionStorage.setItem('highlightReserva', canalId);
            handleNavigation('/gestion-diaria');
        } else {
            sessionStorage.setItem('openReserva', canalId);
            handleNavigation('/gestionar-reservas');
        }
    });
}

export async function render() {
    return `
        <div class="cal-container">
            <div class="cal-header">
                <h2 class="cal-titulo">Calendario de Ocupación</h2>
                <div id="cal-nav-wrap"></div>
            </div>
            <div id="cal-metricas-wrap"></div>
            <div id="cal-leyenda-wrap"></div>
            <div id="gantt-contenedor" class="cal-gantt-wrap">
                <p class="text-center text-gray-400 py-12">Cargando...</p>
            </div>
        </div>

        <!-- Tooltip flotante -->
        <div id="cal-tooltip" class="cal-tooltip hidden"></div>

        <!-- Modal detalle -->
        <div id="cal-modal" class="modal hidden fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center z-50">
            <div class="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 p-6">
                <div class="flex items-center gap-3 mb-4 pb-4 border-b">
                    <div class="w-10 h-10 rounded-xl bg-primary-100 flex items-center justify-center text-primary-600 flex-shrink-0"><i class="fa-solid fa-house"></i></div>
                    <div class="flex-1">
                        <h3 class="text-base font-semibold text-gray-900">Detalle de Reserva</h3>
                    </div>
                    <button id="cal-modal-close" class="text-gray-400 hover:text-gray-700 text-xl leading-none">&times;</button>
                </div>
                <div id="cal-modal-body"></div>
            </div>
        </div>`;
}

export async function afterRender() {
    try {
        const datos = await fetchAPI('/calendario');
        todosEventos  = datos.eventos;
        todosRecursos = datos.recursos;
        metricas      = datos.metricas || {};

        todosRecursos.forEach((r, i) => { colorMap[r.id] = colorPropiedad(i); });

        document.getElementById('cal-metricas-wrap').innerHTML = renderMetricas();
        document.getElementById('cal-leyenda-wrap').innerHTML  = renderLeyenda();
        document.getElementById('cal-nav-wrap').innerHTML      = renderNavegacion();

        // Insertar label de mes en nav
        const nav = document.getElementById('cal-nav-wrap');
        if (nav) {
            nav.querySelector('#cal-prev').addEventListener('click', () => {
                mesActual.setMonth(mesActual.getMonth() - 1);
                document.getElementById('cal-mes-label').textContent = nombreMes(mesActual);
                actualizarGantt();
            });
            nav.querySelector('#cal-next').addEventListener('click', () => {
                mesActual.setMonth(mesActual.getMonth() + 1);
                document.getElementById('cal-mes-label').textContent = nombreMes(mesActual);
                actualizarGantt();
            });
            nav.querySelector('#cal-hoy').addEventListener('click', () => {
                mesActual = new Date();
                mesActual.setDate(1);
                document.getElementById('cal-mes-label').textContent = nombreMes(mesActual);
                actualizarGantt();
            });
        }

        actualizarGantt();

        document.getElementById('cal-modal-close').addEventListener('click', () => {
            document.getElementById('cal-modal').classList.add('hidden');
        });

    } catch (error) {
        document.getElementById('gantt-contenedor').innerHTML =
            `<p class="text-danger-500 p-6">Error al cargar el calendario: ${error.message}</p>`;
    }
}
