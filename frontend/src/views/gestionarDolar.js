import { fetchAPI } from '../api.js';

let currentYear, currentMonth;
let valoresDelMes = [];
let valorEditando = null;

function showStatus(message, type = 'info', containerId = 'upload-status') {
    const statusEl = document.getElementById(containerId);
    if (!statusEl) return;
    let bgColor, textColor;
    switch (type) {
        case 'error': bgColor = 'bg-red-100'; textColor = 'text-red-800'; break;
        case 'success': bgColor = 'bg-green-100'; textColor = 'text-green-800'; break;
        default: bgColor = 'bg-blue-100'; textColor = 'text-blue-800';
    }
    statusEl.innerHTML = message;
    statusEl.className = `mt-4 p-3 rounded-md text-sm ${bgColor} ${textColor}`;
    statusEl.classList.remove('hidden');
}

function renderTabla() {
    const tbody = document.getElementById('valores-tbody');
    if (!tbody) return;
    if (valoresDelMes.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center py-4 text-gray-500">No hay valores para el mes seleccionado.</td></tr>';
        return;
    }
    tbody.innerHTML = valoresDelMes.map((v, index) => `
        <tr class="border-b">
            <td class="px-4 py-2 text-center font-medium text-gray-500">${index + 1}</td>
            <td class="px-4 py-2">${v.fecha}</td>
            <td class="px-4 py-2 font-mono">${v.valor.toLocaleString('es-CL')} ${v.modificadoManualmente ? '✏️' : ''}</td>
            <td class="px-4 py-2 text-right">
                <button data-fecha="${v.fecha}" class="edit-btn btn-table-edit mr-2">Editar</button>
                <button data-fecha="${v.fecha}" class="delete-btn btn-table-delete">Eliminar</button>
            </td>
        </tr>
    `).join('');
}

async function fetchAndRenderMonth() {
    const year = document.getElementById('year-select-view').value;
    const month = document.getElementById('month-select-view').value;
    currentYear = year;
    currentMonth = month;

    const tbody = document.getElementById('valores-tbody');
    tbody.innerHTML = '<tr><td colspan="4" class="text-center py-4 text-gray-500">Cargando...</td></tr>';

    try {
        valoresDelMes = await fetchAPI(`/dolar/valores/${year}/${month}`);
        renderTabla();
    } catch (error) {
        tbody.innerHTML = `<tr><td colspan="4" class="text-center py-4 text-red-500">Error: ${error.message}</td></tr>`;
    }
}

function abrirModal(valor = null) {
    valorEditando = valor;
    const modal = document.getElementById('valor-modal');
    const form = document.getElementById('valor-form');
    document.getElementById('modal-title').textContent = valor ? `Editar valor para ${valor.fecha}` : 'Añadir Nuevo Valor';
    
    if (valor) {
        form.fecha.value = valor.fecha;
        form.fecha.readOnly = true;
        form.valor.value = valor.valor;
    } else {
        form.reset();
        const aaaa = currentYear;
        const mm = String(currentMonth).padStart(2, '0');
        form.fecha.min = `${aaaa}-${mm}-01`;
        form.fecha.max = `${aaaa}-${mm}-${new Date(aaaa, mm, 0).getDate()}`;
        form.fecha.readOnly = false;
    }
    modal.classList.remove('hidden');
}

function cerrarModal() {
    document.getElementById('valor-modal').classList.add('hidden');
    valorEditando = null;
}

