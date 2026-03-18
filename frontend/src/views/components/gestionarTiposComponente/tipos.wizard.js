// frontend/src/views/components/gestionarTiposComponente/tipos.wizard.js
import { fetchAPI } from '../../../api.js';

// Variables globales para el Wizard
let onSaveCallback = null;
let currentAnalisis = null;
let tiposElementoCache = []; // Cache para el dropdown
let inventarioTemporal = []; // Array de { tipoId, nombre, cantidad, icono }

export const renderWizardModal = () => `
    <div id="tipo-wizard-modal" class="modal hidden fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center">
        <div class="modal-content relative bg-white rounded-lg shadow-xl w-full max-w-3xl mx-4 md:mx-auto">
            
            <div class="flex justify-between items-center p-5 border-b bg-gray-50 rounded-t-lg">
                <h3 class="text-xl font-bold text-gray-800 flex items-center gap-2">
                    ✨ Nuevo Tipo de Espacio (IA)
                </h3>
                <button id="close-wizard-btn" class="text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
            </div>

            <div class="p-6 max-h-[75vh] overflow-y-auto">
                
                <!-- PASO 1 -->
                <div id="step-1-input" class="space-y-4">
                    <p class="text-gray-600 text-sm">
                        Escribe el nombre del espacio (ej: "Quincho", "Rincón de Lectura"). 
                        <br><strong>La IA definirá el estándar de fotografía y sugerirá equipamiento.</strong>
                    </p>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Nombre del Espacio</label>
                        <div class="flex gap-2">
                            <input type="text" id="input-nombre-usuario" class="form-input flex-1" placeholder="Ej: Quincho para asados..." autofocus>
                            <button id="btn-analizar-ia" class="btn-primary whitespace-nowrap px-6">
                                🤖 Analizar
                            </button>
                        </div>
                    </div>
                </div>

                <!-- LOADING -->
                <div id="step-loading" class="hidden py-8 text-center">
                    <div class="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600 mx-auto mb-3"></div>
                    <p class="text-indigo-600 font-medium animate-pulse">La IA está diseñando el perfil del espacio...</p>
                    <p class="text-xs text-gray-400 mt-1">Definiendo inventario y tiros de cámara</p>
                </div>

                <!-- PASO 2 -->
                <div id="step-2-review" class="hidden space-y-6">
                    <!-- Cabecera -->
                    <div class="bg-indigo-50 p-4 rounded-md border border-indigo-100">
                        <div class="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
                            <div class="md:col-span-1 text-center">
                                <span id="review-icono" class="text-5xl">🏠</span>
                            </div>
                            <div class="md:col-span-3">
                                <label class="block text-xs font-semibold text-indigo-600 uppercase tracking-wide">Nombre Normalizado</label>
                                <input type="text" id="review-nombre-normalizado" class="w-full font-bold text-lg text-gray-900 bg-transparent border-b border-indigo-200 focus:outline-none focus:border-indigo-500 pb-1">
                                <input type="text" id="review-descripcion" class="w-full text-sm text-gray-600 mt-1 bg-transparent border-b border-transparent focus:border-indigo-300 focus:outline-none" placeholder="Descripción...">
                            </div>
                        </div>
                    </div>

                    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <!-- Columna Izquierda: Fotos -->
                        <div>
                            <h4 class="font-semibold text-gray-800 mb-2 flex items-center justify-between">
                                <span class="flex items-center gap-2">📸 Guía de Fotos (IA)</span>
                                <button id="btn-recalc-photos" class="text-[10px] bg-indigo-50 text-indigo-600 px-2 py-1 rounded border border-indigo-200 hover:bg-indigo-100 transition-colors" title="Recalcular basándose en el inventario actual">
                                    ↻ Recalcular
                                </button>
                            </h4>
                            <ul id="review-shotlist" class="space-y-2 text-sm text-gray-700 bg-gray-50 p-3 rounded-md border border-gray-200 h-64 overflow-y-auto">
                            </ul>
                        </div>

                        <!-- Columna Derecha: Inventario -->
                        <div class="flex flex-col h-full">
                            <h4 class="font-semibold text-gray-800 mb-2 flex items-center gap-2">
                                📦 Inventario Estándar
                                <span class="text-xs text-gray-400 font-normal">(Se creará automáticamente)</span>
                            </h4>
                            
                            <!-- Lista Actual -->
                            <div id="review-inventory-list" class="flex-1 bg-gray-50 p-2 rounded-md border border-gray-200 overflow-y-auto h-40 mb-2 text-sm">
                                <p class="text-gray-400 text-center italic mt-4">Sin elementos por defecto.</p>
                            </div>

                            <!-- Agregar Elemento -->
                            <!-- Agregar Elemento (Compatibilidad Legacy + Bulk) -->
                            <div class="space-y-3">
                                <!-- Botones de Acción -->
                                <div class="flex gap-2">
                                    <button type="button" onclick="window.wizardToggleBulkPanel()" class="flex-1 bg-indigo-50 text-indigo-700 px-3 py-2 rounded-md text-sm border border-indigo-200 hover:bg-indigo-100 transition-colors flex justify-between items-center">
                                        <span>+ Agregar Activos (Masivo)</span>
                                        <span id="wizard-bulk-arrow" class="transform transition-transform text-xs">▼</span>
                                    </button>
                                </div>

                                <!-- Panel Bulk (Hidden) -->
                                <div id="wizard-bulk-panel" class="hidden border border-indigo-100 rounded-md p-2 bg-white shadow-sm">
                                    <div id="wizard-bulk-list-container">Cargando...</div>
                                    <div class="flex justify-end pt-2 border-t mt-2">
                                        <button type="button" onclick="window.wizardAgregarSeleccionados()" class="bg-indigo-600 text-white px-3 py-1.5 rounded text-xs hover:bg-indigo-700">
                                            Agregar Seleccionados
                                        </button>
                                    </div>
                                </div>

                                <!-- Legacy Single Add (Opcional, mantener oculto o secundario si se prefiere) -->
                                <div class="flex gap-2 items-center text-xs text-gray-500 pt-2 border-t">
                                    <span>Agregar individual:</span>
                                    <select id="select-element-default" class="form-select text-xs w-32">
                                        <option value="">Buscar...</option>
                                    </select>
                                    <input type="number" id="input-qty-default" class="form-input text-xs w-12 text-center" value="1" min="1">
                                    <button id="btn-add-default" class="bg-gray-200 text-gray-700 px-2 py-1 rounded hover:bg-gray-300">+</button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

            </div>

            <div class="p-5 border-t bg-gray-50 rounded-b-lg flex justify-end gap-3">
                <button id="btn-cancelar-wizard" class="btn-secondary">Cancelar</button>
                <button id="btn-guardar-tipo" class="btn-primary hidden">Confirmar y Crear</button>
            </div>
        </div>
    </div>
`;

