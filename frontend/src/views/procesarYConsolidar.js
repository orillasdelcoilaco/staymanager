import { fetchAPI } from '../api.js';

function mostrarResultados(resultados) {
    const container = document.getElementById('resultados-container');
    if (!container) return;

    const { totalFilas, reservasCreadas, reservasActualizadas, clientesCreados, errores } = resultados.data;

    let erroresHtml = '';
    if (errores && errores.length > 0) {
        erroresHtml = `
            <h4 class="font-semibold text-red-700 mt-4">Errores encontrados (${errores.length}):</h4>
            <ul class="list-disc list-inside text-sm text-red-600">
                ${errores.map(e => `<li>Reserva ${e.fila}: ${e.error}</li>`).join('')}
            </ul>
        `;
    }

    container.innerHTML = `
        <div class="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative" role="alert">
            <strong class="font-bold">¡Proceso completado!</strong>
            <ul class="mt-2 list-disc list-inside">
                <li>Total de filas leídas: ${totalFilas}</li>
                <li>Reservas nuevas creadas: ${reservasCreadas}</li>
                <li>Reservas existentes actualizadas: ${reservasActualizadas}</li>
                <li>Clientes nuevos creados: ${clientesCreados}</li>
            </ul>
            ${erroresHtml}
        </div>
    `;
    container.classList.remove('hidden');
}

function mostrarEstado(mensaje, esError = false) {
    const container = document.getElementById('resultados-container');
    if (!container) return;
    const color = esError ? 'red' : 'blue';
    container.innerHTML = `
        <div class="bg-${color}-100 border border-${color}-400 text-${color}-700 px-4 py-3 rounded relative">
            <p>${mensaje}</p>
        </div>
    `;
    container.classList.remove('hidden');
}

export function render() {
    return `
        <div class="bg-white p-8 rounded-lg shadow">
            <h2 class="text-2xl font-semibold text-gray-900 mb-4">Procesar y Consolidar Reservas</h2>
            <p class="text-gray-600 mb-6">
                Sube tu archivo de reporte de reservas (formato CSV o XLS) para sincronizar los datos en el sistema.
                El proceso identificará los alojamientos, creará o actualizará clientes y registrará las reservas.
            </p>
            
            <form id="upload-form" class="border-t pt-6">
                <div class="mb-4">
                    <label for="archivoReservas" class="block text-sm font-medium text-gray-700">Seleccionar archivo</label>
                    <input type="file" id="archivoReservas" name="archivoReservas" required 
                           accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                           class="mt-1 block w-full text-sm text-gray-500
                                  file:mr-4 file:py-2 file:px-4
                                  file:rounded-full file:border-0
                                  file:text-sm file:font-semibold
                                  file:bg-indigo-50 file:text-indigo-700
                                  hover:file:bg-indigo-100">
                </div>
                
                <div class="flex justify-end">
                    <button type="submit" id="submit-btn" class="px-6 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:bg-gray-400">
                        Subir y Procesar
                    </button>
                </div>
            </form>

            <div id="resultados-container" class="mt-8 hidden">
                </div>
        </div>
    `;
}

export function afterRender() {
    const form = document.getElementById('upload-form');
    const submitBtn = document.getElementById('submit-btn');
    const inputFile = document.getElementById('archivoReservas');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!inputFile.files || inputFile.files.length === 0) {
            alert('Por favor, selecciona un archivo.');
            return;
        }

        submitBtn.disabled = true;
        submitBtn.textContent = 'Procesando...';
        mostrarEstado('Subiendo y procesando el archivo, esto puede tardar unos momentos...');

        const formData = new FormData();
        formData.append('archivoReservas', inputFile.files[0]);

        try {
            const resultados = await fetchAPI('/sincronizar/upload', {
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
        }
    });
}