import { fetchAPI } from '../api.js';

let plantillas = [];
let tipos = [];
let editandoPlantilla = null;

const ETIQUETAS_DISPONIBLES = [
    { etiqueta: '[CLIENTE_NOMBRE]', descripcion: 'Nombre completo del cliente' },
    { etiqueta: '[RESERVA_ID_CANAL]', descripcion: 'ID de la reserva en el canal de origen' },
    { etiqueta: '[FECHA_LLEGADA]', descripcion: 'Fecha de check-in' },
    { etiqueta: '[FECHA_SALIDA]', descripcion: 'Fecha de check-out' },
    { etiqueta: '[ALOJAMIENTO_NOMBRE]', descripcion: 'Nombre del alojamiento reservado' },
    { etiqueta: '[TOTAL_NOCHES]', descripcion: 'Número total de noches de la estadía' },
    { etiqueta: '[CANTIDAD_HUESPEDES]', descripcion: 'Número de huéspedes en la reserva' },
    { etiqueta: '[SALDO_PENDIENTE]', descripcion: 'Monto del saldo adeudado por el cliente' },
    { etiqueta: '[COBRO]', descripcion: 'Genera un resumen detallado del cobro (Total, abonos, saldo, etc.)' }
];

function abrirModal(plantilla = null) {
    const modal = document.getElementById('plantilla-modal');
    const form = document.getElementById('plantilla-form');
    const modalTitle = document.getElementById('modal-title');
    
    document.getElementById('tipo-select').innerHTML = tipos.map(t => `<option value="${t.id}">${t.nombre}</option>`).join('');

    if (plantilla) {
        editandoPlantilla = plantilla;
        modalTitle.textContent = 'Editar Plantilla';
        form.nombre.value = plantilla.nombre;
        form.tipoId.value = plantilla.tipoId;
        form.texto.value = plantilla.texto;
    } else {
        editandoPlantilla = null;
        modalTitle.textContent = 'Nueva Plantilla';
        form.reset();
    }
    
    modal.classList.remove('hidden');
}

function cerrarModal() {
    document.getElementById('plantilla-modal').classList.add('hidden');
    editandoPlantilla = null;
}

function renderTabla() {
    const tbody = document.getElementById('plantillas-tbody');
    if (!tbody) return;

    if (plantillas.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" class="text-center text-gray-500 py-4">No hay plantillas registradas.</td></tr>';
        return;
    }
    
    const tiposMap = new Map(tipos.map(t => [t.id, t.nombre]));

    tbody.innerHTML = plantillas.map(p => `
        <tr class="border-b">
            <td class="py-3 px-4 font-medium">${p.nombre}</td>
            <td class="py-3 px-4">${tiposMap.get(p.tipoId) || 'Sin tipo'}</td>
            <td class="py-3 px-4">
                <button data-id="${p.id}" class="edit-btn text-indigo-600 hover:text-indigo-800 text-sm font-medium mr-3">Editar</button>
                <button data-id="${p.id}" class="delete-btn text-red-600 hover:text-red-800 text-sm font-medium">Eliminar</button>
            </td>
        </tr>
    `).join('');
}

function renderEtiquetas() {
    const container = document.getElementById('etiquetas-container');
    if (!container) return;
    container.innerHTML = ETIQUETAS_DISPONIBLES.map(e => `
        <div class="flex items-center justify-between p-2 bg-gray-50 rounded">
            <div class="text-sm">
                <code class="font-bold text-indigo-600">${e.etiqueta}</code>
                <p class="text-xs text-gray-500">${e.descripcion}</p>
            </div>
            <button data-etiqueta="${e.etiqueta}" class="copy-tag-btn text-xs bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold py-1 px-2 rounded">Copiar</button>
        </div>
    `).join('');
}