export const setupWizardEvents = (onSave) => {
    onSaveCallback = onSave;
    const modal = document.getElementById('tipo-wizard-modal');

    // Fetch inicial de tipos de elemento
    cargarTiposElemento();

    const cerrar = () => {
        if (modal) modal.classList.add('hidden');
        resetWizard();
    };

    document.getElementById('close-wizard-btn')?.addEventListener('click', cerrar);
    document.getElementById('btn-cancelar-wizard')?.addEventListener('click', cerrar);

    // Paso 1: Analizar
    const btnAnalizar = document.getElementById('btn-analizar-ia');
    if (btnAnalizar) btnAnalizar.addEventListener('click', handleAnalizar);

    document.getElementById('input-nombre-usuario')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleAnalizar();
    });

    // Paso 2: Gestión de Inventario
    document.getElementById('btn-add-default')?.addEventListener('click', handleAddDefault);

    // Paso 2: Guardar
    document.getElementById('btn-guardar-tipo')?.addEventListener('click', handleGuardar);

    // AI Recalc
    document.getElementById('btn-recalc-photos')?.addEventListener('click', handleRecalculatePhotos);
};

export const openWizard = () => {
    const modal = document.getElementById('tipo-wizard-modal');
    modal.classList.remove('hidden');
    document.getElementById('input-nombre-usuario').focus();
    // Recargar tipos por si hubo cambios
    cargarTiposElemento();
};

