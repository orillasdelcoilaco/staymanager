// frontend/src/views/gestionarPlantillas.js

import { fetchAPI } from '../api.js';

let plantillas = [];
let tipos = [];
let editandoPlantilla = null;

const ETIQUETAS_DISPONIBLES = [
    // Etiquetas de Mensajes Generales
    { etiqueta: '[CLIENTE_NOMBRE]', descripcion: 'Nombre completo del cliente' },
    { etiqueta: '[RESERVA_ID_CANAL]', descripcion: 'ID de la reserva en el canal de origen' },
    { etiqueta: '[FECHA_LLEGADA]', descripcion: 'Fecha de check-in' },
    { etiqueta: '[FECHA_SALIDA]', descripcion: 'Fecha de check-out' },
    { etiqueta: '[ALOJAMIENTO_NOMBRE]', descripcion: 'Nombre(s) de el/los alojamiento(s) reservado(s)' },
    { etiqueta: '[TOTAL_NOCHES]', descripcion: 'Número total de noches de la estadía' },
    { etiqueta: '[CANTIDAD_HUESPEDES]', descripcion: 'Número de huéspedes en la reserva' },
    { etiqueta: '[SALDO_PENDIENTE]', descripcion: 'Monto del saldo adeudado por el cliente' },
    { etiqueta: '[COBRO]', descripcion: 'Genera un resumen detallado del cobro (Total, abonos, saldo, etc.)' },
    
    // Etiquetas Específicas para Propuestas y Presupuestos
    { etiqueta: '[RESUMEN_VALORES_PROPUESTA]', descripcion: '(Para Propuestas) Bloque completo con detalle de precios, descuentos y totales' },
    { etiqueta: '[PROPUESTA_ID]', descripcion: 'ID único generado para la propuesta de reserva' },
    { etiqueta: '[FECHAS_ESTADIA_TEXTO]', descripcion: 'Texto formateado de las fechas (ej: 7 al 17 de octubre)' },
    { etiqueta: '[DETALLE_PROPIEDADES_PROPUESTA]', descripcion: 'Bloque con el detalle de las cabañas seleccionadas' },
    { etiqueta: '[FECHA_VENCIMIENTO_PROPUESTA]', descripcion: 'Fecha y hora de expiración de la propuesta' },
    { etiqueta: '[PORCENTAJE_ABONO]', descripcion: 'Porcentaje de abono requerido (ej: 10%)' },
    { etiqueta: '[MONTO_ABONO]', descripcion: 'Monto del abono requerido' },
    { etiqueta: '[CLIENTE_EMPRESA]', descripcion: 'Nombre de la empresa del cliente' },
    { etiqueta: '[FECHA_EMISION]', descripcion: 'Fecha en que se genera el documento' },
    { etiqueta: '[GRUPO_SOLICITADO]', descripcion: 'N° de personas solicitadas' },
    { etiqueta: '[TOTAL_DIAS]', descripcion: 'Cantidad de días de la estadía (noches + 1)' },
    { etiqueta: '[LISTA_DE_CABANAS]', descripcion: '(Para Presupuestos) Bloque dinámico con detalle para presupuestos' },
    { etiqueta: '[TOTAL_GENERAL]', descripcion: '(Para Presupuestos) Monto total del documento' },
    { etiqueta: '[RESUMEN_CANTIDAD_CABANAS]', descripcion: 'N° total de cabañas' },
    { etiqueta: '[RESUMEN_CAPACIDAD_TOTAL]', descripcion: 'Suma de la capacidad de las cabañas' },

    // Etiquetas de Configuración de la Empresa
    { etiqueta: '[EMPRESA_NOMBRE]', descripcion: 'Nombre de tu empresa' },
    { etiqueta: '[EMPRESA_SLOGAN]', descripcion: 'Slogan o bajada de título de tu empresa' },
    { etiqueta: '[SERVICIOS_GENERALES]', descripcion: 'Bloque de texto con servicios generales' },
    { etiqueta: '[CONDICIONES_RESERVA]', descripcion: 'Párrafo con tus condiciones de reserva' },
    { etiqueta: '[EMPRESA_UBICACION_TEXTO]', descripcion: 'Dirección o texto de ubicación' },
    { etiqueta: '[EMPRESA_GOOGLE_MAPS_LINK]', descripcion: 'Link a tu ubicación en Google Maps' },
    { etiqueta: '[USUARIO_NOMBRE]', descripcion: 'Nombre del contacto de tu empresa' },
    { etiqueta: '[USUARIO_EMAIL]', descripcion: 'Email de contacto de tu empresa' },
    { etiqueta: '[USUARIO_TELEFONO]', descripcion: 'Teléfono de contacto de tu empresa' },
    { etiqueta: '[EMPRESA_WEBSITE]', descripcion: 'Sitio web de tu empresa' },
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
        tbody.innerHTML = '<tr><td colspan="4" class="text-center text-gray-500 py-4">No hay plantillas registradas.</td></tr>';
        return;
    }
    
    const tiposMap = new Map(tipos.map(t => [t.id, t.nombre]));

    tbody.innerHTML = plantillas.map((p, index) => `
        <tr class="border-b">
            <td class="py-3 px-4 text-center font-medium text-gray-500">${index + 1}</td>
            <td class="py-3 px-4 font-medium">${p.nombre}</td>
            <td class="py-3 px-4">${tiposMap.get(p.tipoId) || 'Sin tipo'}</td>
            <td class="py-3 px-4">
                <button data-id="${p.id}" class="edit-btn btn-table-edit mr-2">Editar</button>
                <button data-id="${p.id}" class="delete-btn btn-table-delete">Eliminar</button>
            </td>
        </tr>
    `).join('');
}

function renderEtiquetas() {
    const container = document.getElementById('etiquetas-container');
    if (!container) return;
    container.innerHTML = ETIQUETAS_DISPONIBLES.sort((a, b) => a.etiqueta.localeCompare(b.etiqueta)).map(e => `
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
            <div class="table-container">
                <table class="min-w-full bg-white">
                    <thead>
                        <tr>
                            <th class="th w-12">#</th>
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
            <div class="modal-content !max-w-6xl">
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
                            <textarea name="texto" rows="20" required class="form-input"></textarea>
                        </div>
                        <div class="flex justify-end pt-4 border-t">
                            <button type="button" id="cancel-btn" class="btn-secondary mr-2">Cancelar</button>
                            <button type="submit" class="btn-primary">Guardar Plantilla</button>
                        </div>
                    </form>
                    <div class="md:col-span-1 border-l pl-4">
                        <h4 class="font-semibold text-gray-800 mb-2">Etiquetas Disponibles</h4>
                        <div id="etiquetas-container" class="space-y-2 max-h-[60vh] overflow-y-auto"></div>
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
        document.getElementById('plantillas-tbody').innerHTML = `<tr><td colspan="4" class="text-center text-red-500 py-4">Error al cargar datos: ${error.message}</td></tr>`;
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