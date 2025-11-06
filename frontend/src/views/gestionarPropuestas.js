// frontend/src/views/gestionarPropuestas.js
import { fetchAPI } from '../api.js';
import { handleNavigation } from '../router.js';

let todasLasPropuestas = [];
let todosLosCanales = [];

function formatCurrency(value) { return `$${(Math.round(value) || 0).toLocaleString('es-CL')}`; }
function formatDate(dateString) { return new Date(dateString + 'T00:00:00Z').toLocaleDateString('es-CL', { timeZone: 'UTC' }); }

// frontend/src/views/gestionarPropuestas.js

function renderTabla() {
    const tbody = document.getElementById('propuestas-tbody');
    if (!tbody) return;

    const canalFiltro = document.getElementById('canal-filter').value;
    const fechaInicio = document.getElementById('fecha-inicio-filter').value;
    const fechaFin = document.getElementById('fecha-fin-filter').value;

    const propuestasFiltradas = todasLasPropuestas.filter(item => {
        const matchCanal = !canalFiltro || item.canalNombre === canalFiltro;
        const matchFecha = (!fechaInicio || item.fechaLlegada >= fechaInicio) && (!fechaFin || item.fechaLlegada <= fechaFin);
        return matchCanal && matchFecha;
    });

    // Ordenar: incompletas/iCal primero, luego por fecha de llegada
    propuestasFiltradas.sort((a, b) => {
        const aIncompleta = (!a.clienteId || a.monto === 0 || a.origen === 'ical');
        const bIncompleta = (!b.clienteId || b.monto === 0 || b.origen === 'ical');
        if (aIncompleta && !bIncompleta) return -1;
        if (!aIncompleta && bIncompleta) return 1;
        return new Date(b.fechaLlegada) - new Date(a.fechaLlegada);
    });

    if (propuestasFiltradas.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10" class="text-center text-gray-500 py-4">No hay propuestas que coincidan con los filtros.</td></tr>'; // Colspan 10
        return;
    }

    tbody.innerHTML = propuestasFiltradas.map((item, index) => {
        const isIncomplete = !item.clienteId || item.monto === 0 || (item.origen === 'ical' && !item.clienteId);
        const icalIndicator = item.origen === 'ical' ? `<span title="Generado desde iCal" class="mr-2">🗓️</span>` : '';
        const tipoTexto = item.tipo === 'propuesta' ? 'Reserva Tentativa' : 'Presupuesto Formal';
        const clienteNombre = item.origen === 'ical' && isIncomplete ? item.idReservaCanal : (item.clienteNombre || 'N/A');
        const montoTexto = (isIncomplete && item.monto === 0) ? 'Por completar' : formatCurrency(item.monto);
        
        // --- INICIO DE LA CORRECCIÓN ---
        const personasTexto = item.personas > 0 ? item.personas : (isIncomplete ? '?' : 'N/A');
        const noches = Math.round((new Date(item.fechaSalida) - new Date(item.fechaLlegada)) / (1000 * 60 * 60 * 24));
        // --- FIN DE LA CORRECCIÓN ---

        return `
        <tr class="border-b text-sm hover:bg-gray-50 ${isIncomplete ? 'bg-yellow-50' : ''}">
            <td class="p-2 text-center font-medium text-gray-500">${index + 1}</td>
            <td class="p-2">${icalIndicator}${tipoTexto} ${isIncomplete ? '<span class="text-red-600 font-medium">(Incompleta)</span>' : ''}</td>
            <td class="p-2 font-medium">${item.canalNombre || 'N/A'}</td>
            <td class="p-2 font-medium truncate" style="max-width: 200px;" title="${clienteNombre}">${clienteNombre}</td>
            <td class="p-2">${formatDate(item.fechaLlegada)} al ${formatDate(item.fechaSalida)}</td>
            <td class="p-2 text-center">${noches}</td>             <td class="p-2 text-center font-bold">${personasTexto}</td>             <td class="p-2">${item.propiedadesNombres}</td>
            <td class="p-2 font-semibold text-right">${montoTexto}</td>
            <td class="p-2 text-center space-x-2 whitespace-nowrap">
                <button data-id="${item.id}" data-tipo="${item.tipo}" class="edit-btn btn-table-copy">Editar/Completar</button>
                <button data-id="${item.id}" data-tipo="${item.tipo}" data-ids-reservas="${item.idsReservas?.join(',')}" class="approve-btn btn-table-edit" ${isIncomplete ? 'disabled' : ''}>Aprobar</button>
                <button data-id="${item.id}" data-tipo="${item.tipo}" data-ids-reservas="${item.idsReservas?.join(',')}" class="reject-btn btn-table-delete">Rechazar</button>
            </td>
        </tr>
    `}).join('');
}