// --- LOGICA INTERNA ---

async function cargarTiposElemento() {
    const select = document.getElementById('select-element-default');
    if (!select) return;

    if (tiposElementoCache.length === 0) {
        try {
            tiposElementoCache = await fetchAPI('/tipos-elemento');
        } catch (error) {
            console.error('Error cargando tipos elemento:', error);
            select.innerHTML = '<option value="">Error carga</option>';
            return;
        }
    }

    // Renderizar opciones agrupadas
    const categorias = {};
    tiposElementoCache.forEach(t => {
        const cat = t.categoria || 'OTROS';
        if (!categorias[cat]) categorias[cat] = [];
        categorias[cat].push(t);
    });

    let html = '<option value="">+ Agregar...</option>';
    Object.keys(categorias).sort().forEach(cat => {
        html += `<optgroup label="${cat}">`;
        categorias[cat].forEach(t => {
            html += `<option value="${t.id}">${t.icono || ''} ${t.nombre}</option>`;
        });
        html += `</optgroup>`;
    });
    select.innerHTML = html;
}

const resetWizard = () => {
    document.getElementById('step-1-input').classList.remove('hidden');
    document.getElementById('step-loading').classList.add('hidden');
    document.getElementById('step-2-review').classList.add('hidden');
    document.getElementById('btn-guardar-tipo').classList.add('hidden');
    document.getElementById('input-nombre-usuario').value = '';
    currentAnalisis = null;
    inventarioTemporal = [];
    editingId = null;
    document.querySelector('#tipo-wizard-modal h3').textContent = '✨ Nuevo Tipo de Espacio (IA)';
};

const handleAnalizar = async () => {
    const nombreUsuario = document.getElementById('input-nombre-usuario').value.trim();
    if (!nombreUsuario) return;

    document.getElementById('step-1-input').classList.add('hidden');
    document.getElementById('step-loading').classList.remove('hidden');

    try {
        currentAnalisis = await fetchAPI('/componentes/analizar-ia', {
            method: 'POST',
            body: { nombre: nombreUsuario }
        });

        document.getElementById('review-icono').textContent = currentAnalisis.icono;
        document.getElementById('review-nombre-normalizado').value = currentAnalisis.nombreNormalizado;
        document.getElementById('review-descripcion').value = currentAnalisis.descripcionBase;

        const shotListHtml = currentAnalisis.shotList.map(item =>
            `<li class="flex items-start gap-2"><span class="text-green-500 font-bold">✓</span> ${item}</li>`
        ).join('');
        document.getElementById('review-shotlist').innerHTML = shotListHtml;

        // Procesar Inventario Sugerido (IA -> IDs reales si existen match fuzzy)
        inventarioTemporal = [];
        if (currentAnalisis.inventarioSugerido) {
            currentAnalisis.inventarioSugerido.forEach(sug => {
                // Match muy básico por nombre
                const match = tiposElementoCache.find(t => t.nombre.toLowerCase().includes(sug.nombre.toLowerCase()));
                if (match) {
                    inventarioTemporal.push({
                        tipoId: match.id,
                        nombre: match.nombre,
                        icono: match.icono,
                        cantidad: sug.cantidad || 1,
                        isNew: false
                    });
                } else {
                    // Si no existe, lo agregamos como "Nuevo" para que el backend lo cree
                    inventarioTemporal.push({
                        tipoId: null,
                        nombre: sug.nombre,
                        icono: '🆕',
                        cantidad: sug.cantidad || 1,
                        categoria: sug.categoria || 'EQUIPAMIENTO',
                        isNew: true
                    });
                }
            });
        }
        renderInventarioList();

        document.getElementById('step-loading').classList.add('hidden');
        document.getElementById('step-2-review').classList.remove('hidden');
        document.getElementById('btn-guardar-tipo').classList.remove('hidden');

    } catch (error) {
        alert(`Error: ${error.message}`);
        resetWizard();
    }
};

