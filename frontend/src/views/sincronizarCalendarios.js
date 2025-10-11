// frontend/src/views/sincronizarCalendarios.js
import { fetchAPI } from '../api.js';

let propiedades = [];
let canales = [];
let currentUser = null;

async function renderExportLinks() {
    const container = document.getElementById('export-links-container');
    const loading = document.getElementById('export-loading');

    if (propiedades.length === 0) {
        loading.innerHTML = '<p class="text-center text-gray-500">No hay propiedades configuradas para generar enlaces iCal.</p>';
        return;
    }

    const API_BASE_URL = window.location.origin;

    container.innerHTML = propiedades.map(prop => {
        const icalUrl = `${API_BASE_URL}/ical/${currentUser.empresaId}/${prop.id}.ics`;
        return `
            <div class="p-4 border rounded-lg flex flex-col md:flex-row items-start md:items-center justify-between">
                <div class="mb-2 md:mb-0">
                    <p class="font-semibold text-gray-800">${prop.nombre}</p>
                    <input type="text" readonly value="${icalUrl}" class="text-sm text-gray-500 w-full md:w-96 mt-1 p-1 border rounded bg-gray-50">
                </div>
                <button data-url="${icalUrl}" class="copy-btn btn-secondary">
                    Copiar URL
                </button>
            </div>
        `;
    }).join('');

    loading.classList.add('hidden');
    
    document.querySelectorAll('.copy-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const url = e.target.dataset.url;
            navigator.clipboard.writeText(url).then(() => {
                e.target.textContent = '¡Copiado!';
                setTimeout(() => { e.target.textContent = 'Copiar URL'; }, 2000);
            });
        });
    });
}


export async function render() {
    return `
        <div class="space-y-8">
            <div class="bg-white p-8 rounded-lg shadow">
                <h2 class="text-2xl font-semibold text-gray-900 mb-2">Exportar Calendarios (iCal)</h2>
                <p class="text-gray-600 mb-6">
                    Usa estas URLs para sincronizar la disponibilidad desde SuiteManager hacia otros canales como Booking, Airbnb o tu propio sitio web.
                </p>
                <div id="export-loading" class="text-center p-8">
                    <p class="text-gray-500">Cargando listado de propiedades...</p>
                </div>
                <div id="export-links-container" class="space-y-4"></div>
            </div>

            <div class="bg-white p-8 rounded-lg shadow">
                <h2 class="text-2xl font-semibold text-gray-900 mb-2">Importar Calendarios Externos</h2>
                <p class="text-gray-600 mb-6">
                    Filtra por canal y/o rango de fechas para importar reservas externas y crear borradores en "Gestionar Propuestas".
                </p>
                
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4 items-end p-4 border rounded-md bg-gray-50">
                    <div>
                        <label for="canal-filter-import" class="block text-sm font-medium text-gray-700">Canal a Sincronizar</label>
                        <select id="canal-filter-import" class="form-select mt-1">
                            <option value="">Todos los Canales</option>
                        </select>
                    </div>
                    <div>
                        <label for="fecha-inicio-import" class="block text-sm font-medium text-gray-700">Desde (Fecha de Inicio de la Reserva)</label>
                        <input type="date" id="fecha-inicio-import" class="form-input mt-1">
                    </div>
                    <div>
                        <label for="fecha-fin-import" class="block text-sm font-medium text-gray-700">Hasta (Fecha de Inicio de la Reserva)</label>
                        <input type="date" id="fecha-fin-import" class="form-input mt-1">
                    </div>
                </div>

                <div class="mt-6 text-center">
                    <button id="sync-ical-btn" class="btn-primary btn-lg">
                        Sincronizar Ahora
                    </button>
                </div>
                <div id="sync-status" class="mt-4 p-4 rounded-md hidden"></div>
            </div>
        </div>
    `;
}

export async function afterRender() {
    try {
        [propiedades, canales, currentUser] = await Promise.all([
            fetchAPI('/propiedades'),
            fetchAPI('/canales'),
            fetchAPI('/auth/me')
        ]);
        renderExportLinks();
        
        const canalSelect = document.getElementById('canal-filter-import');
        canales.forEach(canal => {
            if (canal.nombre.toLowerCase() !== 'app') {
                canalSelect.add(new Option(canal.nombre, canal.id));
            }
        });

    } catch (error) {
        document.getElementById('export-loading').innerHTML = `<p class="text-red-500">Error al cargar los datos: ${error.message}</p>`;
    }

    const syncBtn = document.getElementById('sync-ical-btn');
    const syncStatus = document.getElementById('sync-status');

    syncBtn.addEventListener('click', async () => {
        syncBtn.disabled = true;
        syncBtn.textContent = 'Sincronizando...';
        syncStatus.className = 'mt-4 p-4 rounded-md text-sm bg-blue-100 text-blue-800';
        syncStatus.innerHTML = 'Iniciando proceso... Esto puede tardar unos segundos.';
        syncStatus.classList.remove('hidden');
        
        const payload = {
            canalFiltroId: document.getElementById('canal-filter-import').value,
            fechaInicio: document.getElementById('fecha-inicio-import').value || null,
            fechaFin: document.getElementById('fecha-fin-import').value || null
        };

        try {
            const result = await fetchAPI('/sincronizar/ical', { 
                method: 'POST',
                body: payload
            });
            const { propiedadesRevisadas, nuevasReservasCreadas, errores } = result.summary;
            
            let summaryHtml = `<strong>¡Sincronización completada!</strong><ul class="list-disc list-inside mt-2">
                <li>Propiedades con URLs de iCal revisadas: <strong>${propiedadesRevisadas}</strong></li>
                <li>Nuevas reservas provisionales creadas: <strong>${nuevasReservasCreadas}</strong></li>
                <li>Errores encontrados: <strong>${errores.length}</strong></li>
            </ul>`;
            
            if (errores.length > 0) {
                summaryHtml += `<p class="mt-2 font-semibold">Detalle de errores:</p><ul class="list-disc list-inside">${errores.map(e => `<li>${e}</li>`).join('')}</ul>`;
                 syncStatus.className = 'mt-4 p-4 rounded-md text-sm bg-yellow-100 text-yellow-800';
            } else {
                 syncStatus.className = 'mt-4 p-4 rounded-md text-sm bg-green-100 text-green-800';
            }

            syncStatus.innerHTML = summaryHtml;
            
        } catch (error) {
            syncStatus.className = 'mt-4 p-4 rounded-md text-sm bg-red-100 text-red-800';
            syncStatus.innerHTML = `<strong>Error:</strong> ${error.message}`;
        } finally {
            syncBtn.disabled = false;
            syncBtn.textContent = 'Sincronizar Ahora';
        }
    });
}