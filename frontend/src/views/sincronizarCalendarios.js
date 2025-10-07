// frontend/src/views/sincronizarCalendarios.js
import { fetchAPI } from '../api.js';

let propiedades = [];
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
                const originalText = e.target.textContent;
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
                    Presiona el botón para leer los calendarios de canales externos (cuyas URLs hayas guardado en "Gestionar Alojamientos") y crear reservas provisionales en "Gestionar Propuestas".
                </p>
                <button id="sync-ical-btn" class="btn-primary">
                    Sincronizar Ahora
                </button>
                <div id="sync-status" class="mt-4 p-4 rounded-md hidden"></div>
            </div>
        </div>
    `;
}

export async function afterRender() {
    try {
        [propiedades, currentUser] = await Promise.all([
            fetchAPI('/propiedades'),
            fetchAPI('/auth/me')
        ]);
        renderExportLinks();
    } catch (error) {
        document.getElementById('export-loading').innerHTML = `<p class="text-red-500">Error al cargar las propiedades: ${error.message}</p>`;
    }

    const syncBtn = document.getElementById('sync-ical-btn');
    const syncStatus = document.getElementById('sync-status');

    syncBtn.addEventListener('click', async () => {
        syncBtn.disabled = true;
        syncBtn.textContent = 'Sincronizando...';
        syncStatus.className = 'mt-4 p-4 rounded-md text-sm bg-blue-100 text-blue-800';
        syncStatus.innerHTML = 'Iniciando proceso... Esto puede tardar unos segundos.';
        syncStatus.classList.remove('hidden');

        try {
            const result = await fetchAPI('/sincronizar/ical', { method: 'POST' });
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