export function render() {
    const today = new Date();
    currentYear = today.getFullYear();
    currentMonth = today.getMonth() + 1;

    let yearOptionsUpload = '', yearOptionsView = '';
    for (let year = 2022; year <= currentYear + 1; year++) {
        yearOptionsUpload += `<option value="${year}" ${year === currentYear ? 'selected' : ''}>${year}</option>`;
        yearOptionsView += `<option value="${year}" ${year === currentYear ? 'selected' : ''}>${year}</option>`;
    }

    const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
    let monthOptions = monthNames.map((name, index) => 
        `<option value="${index + 1}" ${index + 1 === currentMonth ? 'selected' : ''}>${name}</option>`
    ).join('');

    return `
        <div class="space-y-8">
            <div class="bg-white p-6 rounded-lg shadow">
                <h3 class="text-lg font-semibold mb-4">Ver y Editar Valores Históricos</h3>
                <div class="flex items-end space-x-4 mb-4">
                    <div>
                        <label for="year-select-view" class="block text-sm font-medium">Año</label>
                        <select id="year-select-view" class="form-select mt-1">${yearOptionsView}</select>
                    </div>
                    <div>
                        <label for="month-select-view" class="block text-sm font-medium">Mes</label>
                        <select id="month-select-view" class="form-select mt-1">${monthOptions}</select>
                    </div>
                    <button id="add-valor-btn" class="btn-primary">Añadir Valor</button>
                </div>
                <div class="table-container">
                    <table class="min-w-full bg-white">
                        <thead>
                            <tr>
                                <th class="th w-12">#</th>
                                <th class="th">Fecha</th>
                                <th class="th">Valor (CLP)</th>
                                <th class="th text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody id="valores-tbody"></tbody>
                    </table>
                </div>
            </div>

            <div class="bg-white p-6 rounded-lg shadow">
                <h3 class="text-lg font-semibold mb-4">Cargar Archivo CSV por Año</h3>
                <form id="upload-form" class="space-y-4">
                    <div><label for="year-select-upload" class="block text-sm font-medium">Año del archivo</label><select id="year-select-upload" name="year" required class="form-select mt-1">${yearOptionsUpload}</select></div>
                    <div><label for="dolar-file-input" class="block text-sm font-medium">Archivo CSV</label><input type="file" id="dolar-file-input" name="dolarFile" accept=".csv" required class="form-input-file mt-1"></div>
                    <div><button type="submit" id="upload-btn" class="btn-secondary">Cargar Archivo</button></div>
                </form>
                <div id="upload-status" class="mt-4 hidden"></div>
            </div>
        </div>

        <div id="valor-modal" class="modal hidden"><div class="modal-content">
            <h3 id="modal-title" class="text-xl font-semibold mb-4"></h3>
            <form id="valor-form" class="space-y-4">
                <div><label for="fecha" class="block text-sm font-medium">Fecha</label><input type="date" name="fecha" required class="form-input mt-1"></div>
                <div><label for="valor" class="block text-sm font-medium">Valor</label><input type="number" step="0.01" name="valor" required class="form-input mt-1"></div>
                <div class="flex justify-end pt-4 border-t"><button type="button" id="cancel-btn" class="btn-secondary mr-2">Cancelar</button><button type="submit" class="btn-primary">Guardar</button></div>
            </form>
        </div></div>
    `;
}

export function afterRender() {
    document.getElementById('year-select-view').addEventListener('change', fetchAndRenderMonth);
    document.getElementById('month-select-view').addEventListener('change', fetchAndRenderMonth);
    document.getElementById('add-valor-btn').addEventListener('click', () => abrirModal());
    document.getElementById('cancel-btn').addEventListener('click', cerrarModal);

    const uploadForm = document.getElementById('upload-form');
    uploadForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const year = document.getElementById('year-select-upload').value;
        const fileInput = document.getElementById('dolar-file-input');
        const uploadBtn = document.getElementById('upload-btn');
        if (!fileInput.files.length) { showStatus('Selecciona un archivo.', 'error'); return; }

        uploadBtn.disabled = true;
        uploadBtn.textContent = 'Procesando...';
        showStatus(`Cargando archivo del año ${year}...`, 'info');
        
        const formData = new FormData();
        formData.append('dolarFile', fileInput.files[0]);
        formData.append('year', year);

        try {
            const result = await fetchAPI('/dolar/upload-csv', { method: 'POST', body: formData });
            showStatus(`<strong>Éxito para ${year}:</strong> Se procesaron ${result.summary.processed} registros. Los valores modificados manualmente fueron omitidos.`, 'success');
            if (year == currentYear && (new Date().getMonth() + 1) == currentMonth) fetchAndRenderMonth();
        } catch (error) {
            showStatus(`<strong>Error:</strong> ${error.message}`, 'error');
        } finally {
            uploadBtn.disabled = false;
            uploadBtn.textContent = 'Cargar Archivo';
        }
    });

    const valoresTbody = document.getElementById('valores-tbody');
    valoresTbody.addEventListener('click', async e => {
        const fecha = e.target.dataset.fecha;
        if (!fecha) return;
        if (e.target.classList.contains('edit-btn')) {
            const valor = valoresDelMes.find(v => v.fecha === fecha);
            abrirModal(valor);
        }
        if (e.target.classList.contains('delete-btn')) {
            if (confirm(`¿Seguro que quieres eliminar el valor para la fecha ${fecha}?`)) {
                try {
                    await fetchAPI(`/dolar/valores/${fecha}`, { method: 'DELETE' });
                    fetchAndRenderMonth();
                } catch (error) {
                    alert(`Error al eliminar: ${error.message}`);
                }
            }
        }
    });

    const valorForm = document.getElementById('valor-form');
    valorForm.addEventListener('submit', async e => {
        e.preventDefault();
        const datos = {
            fecha: e.target.fecha.value,
            valor: e.target.valor.value
        };
        try {
            await fetchAPI('/dolar/valores', { method: 'POST', body: datos });
            cerrarModal();
            fetchAndRenderMonth();
        } catch (error) {
            alert(`Error al guardar: ${error.message}`);
        }
    });

    fetchAndRenderMonth();
}