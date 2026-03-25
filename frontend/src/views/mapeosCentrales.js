// frontend/src/views/mapeosCentrales.js
// Admin view for managing centralized OTA CSV mappings.
// Only SYSTEM_ADMIN_EMAILS users can write/sync; all users can read & apply.

import { fetchAPI } from '../api.js';

const camposInternos = [
    { id: 'idReservaCanal', nombre: 'ID Reserva Canal' },
    { id: 'alojamientoNombre', nombre: 'Nombre Alojamiento' },
    { id: 'fechaLlegada', nombre: 'Fecha Llegada' },
    { id: 'fechaSalida', nombre: 'Fecha Salida' },
    { id: 'nombreCliente', nombre: 'Nombre Cliente' },
    { id: 'apellidoCliente', nombre: 'Apellido Cliente' },
    { id: 'estado', nombre: 'Estado Reserva' },
    { id: 'fechaReserva', nombre: 'Fecha Creación Reserva' },
    { id: 'invitados', nombre: 'Cantidad Huéspedes' },
    { id: 'correoCliente', nombre: 'Email Cliente' },
    { id: 'telefonoCliente', nombre: 'Teléfono Cliente' },
    { id: 'pais', nombre: 'País Cliente' },
    { id: 'tipoFila', nombre: 'Tipo Fila' },
    { id: 'valorAnfitrion', nombre: 'Pago Recibido por Anfitrión (Payout)' },
    { id: 'comision', nombre: 'Comisión Canal' },
    { id: 'costoCanal', nombre: 'Costo Canal' },
];

let mapeosCentrales = [];
let mapeoActual = null;
let canalesEmpresa = [];
let cabecerasArchivo = [];
let archivoDeMuestra = null;

// ── Helpers ──────────────────────────────────────────────────────────────────

