// frontend/src/views/gestionarPlantillas.js
import { fetchAPI } from '../api.js';
import { ETIQUETAS_MOTOR_FALLBACK } from '../shared/plantillasEtiquetasMotorFallback.js';
import { renderFilasTabla } from './components/gestionarPlantillas/plantillas.table.js';
import { renderModalPlantilla, setupModalPlantilla, abrirModalPlantilla } from './components/gestionarPlantillas/plantillas.modals.js';
import {
    renderModalPlantillaEmailConfig,
    setupPlantillaEmailConfigModal,
    abrirModalPlantillaEmailConfig,
} from './components/gestionarPlantillas/plantillas.emailConfig.modal.js';

let plantillas = [];
let tipos = [];
let etiquetasMotor = [];

async function fetchAndRender() {
    try {
        [plantillas, tipos] = await Promise.all([
            fetchAPI('/plantillas'),
            fetchAPI('/plantillas/tipos')
        ]);
        
        document.getElementById('plantillas-tbody').innerHTML = renderFilasTabla(plantillas, tipos);
    } catch (error) {
        console.error("Error al cargar datos:", error);
        const container = document.querySelector('.table-container');
        if(container) container.innerHTML = `<p class="text-danger-500 p-4">Error al cargar los datos.</p>`;
    }
}

export async function render() {
    try {
        [plantillas, tipos] = await Promise.all([
            fetchAPI('/plantillas'),
            fetchAPI('/plantillas/tipos'),
        ]);
    } catch (error) {
        return `<p class="text-danger-500">Error crítico de conexión.</p>`;
    }

    etiquetasMotor = [...ETIQUETAS_MOTOR_FALLBACK];
    try {
        const fetched = await fetchAPI('/plantillas/etiquetas-motor');
        if (Array.isArray(fetched) && fetched.length > 0) {
            etiquetasMotor = fetched;
        }
    } catch (e) {
        console.warn('[gestionarPlantillas] GET /plantillas/etiquetas-motor no disponible, catálogo embebido:', e?.message || e);
    }

    return `
        <div class="bg-white p-8 rounded-lg shadow">
            <div class="flex justify-between items-center mb-6">
                <div>
                    <h2 class="text-2xl font-semibold text-gray-900">Gestionar Plantillas de Mensajes</h2>
                    <p class="text-sm text-gray-500 mt-1">Los <strong>tipos</strong> clasifican en la otra vista; aquí editas texto, asunto y la configuración de <strong>correo</strong> por plantilla.</p>
                </div>
                <button id="add-plantilla-btn" class="btn-primary">
                    + Nueva Plantilla
                </button>
            </div>
            <div class="table-container">
                <table class="min-w-full bg-white">
                    <thead>
                        <tr>
                            <th class="th w-12">#</th>
                            <th class="th">Nombre</th>
                            <th class="th">Tipo</th>
                            <th class="th">Asunto</th>
                            <th class="th w-24 text-center">Correo</th>
                            <th class="th">Acciones</th>
                        </tr>
                    </thead>
                    <tbody id="plantillas-tbody">
                        ${renderFilasTabla(plantillas, tipos)}
                    </tbody>
                </table>
            </div>
        </div>
        
        ${renderModalPlantilla(etiquetasMotor)}
        ${renderModalPlantillaEmailConfig()}
    `;
}

export function afterRender() {
    setupModalPlantilla(async () => {
        await fetchAndRender();
    });
    setupPlantillaEmailConfigModal();

    document.getElementById('add-plantilla-btn').addEventListener('click', () => abrirModalPlantilla(null, tipos));

    const tbody = document.getElementById('plantillas-tbody');

    tbody.addEventListener('click', async (e) => {
        const emailBtn = e.target.closest('.plantilla-email-config-btn');
        const editBtn = e.target.closest('.edit-btn');
        const delBtn = e.target.closest('.delete-btn');
        const id = (emailBtn || editBtn || delBtn)?.dataset?.id;
        if (!id) return;

        if (emailBtn) {
            const plantilla = plantillas.find((p) => p.id === id);
            if (plantilla) abrirModalPlantillaEmailConfig(plantilla, fetchAndRender);
            return;
        }

        if (editBtn) {
            const plantilla = plantillas.find((p) => p.id === id);
            if (plantilla) abrirModalPlantilla(plantilla, tipos);
            return;
        }

        if (delBtn) {
            if (confirm('¿Estás seguro de que quieres eliminar esta plantilla?')) {
                try {
                    await fetchAPI(`/plantillas/${id}`, { method: 'DELETE' });
                    await fetchAndRender();
                } catch (error) {
                    alert(`Error al eliminar: ${error.message}`);
                }
            }
        }
    });

    const openId = sessionStorage.getItem('openPlantillaId');
    if (openId) {
        sessionStorage.removeItem('openPlantillaId');
        const plantilla = plantillas.find((p) => String(p.id) === String(openId));
        if (plantilla) abrirModalPlantilla(plantilla, tipos);
    }
}