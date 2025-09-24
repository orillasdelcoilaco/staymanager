import { fetchAPI } from '../api.js';

function showStatus(message, type = 'info') {
    const statusEl = document.getElementById('upload-status');
    if (!statusEl) return;
    
    let bgColor, textColor;
    switch (type) {
        case 'error': bgColor = 'bg-red-100'; textColor = 'text-red-800'; break;
        case 'success': bgColor = 'bg-green-100'; textColor = 'text-green-800'; break;
        default: bgColor = 'bg-blue-100'; textColor = 'text-blue-800';
    }
    
    statusEl.innerHTML = message;
    statusEl.className = `mt-6 p-4 rounded-md text-sm ${bgColor} ${textColor}`;
    statusEl.classList.remove('hidden');
}

export function render() {
    const currentYear = new Date().getFullYear();
    let yearOptions = '';
    for (let year = 2022; year <= currentYear + 1; year++) {
        yearOptions += `<option value="${year}">${year}</option>`;
    }

    return `
        <div class="bg-white p-8 rounded-lg shadow max-w-2xl mx-auto">
            <h2 class="text-2xl font-semibold text-gray-900 mb-2">Cargar Historial del Valor del Dólar</h2>
            <p class="text-gray-600 mb-6">
                Sube los archivos CSV con el valor histórico del dólar, un archivo por cada año. El sistema guardará los valores para usarlos en los cálculos de tarifas de Booking.
            </p>
            <form id="upload-form" class="mt-4 space-y-4">
                <div>
                    <label for="year-select" class="block text-sm font-medium text-gray-700">1. Selecciona el año del archivo</label>
                    <select id="year-select" name="year" required class="mt-1 form-select w-full">${yearOptions}</select>
                </div>
                <div>
                    <label for="dolar-file-input" class="block text-sm font-medium text-gray-700">2. Selecciona el archivo CSV</label>
                    <input type="file" id="dolar-file-input" name="dolarFile" accept=".csv" required 
                           class="mt-1 block w-full text-sm text-gray-500
                                  file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0
                                  file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700
                                  hover:file:bg-indigo-100">
                </div>
                <div class="pt-2">
                    <button type="submit" id="upload-btn" class="w-full sm:w-auto inline-flex justify-center items-center px-6 py-2 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700">
                        Cargar y Guardar Valores
                    </button>
                </div>
            </form>
            <div id="upload-status" class="mt-6 hidden"></div>
        </div>
    `;
}

export function afterRender() {
    const uploadForm = document.getElementById('upload-form');
    if (!uploadForm) return;

    uploadForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const year = document.getElementById('year-select').value;
        const fileInput = document.getElementById('dolar-file-input');
        const uploadBtn = document.getElementById('upload-btn');

        if (!fileInput.files.length) {
            showStatus('Por favor, selecciona un archivo.', 'error');
            return;
        }

        uploadBtn.disabled = true;
        uploadBtn.textContent = 'Procesando...';
        showStatus(`Cargando archivo del año ${year}. Esto puede tardar unos segundos...`, 'info');
        
        const formData = new FormData();
        formData.append('dolarFile', fileInput.files[0]);
        formData.append('year', year);

        try {
            const result = await fetchAPI('/dolar/upload-csv', {
                method: 'POST',
                body: formData
            });
            showStatus(`<strong>Éxito para el año ${year}:</strong> Se procesaron y guardaron ${result.summary.processed} registros.`, 'success');
            uploadForm.reset();
        } catch (error) {
            showStatus(`<strong>Error:</strong> ${error.message}`, 'error');
        } finally {
            uploadBtn.disabled = false;
            uploadBtn.textContent = 'Cargar y Guardar Valores';
        }
    });
}