// frontend/src/views/gestionarPropuestas.js
import { fetchAPI } from '../api.js';
import { handleNavigation } from '../router.js';

let todasLasPropuestas = [];
let todosLosCanales = [];
let listenerAgregado = false; // Flag para evitar duplicación de listeners

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

    // Ordenar: incompletas/iCal primero, luego por fecha de llegada
    propuestasFiltradas.sort((a, b) => {
        const aIncompleta = (!a.clienteId || a.monto === 0 || (a.origen === 'ical' && !a.clienteId));
        const bIncompleta = (!b.clienteId || b.monto === 0 || (b.origen === 'ical' && !b.clienteId));
        if (aIncompleta && !bIncompleta) return -1;
        if (!aIncompleta && bIncompleta) return 1;
        return new Date(b.fechaLlegada) - new Date(a.fechaLlegada);
    });

    if (propuestasFiltradas.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10" class="text-center text-gray-500 py-4">No hay propuestas que coincidan con los filtros.</td></tr>';
        return;
    }

    tbody.innerHTML = propuestasFiltradas.map((item, index) => {
        const isIncomplete = !item.clienteId || item.monto === 0 || (item.origen === 'ical' && !item.clienteId);
        const icalIndicator = item.origen === 'ical' ? `<span title="Generado desde iCal" class="mr-2">🗓️</span>` : '';
        const tipoTexto = item.tipo === 'propuesta' ? 'Reserva Tentativa' : 'Presupuesto Formal';
        const clienteNombre = item.origen === 'ical' && isIncomplete ? (item.idReservaCanal || item.id) : (item.clienteNombre || 'N/A');
        const montoTexto = (isIncomplete && item.monto === 0) ? 'Por completar' : formatCurrency(item.monto);
        
        const personasTexto = item.personas > 0 ? item.personas : (isIncomplete ? '?' : 'N/A');
        const noches = Math.round((new Date(item.fechaSalida) - new Date(item.fechaLlegada)) / (1000 * 60 * 60 * 24));

        return `
        <tr class="border-b text-sm hover:bg-gray-50 ${isIncomplete ? 'bg-yellow-50' : ''}">
            <td class="p-2 text-center font-medium text-gray-500">${index + 1}</td>
            <td class="p-2">${icalIndicator}${tipoTexto} ${isIncomplete ? '<span class="text-red-600 font-medium">(Incompleta)</span>' : ''}</td>
            <td class="p-2 font-medium">${item.canalNombre || 'N/A'}</td>
            <td class="p-2 font-medium truncate" style="max-width: 200px;" title="${clienteNombre}">${clienteNombre}</td>
            <td class="p-2">${formatDate(item.fechaLlegada)} al ${formatDate(item.fechaSalida)}</td>
            <td class="p-2 text-center">${noches}</td>
            <td class="p-2 text-center font-bold">${personasTexto}</td>
            <td class="p-2">${item.propiedadesNombres}</td>
            <td class="p-2 font-semibold text-right">${montoTexto}</td>
            <td class="p-2 text-center space-x-2 whitespace-nowrap">
                <button data-id="${item.id}" data-tipo="${item.tipo}" class="edit-btn btn-table-copy">Editar/Completar</button>
                <button data-id="${item.id}" data-tipo="${item.tipo}" data-ids-reservas="${item.idsReservas?.join(',')}" data-cliente-id="${item.clienteId || ''}" class="approve-btn btn-table-edit" ${isIncomplete ? 'disabled' : ''}>Aprobar</button>
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
        if (tbody) tbody.innerHTML = `<tr><td colspan="10" class="text-center text-red-500 py-4">Error al cargar: ${error.message}</td></tr>`;
    }
}

// Handler separado para poder removerlo si es necesario
async function handleTableClick(e) {
    const target = e.target;
    
    // Verificar que sea un botón con los datos necesarios
    if (!target.matches('button[data-id]')) return;
    
    // Prevenir múltiples clics
    if (target.dataset.processing === 'true') return;
    
    const id = target.dataset.id;
    const tipo = target.dataset.tipo;
    if (!id || !tipo) return;

    // --- EDITAR ---
    if (target.classList.contains('edit-btn')) {
        const item = todasLasPropuestas.find(p => p.id === id);
        if (!item) {
            alert('Error: No se pudo encontrar el ítem para editar.');
            return;
        }

        const personas = item.personas || 1;
        let params;
        let route;

        if (item.tipo === 'propuesta') {
            const loadDocId = item.idsReservas && item.idsReservas.length > 0 ? item.idsReservas[0] : null;

            if (!loadDocId) {
                alert(`Error: Esta propuesta (ID: ${id}) no tiene un ID de reserva válido para cargar.`);
                return;
            }

            params = new URLSearchParams({
                edit: id,
                load: loadDocId,
                props: item.propiedades.map(p => p.id).join(','),
                clienteId: item.clienteId || '',
                fechaLlegada: item.fechaLlegada,
                fechaSalida: item.fechaSalida,
                personas: personas,
                idReservaCanal: item.idReservaCanal || '',
                canalId: item.canalId || '',
                origen: item.origen || 'manual',
                icalUid: item.icalUid || ''
            });
            route = '/agregar-propuesta';

        } else {
            params = new URLSearchParams({
                edit: item.id,
                clienteId: item.clienteId || '',
                fechaLlegada: item.fechaLlegada,
                fechaSalida: item.fechaSalida,
                personas: item.personas || 1, 
                propiedades: item.propiedades.map(p => p.id).join(','),
                canalId: item.canalId || '',
                origen: item.origen || 'manual'
            });
            route = '/generar-presupuesto';
        }

        handleNavigation(`${route}?${params.toString()}`);
        return;
    }
    
    // --- APROBAR ---
    if (target.classList.contains('approve-btn')) {
        // Marcar como procesando para evitar doble clic
        target.dataset.processing = 'true';
        target.disabled = true;
        const textoOriginal = target.textContent;
        target.textContent = 'Verificando...';

        try {
            let result;
            if (tipo === 'propuesta') {
                const idsReservas = target.dataset.idsReservas?.split(',').filter(Boolean) || [];
                if (idsReservas.length === 0) {
                    throw new Error('No se encontraron IDs de reserva para aprobar.');
                }
                
                // Primero verificar disponibilidad (sin confirmación del usuario aún)
                result = await fetchAPI(`/gestion-propuestas/propuesta/${id}/verificar-disponibilidad`, { 
                    method: 'POST', 
                    body: { idsReservas } 
                });
                
                // Si hay disponibilidad, ahora sí pedir confirmación
                const tipoTexto = 'esta propuesta';
                if (!confirm(`¿Estás seguro de que quieres aprobar ${tipoTexto}?\n\nLa disponibilidad ha sido verificada.`)) {
                    target.disabled = false;
                    target.textContent = textoOriginal;
                    target.dataset.processing = 'false';
                    return;
                }
                
                target.textContent = 'Aprobando...';
                
                // Ahora sí aprobar
                result = await fetchAPI(`/gestion-propuestas/propuesta/${id}/aprobar`, { 
                    method: 'POST', 
                    body: { idsReservas } 
                });
            } else {
                // Para presupuestos, mantener el flujo original
                const tipoTexto = 'este presupuesto';
                if (!confirm(`¿Estás seguro de que quieres aprobar ${tipoTexto}?\n\nSe verificará la disponibilidad antes de confirmar.`)) {
                    target.disabled = false;
                    target.textContent = textoOriginal;
                    target.dataset.processing = 'false';
                    return;
                }
                
                target.textContent = 'Aprobando...';
                result = await fetchAPI(`/gestion-propuestas/presupuesto/${id}/aprobar`, { 
                    method: 'POST' 
                });
            }
            
            // Solo mostrar éxito si llegamos aquí
            alert('✅ ' + result.message);
            await fetchAndRender();
            
        } catch (error) {
            alert(`❌ Error al aprobar: ${error.message}`);
            // Restaurar botón
            target.disabled = false;
            target.textContent = textoOriginal;
        } finally {
            target.dataset.processing = 'false';
        }
        return;
    }
    
    // --- RECHAZAR ---
    if (target.classList.contains('reject-btn')) {
        const tipoTexto = tipo === 'propuesta' ? 'esta propuesta' : 'este presupuesto';
        
        if (!confirm(`¿Estás seguro de que quieres rechazar ${tipoTexto}?\n\nEsta acción eliminará la propuesta permanentemente.`)) {
            return;
        }
        
        // Marcar como procesando
        target.dataset.processing = 'true';
        target.disabled = true;
        const textoOriginal = target.textContent;
        target.textContent = 'Eliminando...';
         
        try {
            if (tipo === 'propuesta') {
                const idsReservas = target.dataset.idsReservas?.split(',').filter(Boolean) || [];
                await fetchAPI(`/gestion-propuestas/propuesta/${id}/rechazar`, { 
                    method: 'POST', 
                    body: { idsReservas } 
                });
            } else {
                await fetchAPI(`/gestion-propuestas/presupuesto/${id}/rechazar`, { 
                    method: 'POST' 
                });
            }
            
            alert('✅ Propuesta rechazada y eliminada.');
            await fetchAndRender();
            
        } catch(error) {
            alert(`❌ Error: ${error.message}`);
            target.disabled = false;
            target.textContent = textoOriginal;
        } finally {
            target.dataset.processing = 'false';
        }
        return;
    }
}

export async function render() {
    // Resetear el flag cuando se renderiza la vista
    listenerAgregado = false;
    
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
                        <th class="th text-center">Noches</th>
                        <th class="th text-center">Pers.</th>
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
    await fetchAndRender();

    document.getElementById('canal-filter').addEventListener('change', renderTabla);
    document.getElementById('fecha-inicio-filter').addEventListener('input', renderTabla);
    document.getElementById('fecha-fin-filter').addEventListener('input', renderTabla);

    const tbody = document.getElementById('propuestas-tbody');
    
    // Solo agregar el listener si no se ha agregado antes
    if (!listenerAgregado && tbody) {
        tbody.addEventListener('click', handleTableClick);
        listenerAgregado = true;
    }
}