function handleAddDefault() {
    const select = document.getElementById('select-element-default');
    const inputQty = document.getElementById('input-qty-default');
    const id = select.value;
    const qty = parseInt(inputQty.value) || 1;

    if (!id) return;

    const tipo = tiposElementoCache.find(t => t.id === id);
    if (!tipo) return;

    // Check duplicados
    const existe = inventarioTemporal.find(i => i.tipoId === id);
    if (existe) {
        existe.cantidad += qty;
    } else {
        inventarioTemporal.push({
            tipoId: tipo.id,
            nombre: tipo.nombre,
            icono: tipo.icono,
            cantidad: qty,
            isNew: false
        });
    }

    renderInventarioList();
    select.value = ''; // Reset
}

function renderInventarioList() {
    const container = document.getElementById('review-inventory-list');
    if (inventarioTemporal.length === 0) {
        container.innerHTML = '<p class="text-gray-400 text-center italic mt-4">Sin elementos por defecto.</p>';
        return;
    }

    container.innerHTML = `
        <ul class="space-y-1">
            ${inventarioTemporal.map((item, index) => `
                <li class="flex justify-between items-center bg-white p-2 rounded border border-gray-100 shadow-sm">
                    <span class="flex items-center gap-2">
                        <span>${item.icono || '🔹'}</span>
                        <span class="font-medium ${item.isNew ? 'text-indigo-600' : ''}">${item.nombre}</span>
                        <span class="text-xs text-gray-500 bg-gray-100 px-1 rounded">x${item.cantidad}</span>
                        ${item.isNew ? '<span class="text-[10px] bg-indigo-100 text-indigo-700 px-1 rounded border border-indigo-200">Nuevo</span>' : ''}
                    </span>
                    <button class="text-red-400 hover:text-red-600 text-xs" onclick="document.getElementById('btn-del-inv-${index}').click()">✕</button>
                    <!-- Hack para evento onclick simple sin exponer función a window -->
                    <button id="btn-del-inv-${index}" class="hidden" onclick="(function(){ 
                        const event = new CustomEvent('delete-inv', { detail: ${index} }); 
                        document.dispatchEvent(event);
                    })()"></button>
                </li>
            `).join('')}
        </ul>
    `;
}

// Escuchar evento custom de borrado (para no polucionar window)
document.addEventListener('delete-inv', (e) => {
    const index = e.detail;
    if (inventarioTemporal[index]) {
        inventarioTemporal.splice(index, 1);
        renderInventarioList();
    }
});

// Variable global extra para edición
let editingId = null;

