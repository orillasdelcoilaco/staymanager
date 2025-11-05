// frontend/src/views/gestionarPropuestas.js
import { fetchAPI } from '../api.js';
import { handleNavigation } from '../router.js';

let todasLasPropuestas = [];
let todosLosCanales = [];

function formatCurrency(value) { return `$${(Math.round(value) || 0).toLocaleString('es-CL')}`; }
function formatDate(dateString) { return new Date(dateString + 'T00:00:00Z').toLocaleDateString('es-CL', { timeZone: 'UTC' }); }

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

    if (propuestasFiltradas.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center text-gray-500 py-4">No hay propuestas que coincidan con los filtros.</td></tr>';
        return;
    }

    tbody.innerHTML = propuestasFiltradas.map((item, index) => {
        const isIncomplete = !item.clienteId || item.monto === 0;
        const icalIndicator = item.origen === 'ical' ? `<span title="Generado desde iCal" class="mr-2">🗓️</span>` : '';
        const tipoTexto = item.tipo === 'propuesta' ? 'Reserva Tentativa' : 'Presupuesto Formal';
        const clienteNombre = item.origen === 'ical' && isIncomplete ? item.idReservaCanal : (item.clienteNombre || 'N/A');
        const montoTexto = isIncomplete ? 'Por completar' : formatCurrency(item.monto);

        return `
        <tr class="border-b text-sm hover:bg-gray-50">
            <td class="p-2 text-center font-medium text-gray-500">${index + 1}</td>
            <td class="p-2">${icalIndicator}${tipoTexto} ${isIncomplete ? '(Incompleta)' : ''}</td>
            <td class="p-2 font-medium">${item.canalNombre || 'N/A'}</td>
            <td class="p-2 font-medium truncate" style="max-width: 200px;" title="${clienteNombre}">${clienteNombre}</td>
            <td class="p-2">${formatDate(item.fechaLlegada)} al ${formatDate(item.fechaSalida)}</td>
            <td class="p-2">${item.propiedadesNombres}</td>
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
                        <th class="th">Propiedades</th>
                        <th class="th text-right">Monto</th>
                        <th class="th text-center">Acciones</th>
                    </tr></thead>
                    <tbody id="propuestas-tbody"></tbody>
                </table>
            </div>
        </div>
    `;
}

export async function afterRender() {
    await fetchAndRender(); // Esta llamada es correcta

    document.getElementById('canal-filter').addEventListener('change', renderTabla);
    document.getElementById('fecha-inicio-filter').addEventListener('input', renderTabla);
    document.getElementById('fecha-fin-filter').addEventListener('input', renderTabla);

    const tbody = document.getElementById('propuestas-tbody');
    tbody.addEventListener('click', async (e) => {
        const target = e.target;
        const id = target.dataset.id;
        const tipo = target.dataset.tipo;
        if (!id || !tipo) return;

        // --- INICIO DE LA CORRECCIÓN ---
        // (Solo esta sección 'edit-btn' ha sido modificada)
        if (target.classList.contains('edit-btn')) {
            const item = todasLasPropuestas.find(p => p.id === id);
            if (!item) {
                alert('Error: No se pudo encontrar la propuesta para editar.');
                return;
            }
            
            console.log("--- DEBUG: Datos de la propuesta seleccionada ---");
            console.log(item);

            // 1. Obtener el ID de DOCUMENTO para Cargar (GET)
            // item.idsReservas es un array de IDs de documentos de Firestore
            const loadDocId = item.idsReservas && item.idsReservas.length > 0 ? item.idsReservas[0] : null;

            if (!loadDocId) {
                alert(`Error: Esta propuesta (ID: ${id}) no tiene un ID de reserva válido para cargar. No se puede editar.`);
                return;
            }

            // 2. Obtener el resto de los datos (como en tu código original)
            const personas = item.propiedades.reduce((sum, p) => sum + (p.capacidad || 1), 0);
            
            // 3. Construir los parámetros de URL correctos
            const params = new URLSearchParams({
                edit: id,   // El ID de Grupo (para Guardar/PUT) ej: "Miryan Sanchez (4274)"
                load: loadDocId, // El ID de Documento (para Cargar/GET) ej: "aB3xYqZ..."
                props: item.propiedades.map(p => p.id).join(','), // 'props' para coincidir con utils.js
                
                // (Estos son para rellenar, aunque utils.js los cargará de nuevo)
                clienteId: item.clienteId || '',
                fechaLlegada: item.fechaLlegada,
                fechaSalida: item.fechaSalida,
                personas: personas,
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
              _ }
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
indented
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