import { fetchAPI } from '../api.js';
import { renderFilasTabla } from './components/gestionarAlojamientos/alojamientos.table.js';
import { renderModalAlojamiento, setupModalAlojamiento, abrirModalAlojamiento } from './components/gestionarAlojamientos/alojamientos.modals.js';
import { abrirModalAreasComunes } from './components/gestionarAlojamientos/areasComunes.modal.js';

let propiedades = [];
let canales = [];

async function cargarDatos() {
    try {
        [propiedades, canales] = await Promise.all([
            fetchAPI(`/propiedades?t=${Date.now()}`),
            fetchAPI('/canales')
        ]);
        const tbody = document.getElementById('propiedades-tbody');
        if (tbody) {
            tbody.innerHTML = renderFilasTabla(propiedades);
        }
    } catch (error) {
        console.error("Error al cargar datos:", error);
        const container = document.querySelector('.table-container');
        if (container) {
            container.innerHTML = `<p class="text-danger-500 p-4">Error al cargar los datos. Por favor, intente de nuevo.</p>`;
        }
    }
}

export async function render() {
    try {
        [propiedades, canales] = await Promise.all([
            fetchAPI(`/propiedades?t=${Date.now()}`),
            fetchAPI('/canales')
        ]);

        return `
            <div class="container mx-auto px-4 py-8">
                <div class="flex justify-between items-center mb-6">
                    <h1 class="text-2xl font-bold text-gray-800">Gestionar Alojamientos</h1>
                    <button id="add-propiedad-btn" class="btn-primary">
                        + Agregar Alojamiento
                    </button>
                </div>
                <!-- BANNER PASO 3 -->
                <div class="mb-4 p-4 bg-primary-50 border border-primary-100 rounded-lg text-sm text-primary-800">
                    <div class="flex items-start gap-3">
                        <span class="text-lg mt-0.5">🏡</span>
                        <div>
                            <p class="font-semibold mb-1">Paso 3 de 3 — Alojamientos</p>
                            <p>Combina los <strong>espacios</strong> del Paso 2 para configurar cada alojamiento. Al guardar, la IA sincroniza automáticamente el contexto completo de la propiedad (activos, capacidad, espacios) para generar descripciones y fichas schema.org.</p>
                        </div>
                    </div>
                </div>

                <!-- BLOQUE INSTALACIONES DEL RECINTO -->
                <div class="mb-6 bg-white border border-success-100 rounded-xl shadow-sm overflow-hidden">
                    <div class="flex items-center justify-between p-4 bg-success-50 border-b border-success-100">
                        <div class="flex items-center gap-3">
                            <span class="text-xl">🌿</span>
                            <div>
                                <h3 class="font-semibold text-success-800 text-sm">Instalaciones del Recinto</h3>
                                <p class="text-xs text-success-600">Amenidades y áreas compartidas entre todos los alojamientos (piscina, quincho, estacionamiento, etc.)</p>
                            </div>
                        </div>
                        <button id="gestionar-areas-btn" class="btn-outline text-sm border-success-300 text-success-700 hover:bg-success-100">
                            Gestionar instalaciones
                        </button>
                    </div>
                    <div id="areas-resumen" class="px-4 py-3 text-xs text-gray-400 italic">
                        Cargando…
                    </div>
                </div>

                <div class="bg-white shadow-md rounded my-6 overflow-x-auto table-container">
                    <table class="min-w-full w-full table-auto">
                        <thead>
                            <tr class="bg-gray-200 text-gray-600 uppercase text-sm leading-normal">
                                <th class="py-3 px-6 text-center">#</th>
                                <th class="py-3 px-6 text-left">ID Propiedad</th>
                                <th class="py-3 px-6 text-left">Nombre</th>
                                <th class="py-3 px-6 text-center">Capacidad</th>
                                <th class="py-3 px-6 text-center">Nº Piezas</th>
                                <th class="py-3 px-6 text-center">Nº Baños</th>
                                <th class="py-3 px-6 text-center">Acciones</th>
                            </tr>
                        </thead>
                        <tbody id="propiedades-tbody" class="text-gray-600 text-sm font-light">
                            ${renderFilasTabla(propiedades)}
                        </tbody>
                    </table>
                </div>
                ${renderModalAlojamiento()}
            </div>
        `;
    } catch (error) {
        console.error("Error rendering alojamientos:", error);
        return `<p class="text-danger-500 p-8">Error crítico de conexión. Por favor, recargue la página.</p>`;
    }
}

