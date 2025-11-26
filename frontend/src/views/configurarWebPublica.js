// frontend/src/views/configurarWebPublica.js
import { fetchAPI } from '../api.js';
import { renderGeneral, setupGeneralEvents } from './components/configurarWebPublica/webPublica.general.js';
import { initPropiedad, renderPropiedadSettings, setupPropiedadEvents } from './components/configurarWebPublica/webPublica.propiedad.js';
import { initGaleria, renderGaleria, setupGaleriaEvents } from './components/configurarWebPublica/webPublica.galeria.js';

let todasLasPropiedades = [];
let todosLosTipos = []; // Nueva variable para la ontología
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
        </div>
    `;
}

export async function afterRender() {
    try {
        // Ejecutar configuración de CORS en segundo plano
        fetchAPI('/website-config/fix-storage-cors', { method: 'POST' })
            .catch(err => console.warn("CORS Auto-fix warning:", err));

        // 1. Carga de datos (Incluyendo /componentes para la IA)
        const [empresa, propiedades, configWeb, tipos] = await Promise.all([
            fetchAPI('/empresa'),
            fetchAPI('/propiedades'),
            fetchAPI('/website-config/configuracion-web'),
            fetchAPI('/componentes') // Traemos la inteligencia
        ]);
        
        empresaInfo = empresa;
        todasLasPropiedades = propiedades;
        todosLosTipos = tipos;

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

    } catch (error) {
        console.error('Error en carga inicial:', error);
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
        
        // *** AQUÍ ESTÁ LA MAGIA DE LA INTEGRACIÓN ***
        // Pasamos los componentes de la propiedad y la lista maestra de tipos
        // para que la galería pueda cruzar datos y mostrar el Shot List.
        galContainer.innerHTML = renderGaleria(propiedad.componentes, todosLosTipos);

        setupPropiedadEvents();
        setupGaleriaEvents();

    } catch (error) {
        console.error('Error al cargar propiedad:', error);
        propContainer.innerHTML = `<p class="text-red-500">Error cargando propiedad: ${error.message}</p>`;
    }
}