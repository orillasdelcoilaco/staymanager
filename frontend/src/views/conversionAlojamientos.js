import { fetchAPI } from '../api.js';

let conversiones = [];
let alojamientos = [];
let canales = [];
let editandoConversion = null;

// --- Lógica del Modal ---
function abrirModal(conversion = null) {
    const modal = document.getElementById('conversion-modal');
    const form = document.getElementById('conversion-form');
    const modalTitle = document.getElementById('modal-title');

    // Poblar los selects
    document.getElementById('alojamiento-select').innerHTML = alojamientos.map(a => `<option value="${a.id}">${a.nombre}</option>`).join('');
    document.getElementById('canal-select').innerHTML = canales.map(c => `<option value="${c.id}">${c.nombre}</option>`).join('');
    
    if (conversion) {
        editandoConversion = conversion;
        modalTitle.textContent = 'Editar Conversión';
        form.alojamientoId.value = conversion.alojamientoId;
        form.canalId.value = conversion.canalId;
        form.nombreExterno.value = conversion.nombreExterno;
    } else {
        editandoConversion = null;
        modalTitle.textContent = 'Nueva Conversión';
        form.reset();
    }
    
    modal.classList.remove('hidden');
}

function cerrarModal() {
    document.getElementById('conversion-modal').classList.add('hidden');
    editandoConversion = null;
}

// --- Lógica de la Tabla ---
function renderTabla() {
    const tbody = document.getElementById('conversiones-tbody');
    if (!tbody) return;

    if (conversiones.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center text-gray-500 py-4">No hay conversiones registradas.</td></tr>';
        return;
    }

    tbody.innerHTML = conversiones.map(c => `
        <tr class="border-b">
            <td class="py-3 px-4 font-medium">${c.alojamientoNombre}</td>
            <td class="py-3 px-4">${c.canalNombre}</td>
            <td class="py-3 px-4 font-mono text-sm">${c.nombreExterno}</td>
            <td class="py-3 px-4">
                <button data-id="${c.id}" class="edit-btn text-indigo-600 hover:text-indigo-800 text-sm font-medium mr-3">Editar</button>
                <button data-id="${c.id}" class="delete-btn text-red-600 hover:text-red-800 text-sm font-medium">Eliminar</button>
            </td>
        </tr>
    `).join('');
}

// --- Lógica Principal de la Vista ---
export async function render() {
    try {
        [conversiones, alojamientos, canales] = await Promise.all([
            fetchAPI('/conversiones'),
            fetchAPI('/propiedades'),
            fetchAPI('/canales')
        ]);
    } catch (error) {
        return `<p class="text-red-500">Error al cargar los datos necesarios. Por favor, intente de nuevo.</p>`;
    }

    return `
        <div class="bg-white p-8 rounded-lg shadow">
            <div class="flex justify-between items-center mb-6">
                <h2 class="text-2xl font-semibold text-gray-900">Conversión de Nombres de Alojamientos</h2>
                <button id="add-conversion-btn" class="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700">
                    + Nueva Conversión
                </button>
            </div>
            <div class="overflow-x-auto">
                <table class="min-w-full bg-white">
                    <thead class="bg-gray-50">
                        <tr>
                            <th class="th">Alojamiento Interno</th>
                            <th class="th">Canal</th>
                            <th class="th">Nombre en el Reporte del Canal</th>
                            <th class="th">Acciones</th>
                        </tr>
                    </thead>
                    <tbody id="conversiones-tbody"></tbody>
                </table>
            </div>
        </div>

        <div id="conversion-modal" class="modal hidden">
            <div class="modal-content">
                <h3 id="modal-title" class="text-xl font-semibold mb-4">Nueva Conversión</h3>
                <form id="conversion-form">
                    <div class="mb-4">
                        <label for="alojamiento-select" class="block text-sm font-medium text-gray-700">Alojamiento (en SuiteManager)</label>
                        <select id="alojamiento-select" name="alojamientoId" required class="mt-1 form-select"></select>
                    </div>
                    <div class="mb-4">
                        <label for="canal-select" class="block text-sm font-medium text-gray-700">Canal de Venta</label>
                        <select id="canal-select" name="canalId" required class="mt-1 form-select"></select>
                    </div>
                    <div class="mb-4">
                        <label for="nombreExterno" class="block text-sm font-medium text-gray-700">Nombre del Alojamiento en el Reporte</label>
                        <input type="text" id="nombreExterno" name="nombreExterno" required class="mt-1 form-input">
                    </div>
                    <div class="flex justify-end pt-4 mt-4 border-t">
                        <button type="button" id="cancel-btn" class="px-4 py-2 bg-gray-200 text-gray-800 rounded-md mr-2 hover:bg-gray-300">Cancelar</button>
                        <button type="submit" class="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700">Guardar</button>
                    </div>
                </form>
            </div>
        </div>
    `;
}

export function afterRender() {
    renderTabla();

    document.getElementById('add-conversion-btn').addEventListener('click', () => abrirModal());
    document.getElementById('cancel-btn').addEventListener('click', cerrarModal);

    document.getElementById('conversion-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const form = e.target;
        const alojamientoSelect = form.querySelector('#alojamiento-select');
        const canalSelect = form.querySelector('#canal-select');
        
        const datos = {
            alojamientoId: alojamientoSelect.value,
            alojamientoNombre: alojamientoSelect.options[alojamientoSelect.selectedIndex].text,
            canalId: canalSelect.value,
            canalNombre: canalSelect.options[canalSelect.selectedIndex].text,
            nombreExterno: form.nombreExterno.value
        };

        try {
            const endpoint = editandoConversion ? `/conversiones/${editandoConversion.id}` : '/conversiones';
            const method = editandoConversion ? 'PUT' : 'POST';
            await fetchAPI(endpoint, { method, body: datos });
            
            conversiones = await fetchAPI('/conversiones');
            renderTabla();
            cerrarModal();
        } catch (error) {
            alert(`Error al guardar: ${error.message}`);
        }
    });

    document.getElementById('conversiones-tbody').addEventListener('click', async (e) => {
        const target = e.target;
        const id = target.dataset.id;
        if (!id) return;

        const conversion = conversiones.find(c => c.id === id);
        if (!conversion) return;

        if (target.classList.contains('edit-btn')) {
            abrirModal(conversion);
        }

        if (target.classList.contains('delete-btn')) {
            if (confirm('¿Estás seguro de que quieres eliminar esta conversión?')) {
                try {
                    await fetchAPI(`/conversiones/${id}`, { method: 'DELETE' });
                    conversiones = await fetchAPI('/conversiones');
                    renderTabla();
                } catch (error) {
                    alert(`Error al eliminar: ${error.message}`);
                }
            }
        }
    });
}