export const openWizardForEdit = (data) => {
    editingId = data.id;
    currentAnalisis = {
        icono: data.icono,
        nombreNormalizado: data.nombreNormalizado,
        descripcionBase: data.descripcionBase,
        shotList: data.shotList || [],
        requerimientosFotos: data.requerimientosFotos || []
    };

    const modal = document.getElementById('tipo-wizard-modal');
    modal.classList.remove('hidden');

    // Populate UI
    document.getElementById('input-nombre-usuario').value = data.nombreUsuario || '';
    document.getElementById('review-icono').textContent = data.icono || '🏠';
    document.getElementById('review-nombre-normalizado').value = data.nombreNormalizado || '';
    document.getElementById('review-descripcion').value = data.descripcionBase || '';

    // Populate Shotlist
    const shotListHtml = (data.shotList || []).map(item =>
        `<li class="flex items-start gap-2"><span class="text-green-500 font-bold">✓</span> ${item}</li>`
    ).join('');
    document.getElementById('review-shotlist').innerHTML = shotListHtml;

    // Populate Inventory from Existing Data
    inventarioTemporal = (data.elementosDefault || []).map(e => ({
        tipoId: e.tipoId,
        nombre: e.nombre,
        icono: e.icono,
        cantidad: e.cantidad || 1,
        isNew: false
    }));
    renderInventarioList();

    // Show Step 2 directly
    document.getElementById('step-1-input').classList.add('hidden');
    document.getElementById('step-loading').classList.add('hidden');
    document.getElementById('step-2-review').classList.remove('hidden');
    document.getElementById('btn-guardar-tipo').classList.remove('hidden');
    document.getElementById('btn-guardar-tipo').textContent = 'Guardar Cambios';

    // Update Title
    modal.querySelector('h3').textContent = '✏️ Editar Tipo de Espacio';

    cargarTiposElemento(); // Ensure dropdown is populated
};

const handleGuardar = async () => {
    if (!currentAnalisis) return;

    const btn = document.getElementById('btn-guardar-tipo');
    btn.disabled = true;
    const isEdit = !!editingId;
    btn.textContent = isEdit ? 'Actualizando...' : 'Guardando...';

    try {
        // Separamos lo existente de lo nuevo para que el backend sepa qué crear
        const existing = inventarioTemporal.filter(i => !i.isNew);
        const newItems = inventarioTemporal.filter(i => i.isNew);

        const datosFinales = {
            ...currentAnalisis,
            nombreNormalizado: document.getElementById('review-nombre-normalizado').value,
            descripcionBase: document.getElementById('review-descripcion').value,
            nombreUsuario: document.getElementById('input-nombre-usuario').value,

            // Override 'inventarioSugerido' con solo los items NUEVOS que el usuario mantuvo en la lista
            inventarioSugerido: newItems.map(i => ({
                nombre: i.nombre,
                cantidad: i.cantidad,
                categoria: i.categoria
            })),

            // 'elementosDefault' son los items YA EXISTENTES que se vincularán
            elementosDefault: existing
        };

        const url = isEdit ? `/componentes/${editingId}` : '/componentes';
        const method = isEdit ? 'PUT' : 'POST';

        await fetchAPI(url, {
            method: method,
            body: datosFinales
        });

        document.getElementById('tipo-wizard-modal').classList.add('hidden');
        resetWizard();
        if (onSaveCallback) onSaveCallback();

    } catch (error) {
        alert(`Error al guardar: ${error.message}`);
    } finally {
        btn.disabled = false;
        btn.textContent = 'Confirmar y Crear';
    }
};

// --- BULK ADD LOGIC ---

window.wizardToggleBulkPanel = () => {
    const panel = document.getElementById('wizard-bulk-panel');
    const arrow = document.getElementById('wizard-bulk-arrow');
    const container = document.getElementById('wizard-bulk-list-container');

    if (panel.classList.contains('hidden')) {
        panel.classList.remove('hidden');
        arrow.style.transform = 'rotate(180deg)';

        // Render keys only once
        if (container.innerHTML === 'Cargando...') {
            container.innerHTML = renderWizardCheckboxList(tiposElementoCache);
        }
    } else {
        panel.classList.add('hidden');
        arrow.style.transform = 'rotate(0deg)';
    }
};

window.wizardToggleCategoryGroup = (categoryKey, isChecked) => {
    const checkboxes = document.querySelectorAll(`input[name="wizard-bulk-check"][data-category="${categoryKey}"]`);
    checkboxes.forEach(cb => cb.checked = isChecked);
};

