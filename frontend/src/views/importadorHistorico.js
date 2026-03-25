// frontend/src/views/importadorHistorico.js
// Importador de reservas históricas desde Gestor de Reservas → SuiteManager

import { fetchAPI } from '../api.js';

// ── Estado de módulo ────────────────────────────────────────────────────────
let importData    = null;
let previewData   = null;
let archivoNombre = '';

export function render() {
    return `
<div class="max-w-3xl mx-auto py-8 px-4">
    <div class="mb-6">
        <h1 class="text-2xl font-bold text-gray-900">Importador Histórico</h1>
        <p class="text-sm text-gray-500 mt-1">Importa reservas desde el Gestor de Reservas (Orillas del Coilaco)</p>
    </div>

    <!-- Paso 1 -->
    <div id="paso-1" class="bg-white rounded-xl border border-gray-200 p-6 mb-4">
        <h2 class="font-semibold text-gray-800 mb-1">Paso 1 — Cargar archivo JSON</h2>
        <p class="text-xs text-gray-500 mb-4">Exporta el archivo desde el Gestor de Reservas y súbelo aquí.</p>
        <div id="drop-zone" class="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-primary-400 transition-colors">
            <div class="text-3xl mb-2">📂</div>
            <p class="text-sm text-gray-600">Arrastra el archivo JSON aquí o haz clic para seleccionar</p>
            <input type="file" id="file-input" accept=".json" class="hidden">
        </div>
        <div id="file-info" class="hidden mt-3 p-3 bg-primary-50 rounded-lg flex items-center gap-3">
            <span class="text-xl">📄</span>
            <div class="flex-1 min-w-0">
                <p id="file-name" class="text-sm font-medium text-primary-800 truncate"></p>
                <p id="file-summary" class="text-xs text-primary-600"></p>
            </div>
            <button id="btn-analyze" class="btn-primary text-sm px-4 py-1.5">Analizar →</button>
        </div>
    </div>

    <!-- Paso 2 -->
    <div id="paso-2" class="hidden bg-white rounded-xl border border-gray-200 p-6 mb-4">
        <h2 class="font-semibold text-gray-800 mb-1">Paso 2 — Verificar mapeos</h2>
        <p class="text-xs text-gray-500 mb-4">Confirma que cada cabaña y canal se asocia al correcto en SuiteManager.</p>
        <div class="mb-5">
            <h3 class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Alojamientos</h3>
            <div id="mapeo-cabanas" class="space-y-2"></div>
        </div>
        <div>
            <h3 class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Canales</h3>
            <div id="mapeo-canales" class="space-y-2"></div>
        </div>
        <div id="advertencia-mapeos" class="hidden mt-4 p-3 bg-warning-50 border border-warning-200 rounded-lg text-sm text-warning-700"></div>
        <div class="mt-5 flex justify-between items-center">
            <div id="resumen-import" class="text-sm text-gray-600"></div>
            <button id="btn-importar" class="btn-primary">Importar reservas →</button>
        </div>
    </div>

    <!-- Paso 3 -->
    <div id="paso-3" class="hidden bg-white rounded-xl border border-gray-200 p-6">
        <h2 class="font-semibold text-gray-800 mb-4">Resultado de la importación</h2>
        <div id="resultado-importacion" class="space-y-3"></div>
    </div>

    <div id="loader-overlay" class="hidden fixed inset-0 bg-white/70 backdrop-blur-sm flex items-center justify-center z-50">
        <div class="text-center">
            <div class="animate-spin w-10 h-10 border-4 border-primary-500 border-t-transparent rounded-full mx-auto mb-3"></div>
            <p id="loader-msg" class="text-sm text-gray-600">Procesando…</p>
        </div>
    </div>
</div>`;
}

function setLoader(show, msg = '') {
    document.getElementById('loader-overlay').classList.toggle('hidden', !show);
    document.getElementById('loader-msg').textContent = msg;
}

