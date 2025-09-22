import { fetchAPI } from '../api.js';

let calendar;

// --- INICIO DE CAMBIOS: Paleta de colores actualizada ---
const channelColors = {
    'Booking.com': '#003580', // Azul para Booking
    'SODC': '#2ECC71',        // Verde para SODC
    'Directo': '#2ECC71',     // Verde para Directo/App
    'Airbnb': '#E74C3C',      // Rojo para Airbnb
    'Otro': '#95A5A6'         // Gris para el resto
};
// --- FIN DE CAMBIOS ---

function renderModalInfo(eventInfo) {
    const modal = document.getElementById('calendario-modal');
    const props = eventInfo.event.extendedProps;
    document.getElementById('modal-title').textContent = `Reserva: ${props.clienteNombre}`;
    document.getElementById('modal-alojamiento').textContent = props.alojamientoNombre;
    document.getElementById('modal-fechas').textContent = `${new Date(eventInfo.event.startStr).toLocaleDateString('es-CL', { timeZone: 'UTC' })} - ${new Date(eventInfo.event.endStr).toLocaleDateString('es-CL', { timeZone: 'UTC' })}`;
    document.getElementById('modal-noches').textContent = props.totalNoches;
    document.getElementById('modal-huespedes').textContent = props.huespedes;
    document.getElementById('modal-telefono').textContent = props.telefono;
    document.getElementById('modal-estado').textContent = props.estado;
    modal.classList.remove('hidden');
}

export async function render() {
    return `
        <style>
            .fc-day-today {
                background-color: rgba(253, 224, 71, 0.2) !important;
            }
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
        const { recursos, eventos } = await fetchAPI('/calendario');
        
        calendar = new FullCalendar.Calendar(calendarEl, {
            schedulerLicenseKey: 'GPL-My-Project-Is-Open-Source',
            initialView: 'resourceTimelineMonth',
            locale: 'es',
            height: '80vh',
            headerToolbar: {
                left: 'prev,next today',
                center: 'title',
                right: 'resourceTimelineMonth,resourceTimelineWeek'
            },
            resources: recursos,
            events: eventos,
            eventClick: (info) => {
                renderModalInfo(info);
            },
            eventDataTransform: function(eventData) {
                const canal = eventData.extendedProps.canalNombre || 'Otro';
                const color = channelColors[canal] || channelColors['Otro'];
                return {
                    ...eventData,
                    backgroundColor: color,
                    borderColor: color
                };
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