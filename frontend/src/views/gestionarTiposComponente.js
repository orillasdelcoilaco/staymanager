// frontend/src/views/gestionarTiposComponente.js
import { fetchAPI } from '../api.js';
import { renderTablaTipos } from './components/gestionarTiposComponente/tipos.list.js';
import { renderWizardModal, setupWizardEvents, openWizard } from './components/gestionarTiposComponente/tipos.wizard.js';

let tiposComponente = [];
let tiposFiltrados = [];

export async function render() {
    return `
        <div class="bg-white p-8 rounded-lg shadow">
            <div class="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                <div>
                    <h2 class="text-2xl font-semibold text-gray-900">Definición de Espacios (Ontología)</h2>
                    <p class="text-sm text-gray-500 mt-1">Gestiona los tipos de espacios que componen tus alojamientos. La IA definirá los estándares de fotografía para cada uno.</p>
                </div>
                <!-- Action Buttons & Search -->
                <div class="flex items-center gap-3 w-full md:w-auto">
                    <div class="relative flex-1 md:flex-initial">
                        <input type="text" id="input-busqueda-tipo" 
                            placeholder="🔍 Buscar activo..." 
                            class="form-input w-full md:w-64 pl-8 text-sm border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
                        >
                    </div>
                    <button id="btn-nuevo-tipo" class="btn-primary flex items-center gap-2 whitespace-nowrap">
                        <span class="text-xl">+</span> Nuevo Tipo
                    </button>
                </div>
            </div>

            <!-- BANNER PASO 2 -->
            <div class="mb-6 p-4 bg-primary-50 border border-primary-100 rounded-lg text-sm text-primary-800">
                <div class="flex items-start gap-3">
                    <span class="text-lg mt-0.5">🏠</span>
                    <div>
                        <p class="font-semibold mb-1">Paso 2 de 3 — Definición de Espacios</p>
                        <p>Cada espacio (ej: Dormitorio Principal, Terraza) agrupa los <strong>activos</strong> definidos en el Paso 1. En el Paso 3 asignarás espacios a cada alojamiento. La IA generará estándares de fotografía y narrativa comercial a partir de la composición de cada espacio.</p>
                    </div>
                </div>
            </div>

            <div class="table-container border rounded-lg overflow-auto max-h-[70vh]">
                <table class="min-w-full bg-white">
                    <thead class="bg-gray-50 border-b sticky top-0 z-10">
                        <tr>
                            <th class="py-3 px-4 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-16">Icono</th>
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

    // --- Lógica de Búsqueda ---
    const inputSearch = document.getElementById('input-busqueda-tipo');
    inputSearch.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase().trim();
        filtrarYRenderizar(query);
    });

    const tbody = document.getElementById('tipos-tbody');
    if (!tbody.dataset.listenerAttached) {
        tbody.dataset.listenerAttached = 'true';
        tbody.addEventListener('click', async (e) => {
            // Collapse/Expand Handler
            const toggleBtn = e.target.closest('.btn-toggle-categoria');
            if (toggleBtn) {
                const slug = toggleBtn.dataset.catSlug;
                // DEBUG ALERT
                // alert(`Toggling: ${slug}`);
                console.log(`[Collapse] Clicked on slug: ${slug}`);

                const rows = document.querySelectorAll(`.group-cat-${CSS.escape(slug)}`);

                if (rows.length === 0) return;

                const isHidden = rows[0].classList.contains('hidden');

                rows.forEach(r => {
                    if (isHidden) r.classList.remove('hidden');
                    else r.classList.add('hidden');
                });

                const chevron = toggleBtn.querySelector('.icon-chevron');
                if (chevron) {
                    chevron.style.transform = isHidden ? 'rotate(0deg)' : 'rotate(-180deg)';
                }
                return;
            }

            // Editar
            const btnEdit = e.target.closest('.btn-edit-tipo');
            if (btnEdit) {
                const id = btnEdit.dataset.id;
                const tipo = tiposComponente.find(t => t.id === id);
                if (tipo) {
                    const { openWizardForEdit } = await import('./components/gestionarTiposComponente/tipos.wizard.js');
                    openWizardForEdit(tipo);
                }
                return;
            }

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
}

async function cargarTipos() {
    const tbody = document.getElementById('tipos-tbody');
    try {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4">Cargando ontología...</td></tr>';
        console.log('[Tipos] Fetching /componentes...');
        tiposComponente = await fetchAPI(`/componentes?t=${Date.now()}`);
        console.log(`[Tipos] Cargados ${tiposComponente.length} tipos.`);

        // Inicializar filtrados con todos
        filtrarYRenderizar('');
    } catch (error) {
        console.error('[Tipos] Error al cargar lista:', error);
        tbody.innerHTML = `<tr><td colspan="5" class="text-center py-4 text-danger-500">Error de conexión: ${error.message}</td></tr>`;
    }
}

function filtrarYRenderizar(query) {
    const tbody = document.getElementById('tipos-tbody');

    if (!query) {
        tiposFiltrados = [...tiposComponente];
    } else {
        tiposFiltrados = tiposComponente.filter(t => {
            const nombre = (t.nombreNormalizado || '').toLowerCase();
            const original = (t.nombreUsuario || '').toLowerCase();
            const cat = (t.categoria || '').toLowerCase();
            return nombre.includes(query) || original.includes(query) || cat.includes(query);
        });
    }

    tbody.innerHTML = renderTablaTipos(tiposFiltrados);
}