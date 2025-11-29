import { fetchAPI } from '../api.js';

let tipos = [];

async function cargarTipos() {
    try {
        tipos = await fetchAPI('/tipos-elemento');
        renderTabla();
    } catch (error) {
        console.error("Error al cargar tipos:", error);
        alert("Error al cargar los tipos de elemento.");
    }
}

function renderTabla() {
    const tbody = document.getElementById('tipos-tbody');
    if (!tbody) return;

    tbody.innerHTML = tipos.map(t => `
        <tr class="border-b hover:bg-gray-50">
            <td class="p-3 text-2xl text-center">${t.icono}</td>
            <td class="p-3 font-medium">${t.nombre}</td>
            <td class="p-3">
                <span class="px-2 py-1 text-xs rounded-full ${t.categoria === 'CAMA' ? 'bg-blue-100 text-blue-800' :
            t.categoria === 'BANO_ELEMENTO' ? 'bg-teal-100 text-teal-800' :
                'bg-gray-100 text-gray-800'
        }">
                    ${t.categoria}
                </span>
            </td>
            <td class="p-3 text-center text-sm text-gray-500">
                ${t.permiteCantidad ? '✅ Sí' : '❌ No'}
            </td>
            <td class="p-3 text-right">
                <button class="text-red-500 hover:text-red-700 delete-btn" data-id="${t.id}">
                    🗑️ Eliminar
                </button>
            </td>
        </tr>
    `).join('');

    tbody.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            if (confirm('¿Estás seguro de eliminar este tipo?')) {
                try {
                    await fetchAPI(`/tipos-elemento/${e.target.dataset.id}`, { method: 'DELETE' });
                    await cargarTipos();
                } catch (error) {
                    alert(error.message);
                }
            }
        });
    });
}

export async function render() {
    // Carga inicial
    try {
        tipos = await fetchAPI('/tipos-elemento');
    } catch (error) {
        console.error(error);
    }

    return `
        <div class="bg-white p-8 rounded-lg shadow">
            <div class="flex justify-between items-center mb-6">
                <div>
                    <h2 class="text-2xl font-semibold text-gray-900">Tipos de Elemento (Amenidades)</h2>
                    <p class="text-gray-500 text-sm mt-1">Define qué cosas pueden haber dentro de los espacios (Camas, Duchas, TV, etc).</p>
                </div>
                <button id="btn-nuevo-tipo" class="btn-primary">+ Nuevo Tipo</button>
            </div>

            <!-- Formulario (Oculto por defecto) -->
            <div id="form-container" class="hidden bg-gray-50 p-4 rounded-lg border mb-6">
                <h3 class="font-semibold mb-3">Crear Nuevo Tipo</h3>
                <form id="form-nuevo-tipo" class="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
                    <div class="md:col-span-2">
                        <label class="block text-xs font-medium text-gray-700">Nombre</label>
                        <input type="text" name="nombre" required placeholder="Ej: Cama King" class="form-input w-full mt-1">
                    </div>
                    <div>
                        <label class="block text-xs font-medium text-gray-700">Categoría</label>
                        <select name="categoria" required class="form-select w-full mt-1">
                            <option value="CAMA">Cama</option>
                            <option value="BANO_ELEMENTO">Baño (Ducha, WC)</option>
                            <option value="EQUIPAMIENTO">Equipamiento (TV, Wifi)</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-xs font-medium text-gray-700">Icono (Emoji)</label>
                        <input type="text" name="icono" placeholder="🛏️" class="form-input w-full mt-1">
                    </div>
                    <div class="flex items-center mb-2">
                         <label class="flex items-center space-x-2 text-xs cursor-pointer">
                            <input type="checkbox" name="permiteCantidad" checked class="rounded border-gray-300">
                            <span>¿Es contable?</span>
                        </label>
                    </div>
                    <div class="flex gap-2">
                        <button type="button" id="btn-cancelar" class="btn-secondary w-full">Cancelar</button>
                        <button type="submit" class="btn-primary w-full">Guardar</button>
                    </div>
                </form>
            </div>

            <div class="overflow-x-auto">
                <table class="w-full text-left border-collapse">
                    <thead>
                        <tr class="text-sm text-gray-500 border-b">
                            <th class="p-3 text-center w-16">Icono</th>
                            <th class="p-3">Nombre</th>
                            <th class="p-3">Categoría</th>
                            <th class="p-3 text-center">Contable</th>
                            <th class="p-3 text-right">Acciones</th>
                        </tr>
                    </thead>
                    <tbody id="tipos-tbody">
                        ${tipos.length === 0 ? '<tr><td colspan="5" class="p-4 text-center text-gray-400">No hay tipos definidos.</td></tr>' : ''}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

export function afterRender() {
    renderTabla();

    const formContainer = document.getElementById('form-container');
    const btnNuevo = document.getElementById('btn-nuevo-tipo');
    const btnCancelar = document.getElementById('btn-cancelar');
    const form = document.getElementById('form-nuevo-tipo');

    btnNuevo.addEventListener('click', () => {
        formContainer.classList.remove('hidden');
        btnNuevo.classList.add('hidden');
    });

    btnCancelar.addEventListener('click', () => {
        formContainer.classList.add('hidden');
        btnNuevo.classList.remove('hidden');
        form.reset();
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(form);
        const datos = {
            nombre: formData.get('nombre'),
            categoria: formData.get('categoria'),
            icono: formData.get('icono') || '🔹',
            permiteCantidad: formData.get('permiteCantidad') === 'on'
        };

        try {
            await fetchAPI('/tipos-elemento', {
                method: 'POST',
                body: datos
            });
            form.reset();
            formContainer.classList.add('hidden');
            btnNuevo.classList.remove('hidden');
            await cargarTipos();
        } catch (error) {
            alert(error.message);
        }
    });
}
