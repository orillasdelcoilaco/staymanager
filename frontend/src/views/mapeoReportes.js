import { fetchAPI } from '../api.js';

let mapeos = [];
let canales = [];
let canalSiendoEditado = null;
let cabecerasArchivo = []; // Para guardar las columnas del archivo subido

const camposInternos = [
    { id: 'idReservaCanal', nombre: 'ID de Reserva del Canal', requerido: true },
    { id: 'alojamientoNombre', nombre: 'Nombre del Alojamiento (en reporte)', requerido: true },
    { id: 'fechaLlegada', nombre: 'Fecha de Llegada (Check-in)', requerido: true },
    { id: 'fechaSalida', nombre: 'Fecha de Salida (Check-out)', requerido: true },
    { id: 'nombreCliente', nombre: 'Nombre del Cliente', requerido: true },
    { id: 'apellidoCliente', nombre: 'Apellido del Cliente (Opcional)', requerido: false },
    { id: 'estado', nombre: 'Estado de la Reserva' },
    { id: 'fechaReserva', nombre: 'Fecha de Creación de la Reserva' },
    { id: 'totalNoches', nombre: 'Total de Noches' },
    { id: 'invitados', nombre: 'Cantidad de Huéspedes' },
    { id: 'correoCliente', nombre: 'Email del Cliente' },
    { id: 'telefonoCliente', nombre: 'Teléfono del Cliente' },
    { id: 'valorTotal', nombre: 'Valor Total de la Reserva' },
    { id: 'comision', nombre: 'Comisión' },
    { id: 'abono', nombre: 'Abono' },
    { id: 'pendiente', nombre: 'Pendiente de Pago' },
    { id: 'pais', nombre: 'País del Cliente' },
    { id: 'tipoFila', nombre: 'Tipo de Fila (para ignorar filas)', descripcion: 'Selecciona la columna que identifica el tipo de fila. El sistema solo procesará las que contengan "Reservación". Ej: Columna "Tipo" en reportes de Airbnb.' },
];

function renderizarCamposMapeo() {
    const fieldsContainer = document.getElementById('mapeo-fields-container');
    if (!fieldsContainer || !canalSiendoEditado) return;

    const mapeosDelCanal = mapeos.filter(m => m.canalId === canalSiendoEditado.id);
    
    const opcionesHtml = cabecerasArchivo.map(c => `<option value="${c}">${c}</option>`).join('');

    fieldsContainer.innerHTML = camposInternos.map(campo => {
        const mapeoExistente = mapeosDelCanal.find(m => m.campoInterno === campo.id);
        const valorGuardado = (mapeoExistente && cabecerasArchivo[mapeoExistente.columnaIndex]) ? cabecerasArchivo[mapeoExistente.columnaIndex] : '';
        
        return `
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                <label for="campo-${campo.id}" class="text-sm font-medium text-gray-700 md:justify-self-end">
                    ${campo.nombre} ${campo.requerido ? '<span class="text-red-500">*</span>' : ''}
                </label>
                <div>
                    <select id="campo-${campo.id}" data-campo-interno="${campo.id}" class="form-select mapeo-select">
                        <option value="">-- No aplicar / No existe --</option>
                        ${opcionesHtml}
                    </select>
                    ${campo.descripcion ? `<p class="text-xs text-gray-500 mt-1">${campo.descripcion}</p>` : ''}
                </div>
            </div>
        `;
    }).join('');

    fieldsContainer.querySelectorAll('select').forEach(select => {
        const campoId = select.dataset.campoInterno;
        const mapeo = mapeosDelCanal.find(m => m.campoInterno === campoId);
        if (mapeo && typeof mapeo.columnaIndex === 'number' && cabecerasArchivo[mapeo.columnaIndex]) {
            select.value = cabecerasArchivo[mapeo.columnaIndex];
        }
    });

    document.getElementById('mapeo-editor').classList.remove('hidden');
}


async function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file || !canalSiendoEditado) return;

    const statusDiv = document.getElementById('upload-status');
    statusDiv.textContent = 'Analizando archivo...';
    statusDiv.classList.remove('hidden', 'text-red-500');

    const formData = new FormData();
    formData.append('archivoMuestra', file);

    try {
        cabecerasArchivo = await fetchAPI('/sincronizar/analizar-archivo', {
            method: 'POST',
            body: formData
        });
        statusDiv.classList.add('hidden');
        renderizarCamposMapeo();
    } catch (error) {
        statusDiv.textContent = `Error al leer el archivo: ${error.message}`;
        statusDiv.classList.add('text-red-500');
    }
}

