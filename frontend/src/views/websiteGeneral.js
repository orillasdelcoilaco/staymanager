// frontend/src/views/websiteGeneral.js
import { fetchAPI } from '../api.js';
import { renderGeneral, setupGeneralEvents } from './components/configurarWebPublica/webPublica.general.js';

export async function render() {
    return `
        <div class="bg-white p-8 rounded-lg shadow space-y-6">
            <div class="border-b pb-4 mb-4">
                <h2 class="text-2xl font-semibold text-gray-900">Configuración General del Sitio Web</h2>
                <p class="text-gray-500 mt-1">Define la identidad visual, dominio y SEO global de tu página pública.</p>
            </div>
            
            <div id="contenedor-general">
                <div class="flex justify-center p-8">
                    <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                </div>
            </div>
        </div>
    `;
}

export async function afterRender() {
    try {
        // Ejecutar configuración de CORS en segundo plano por si acaso
        fetchAPI('/website/fix-storage-cors', { method: 'POST' })
            .catch(err => console.warn("CORS Auto-fix warning:", err));

        // Cargar configuración completa de la empresa
        const empresaData = await fetchAPI('/empresa');

        const containerGeneral = document.getElementById('contenedor-general');
        if (containerGeneral) {
            containerGeneral.innerHTML = renderGeneral(empresaData || {});
            setupGeneralEvents();
        }

    } catch (error) {
        console.error('Error en carga inicial:', error);
        const container = document.getElementById('contenedor-general');
        if (container) container.innerHTML = `<p class="text-red-500">Error de carga: ${error.message}</p>`;
    }
}