function otaKeyDesdeNombre(nombre) {
    return (nombre || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// ── Render principal ──────────────────────────────────────────────────────────

export async function render() {
    try {
        [mapeosCentrales, canalesEmpresa] = await Promise.all([
            fetchAPI('/mapeos-centrales'),
            fetchAPI('/canales'),
        ]);
    } catch (err) {
        return `<p class="text-danger-500 p-4">Error al cargar datos: ${err.message}</p>`;
    }

    return `
        <div class="bg-white p-8 rounded-lg shadow space-y-6">
            <div class="flex justify-between items-center">
                <div>
                    <h2 class="text-2xl font-semibold text-gray-900">Mapeos OTA Centralizados</h2>
                    <p class="text-sm text-gray-500 mt-1">Configuración global de mapeos CSV para canales OTA. Se aplica automáticamente a todas las empresas al importar.</p>
                </div>
                <button id="btn-nuevo-mapeo" class="btn-primary">+ Nuevo OTA</button>
            </div>

            <div id="lista-mapeos-centrales">
                ${renderListaMapeos(mapeosCentrales, canalesEmpresa)}
            </div>

            <!-- Panel editor (oculto por defecto) -->
            <div id="panel-editor-mapeo" class="hidden border rounded-lg p-6 bg-gray-50 space-y-4">
                <h3 id="editor-titulo" class="text-lg font-semibold text-gray-800">Nuevo Mapeo OTA</h3>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Nombre del Canal OTA</label>
                        <input id="editor-nombre" type="text" class="input-field w-full" placeholder="ej: Airbnb" />
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Formato de Fecha</label>
                        <select id="editor-formato-fecha" class="input-field w-full">
                            <option value="DD/MM/YYYY">DD/MM/YYYY — con cero (25/12/2025)</option>
                            <option value="D/M/YYYY">D/M/YYYY — sin cero, Airbnb (5/2/2025)</option>
                            <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                            <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                            <option value="D MMM YYYY">D MMM YYYY</option>
                            <option value="DD-MM-YYYY">DD-MM-YYYY</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Separador Decimal</label>
                        <select id="editor-separador" class="input-field w-full">
                            <option value=",">, (coma)</option>
                            <option value=".">. (punto)</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Configuración IVA</label>
                        <select id="editor-iva" class="input-field w-full">
                            <option value="incluido">IVA incluido en el precio</option>
                            <option value="agregar">Agregar IVA al precio</option>
                            <option value="exento">Exento de IVA</option>
                        </select>
                    </div>
                </div>

                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">Mapeo de Columnas CSV</label>
                    <p class="text-xs text-gray-500 mb-3">Sube un archivo CSV de muestra para detectar las columnas automáticamente.</p>

                    <div class="flex items-center gap-3 mb-3">
                        <input type="file" id="editor-archivo-muestra" accept=".csv,.txt" class="text-sm text-gray-600" />
                        <span id="editor-upload-status" class="text-sm hidden"></span>
                    </div>

                    <p id="editor-mapeo-actual" class="text-sm text-success-600 mb-2 hidden"></p>

                    <div id="editor-campos-mapeo" class="hidden">
                        <div id="editor-campos-grid" class="space-y-2"></div>
                    </div>
                </div>

                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">Mapeo de Estados</label>
                    <p class="text-xs text-gray-500 mb-3">Define cómo se traducen los estados del canal al sistema.</p>
                    <div id="editor-estados-container" class="space-y-2">
                        ${renderEditorEstados({})}
                    </div>
                    <button id="btn-agregar-estado" class="btn-secondary text-sm mt-2">+ Agregar Estado</button>
                </div>

                <div class="flex gap-3 pt-2">
                    <button id="btn-guardar-mapeo" class="btn-primary">Guardar</button>
                    <button id="btn-cancelar-editor" class="btn-secondary">Cancelar</button>
                </div>
            </div>
        </div>
    `;
}

function renderListaMapeos(lista, canales) {
    if (!lista.length) {
        return `<p class="text-gray-500 text-sm">No hay mapeos centrales configurados aún.</p>`;
    }

    return `
        <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-gray-200 text-sm">
                <thead class="bg-gray-50">
                    <tr>
                        <th class="px-4 py-3 text-left font-medium text-gray-500">Canal OTA</th>
                        <th class="px-4 py-3 text-left font-medium text-gray-500">Campos mapeados</th>
                        <th class="px-4 py-3 text-left font-medium text-gray-500">Fecha</th>
                        <th class="px-4 py-3 text-left font-medium text-gray-500">Acciones</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-gray-100">
                    ${lista.map(m => `
                        <tr>
                            <td class="px-4 py-3 font-medium text-gray-900">${m.nombre}</td>
                            <td class="px-4 py-3 text-gray-600">${(m.mapeos || []).length} campos</td>
                            <td class="px-4 py-3 text-gray-500">${m.fechaActualizacion ? new Date(m.fechaActualizacion._seconds * 1000).toLocaleDateString('es-CL') : '–'}</td>
                            <td class="px-4 py-3 flex gap-2 flex-wrap">
                                <button class="btn-secondary text-xs btn-editar-mapeo" data-key="${m.id}">✏️ Editar</button>
                                <button class="btn-secondary text-xs btn-sync-mapeo" data-key="${m.id}" title="Aplicar a todas las empresas">🔄 Sincronizar</button>
                                ${canales.length ? `
                                    <select class="input-field text-xs select-canal-aplicar" data-key="${m.id}">
                                        <option value="">Aplicar a canal…</option>
                                        ${canales.map(c => `<option value="${c.id}">${c.nombre}</option>`).join('')}
                                    </select>
                                    <button class="btn-secondary text-xs btn-aplicar-mapeo" data-key="${m.id}">✅ Aplicar</button>
                                ` : ''}
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>

        <!-- Export from current empresa -->
        ${canales.length ? `
            <div class="mt-4 p-4 bg-primary-50 rounded-lg border border-primary-200">
                <p class="text-sm font-medium text-primary-800 mb-2">Exportar mapeo de esta empresa al central</p>
                <div class="flex gap-2 items-center">
                    <select id="select-canal-exportar" class="input-field text-sm">
                        <option value="">Selecciona un canal…</option>
                        ${canales.map(c => `<option value="${c.id}">${c.nombre}</option>`).join('')}
                    </select>
                    <button id="btn-exportar-mapeo" class="btn-secondary text-sm">📤 Exportar</button>
                </div>
            </div>
        ` : ''}
    `;
}

function renderEditorEstados(mapeosDeEstado) {
    const entries = Object.entries(mapeosDeEstado || {});
    if (!entries.length) {
        return `<p class="text-xs text-gray-400 italic" id="msg-sin-estados">Sin estados configurados.</p>`;
    }
    return entries.map(([otaEstado, interno]) => renderFilaEstado(otaEstado, interno)).join('');
}

function renderFilaEstado(otaEstado = '', interno = '') {
    return `
        <div class="flex items-center gap-2 estado-fila">
            <input type="text" class="input-field text-sm w-40 estado-ota" placeholder="Estado OTA" value="${otaEstado}" />
            <span class="text-gray-400">→</span>
            <select class="input-field text-sm w-48 estado-interno">
                ${['confirmada', 'cancelada', 'pendiente', 'no_show', 'modificada'].map(e =>
                    `<option value="${e}" ${e === interno ? 'selected' : ''}>${e}</option>`
                ).join('')}
            </select>
            <button class="text-danger-400 hover:text-danger-600 text-xs btn-eliminar-estado">✕</button>
        </div>
    `;
}

// ── Setup de eventos ──────────────────────────────────────────────────────────

export function afterRender() {
    // Botón nuevo
    document.getElementById('btn-nuevo-mapeo')?.addEventListener('click', () => {
        abrirEditor(null);
    });

    // Botón cancelar
    document.getElementById('btn-cancelar-editor')?.addEventListener('click', () => {
        cerrarEditor();
    });

    // Botón guardar
    document.getElementById('btn-guardar-mapeo')?.addEventListener('click', guardarMapeo);

    // Botón agregar estado
    document.getElementById('btn-agregar-estado')?.addEventListener('click', () => {
        const container = document.getElementById('editor-estados-container');
        const msgSin = document.getElementById('msg-sin-estados');
        if (msgSin) msgSin.remove();
        container.insertAdjacentHTML('beforeend', renderFilaEstado());
    });

    // Delegado en lista: editar, sincronizar, aplicar
    document.getElementById('lista-mapeos-centrales')?.addEventListener('click', async (e) => {
        const btnEditar = e.target.closest('.btn-editar-mapeo');
        const btnSync = e.target.closest('.btn-sync-mapeo');
        const btnAplicar = e.target.closest('.btn-aplicar-mapeo');
        const btnEliminarEstado = e.target.closest('.btn-eliminar-estado');
        const btnExportar = e.target.closest('#btn-exportar-mapeo');

        if (btnEditar) {
            const key = btnEditar.dataset.key;
            const mapeo = mapeosCentrales.find(m => m.id === key);
            if (mapeo) abrirEditor(mapeo);
        }

        if (btnSync) {
            const key = btnSync.dataset.key;
            if (!confirm(`¿Sincronizar "${key}" a TODAS las empresas? Esta acción aplicará el mapeo central a todos los canales que coincidan por nombre.`)) return;
            try {
                btnSync.disabled = true;
                btnSync.textContent = '⏳ Sincronizando…';
                const result = await fetchAPI(`/mapeos-centrales/${key}/sync`, { method: 'POST' });
                alert(`✅ Sincronización completada.\n${result.actualizadas} empresas actualizadas.\n${result.errores.length ? 'Errores: ' + result.errores.join(', ') : ''}`);
            } catch (err) {
                alert(`Error al sincronizar: ${err.message}`);
            } finally {
                btnSync.disabled = false;
                btnSync.textContent = '🔄 Sincronizar';
            }
        }

        if (btnAplicar) {
            const key = btnAplicar.dataset.key;
            const select = document.querySelector(`.select-canal-aplicar[data-key="${key}"]`);
            const canalId = select?.value;
            if (!canalId) { alert('Selecciona un canal primero.'); return; }
            try {
                btnAplicar.disabled = true;
                await fetchAPI(`/mapeos-centrales/${key}/aplicar`, { method: 'POST', body: JSON.stringify({ canalId }) });
                alert('✅ Mapeo aplicado al canal exitosamente.');
            } catch (err) {
                alert(`Error: ${err.message}`);
            } finally {
                btnAplicar.disabled = false;
            }
        }

        if (btnEliminarEstado) {
            btnEliminarEstado.closest('.estado-fila')?.remove();
        }

        if (btnExportar) {
            const canalId = document.getElementById('select-canal-exportar')?.value;
            if (!canalId) { alert('Selecciona un canal para exportar.'); return; }
            try {
                btnExportar.disabled = true;
                btnExportar.textContent = '⏳ Exportando…';
                const result = await fetchAPI('/mapeos-centrales/exportar', { method: 'POST', body: JSON.stringify({ canalId }) });
                alert(`✅ Mapeo exportado como "${result.otaKey}".`);
                await recargar();
            } catch (err) {
                alert(`Error al exportar: ${err.message}`);
            } finally {
                btnExportar.disabled = false;
                btnExportar.textContent = '📤 Exportar';
            }
        }
    });

    // Delegado en panel editor: eliminar fila de estado
    document.getElementById('panel-editor-mapeo')?.addEventListener('click', (e) => {
        const btnEliminar = e.target.closest('.btn-eliminar-estado');
        if (btnEliminar) btnEliminar.closest('.estado-fila')?.remove();
    });

    // Listener archivo CSV de muestra
    document.getElementById('editor-archivo-muestra')?.addEventListener('change', handleFileUploadCentral);
}

// ── Helpers archivo de muestra ────────────────────────────────────────────────

async function handleFileUploadCentral(e) {
    const file = e.target.files[0];
    if (!file) return;
    archivoDeMuestra = file;
    cabecerasArchivo = [];

    const statusEl = document.getElementById('editor-upload-status');
    statusEl.textContent = 'Analizando columnas…';
    statusEl.classList.remove('hidden', 'text-danger-500');
    statusEl.classList.add('text-gray-500');

    const formData = new FormData();
    formData.append('archivoMuestra', file);
    try {
        cabecerasArchivo = await fetchAPI('/sincronizar/analizar-archivo', { method: 'POST', body: formData });
        statusEl.classList.add('hidden');
        renderCamposMapeoGrid();
    } catch (err) {
        statusEl.textContent = `Error al leer el archivo: ${err.message}`;
        statusEl.classList.remove('text-gray-500');
        statusEl.classList.add('text-danger-500');
    }
}

function renderCamposMapeoGrid() {
    const contenedor = document.getElementById('editor-campos-mapeo');
    const grid       = document.getElementById('editor-campos-grid');
    const mapeosActuales = mapeoActual?.mapeos || [];
    const opcionesHtml   = cabecerasArchivo.map(c => `<option value="${c}">${c}</option>`).join('');

    grid.innerHTML = camposInternos.map(campo => `
        <div class="flex items-center gap-3 text-sm">
            <span class="w-52 text-gray-600 shrink-0">${campo.nombre}</span>
            <select class="input-field flex-1 mapeo-central-select" data-campo="${campo.id}">
                <option value="">— no aplicar —</option>
                ${opcionesHtml}
            </select>
        </div>`).join('');

    // Pre-seleccionar mapeos existentes por nombre de columna
    grid.querySelectorAll('.mapeo-central-select').forEach(select => {
        const m = mapeosActuales.find(x => x.campoInterno === select.dataset.campo);
        if (m && cabecerasArchivo[m.columnaIndex]) select.value = cabecerasArchivo[m.columnaIndex];
    });

    // Listener en el select de estado para auto-detectar valores
    const selectEstado = grid.querySelector('.mapeo-central-select[data-campo="estado"]');
    if (selectEstado) {
        selectEstado.addEventListener('change', (e) => {
            if (e.target.value) detectarEstadosCentral(e.target.value);
        });
        if (selectEstado.value) detectarEstadosCentral(selectEstado.value);
    }

    contenedor.classList.remove('hidden');
}

async function detectarEstadosCentral(columnaNombre) {
    const indiceColumna = cabecerasArchivo.indexOf(columnaNombre);
    if (indiceColumna === -1 || !archivoDeMuestra) return;

    const container = document.getElementById('editor-estados-container');
    const btnAgregar = document.getElementById('btn-agregar-estado');
    container.innerHTML = '<p class="text-sm text-gray-500">Detectando estados del archivo…</p>';
    btnAgregar.classList.add('hidden');

    try {
        const formData = new FormData();
        formData.append('archivoMuestra', archivoDeMuestra);
        formData.append('indiceColumna', indiceColumna);
        const valoresUnicos = await fetchAPI('/sincronizar/analizar-columna', { method: 'POST', body: formData });

        const mapeosActuales = mapeoActual?.mapeosDeEstado || {};
        container.innerHTML = valoresUnicos.map(valor => `
            <div class="flex items-center gap-2">
                <span class="font-mono text-sm bg-gray-100 px-2 py-1 rounded w-52 shrink-0 truncate" title="${valor}">${valor}</span>
                <span class="text-gray-400">→</span>
                <select class="input-field text-sm flex-1 estado-central-auto" data-valor-original="${valor}">
                    <option value="">— ignorar fila —</option>
                    <option value="confirmada"  ${mapeosActuales[valor] === 'confirmada'  ? 'selected' : ''}>Confirmada</option>
                    <option value="cancelada"   ${mapeosActuales[valor] === 'cancelada'   ? 'selected' : ''}>Cancelada</option>
                    <option value="pendiente"   ${mapeosActuales[valor] === 'pendiente'   ? 'selected' : ''}>Pendiente</option>
                    <option value="no_show"     ${mapeosActuales[valor] === 'no_show'     ? 'selected' : ''}>No Show</option>
                    <option value="modificada"  ${mapeosActuales[valor] === 'modificada'  ? 'selected' : ''}>Modificada</option>
                </select>
            </div>`).join('');
    } catch (err) {
        container.innerHTML = `<p class="text-sm text-danger-500">Error al detectar estados: ${err.message}</p>`;
        btnAgregar.classList.remove('hidden');
    }
}

function renderCamposMapeoGridSinArchivo(mapeosActuales) {
    const contenedor = document.getElementById('editor-campos-mapeo');
    const grid       = document.getElementById('editor-campos-grid');

    grid.innerHTML = camposInternos.map(campo => {
        const m = mapeosActuales.find(x => x.campoInterno === campo.id);
        return `
        <div class="flex items-center gap-3 text-sm">
            <span class="w-52 text-gray-600 shrink-0">${campo.nombre}</span>
            <input type="number" min="0" class="input-field w-24 text-center mapeo-col-input"
                   data-campo="${campo.id}" placeholder="–" value="${m != null ? m.columnaIndex : ''}" />
        </div>`;
    }).join('');

    contenedor.classList.remove('hidden');
}

// ── Editor helpers ────────────────────────────────────────────────────────────

function abrirEditor(mapeo) {
    mapeoActual = mapeo;
    cabecerasArchivo = [];
    archivoDeMuestra = null;

    const panel = document.getElementById('panel-editor-mapeo');
    document.getElementById('editor-titulo').textContent = mapeo ? `Editar: ${mapeo.nombre}` : 'Nuevo Mapeo OTA';

    document.getElementById('editor-nombre').value = mapeo?.nombre || '';
    document.getElementById('editor-formato-fecha').value = mapeo?.formatoFecha || 'DD/MM/YYYY';
    document.getElementById('editor-separador').value = mapeo?.separadorDecimal || ',';
    document.getElementById('editor-iva').value = mapeo?.configuracionIva || 'incluido';

    // Resetear zona de archivo
    const fileInput = document.getElementById('editor-archivo-muestra');
    if (fileInput) fileInput.value = '';
    document.getElementById('editor-upload-status').classList.add('hidden');
    document.getElementById('editor-campos-mapeo').classList.add('hidden');

    // Mostrar mapeos existentes o limpiar grid
    const resumenEl = document.getElementById('editor-mapeo-actual');
    if (mapeo?.mapeos?.length > 0) {
        resumenEl.textContent = `Mostrando ${mapeo.mapeos.length} campo(s) mapeado(s) por índice de columna. Sube un CSV de muestra para mapear por nombre de columna.`;
        resumenEl.classList.remove('hidden');
        renderCamposMapeoGridSinArchivo(mapeo.mapeos);
    } else {
        resumenEl.classList.add('hidden');
        document.getElementById('editor-campos-grid').innerHTML = '';
        document.getElementById('editor-campos-mapeo').classList.add('hidden');
    }

    // Estados: resetear a modo manual con los existentes
    document.getElementById('btn-agregar-estado').classList.remove('hidden');
    document.getElementById('editor-estados-container').innerHTML =
        renderEditorEstados(mapeo?.mapeosDeEstado || {});

    panel.classList.remove('hidden');
    panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function cerrarEditor() {
    mapeoActual = null;
    document.getElementById('panel-editor-mapeo').classList.add('hidden');
}

async function guardarMapeo() {
    const nombre = document.getElementById('editor-nombre').value.trim();
    if (!nombre) { alert('El nombre del canal es obligatorio.'); return; }

    const otaKey = mapeoActual?.id || otaKeyDesdeNombre(nombre);

    const mapeos = [];
    const selectsPresentes = document.querySelectorAll('.mapeo-central-select');
    const inputsPresentes  = document.querySelectorAll('.mapeo-col-input');
    if (selectsPresentes.length > 0) {
        // Archivo subido: leer por nombre de columna
        selectsPresentes.forEach(select => {
            const colNombre = select.value;
            if (colNombre) {
                const idx = cabecerasArchivo.indexOf(colNombre);
                if (idx !== -1) mapeos.push({ campoInterno: select.dataset.campo, columnaIndex: idx });
            }
        });
    } else if (inputsPresentes.length > 0) {
        // Sin archivo: leer índices numéricos del grid de fallback
        inputsPresentes.forEach(input => {
            const val = input.value.trim();
            if (val !== '') mapeos.push({ campoInterno: input.dataset.campo, columnaIndex: parseInt(val, 10) });
        });
    }

    const mapeosDeEstado = {};
    // Estados auto-detectados desde archivo CSV
    document.querySelectorAll('.estado-central-auto').forEach(select => {
        const valor = select.dataset.valorOriginal;
        const interno = select.value;
        if (valor && interno) mapeosDeEstado[valor] = interno;
    });
    // Estados ingresados manualmente (fallback sin archivo)
    if (Object.keys(mapeosDeEstado).length === 0) {
        document.querySelectorAll('.estado-fila').forEach(fila => {
            const otaEstado = fila.querySelector('.estado-ota')?.value.trim();
            const interno   = fila.querySelector('.estado-interno')?.value;
            if (otaEstado && interno) mapeosDeEstado[otaEstado] = interno;
        });
    }

    const datos = {
        nombre,
        formatoFecha: document.getElementById('editor-formato-fecha').value,
        separadorDecimal: document.getElementById('editor-separador').value,
        configuracionIva: document.getElementById('editor-iva').value,
        mapeosDeEstado,
        mapeos,
    };

    const btnGuardar = document.getElementById('btn-guardar-mapeo');
    try {
        btnGuardar.disabled = true;
        btnGuardar.textContent = 'Guardando…';
        await fetchAPI(`/mapeos-centrales/${otaKey}`, { method: 'PUT', body: JSON.stringify(datos) });
        cerrarEditor();
        await recargar();
    } catch (err) {
        alert(`Error al guardar: ${err.message}`);
    } finally {
        btnGuardar.disabled = false;
        btnGuardar.textContent = 'Guardar';
    }
}

async function recargar() {
    try {
        [mapeosCentrales, canalesEmpresa] = await Promise.all([
            fetchAPI('/mapeos-centrales'),
            fetchAPI('/canales'),
        ]);
        document.getElementById('lista-mapeos-centrales').innerHTML =
            renderListaMapeos(mapeosCentrales, canalesEmpresa);
    } catch (err) {
        console.error('Error al recargar mapeos:', err);
    }
}