function _renderResumenAreas(data) {
    if (!data.activo || !data.espacios?.length) {
        return '<span class="text-xs text-gray-400 italic">Sin instalaciones configuradas.</span>';
    }
    const chips = data.espacios.map(e =>
        `<span class="inline-flex items-center gap-1 text-xs bg-success-50 text-success-700 border border-success-200 rounded-full px-2 py-0.5">${e.icono || '🌿'} ${e.nombre}</span>`
    ).join('');
    return `<div class="flex flex-wrap gap-1.5">${chips}</div>`;
}

async function cargarResumenAreas() {
    const resumenEl = document.getElementById('areas-resumen');
    if (!resumenEl) return;
    try {
        const data = await fetchAPI('/website/empresa/areas-comunes');
        resumenEl.innerHTML = _renderResumenAreas(data);
    } catch {
        resumenEl.innerHTML = '<span class="text-xs text-gray-400">No disponible</span>';
    }
}

export function afterRender() {
    setupModalAlojamiento(async () => {
        await cargarDatos();
    });

    cargarResumenAreas();

    const gestionarBtn = document.getElementById('gestionar-areas-btn');
    if (gestionarBtn) {
        gestionarBtn.addEventListener('click', () => {
            abrirModalAreasComunes((saved) => {
                const resumenEl = document.getElementById('areas-resumen');
                if (resumenEl) resumenEl.innerHTML = _renderResumenAreas(saved);
            });
        });
    }

    const addBtn = document.getElementById('add-propiedad-btn');
    if (addBtn) {
        // Use a flag to prevent multiple listeners
        if (!addBtn.dataset.listenerAttached) {
            addBtn.addEventListener('click', () => {
                abrirModalAlojamiento(null, canales);
            });
            addBtn.dataset.listenerAttached = 'true';
        }
    }

    const tbody = document.getElementById('propiedades-tbody');
    if (tbody) {
        // Use a flag to prevent multiple listeners
        if (!tbody.dataset.listenerAttached) {
            tbody.addEventListener('click', async (e) => {
                const target = e.target.closest('button');
                if (!target) return;

                const id = target.dataset.id;
                if (!id) return;

                // Stop propagation to prevent bubbling issues
                e.stopPropagation();

                if (target.classList.contains('edit-btn')) {
                    const propiedadAEditar = propiedades.find(p => p.id === id);
                    if (propiedadAEditar) {
                        abrirModalAlojamiento(propiedadAEditar, canales);
                    } else {
                        console.error('Propiedad no encontrada en memoria:', id);
                        alert('Error: No se pudo encontrar la propiedad. Recargando datos...');
                        await cargarDatos();
                    }
                }

                if (target.classList.contains('clone-btn')) {
                    // Arquitectura: Prompt for Name to ensure clean ID generation
                    const defaultName = `${target.closest('tr').children[2].textContent.trim()} (Copia)`;
                    const newName = prompt('Ingresa el nombre para el nuevo alojamiento (esto definirá su ID):', defaultName);

                    if (newName) {
                        try {
                            // Show loading cursor
                            document.body.style.cursor = 'wait';
                            // Pass name in body
                            const res = await fetchAPI(`/propiedades/${id}/clonar`, {
                                method: 'POST',
                                body: { name: newName }
                            });
                            alert(`Propiedad clonada con éxito: ${res.nombre}`);
                            await cargarDatos();
                        } catch (error) {
                            console.error("Error al clonar:", error);
                            alert(`Error al clonar: ${error.message}`);
                        } finally {
                            document.body.style.cursor = 'default';
                        }
                    }
                }

                if (target.classList.contains('delete-btn')) {
                    if (confirm('¿Estás seguro de que quieres eliminar este alojamiento?')) {
                        try {
                            await fetchAPI(`/propiedades/${id}`, { method: 'DELETE' });
                            await cargarDatos();
                        } catch (error) {
                            alert(`Error al eliminar: ${error.message}`);
                        }
                    }
                }
            });
            tbody.dataset.listenerAttached = 'true';
        }
    }
}