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
                <div class="animate-pulse flex space-x-4"><div class="flex-1 space-y-4 py-1"><div class="h-4 bg-gray-200 rounded w-3/4"></div><div class="space-y-2"><div class="h-4 bg-gray-200 rounded"></div></div></div></div>
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

    } catch (error) {
        console.error(error); // Solo errores críticos
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
    propContainer.innerHTML = '<p class="text-gray-500">Cargando...</p>';
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
        propContainer.innerHTML = `<p class="text-red-500">Error: ${error.message}</p>`;
    }
}