function abrirModal(canal) {
    canalSiendoEditado = canal;
    cabecerasArchivo = [];
    
    const modal = document.getElementById('mapeo-modal');
    document.getElementById('modal-title').textContent = `Configurar Mapeo para: ${canal.nombre}`;
    document.getElementById('upload-status').classList.add('hidden');
    document.getElementById('mapeo-editor').classList.add('hidden');
    document.getElementById('archivo-muestra-input').value = '';
    
    modal.classList.remove('hidden');
}

function cerrarModal() {
    document.getElementById('mapeo-modal').classList.add('hidden');
    canalSiendoEditado = null;
}

export async function render() {
    try {
        [mapeos, canales] = await Promise.all([fetchAPI('/mapeos'), fetchAPI('/canales')]);
    } catch (error) {
        return `<p class="text-red-500">Error al cargar los datos.</p>`;
    }

    return `
        <div class="bg-white p-8 rounded-lg shadow">
             <h2 class="text-2xl font-semibold text-gray-900 mb-2">Mapeo de Columnas de Reportes</h2>
            <p class="text-gray-600 mb-6">
                Selecciona un canal para enseñarle al sistema cómo leer sus reportes de reservas.
            </p>
            <table class="min-w-full bg-white">
                <thead class="bg-gray-50">
                    <tr><th class="th">Canal de Venta</th><th class="th text-center">Acciones</th></tr>
                </thead>
                <tbody id="canales-mapeo-tbody">
                    ${canales.map(c => `
                        <tr class="border-b">
                            <td class="py-3 px-4 font-medium">${c.nombre}</td>
                            <td class="py-3 px-4 text-center">
                                <button data-id="${c.id}" class="edit-btn px-4 py-1 bg-indigo-100 text-indigo-700 rounded-md hover:bg-indigo-200 text-sm font-medium">
                                    Configurar Mapeo
                                </button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>

        <div id="mapeo-modal" class="modal hidden">
            <div class="modal-content !max-w-4xl">
                <h3 id="modal-title" class="text-xl font-semibold mb-4"></h3>
                <div class="space-y-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700">1. Sube un archivo de ejemplo</label>
                        <p class="text-xs text-gray-500 mb-2">El sistema leerá las columnas para que puedas mapearlas fácilmente.</p>
                        <input type="file" id="archivo-muestra-input" class="form-input-file">
                        <div id="upload-status" class="mt-2 text-sm hidden"></div>
                    </div>

                    <div id="mapeo-editor" class="hidden border-t pt-4">
                        <label class="block text-sm font-medium text-gray-700">2. Asigna las columnas del archivo</label>
                        <p class="text-xs text-gray-500 mb-4">Selecciona qué columna de tu archivo corresponde a cada campo del sistema.</p>
                        <div id="mapeo-fields-container" class="space-y-3 max-h-[50vh] overflow-y-auto pr-4"></div>
                    </div>
                </div>
                <div class="flex justify-end pt-6 mt-6 border-t">
                    <button type="button" id="cancel-btn" class="btn-secondary">Cancelar</button>
                    <button type="button" id="guardar-mapeo-btn" class="btn-primary ml-2">Guardar Mapeo</button>
                </div>
            </div>
        </div>
    `;
}

export function afterRender() {
    document.getElementById('canales-mapeo-tbody').addEventListener('click', (e) => {
        if (e.target.classList.contains('edit-btn')) {
            const canal = canales.find(c => c.id === e.target.dataset.id);
            if (canal) abrirModal(canal);
        }
    });

    document.getElementById('cancel-btn').addEventListener('click', cerrarModal);
    document.getElementById('archivo-muestra-input').addEventListener('change', handleFileUpload);
    
    document.getElementById('guardar-mapeo-btn').addEventListener('click', async () => {
        if (!canalSiendoEditado) return;

        const selects = document.querySelectorAll('.mapeo-select');
        const mapeosParaGuardar = [];
        selects.forEach(select => {
            const nombreColumna = select.value;
            if (nombreColumna) {
                const index = cabecerasArchivo.indexOf(nombreColumna);
                if (index !== -1) {
                    mapeosParaGuardar.push({
                        campoInterno: select.dataset.campoInterno,
                        columnaIndex: index
                    });
                }
            }
        });
        
        try {
            await fetchAPI(`/mapeos/${canalSiendoEditado.id}`, {
                method: 'POST',
                body: { mapeos: mapeosParaGuardar }
            });
            alert(`Mapeo para "${canalSiendoEditado.nombre}" guardado con éxito.`);
            mapeos = await fetchAPI('/mapeos');
            cerrarModal();
        } catch (error) {
            alert(`Error al guardar: ${error.message}`);
        }
    });
}