function loadFile(file) {
    if (!file.name.endsWith('.json')) { alert('Solo se aceptan archivos .json'); return; }
    archivoNombre = file.name;
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            // Leer como ArrayBuffer y decodificar con Latin-1 para preservar
            // bytes que serían inválidos en UTF-8 (ej: ñ codificada como F1).
            // El backend tiene fixEncoding() que corrige el mojibake restante.
            const bytes = new Uint8Array(e.target.result);
            const text  = new TextDecoder('latin1').decode(bytes);
            importData = JSON.parse(text);
            document.getElementById('file-name').textContent    = file.name;
            document.getElementById('file-summary').textContent =
                `${importData.reservas?.length || 0} reservas · ${importData.clientes?.length || 0} clientes · ${importData.cabanas?.length || 0} cabañas`;
            document.getElementById('file-info').classList.remove('hidden');
        } catch { alert('El archivo no es un JSON válido.'); }
    };
    reader.readAsArrayBuffer(file);
}

function renderPaso2(p) {
    document.getElementById('mapeo-cabanas').innerHTML = p.cabanas.map(c => `
        <div class="flex items-center gap-3 text-sm">
            <span class="w-36 font-medium text-gray-700 truncate" title="${c.nombreOrigen}">${c.nombreOrigen}</span>
            <span class="text-gray-400">→</span>
            <select class="mapeo-alojamiento flex-1 border border-gray-200 rounded-lg px-2 py-1 text-sm" data-index="${c.index}">
                <option value="">— sin mapear —</option>
                ${p.alojamientosDisponibles.map(a =>
                    `<option value="${a.id}" ${a.id === c.alojamientoIdMapeado ? 'selected' : ''}>${a.nombre}</option>`
                ).join('')}
            </select>
        </div>`).join('');

    document.getElementById('mapeo-canales').innerHTML = p.canalesDetectados.length === 0
        ? '<p class="text-xs text-gray-400">No se detectaron canales.</p>'
        : p.canalesDetectados.map(c => `
        <div class="flex items-center gap-3 text-sm">
            <span class="w-36 font-medium text-gray-700 truncate" title="${c.nombreOrigen}">${c.nombreOrigen}</span>
            <span class="text-gray-400">→</span>
            <select class="mapeo-canal flex-1 border border-gray-200 rounded-lg px-2 py-1 text-sm" data-index="${c.index}">
                <option value="">— sin mapear —</option>
                ${p.canalesDisponibles.map(ca =>
                    `<option value="${ca.id}" ${ca.id === c.canalIdMapeado ? 'selected' : ''}>${ca.nombre}</option>`
                ).join('')}
            </select>
        </div>`).join('');

    document.getElementById('resumen-import').textContent =
        `${p.totales.reservas} reservas · ${p.totales.clientes} clientes · ${p.totales.transacciones} transacciones`;

    verificarAdvertencias(p);
}

function verificarAdvertencias(p) {
    const sinMapeo = p.cabanas.filter(c => {
        const sel = document.querySelector(`.mapeo-alojamiento[data-index="${c.index}"]`);
        return !sel?.value;
    });
    const adv = document.getElementById('advertencia-mapeos');
    if (sinMapeo.length > 0) {
        adv.textContent = `⚠️ ${sinMapeo.length} cabaña(s) sin mapear: ${sinMapeo.map(c => c.nombreOrigen).join(', ')}. Sus reservas serán omitidas.`;
        adv.classList.remove('hidden');
    } else {
        adv.classList.add('hidden');
    }
}

function stat(label, value, color) {
    return `<div class="bg-${color}-50 border border-${color}-200 rounded-lg p-3 text-center">
        <p class="text-2xl font-bold text-${color}-700">${value}</p>
        <p class="text-xs text-${color}-600 mt-0.5">${label}</p>
    </div>`;
}