window.wizardAgregarSeleccionados = () => {
    const checkboxes = document.querySelectorAll(`input[name="wizard-bulk-check"]:checked`);
    let count = 0;

    checkboxes.forEach(cb => {
        const id = cb.value;
        const tipo = tiposElementoCache.find(t => t.id === id);
        if (!tipo) return;

        const existe = inventarioTemporal.find(i => i.tipoId === id);
        if (existe) {
            // Optional: increase quantity or ignore. Ignoring to match previous logic.
        } else {
            inventarioTemporal.push({
                tipoId: tipo.id,
                nombre: tipo.nombre,
                icono: tipo.icono,
                cantidad: 1,
                isNew: false
            });
            count++;
        }
        cb.checked = false;
    });

    // Uncheck headers
    document.querySelectorAll(`input[name="wizard-bulk-check-header"]`).forEach(h => h.checked = false);

    if (count > 0) {
        renderInventarioList();
    } else {
        alert('Items ya agregados.');
    }
};

function renderWizardCheckboxList(tipos) {
    const categorias = {};
    tipos.forEach(t => {
        const cat = (t.categoria || 'OTROS').toUpperCase();
        if (!categorias[cat]) categorias[cat] = [];
        categorias[cat].push(t);
    });

    let html = '<div class="space-y-4 max-h-48 overflow-y-auto pr-1 custom-scrollbar">';

    Object.keys(categorias).sort().forEach(cat => {
        const items = categorias[cat];
        html += `
            <div class="bg-gray-50 border border-gray-100 rounded-md overflow-hidden">
                 <div class="bg-gray-100 px-3 py-2 flex items-center justify-between sticky top-0">
                    <label class="flex items-center gap-2 cursor-pointer select-none">
                        <input type="checkbox" name="wizard-bulk-check-header"
                            class="form-checkbox text-indigo-600 h-3 w-3 rounded text-xs"
                            onchange="window.wizardToggleCategoryGroup('${cat}', this.checked)"
                        >
                        <span class="text-xs font-bold text-gray-700 uppercase tracking-wide">${cat}</span>
                    </label>
                </div>
                <div class="p-2 grid grid-cols-2 gap-1">
                    ${items.map(i => `
                        <label class="flex items-center gap-2 p-1 hover:bg-white rounded cursor-pointer border border-transparent hover:border-gray-200 transition-colors">
                            <input type="checkbox" name="wizard-bulk-check" value="${i.id}" data-category="${cat}" class="form-checkbox text-indigo-600 h-3 w-3 rounded border-gray-300">
                            <span class="text-xs truncate" title="${i.nombre}">${i.icono || ''} ${i.nombre}</span>
                        </label>
                    `).join('')}
                </div>
            </div>
        `;
    });
    html += '</div>';
    return html;
}


// --- AI RECALCULATE LOGIC ---

const handleRecalculatePhotos = async () => {
    if (inventarioTemporal.length === 0) {
        alert('Agrega items al inventario primero.');
        return;
    }

    const btn = document.getElementById('btn-recalc-photos');
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '↻ ...';

    try {
        const espacioNombre = document.getElementById('review-nombre-normalizado').value || 'Espacio';

        console.log('[Wizard] Recalculando fotos para:', espacioNombre);

        const response = await fetchAPI('/ai/recalculate-photos', {
            method: 'POST',
            body: {
                nombreEspacio: espacioNombre,
                activos: inventarioTemporal.map(i => ({ nombre: i.nombre, cantidad: i.cantidad }))
            }
        });

        if (response.shotList) {
            const shotListHtml = response.shotList.map(item =>
                `<li class="flex items-start gap-2"><span class="text-indigo-500 font-bold">★</span> ${item}</li>`
            ).join('');
            document.getElementById('review-shotlist').innerHTML = shotListHtml;

            if (currentAnalisis) {
                currentAnalisis.shotList = response.shotList;
                if (response.requerimientosFotos) {
                    currentAnalisis.requerimientosFotos = response.requerimientosFotos;
                }
            }
            alert('Requisitos visuales actualizados por IA.');
        }

    } catch (error) {
        console.error(error);
        alert('Error recalculando fotos.');
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
};