export async function render() {
    return `
        <div class="bg-white p-8 rounded-lg shadow">
            <div class="flex justify-between items-center mb-6">
                <h2 class="text-2xl font-semibold text-gray-900">Gestionar Plantillas de Mensajes</h2>
                <button id="add-plantilla-btn" class="btn-primary">+ Nueva Plantilla</button>
            </div>
            <div class="overflow-x-auto">
                <table class="min-w-full bg-white">
                    <thead class="bg-gray-50">
                        <tr>
                            <th class="th">Nombre</th>
                            <th class="th">Tipo</th>
                            <th class="th">Acciones</th>
                        </tr>
                    </thead>
                    <tbody id="plantillas-tbody"></tbody>
                </table>
            </div>
        </div>

        <div id="plantilla-modal" class="modal hidden">
            <div class="modal-content !max-w-4xl">
                <h3 id="modal-title" class="text-xl font-semibold mb-4"></h3>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <form id="plantilla-form" class="space-y-4 md:col-span-2">
                        <div>
                            <label for="nombre" class="block text-sm font-medium text-gray-700">Nombre de la Plantilla</label>
                            <input type="text" name="nombre" required class="form-input">
                        </div>
                        <div>
                            <label for="tipo-select" class="block text-sm font-medium text-gray-700">Tipo de Plantilla</label>
                            <select id="tipo-select" name="tipoId" required class="form-select"></select>
                        </div>
                        <div>
                            <label for="texto" class="block text-sm font-medium text-gray-700">Cuerpo del Mensaje</label>
                            <textarea name="texto" rows="10" required class="form-input"></textarea>
                        </div>
                        <div class="flex justify-end pt-4 border-t">
                            <button type="button" id="cancel-btn" class="btn-secondary mr-2">Cancelar</button>
                            <button type="submit" class="btn-primary">Guardar Plantilla</button>
                        </div>
                    </form>
                    <div class="md:col-span-1 border-l pl-4">
                        <h4 class="font-semibold text-gray-800 mb-2">Etiquetas Disponibles</h4>
                        <div id="etiquetas-container" class="space-y-2 max-h-96 overflow-y-auto"></div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

async function fetchAndRender() {
    try {
        [plantillas, tipos] = await Promise.all([
            fetchAPI('/plantillas'),
            fetchAPI('/plantillas/tipos')
        ]);
        renderTabla();
    } catch (error) {
        document.getElementById('plantillas-tbody').innerHTML = `<tr><td colspan="3" class="text-center text-red-500 py-4">Error al cargar datos: ${error.message}</td></tr>`;
    }
}

export async function afterRender() {
    await fetchAndRender();
    renderEtiquetas();

    document.getElementById('add-plantilla-btn').addEventListener('click', () => abrirModal());
    document.getElementById('cancel-btn').addEventListener('click', cerrarModal);

    document.getElementById('plantilla-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const form = e.target;
        const datos = {
            nombre: form.nombre.value,
            tipoId: form.tipoId.value,
            texto: form.texto.value
        };

        try {
            const endpoint = editandoPlantilla ? `/plantillas/${editandoPlantilla.id}` : '/plantillas';
            const method = editandoPlantilla ? 'PUT' : 'POST';
            await fetchAPI(endpoint, { method, body: datos });
            await fetchAndRender();
            cerrarModal();
        } catch (error) {
            alert(`Error al guardar: ${error.message}`);
        }
    });

    document.getElementById('plantillas-tbody').addEventListener('click', async (e) => {
        const id = e.target.dataset.id;
        if (!id) return;

        if (e.target.classList.contains('edit-btn')) {
            const plantilla = plantillas.find(p => p.id === id);
            if (plantilla) abrirModal(plantilla);
        }

        if (e.target.classList.contains('delete-btn')) {
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

    document.getElementById('etiquetas-container').addEventListener('click', (e) => {
        if (e.target.classList.contains('copy-tag-btn')) {
            const etiqueta = e.target.dataset.etiqueta;
            navigator.clipboard.writeText(etiqueta).then(() => {
                const originalText = e.target.textContent;
                e.target.textContent = '¡Copiado!';
                setTimeout(() => {
                    e.target.textContent = originalText;
                }, 1000);
            });
        }
    });
}