function renderResultados(r) {
    document.getElementById('resultado-importacion').innerHTML = `
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            ${stat('Reservas creadas',  r.creadas,         'success')}
            ${stat('Actualizadas',      r.actualizadas,    'primary')}
            ${stat('Clientes nuevos',   r.clientesCreados, 'primary')}
            ${stat('Transacciones',     r.transacciones,   'success')}
        </div>
        ${r.idCarga ? `
        <div class="p-3 bg-primary-50 border border-primary-200 rounded-lg text-sm text-primary-700 mb-3">
            ✅ Carga registrada en Historial (ID: <span class="font-mono">${r.idCarga}</span>).
            Para revertir, ve a <strong>Historial de Cargas</strong> y elimina esta carga.
        </div>` : ''}
        ${r.errores.length > 0 ? `
        <div class="bg-danger-50 border border-danger-200 rounded-lg p-4">
            <p class="text-sm font-semibold text-danger-700 mb-2">⚠️ ${r.errores.length} error(es):</p>
            <ul class="text-xs text-danger-600 space-y-1 max-h-40 overflow-y-auto">
                ${r.errores.map(e => `<li><span class="font-mono">${e.id}</span>: ${e.error}</li>`).join('')}
            </ul>
        </div>` : `
        <div class="bg-success-50 border border-success-200 rounded-lg p-3 text-sm text-success-700">
            ✅ Importación completada sin errores.
        </div>`}`;
}

async function handleAnalyze() {
    if (!importData) return;
    setLoader(true, 'Analizando mapeos…');
    try {
        previewData = await fetchAPI('/historico-importer/preview', { method: 'POST', body: { importData } });
        renderPaso2(previewData);
        const paso2 = document.getElementById('paso-2');
        paso2.classList.remove('hidden');
        paso2.scrollIntoView({ behavior: 'smooth' });
    } catch (err) {
        alert(`Error al analizar: ${err.message}`);
    } finally {
        setLoader(false);
    }
}

async function handleImportar() {
    if (!importData || !previewData) return;

    const mapeoCabanas = {};
    document.querySelectorAll('.mapeo-alojamiento').forEach(sel => {
        const cab = previewData.cabanas[parseInt(sel.dataset.index, 10)];
        if (sel.value && cab) mapeoCabanas[cab.nombreOrigen] = sel.value;
    });

    const mapeoCanales = {};
    document.querySelectorAll('.mapeo-canal').forEach(sel => {
        const canal = previewData.canalesDetectados[parseInt(sel.dataset.index, 10)];
        if (sel.value && canal) mapeoCanales[canal.nombreOrigen] = sel.value;
    });

    const sinMapeo = previewData.cabanas.filter(c => !mapeoCabanas[c.nombreOrigen]);
    if (sinMapeo.length > 0) {
        const ok = confirm(
            `${sinMapeo.length} cabaña(s) sin mapear:\n${sinMapeo.map(c => c.nombreOrigen).join('\n')}\n\nSus reservas serán omitidas. ¿Continuar?`
        );
        if (!ok) return;
    }

    setLoader(true, 'Importando reservas…');
    try {
        const resultado = await fetchAPI('/historico-importer/run', {
            method: 'POST',
            body: { importData, mapeoCabanas, mapeoCanales, nombreArchivo: archivoNombre }
        });
        renderResultados(resultado);
        const paso3 = document.getElementById('paso-3');
        paso3.classList.remove('hidden');
        paso3.scrollIntoView({ behavior: 'smooth' });
    } catch (err) {
        alert(`Error al importar: ${err.message}`);
    } finally {
        setLoader(false);
    }
}

export async function afterRender() {
    // Reset module state on each mount
    importData = null; previewData = null; archivoNombre = '';

    const dropZone  = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');

    dropZone.addEventListener('click', () => fileInput.click());
    dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('border-primary-400'); });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('border-primary-400'));
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('border-primary-400');
        if (e.dataTransfer.files[0]) loadFile(e.dataTransfer.files[0]);
    });
    fileInput.addEventListener('change', () => { if (fileInput.files[0]) loadFile(fileInput.files[0]); });

    document.getElementById('btn-analyze').addEventListener('click', handleAnalyze);
    document.getElementById('btn-importar').addEventListener('click', handleImportar);
}
