import { fetchAPI } from '../api.js';

let calendar;

// --- Nueva Función para Cargar el Script ---
function loadFullCalendarScript() {
    return new Promise((resolve, reject) => {
        // Si ya está cargado, no hacer nada y resolver
        if (window.FullCalendar) {
            return resolve();
        }
        
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/fullcalendar-premium@6.1.15/index.global.min.js';
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('No se pudo cargar el script de FullCalendar.'));
        document.head.appendChild(script);
    });
}


function renderModalInfo(eventInfo) {
    const modal = document.getElementById('calendario-modal');
    const props = eventInfo.event.extendedProps;
    document.getElementById('modal-title').textContent = `Reserva: ${props.clienteNombre}`;
    document.getElementById('modal-alojamiento').textContent = props.alojamientoNombre;
    document.getElementById('modal-fechas').textContent = `${eventInfo.event.start.toLocaleDateString()} - ${eventInfo.event.end.toLocaleDateString()}`;
    document.getElementById('modal-noches').textContent = props.totalNoches;
    document.getElementById('modal-huespedes').textContent = props.huespedes;
    document.getElementById('modal-telefono').textContent = props.telefono;
    document.getElementById('modal-estado').textContent = props.estado;
    modal.classList.remove('hidden');
}

export async function render() {
    return `
        <style>
            /* Estilos para hacer el calendario más compacto y legible */
            .fc-toolbar-title { font-size: 1.25em !important; }
            .fc-event { font-size: 0.75em !important; padding: 2px 4px !important; }
            .fc-resource-lane { height: 40px !important; }
        </style>
        <div class="bg-white p-6 rounded-lg shadow">
            <h2 class="text-2xl font-semibold text-gray-900 mb-4">Calendario de Ocupación</h2>
            <div id='calendar'></div>
        </div>

        <div id="calendario-modal" class="modal hidden">
            <div class="modal-content">
                <h3 id="modal-title" class="text-xl font-semibold mb-4"></h3>
                <dl class="text-sm space-y-2">
                    <div class="grid grid-cols-2"><dt class="font-medium text-gray-600">Alojamiento:</dt><dd id="modal-alojamiento"></dd></div>
                    <div class="grid grid-cols-2"><dt class="font-medium text-gray-600">Fechas:</dt><dd id="modal-fechas"></dd></div>
                    <div class="grid grid-cols-2"><dt class="font-medium text-gray-600">Noches:</dt><dd id="modal-noches"></dd></div>
                    <div class="grid grid-cols-2"><dt class="font-medium text-gray-600">Huéspedes:</dt><dd id="modal-huespedes"></dd></div>
                    <div class="grid grid-cols-2"><dt class="font-medium text-gray-600">Teléfono:</dt><dd id="modal-telefono"></dd></div>
                    <div class="grid grid-cols-2"><dt class="font-medium text-gray-600">Estado:</dt><dd id="modal-estado"></dd></div>
                </dl>
                <div class="flex justify-end pt-4 mt-4 border-t">
                    <button id="close-modal-btn" class="btn-secondary">Cerrar</button>
                </div>
            </div>
        </div>
    `;
}

export async function afterRender() {
    const calendarEl = document.getElementById('calendar');
    
    try {
        // 1. Esperar a que el script de FullCalendar esté listo
        await loadFullCalendarScript();

        // 2. Obtener los datos de la API
        const { recursos, eventos } = await fetchAPI('/calendario');
        
        // 3. Ahora sí, inicializar el calendario
        calendar = new FullCalendar.Calendar(calendarEl, {
            schedulerLicenseKey: 'GPL-My-Project-Is-Open-Source',
            initialView: 'resourceTimelineMonth',
            locale: 'es',
            headerToolbar: {
                left: 'prev,next today',
                center: 'title',
                right: 'resourceTimelineMonth,resourceTimelineWeek'
            },
            resources: recursos,
            events: eventos,
            eventClick: (info) => {
                renderModalInfo(info);
            }
        });

        calendar.render();

        document.getElementById('close-modal-btn').addEventListener('click', () => {
            document.getElementById('calendario-modal').classList.add('hidden');
        });

    } catch (error) {
        calendarEl.innerHTML = `<p class="text-red-500">Error al cargar el calendario: ${error.message}</p>`;
    }
}