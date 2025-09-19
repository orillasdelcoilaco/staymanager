import { fetchAPI } from '../api.js';

let canales = [];

function mostrarResultados(resultados) {
    // ... (sin cambios)
}

function mostrarEstado(mensaje, esError = false) {
    // ... (sin cambios)
}

export async function render() {
    try {
        canales = await fetchAPI('/canales');
    } catch (error) {
        return `<p class="text-red-500">Error al cargar los canales. Por favor, recarga la página.</p>`;
    }

    return `
        <div class="bg-white p-8 rounded-lg shadow">
            <h2 class="text-2xl font-semibold text-gray-900 mb-4">Procesar y Consolidar Reservas</h2>
            <p class="text-gray-600 mb-6">
                Selecciona el canal al que pertenece el reporte y luego sube el archivo (formato CSV o XLS) para sincronizar los datos.
            </p>
            
            <form id="upload-form" class="border-t pt-6">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
                    <div>
                        <label for="canal-select" class="block text-sm font-medium text-gray-700">1. Seleccionar Canal</label>
                        <select id="canal-select" required class="mt-1 form-select w-full">
                            <option value="">-- Elige un canal --</option>
                            ${canales.map(c => `<option value="${c.id}">${c.nombre}</option>`).join('')}
                        </select>
                    </div>
                    <div>
                        <label for="archivoReservas" class="block text-sm font-medium text-gray-700">2. Seleccionar Archivo</label>
                        <input type="file" id="archivoReservas" name="archivoReservas" required 
                               accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                               class="mt-1 block w-full text-sm text-gray-500
                                      file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0
                                      file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700
                                      hover:file:bg-indigo-100">
                    </div>
                </div>
                
                <div class="flex justify-end">
                    <button type="submit" id="submit-btn" class="px-6 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:bg-gray-400" disabled>
                        Subir y Procesar
                    </button>
                </div>
            </form>

            <div id="resultados-container" class="mt-8 hidden"></div>
        </div>
    `;
}

export function afterRender() {
    const form = document.getElementById('upload-form');
    const submitBtn = document.getElementById('submit-btn');
    const canalSelect = document.getElementById('canal-select');
    const inputFile = document.getElementById('archivoReservas');

    function validarFormulario() {
        const canalValido = canalSelect.value !== '';
        const archivoValido = inputFile.files.length > 0;
        submitBtn.disabled = !(canalValido && archivoValido);
    }

    canalSelect.addEventListener('change', validarFormulario);
    inputFile.addEventListener('change', validarFormulario);

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        submitBtn.disabled = true;
        submitBtn.textContent = 'Procesando...';
        mostrarEstado('Subiendo y procesando el archivo, esto puede tardar unos momentos...');

        const canalId = canalSelect.value;
        const formData = new FormData();
        formData.append('archivoReservas', inputFile.files[0]);

        try {
            const resultados = await fetchAPI(`/sincronizar/upload/${canalId}`, {
                method: 'POST',
                body: formData
            });
            mostrarResultados(resultados);
        } catch (error) {
            console.error('Error en la subida:', error);
            mostrarEstado(`Error: ${error.message}`, true);
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Subir y Procesar';
            form.reset();
            validarFormulario();
        }
    });
}