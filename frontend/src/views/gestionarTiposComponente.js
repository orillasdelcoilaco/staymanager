// frontend/src/views/gestionarTiposComponente.js
import { fetchAPI } from '../api.js';
import { renderTablaTipos } from './components/gestionarTiposComponente/tipos.list.js';
import { renderWizardModal, setupWizardEvents, openWizard } from './components/gestionarTiposComponente/tipos.wizard.js';

let tiposComponente = [];

export async function render() {
    return `
        <div class="bg-white p-8 rounded-lg shadow">
            <div class="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                <div>
                    <h2 class="text-2xl font-semibold text-gray-900">Definición de Espacios (Ontología)</h2>
                    <p class="text-sm text-gray-500 mt-1">Gestiona los tipos de espacios que componen tus alojamientos. La IA definirá los estándares de fotografía para cada uno.</p>
                </div>
                <button id="btn-nuevo-tipo" class="btn-primary flex items-center gap-2">
                    <span class="text-xl">+</span> Agregar Nuevo Tipo
                </button>
            </div>

            <div class="table-container border rounded-lg overflow-hidden">
                <table class="min-w-full bg-white">
                    <thead class="bg-gray-50 border-b">
                        <tr>
                            <th class="py-3 px-4 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Icono</th>
                            <th class="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nombre Estándar</th>
                            <th class="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Definición Comercial</th>
                            <th class="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Requisitos Visuales</th>
                            <th class="py-3 px-4 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
                        </tr>
                    </thead>
                    <tbody id="tipos-tbody" class="divide-y divide-gray-200">
                        </tbody>
                </table>
            </div>
        </div>

        ${renderWizardModal()}
    `;
}

export async function afterRender() {
    console.log('[Tipos] Iniciando vista de Tipos de Componente...');
    await cargarTipos();
    
    setupWizardEvents(async () => {
        console.log('[Tipos] Wizard guardó correctamente. Recargando lista...');
        await cargarTipos();
    });

    document.getElementById('btn-nuevo-tipo').addEventListener('click', openWizard);

    const tbody = document.getElementById('tipos-tbody');
    tbody.addEventListener('click', async (e) => {
        
        // Eliminar
        const btnDelete = e.target.closest('.btn-delete-tipo');
        if (btnDelete) {
            const id = btnDelete.dataset.id;
            if (confirm('¿Eliminar este tipo de componente?')) {
                try {
                    await fetchAPI(`/componentes/${id}`, { method: 'DELETE' });
                    await cargarTipos();
                } catch (error) {
                    alert(error.message);
                }
            }
        }

        // Inicializar Defaults (Botón de Carga Básica)
        if (e.target.id === 'btn-init-defaults') {
            console.log('[Tipos] Click en Cargar Tipos Básicos. Llamando a API...');
            e.target.disabled = true;
            e.target.textContent = 'Creando estructura base (Conectando con IA)...';
            
            try {
                const response = await fetchAPI('/componentes/init-defaults', { method: 'POST' });
                console.log('[Tipos] Respuesta init-defaults:', response);
                
                alert(response.message || 'Tipos creados con éxito.');
                await cargarTipos();
            } catch (error) {
                console.error('[Tipos] Error crítico en init-defaults:', error);
                alert(`Error al crear tipos básicos: ${error.message}. Revisa la consola.`);
            } finally {
                e.target.disabled = false;
            }
        }
    });
}

async function cargarTipos() {
    const tbody = document.getElementById('tipos-tbody');
    try {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4">Cargando ontología...</td></tr>';
        console.log('[Tipos] Fetching /componentes...');
        tiposComponente = await fetchAPI('/componentes');
        console.log(`[Tipos] Cargados ${tiposComponente.length} tipos.`);
        
        tbody.innerHTML = renderTablaTipos(tiposComponente);
    } catch (error) {
        console.error('[Tipos] Error al cargar lista:', error);
        tbody.innerHTML = `<tr><td colspan="5" class="text-center py-4 text-red-500">Error de conexión: ${error.message}</td></tr>`;
    }
}