async function fetchAndRender() {
    try {
        [todasLasPropuestas, todosLosCanales] = await Promise.all([
            fetchAPI('/gestion-propuestas'),
            fetchAPI('/canales')
        ]);

        const canalFilter = document.getElementById('canal-filter');
        canalFilter.innerHTML = '<option value="">Todos los Canales</option>';
        todosLosCanales.forEach(canal => {
            const option = new Option(canal.nombre, canal.nombre);
            canalFilter.add(option);
        });

        renderTabla();
    } catch (error) {
        const tbody = document.getElementById('propuestas-tbody');
        if (tbody) tbody.innerHTML = `<tr><td colspan="8" class="text-center text-red-500 py-4">Error al cargar: ${error.message}</td></tr>`;
    }
}

// frontend/src/views/gestionarPropuestas.js

export async function render() {
    return `
        <div class="bg-white p-8 rounded-lg shadow">
            <h2 class="text-2xl font-semibold text-gray-900 mb-4">Gestionar Propuestas y Presupuestos</h2>
            
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 p-4 border rounded-md bg-gray-50">
                <div>
                    <label for="canal-filter" class="block text-sm font-medium text-gray-700">Filtrar por Canal</label>
                    <select id="canal-filter" class="form-select mt-1"></select>
                </div>
                <div>
                    <label for="fecha-inicio-filter" class="block text-sm font-medium text-gray-700">Desde (Fecha de Llegada)</label>
                    <input type="date" id="fecha-inicio-filter" class="form-input mt-1">
                </div>
                <div>
                    <label for="fecha-fin-filter" class="block text-sm font-medium text-gray-700">Hasta (Fecha de Llegada)</label>
                    <input type="date" id="fecha-fin-filter" class="form-input mt-1">
                </div>
            </div>

            <div class="table-container">
                <table class="min-w-full bg-white">
                    <thead><tr>
                        <th class="th w-12">#</th>
                        <th class="th">Tipo</th>
                        <th class="th">Canal</th>
                        <th class="th">Cliente / ID iCal</th>
                        <th class="th">Fechas</th>
                        <th class="th text-center">Noches</th>                         <th class="th text-center">Pers.</th>                         <th class="th">Propiedades</th>
                        <th class="th text-right">Monto</th>
                        <th class="th text-center">Acciones</th>
                    </tr></thead>
                    <tbody id="propuestas-tbody"></tbody>
                </table>
            </div>
        </div>
    `;
}

// frontend/src/views/gestionarPropuestas.js

