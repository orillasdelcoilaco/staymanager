// frontend/src/views/websiteAlojamientos.js
import { fetchAPI } from '../api.js';
import { initPropiedad, renderPropiedadSettings, setupPropiedadEvents } from './components/configurarWebPublica/webPublica.propiedad.js';
import { initGaleria, renderGaleria, setupGaleriaEvents } from './components/configurarWebPublica/webPublica.galeria.js';

let todasLasPropiedades = [];
let todosLosTipos = [];
let empresaInfo = {};

export async function render() {
    return `
        <div class="bg-white p-8 rounded-lg shadow space-y-6">
            <div class="border-b pb-4 mb-4">
                <h2 class="text-2xl font-semibold text-gray-900">Contenido por Alojamiento</h2>
                <p class="text-gray-500 mt-1">Personaliza cómo se ven tus cabañas o habitaciones en el sitio web (fotos, descripciones, características).</p>
            </div>
            
            <div>
                <label for="propiedad-select" class="block text-sm font-medium text-gray-700">Seleccionar Alojamiento a Editar</label>
                <select id="propiedad-select" class="form-select mt-1 max-w-md">
                    <option value="">-- Cargando lista... --</option>
                </select>
            </div>

            <div id="config-container-propiedad" class="hidden space-y-8 mt-6">
                <div id="contenedor-propiedad" class="bg-gray-50 p-6 rounded-lg border border-gray-200"></div>
                
                <div class="border-t pt-6">
                    <h3 class="text-lg font-semibold text-gray-800 mb-4">Galería de Imágenes</h3>
                    <div id="contenedor-galeria"></div>
                </div>
            </div>
            
            <div id="loading-message" class="hidden text-center py-8 text-gray-500">
                Cargando datos...
            </div>
        </div>
    `;
}

export async function afterRender() {
    try {
        // Carga de datos
        const [empresa, propiedades, tipos] = await Promise.all([
            fetchAPI('/empresa'),
            fetchAPI('/propiedades'),
            fetchAPI('/componentes')
        ]);

        empresaInfo = empresa;
        todasLasPropiedades = propiedades;
        todosLosTipos = tipos;

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
        if (container) container.innerHTML += `<p class="text-red-500 mt-4">Error de carga: ${error.message}</p>`;
    }
}

async function handlePropiedadChange(propiedadId) {
    const container = document.getElementById('config-container-propiedad');
    const propContainer = document.getElementById('contenedor-propiedad');
    const galContainer = document.getElementById('contenedor-galeria');
    const loadingMsg = document.getElementById('loading-message');

    if (!propiedadId) {
        container.classList.add('hidden');
        return;
    }

    container.classList.add('hidden');
    if (loadingMsg) loadingMsg.classList.remove('hidden');

    try {
        const websiteData = await fetchAPI(`/website/propiedad/${propiedadId}`);
        const propiedad = todasLasPropiedades.find(p => p.id === propiedadId);

        initPropiedad(propiedad, websiteData, empresaInfo.nombre);
        await initGaleria(propiedadId, websiteData.images);

        propContainer.innerHTML = renderPropiedadSettings();
        galContainer.innerHTML = renderGaleria(propiedad.componentes, todosLosTipos);

        setupPropiedadEvents();
        setupGaleriaEvents();

        if (loadingMsg) loadingMsg.classList.add('hidden');
        container.classList.remove('hidden');

    } catch (error) {
        console.error('Error al cargar propiedad:', error);
        if (loadingMsg) loadingMsg.classList.add('hidden');
        alert(`Error cargando datos de la propiedad: ${error.message}`);
    }
}
