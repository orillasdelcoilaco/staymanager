// frontend/src/views/configurarWebPublica.js
import { fetchAPI } from '../api.js';
import { renderGeneral, setupGeneralEvents } from './components/configurarWebPublica/webPublica.general.js';
import { initPropiedad, renderPropiedadSettings, setupPropiedadEvents } from './components/configurarWebPublica/webPublica.propiedad.js';
import { initGaleria, renderGaleria, setupGaleriaEvents } from './components/configurarWebPublica/webPublica.galeria.js';

let todasLasPropiedades = [];
let empresaInfo = {};

export async function render() {
    return `
        <div class="bg-white p-8 rounded-lg shadow space-y-6">
            <h2 class="text-2xl font-semibold text-gray-900">Configurar Contenido Web Público (SSR)</h2>
            
            <div id="contenedor-general">
                <p class="text-gray-500">Cargando configuración general...</p>
            </div>
            
            <div class="border-t pt-6">
                <h3 class="text-xl font-bold text-gray-800 mb-4">Contenido por Alojamiento</h3>
                 <div>
                    <label for="propiedad-select" class="block text-sm font-medium text-gray-700">Seleccionar Alojamiento</label>
                    <select id="propiedad-select" class="form-select mt-1">
                        <option value="">-- Cargando... --</option>
                    </select>
                </div>

                <div id="config-container-propiedad" class="hidden space-y-6 mt-4">
                    <div id="contenedor-propiedad"></div>
                    <div id="contenedor-galeria"></div>
                </div>
            </div>

            <div class="border-t pt-8 mt-8">
                <details>
                    <summary class="text-xs text-gray-400 cursor-pointer hover:text-gray-600">Herramientas de Sistema (Click para expandir)</summary>
                    <div class="p-4 bg-gray-50 rounded mt-2 border">
                        <p class="text-xs text-gray-600 mb-2">Si tienes problemas editando imágenes (error de carga/bloqueo), presiona este botón una vez:</p>
                        <button id="btn-fix-cors" class="btn-secondary text-xs bg-gray-200 hover:bg-gray-300 text-gray-700">
                            🛠️ Habilitar Edición de Imágenes (Reparar CORS)
                        </button>
                    </div>
                </details>
            </div>
        </div>
    `;
}

export async function afterRender() {
    try {
        console.log('[ConfigWeb] Iniciando carga de datos...');
        
        const [empresa, propiedades, configWeb] = await Promise.all([
            fetchAPI('/empresa'),
            fetchAPI('/propiedades'),
            fetchAPI('/website-config/configuracion-web')
        ]);
        
        empresaInfo = empresa;
        todasLasPropiedades = propiedades;

        const containerGeneral = document.getElementById('contenedor-general');
        if (containerGeneral) {
            containerGeneral.innerHTML = renderGeneral(configWeb || {});
            setupGeneralEvents();
        }

        const select = document.getElementById('propiedad-select');
        if (select) {
            select.innerHTML = '<option value="">-- Elige un alojamiento --</option>' +
                todasLasPropiedades
                .sort((a, b) => a.nombre.localeCompare(b.nombre))
                .map(p => `<option value="${p.id}">${p.nombre}</option>`).join('');

            select.addEventListener('change', async (e) => handlePropiedadChange(e.target.value));
        }

        // NUEVO: Listener para el botón de reparación CORS
        document.getElementById('btn-fix-cors')?.addEventListener('click', async (e) => {
            const btn = e.target;
            btn.disabled = true;
            btn.textContent = 'Configurando permisos...';
            try {
                const result = await fetchAPI('/website-config/fix-storage-cors', { method: 'POST' });
                alert(`✅ ${result.message}\n\nAhora intenta editar una imagen nuevamente.`);
            } catch (error) {
                alert(`❌ Error: ${error.message}`);
            } finally {
                btn.disabled = false;
                btn.textContent = '🛠️ Habilitar Edición de Imágenes (Reparar CORS)';
            }
        });

    } catch (error) {
        console.error('[ConfigWeb] Error crítico:', error);
        const container = document.querySelector('.bg-white');
        if (container) container.innerHTML = `<p class="text-red-500">Error de carga: ${error.message}</p>`;
    }
}

async function handlePropiedadChange(propiedadId) {
    const container = document.getElementById('config-container-propiedad');
    const propContainer = document.getElementById('contenedor-propiedad');
    const galContainer = document.getElementById('contenedor-galeria');

    if (!propiedadId) {
        container.classList.add('hidden');
        return;
    }

    container.classList.remove('hidden');
    propContainer.innerHTML = '<p class="text-gray-500">Cargando datos de la propiedad...</p>';
    galContainer.innerHTML = '';

    try {
        const websiteData = await fetchAPI(`/website-config/propiedad/${propiedadId}`);
        const propiedad = todasLasPropiedades.find(p => p.id === propiedadId);

        initPropiedad(propiedad, websiteData, empresaInfo.nombre);
        initGaleria(propiedadId, websiteData.images);

        propContainer.innerHTML = renderPropiedadSettings();
        galContainer.innerHTML = renderGaleria(propiedad.componentes);

        setupPropiedadEvents();
        setupGaleriaEvents();

    } catch (error) {
        console.error('[ConfigWeb] Error al cargar propiedad:', error);
        propContainer.innerHTML = `<p class="text-red-500">Error cargando propiedad: ${error.message}</p>`;
    }
}