export async function afterRender() {
    await fetchAndRender();

    document.getElementById('canal-filter').addEventListener('change', renderTabla);
    document.getElementById('fecha-inicio-filter').addEventListener('input', renderTabla);
    document.getElementById('fecha-fin-filter').addEventListener('input', renderTabla);

    const tbody = document.getElementById('propuestas-tbody');
    tbody.addEventListener('click', async (e) => {
        const target = e.target;
        const id = target.dataset.id;
        const tipo = target.dataset.tipo;
        if (!id || !tipo) return;

        if (target.classList.contains('edit-btn')) {
            const item = todasLasPropuestas.find(p => p.id === id);
            if (!item) {
                alert('Error: No se pudo encontrar la propuesta para editar.');
                return;
            }
            
            console.log("--- DEBUG: Datos de la propuesta seleccionada ---");
            console.log(item);

            // --- INICIO DE LA CORRECCIÓN ---

            const loadDocId = item.idsReservas && item.idsReservas.length > 0 ? item.idsReservas[0] : null;

            if (!loadDocId) {
                alert(`Error: Esta propuesta (ID: ${id}) no tiene un ID de reserva válido para cargar. No se puede editar.`);
                return;
            }

            // Corregido: Usar 'item.personas' (las personas reales de la reserva)
            // que ya vienen agregadas desde el backend.
            // Usar 1 como fallback solo si es 0 o nulo (ej: iCal incompleto).
            const personas = item.personas || 1;
            
            const params = new URLSearchParams({
                edit: id,  // El ID de Grupo (para Guardar/PUT)
                load: loadDocId, // El ID de Documento (para Cargar/GET)
                props: item.propiedades.map(p => p.id).join(','),
                
                clienteId: item.clienteId || '',
                fechaLlegada: item.fechaLlegada,
                fechaSalida: item.fechaSalida,
                personas: personas, // <-- AHORA ES CORRECTO
                idReservaCanal: item.idReservaCanal || '',
                canalId: item.canalId || '',
                origen: item.origen || 'manual',
                icalUid: item.icalUid || ''
            });
            
            // --- FIN DE LA CORRECCIÓN ---

            const route = tipo === 'propuesta' ? '/agregar-propuesta' : '/generar-presupuesto';
            const url = `${route}?${params.toString()}`;
            
            console.log("--- DEBUG: URL de navegación generada ---");
            console.log(url);
            
            handleNavigation(url);
        }
        
        if (target.classList.contains('approve-btn')) {
            if (!confirm(`¿Estás seguro de que quieres aprobar est${tipo === 'propuesta' ? 'a propuesta' : 'e presupuesto'}? Se verificará la disponibilidad antes de confirmar.`)) return;
            
            target.disabled = true;
            target.textContent = 'Verificando...';

            try {
                let result;
                if (tipo === 'propuesta') {
                    const idsReservas = target.dataset.idsReservas.split(',');
                    result = await fetchAPI(`/gestion-propuestas/propuesta/${id}/aprobar`, { method: 'POST', body: { idsReservas } });
                } else {
                    result = await fetchAPI(`/gestion-propuestas/presupuesto/${id}/aprobar`, { method: 'POST' });
                }
                alert(result.message);
                await fetchAndRender();
            } catch (error) {
                alert(`Error al aprobar: ${error.message}`);
            } finally {
                target.disabled = false;
                target.textContent = 'Aprobar';
            }
        }
        
        if (target.classList.contains('reject-btn')) {
             if (!confirm(`¿Estás seguro de que quieres rechazar est${tipo === 'propuesta' ? 'a propuesta' : 'e presupuesto'}?`)) return;
             
             target.disabled = true;
             target.textContent = 'Rechazando...';
             
             try {
                 let result;
                 if (tipo === 'propuesta') {
                     const idsReservas = target.dataset.idsReservas.split(',');
                     result = await fetchAPI(`/gestion-propuestas/propuesta/${id}/rechazar`, { method: 'POST', body: { idsReservas } });
                 } else {
                     result = await fetchAPI(`/gestion-propuestas/presupuesto/${id}/rechazar`, { method: 'POST' });
                 }
                 alert('Propuesta rechazada y eliminada.');
                 await fetchAndRender();
             } catch(error) {
                 alert(`Error: ${error.message}`);
             } finally {
                 target.disabled = false;
                 target.textContent = 'Rechazar';
             }
        }
    });
}