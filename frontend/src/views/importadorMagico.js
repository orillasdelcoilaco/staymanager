/**
 * importadorMagico.js
 *
 * Wizard multi-paso para crear una empresa completa en SuiteManager
 * a partir de la URL del sitio web del cliente.
 *
 * Pasos:
 *  1. URL del sitio web → análisis IA
 *  2. Confirmar empresa detectada
 *  3. Confirmar / editar alojamientos
 *  4. Configurar cuenta (email, password, moneda, canales OTA)
 *  5. Crear empresa → resultado
 */

const API_BASE = '/api/importer';

// ─────────────────────────────────────────────────────
// Estado global del wizard
// ─────────────────────────────────────────────────────
let state = {
    step: 1,
    url: '',
    resetMode: false,
    importData: null,
    loading: false,
    error: null,
    sessionId: null,
    sseSource: null
};

// ─── SSE helpers ─────────────────────────────────────────────────────────────

function genSessionId() {
    return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function connectSSE(sessionId, logPanelId) {
    if (state.sseSource) state.sseSource.close();
    const source = new EventSource(`/api/importer/stream/${sessionId}`);
    state.sseSource = source;

    source.onmessage = (e) => {
        try {
            const { msg, type } = JSON.parse(e.data);
            appendLog(logPanelId, msg, type);
        } catch { /* ignorar mensajes malformados */ }
    };
    source.onerror = () => source.close();
    return source;
}

function appendLog(panelId, msg, type = 'log') {
    const panel = document.getElementById(panelId);
    if (!panel) return;

    const colors = { error: '#f87171', done: '#4ade80', info: '#60a5fa', log: '#e5e7eb' };
    const color = colors[type] || colors.log;

    // Limpiar prefijos de debug verbosos para mejor legibilidad
    const clean = msg
        .replace(/\[dotenv[^\]]*\][^\n]*/g, '')
        .replace(/^\s*\n/, '')
        .trim();
    if (!clean) return;

    const line = document.createElement('div');
    line.style.cssText = `color:${color}; padding:1px 0; white-space:pre-wrap; word-break:break-all;`;
    line.textContent = clean;
    panel.appendChild(line);
    panel.scrollTop = panel.scrollHeight;
}

function disconnectSSE() {
    if (state.sseSource) { state.sseSource.close(); state.sseSource = null; }
}

// ─────────────────────────────────────────────────────
// Render inicial (template del container)
// ─────────────────────────────────────────────────────

export async function render() {
    return `
    <div class="max-w-4xl mx-auto py-8 px-4">
        <div class="mb-8 text-center">
            <h1 class="text-3xl font-bold text-gray-900">✨ Importador Mágico</h1>
            <p class="text-gray-500 mt-2">Crea una empresa completa en SuiteManager a partir de cualquier sitio web de alojamiento.</p>
        </div>
        <div id="wizard-steps-bar" class="flex items-center justify-center gap-2 mb-8 text-sm"></div>
        <div id="wizard-content" class="bg-white rounded-xl shadow-lg p-8"></div>
    </div>`;
}

export async function afterRender() {
    disconnectSSE();
    state = { step: 1, url: '', resetMode: false, importData: null, loading: false, error: null, sessionId: null, sseSource: null };
    renderWizard();
}

// ─────────────────────────────────────────────────────
// Orquestador del wizard
// ─────────────────────────────────────────────────────

function renderWizard() {
    renderStepsBar();
    const content = document.getElementById('wizard-content');
    if (!content) return;

    switch (state.step) {
        case 1: renderStep1(content); break;
        case 2: renderStep2(content); break;
        case 3: renderStep3(content); break;
        case 4: renderStep4(content); break;
        case 5: renderStep5(content); break;
    }
}

function renderStepsBar() {
    const bar = document.getElementById('wizard-steps-bar');
    if (!bar) return;
    const steps = ['URL', 'Empresa', 'Alojamientos', 'Cuenta', 'Resultado'];
    bar.innerHTML = steps.map((label, i) => {
        const n = i + 1;
        const isActive = n === state.step;
        const isDone = n < state.step;
        const circleClass = isDone
            ? 'bg-success-500 text-white'
            : isActive
                ? 'bg-primary-600 text-white'
                : 'bg-gray-200 text-gray-500';
        const textClass = isActive ? 'text-primary-700 font-semibold' : isDone ? 'text-success-600' : 'text-gray-400';
        return `
            ${i > 0 ? '<div class="flex-1 h-px bg-gray-200 mx-1 mt-3"></div>' : ''}
            <div class="flex flex-col items-center gap-1">
                <div class="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${circleClass}">${isDone ? '✓' : n}</div>
                <span class="text-xs ${textClass}">${label}</span>
            </div>`;
    }).join('');
}

// ─────────────────────────────────────────────────────
// PASO 1: URL
// ─────────────────────────────────────────────────────

function renderStep1(container) {
    container.innerHTML = `
        <h2 class="text-xl font-semibold text-gray-800 mb-2">Sitio web del cliente</h2>
        <p class="text-gray-500 mb-6">Ingresa la URL del sitio web de alojamiento a analizar. La IA navegará el sitio, leerá el contenido e identificará los alojamientos automáticamente.</p>

        ${state.error ? `<div class="bg-danger-50 border border-danger-200 text-danger-700 rounded-lg p-4 mb-4">${state.error}</div>` : ''}

        <div class="space-y-4">
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">URL del sitio web</label>
                <input id="url-input" type="url" placeholder="https://www.ejemplo.cl o www.ejemplo.cl"
                    value="${state.url}"
                    class="form-input w-full rounded-lg border-gray-300 text-base px-4 py-3 focus:ring-primary-500 focus:border-primary-500">
            </div>

            <div class="flex items-center gap-3">
                <input id="use-vision" type="checkbox" checked class="form-checkbox rounded text-primary-600">
                <label for="use-vision" class="text-sm text-gray-700">Usar visión IA (analizar fotos de los alojamientos) — requiere API Gemini</label>
            </div>

            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Máx. alojamientos a importar</label>
                <input id="max-accommodations" type="number" value="15" min="1" max="30"
                    class="form-input w-32 rounded-lg border-gray-300">
            </div>

            <div class="border-t pt-4">
                <label class="flex items-start gap-3 cursor-pointer p-3 rounded-lg border border-gray-200 hover:border-danger-300 transition-colors ${state.resetMode ? 'bg-danger-50 border-danger-300' : 'bg-gray-50'}">
                    <input id="reset-mode" type="checkbox" ${state.resetMode ? 'checked' : ''} class="form-checkbox mt-0.5 text-danger-600 rounded">
                    <div>
                        <span class="text-sm font-medium text-gray-700">Borrar todo y reimportar desde cero</span>
                        <p class="text-xs text-gray-400 mt-0.5">Si la empresa ya existe, elimina todos los alojamientos, espacios y activos antes de reimportar. La cuenta de usuario se conserva.</p>
                    </div>
                </label>
                <div id="reset-warning" class="${state.resetMode ? '' : 'hidden'} mt-2 bg-danger-50 border border-danger-300 text-danger-700 rounded-lg p-3 text-sm">
                    <strong>⚠️ Atención:</strong> Se eliminarán permanentemente todos los alojamientos, espacios y activos actuales. Esta acción no se puede deshacer.
                </div>
            </div>
        </div>

        <div class="mt-8 flex justify-end">
            <button id="btn-analyze" class="btn-primary px-8 py-3 text-base rounded-lg">
                🔍 Analizar sitio web
            </button>
        </div>

        <div id="loading-analyze" class="hidden mt-6">
            <div class="flex items-center gap-2 text-primary-700 mb-2">
                <svg class="animate-spin h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                </svg>
                <span class="text-sm font-medium">Analizando sitio web...</span>
            </div>
            <div id="log-panel-analyze"
                style="background:#111827;border-radius:8px;padding:10px 14px;font-family:monospace;font-size:11px;line-height:1.6;height:220px;overflow-y:auto;border:1px solid #374151;">
            </div>
        </div>`;

    document.getElementById('btn-analyze')?.addEventListener('click', handleAnalyze);
    document.getElementById('url-input')?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handleAnalyze();
    });
    document.getElementById('reset-mode')?.addEventListener('change', (e) => {
        state.resetMode = e.target.checked;
        document.getElementById('reset-warning')?.classList.toggle('hidden', !e.target.checked);
    });
}

async function handleAnalyze() {
    const urlInput = document.getElementById('url-input');
    const useVision = document.getElementById('use-vision')?.checked ?? true;
    const maxAcc = parseInt(document.getElementById('max-accommodations')?.value || '15');

    const url = urlInput?.value?.trim();
    if (!url) { state.error = 'Debes ingresar una URL.'; renderWizard(); return; }

    state.url = url;
    state.error = null;
    state.sessionId = genSessionId();

    document.getElementById('btn-analyze').disabled = true;
    document.getElementById('loading-analyze').classList.remove('hidden');

    // Conectar SSE antes de lanzar el fetch
    connectSSE(state.sessionId, 'log-panel-analyze');

    try {
        const res = await fetch('/api/importer/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url, useVision, maxAccommodations: maxAcc, sessionId: state.sessionId })
        });
        const data = await res.json();
        disconnectSSE();

        if (!res.ok) { state.error = data.error || 'Error al analizar el sitio.'; renderWizard(); return; }

        state.importData = data;
        state.step = 2;
        renderWizard();
    } catch (err) {
        disconnectSSE();
        state.error = `Error de conexión: ${err.message}`;
        renderWizard();
    }
}

// ─────────────────────────────────────────────────────
// PASO 2: Confirmar empresa
// ─────────────────────────────────────────────────────

function renderStep2(container) {
    const { empresa, homeImages = [] } = state.importData;
    const preview = homeImages[0] || null;

    container.innerHTML = `
        <h2 class="text-xl font-semibold text-gray-800 mb-2">Información de la empresa detectada</h2>
        <p class="text-gray-500 mb-6">Revisa y edita los datos extraídos del sitio web.</p>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
            ${preview ? `
            <div class="md:col-span-1">
                <img src="${preview}" alt="Imagen del sitio" class="w-full h-40 object-cover rounded-lg border border-gray-200">
                <p class="text-xs text-gray-400 mt-1 text-center">Imagen detectada del sitio</p>
            </div>` : '<div></div>'}

            <div class="${preview ? 'md:col-span-2' : 'md:col-span-3'} space-y-3">
                <div>
                    <label class="text-xs font-medium text-gray-500 uppercase tracking-wide">Nombre de la empresa</label>
                    <input id="emp-nombre" type="text" value="${escapeHtml(empresa.nombre || '')}" class="form-input w-full mt-1">
                </div>
                <div class="grid grid-cols-2 gap-3">
                    <div>
                        <label class="text-xs font-medium text-gray-500 uppercase tracking-wide">Email de contacto</label>
                        <input id="emp-email" type="email" value="${escapeHtml(empresa.email || '')}" class="form-input w-full mt-1">
                    </div>
                    <div>
                        <label class="text-xs font-medium text-gray-500 uppercase tracking-wide">Teléfono</label>
                        <input id="emp-telefono" type="text" value="${escapeHtml(empresa.telefono || '')}" class="form-input w-full mt-1">
                    </div>
                </div>
                <div class="grid grid-cols-2 gap-3">
                    <div>
                        <label class="text-xs font-medium text-gray-500 uppercase tracking-wide">Ciudad</label>
                        <input id="emp-ciudad" type="text" value="${escapeHtml(empresa.ciudad || '')}" class="form-input w-full mt-1">
                    </div>
                    <div>
                        <label class="text-xs font-medium text-gray-500 uppercase tracking-wide">País</label>
                        <input id="emp-pais" type="text" value="${escapeHtml(empresa.pais || 'Chile')}" class="form-input w-full mt-1">
                    </div>
                </div>
                <div>
                    <label class="text-xs font-medium text-gray-500 uppercase tracking-wide">Slogan</label>
                    <input id="emp-slogan" type="text" value="${escapeHtml(empresa.slogan || '')}" class="form-input w-full mt-1">
                </div>
                <div>
                    <label class="text-xs font-medium text-gray-500 uppercase tracking-wide">Historia / Descripción</label>
                    <textarea id="emp-historia" rows="3" class="form-input w-full mt-1">${escapeHtml(empresa.historia || '')}</textarea>
                </div>
            </div>
        </div>

        <div class="mt-4 p-4 bg-primary-50 rounded-lg border border-primary-100 text-sm text-primary-700">
            <strong>Detectado:</strong>
            ${state.importData.alojamientos?.length || 0} alojamientos ·
            ${state.importData.tiposEspacio?.length || 0} tipos de espacio ·
            ${state.importData.tiposActivo?.length || 0} tipos de activo ·
            Moneda: ${state.importData.monedaPrincipal || 'CLP'}
        </div>

        <div class="mt-8 flex justify-between">
            <button id="btn-back2" class="btn-secondary px-6 py-2 rounded-lg">← Volver</button>
            <button id="btn-next2" class="btn-primary px-8 py-2 rounded-lg">Continuar →</button>
        </div>`;

    document.getElementById('btn-back2')?.addEventListener('click', () => { state.step = 1; renderWizard(); });
    document.getElementById('btn-next2')?.addEventListener('click', () => {
        // Persistir ediciones en importData
        state.importData.empresa.nombre = document.getElementById('emp-nombre')?.value || state.importData.empresa.nombre;
        state.importData.empresa.email = document.getElementById('emp-email')?.value || null;
        state.importData.empresa.telefono = document.getElementById('emp-telefono')?.value || null;
        state.importData.empresa.ciudad = document.getElementById('emp-ciudad')?.value || null;
        state.importData.empresa.pais = document.getElementById('emp-pais')?.value || 'Chile';
        state.importData.empresa.slogan = document.getElementById('emp-slogan')?.value || null;
        state.importData.empresa.historia = document.getElementById('emp-historia')?.value || null;
        state.step = 3;
        renderWizard();
    });
}

// ─────────────────────────────────────────────────────
// PASO 3: Confirmar alojamientos
// ─────────────────────────────────────────────────────

function renderStep3(container) {
    const { alojamientos = [] } = state.importData;

    container.innerHTML = `
        <h2 class="text-xl font-semibold text-gray-800 mb-2">Alojamientos detectados</h2>
        <p class="text-gray-500 mb-4">Revisa los alojamientos que serán creados. Puedes editar nombres, capacidad y precio, o eliminar los que no correspondan.</p>

        <div id="aloj-list" class="space-y-3">
            ${alojamientos.map((a, i) => renderAlojamientoCard(a, i)).join('')}
        </div>

        ${alojamientos.length === 0 ? `
        <div class="text-center py-8 text-gray-400">
            <p>No se detectaron alojamientos.</p>
            <p class="text-sm mt-1">Puedes continuar y crearlos manualmente después.</p>
        </div>` : ''}

        <div class="mt-8 flex justify-between">
            <button id="btn-back3" class="btn-secondary px-6 py-2 rounded-lg">← Volver</button>
            <button id="btn-next3" class="btn-primary px-8 py-2 rounded-lg">Continuar →</button>
        </div>`;

    document.getElementById('btn-back3')?.addEventListener('click', () => { state.step = 2; renderWizard(); });
    document.getElementById('btn-next3')?.addEventListener('click', () => {
        saveAlojamientosEdits();
        state.step = 4;
        renderWizard();
    });

    // Botones de eliminar
    document.querySelectorAll('.btn-remove-aloj').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const idx = parseInt(e.currentTarget.dataset.idx);
            state.importData.alojamientos.splice(idx, 1);
            renderStep3(container);
        });
    });
}

function renderAlojamientoCard(a, i) {
    const img = a.imagenesRepresentativas?.[0] || null;
    return `
    <div class="border border-gray-200 rounded-lg p-4 bg-gray-50 flex gap-4">
        ${img ? `<img src="${img}" class="w-20 h-16 object-cover rounded flex-shrink-0">` : '<div class="w-20 h-16 bg-gray-200 rounded flex-shrink-0 flex items-center justify-center text-2xl">🏠</div>'}
        <div class="flex-1 grid grid-cols-2 md:grid-cols-4 gap-2">
            <div class="md:col-span-2">
                <label class="text-xs text-gray-500">Nombre</label>
                <input type="text" data-field="nombre" data-idx="${i}" value="${escapeHtml(a.nombre || '')}" class="aloj-field form-input w-full text-sm mt-0.5">
            </div>
            <div>
                <label class="text-xs text-gray-500">Capacidad</label>
                <input type="number" data-field="capacidad" data-idx="${i}" value="${a.capacidad || 2}" min="1" class="aloj-field form-input w-full text-sm mt-0.5">
            </div>
            <div>
                <label class="text-xs text-gray-500">Precio base</label>
                <input type="number" data-field="precioBase" data-idx="${i}" value="${a.precioBase || 0}" min="0" class="aloj-field form-input w-full text-sm mt-0.5">
            </div>
            <div>
                <label class="text-xs text-gray-500">Dormitorios</label>
                <input type="number" data-field="numDormitorios" data-idx="${i}" value="${a.numDormitorios || 1}" min="0" class="aloj-field form-input w-full text-sm mt-0.5">
            </div>
            <div>
                <label class="text-xs text-gray-500">Baños</label>
                <input type="number" data-field="numBanos" data-idx="${i}" value="${a.numBanos || 1}" min="0" class="aloj-field form-input w-full text-sm mt-0.5">
            </div>
            <div class="md:col-span-2 flex items-end">
                <span class="text-xs text-primary-600">${(a.espaciosDetectados || []).join(' · ') || 'Sin espacios detectados'}</span>
            </div>
        </div>
        <button class="btn-remove-aloj text-danger-400 hover:text-danger-600 flex-shrink-0 self-start text-lg" data-idx="${i}" title="Eliminar">✕</button>
    </div>`;
}

function saveAlojamientosEdits() {
    document.querySelectorAll('.aloj-field').forEach(input => {
        const idx = parseInt(input.dataset.idx);
        const field = input.dataset.field;
        const val = input.type === 'number' ? parseFloat(input.value) || 0 : input.value;
        if (state.importData.alojamientos[idx]) {
            state.importData.alojamientos[idx][field] = val;
        }
    });
}

// ─────────────────────────────────────────────────────
// PASO 4: Credenciales y configuración
// ─────────────────────────────────────────────────────

function renderStep4(container) {
    const moneda = state.importData.monedaPrincipal || 'CLP';

    container.innerHTML = `
        <h2 class="text-xl font-semibold text-gray-800 mb-2">Configuración de la cuenta</h2>
        <p class="text-gray-500 mb-6">Define las credenciales de acceso y preferencias iniciales para la nueva empresa.</p>

        <div class="space-y-5">
            <div class="bg-primary-50 border border-primary-200 rounded-lg p-4 text-sm text-primary-700">
                <strong>Modo inteligente:</strong> Si el email ya está registrado en SuiteManager, el wizard <strong>actualizará</strong> la empresa existente sin crear una nueva. La contraseña solo es necesaria para registros nuevos.
            </div>

            <h3 class="font-semibold text-gray-700 border-b pb-1">Acceso a SuiteManager</h3>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Email de acceso *</label>
                    <input id="cred-email" type="email" placeholder="cliente@ejemplo.cl" class="form-input w-full">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Contraseña <span class="font-normal text-gray-400">(solo para nuevos registros)</span></label>
                    <input id="cred-password" type="password" placeholder="Mínimo 6 caracteres" class="form-input w-full">
                </div>
            </div>

            <h3 class="font-semibold text-gray-700 border-b pb-1 mt-2">Moneda principal</h3>
            <div class="flex gap-3">
                ${['CLP', 'USD', 'ARS', 'EUR', 'MXN'].map(m => `
                <label class="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="moneda" value="${m}" ${m === moneda ? 'checked' : ''} class="form-radio text-primary-600">
                    <span class="text-sm font-medium">${m}</span>
                </label>`).join('')}
            </div>

            <h3 class="font-semibold text-gray-700 border-b pb-1 mt-2">Canales adicionales</h3>
            <p class="text-sm text-gray-500">¿El cliente usa estas plataformas? (Se crea solo Venta Directa por defecto)</p>
            <div class="flex flex-wrap gap-3">
                ${['Airbnb', 'Booking.com', 'Expedia', 'VRBO', 'Despegar'].map(canal => `
                <label class="flex items-center gap-2 cursor-pointer bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                    <input type="checkbox" name="canal-ota" value="${canal}" class="form-checkbox text-primary-600">
                    <span class="text-sm">${canal}</span>
                </label>`).join('')}
            </div>

        </div>

        <div id="step4-error" class="hidden mt-4 bg-danger-50 border border-danger-200 text-danger-700 rounded-lg p-4 text-sm"></div>

        <div class="mt-8 flex justify-between">
            <button id="btn-back4" class="btn-secondary px-6 py-2 rounded-lg">← Volver</button>
            <button id="btn-create" class="btn-primary px-8 py-3 text-base rounded-lg font-semibold">
                🚀 Crear empresa
            </button>
        </div>

        <div id="loading-create" class="hidden mt-6">
            <div class="flex items-center gap-2 text-success-700 mb-2">
                <svg class="animate-spin h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                </svg>
                <span class="text-sm font-medium">Creando empresa en Firestore...</span>
            </div>
            <div id="log-panel-create"
                style="background:#111827;border-radius:8px;padding:10px 14px;font-family:monospace;font-size:11px;line-height:1.6;height:220px;overflow-y:auto;border:1px solid #374151;">
            </div>
        </div>`;

    document.getElementById('btn-back4')?.addEventListener('click', () => { state.step = 3; renderWizard(); });
    document.getElementById('btn-create')?.addEventListener('click', handleCreate);
}

async function handleCreate() {
    const email = document.getElementById('cred-email')?.value?.trim();
    const password = document.getElementById('cred-password')?.value;
    const moneda = document.querySelector('input[name="moneda"]:checked')?.value || 'CLP';
    const canalesOTA = [...document.querySelectorAll('input[name="canal-ota"]:checked')].map(el => el.value);
    const resetMode = state.resetMode;
    const errorEl = document.getElementById('step4-error');

    if (!email) {
        errorEl.textContent = 'El email es requerido.';
        errorEl.classList.remove('hidden');
        return;
    }
    if (password && password.length < 6) {
        errorEl.textContent = 'La contraseña debe tener al menos 6 caracteres.';
        errorEl.classList.remove('hidden');
        return;
    }

    errorEl.classList.add('hidden');
    document.getElementById('btn-create').disabled = true;
    document.getElementById('loading-create').classList.remove('hidden');

    // Reusar sessionId del analyze o generar uno nuevo
    if (!state.sessionId) state.sessionId = genSessionId();
    connectSSE(state.sessionId, 'log-panel-create');

    try {
        const res = await fetch('/api/importer/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                importData: state.importData,
                credentials: { email, password },
                wizardAnswers: { moneda, canalesOTA, resetMode },
                sessionId: state.sessionId
            })
        });
        const data = await res.json();
        disconnectSSE();

        if (!res.ok) {
            document.getElementById('btn-create').disabled = false;
            document.getElementById('loading-create').classList.add('hidden');
            errorEl.textContent = data.error || 'Error al crear la empresa.';
            errorEl.classList.remove('hidden');
            return;
        }

        state.importData._createResult = data;
        state.step = 5;
        renderWizard();
    } catch (err) {
        disconnectSSE();
        document.getElementById('btn-create').disabled = false;
        document.getElementById('loading-create').classList.add('hidden');
        errorEl.textContent = `Error de conexión: ${err.message}`;
        errorEl.classList.remove('hidden');
    }
}

// ─────────────────────────────────────────────────────
// PASO 5: Resultado
// ─────────────────────────────────────────────────────

function renderStep5(container) {
    const result = state.importData._createResult;
    const { stats = {}, errores = [], omitidos = [], empresaId, message, modo } = result || {};
    const isUpdate = modo === 'actualización';

    container.innerHTML = `
        <div class="text-center">
            <div class="text-6xl mb-4">${isUpdate ? '♻️' : '🎉'}</div>
            <h2 class="text-2xl font-bold text-gray-900 mb-2">
                ${isUpdate ? '¡Empresa actualizada exitosamente!' : '¡Empresa creada exitosamente!'}
            </h2>
            <p class="text-gray-500">${message || ''}</p>
            ${isUpdate ? `<span class="inline-block mt-2 px-3 py-1 bg-primary-100 text-primary-700 rounded-full text-sm font-medium">Modo: Actualización</span>` : `<span class="inline-block mt-2 px-3 py-1 bg-success-100 text-success-700 rounded-full text-sm font-medium">Modo: Creación nueva</span>`}
        </div>

        <div class="mt-8 grid grid-cols-2 md:grid-cols-3 gap-4">
            ${statsCard('🏢', 'Empresa', empresaId ? (isUpdate ? 'Actualizada' : '1 creada') : 'Error')}
            ${statsCard('📡', 'Canales nuevos', `${stats.canales || 0}`)}
            ${statsCard('🛋️', 'Activos nuevos', `${stats.tiposElemento || 0}`)}
            ${statsCard('🏠', 'Espacios nuevos', `${stats.tiposComponente || 0}`)}
            ${statsCard('🏨', 'Propiedades nuevas', `${stats.propiedades || 0}`)}
            ${statsCard('⏭️', 'Ya existían', `${stats.omitidos || 0}`)}
        </div>

        ${errores.length > 0 ? `
        <div class="mt-6 bg-warning-50 border border-warning-200 rounded-lg p-4">
            <h3 class="font-semibold text-warning-800 mb-2">⚠️ Advertencias (${errores.length})</h3>
            <ul class="text-sm text-warning-700 space-y-1">
                ${errores.map(e => `<li>• ${e}</li>`).join('')}
            </ul>
        </div>` : ''}

        <div class="mt-8 bg-primary-50 border border-primary-100 rounded-lg p-4 text-sm">
            <h3 class="font-semibold text-primary-800 mb-2">Próximos pasos recomendados:</h3>
            <ol class="text-primary-700 space-y-1 list-decimal list-inside">
                <li>Pedir al cliente que valide los alojamientos en el panel admin</li>
                <li>Subir fotos reales a cada espacio (Galería Web)</li>
                <li>Revisar y ajustar tarifas por temporada</li>
                <li>Configurar canales OTA (iCal, mapeos)</li>
                <li>Activar el sitio web público (SSR)</li>
            </ol>
        </div>

        <div class="mt-8 flex justify-center gap-4">
            <button id="btn-new-import" class="btn-secondary px-6 py-2 rounded-lg">Importar otra empresa</button>
        </div>`;

    document.getElementById('btn-new-import')?.addEventListener('click', () => {
        state = { step: 1, url: '', importData: null, loading: false, error: null };
        renderWizard();
    });
}

function statsCard(icon, label, value) {
    return `
    <div class="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center">
        <div class="text-2xl mb-1">${icon}</div>
        <div class="text-sm text-gray-500">${label}</div>
        <div class="font-semibold text-gray-800">${value}</div>
    </div>`;
}

// ─────────────────────────────────────────────────────
// UTILS
// ─────────────────────────────────────────────────────

function escapeHtml(str) {
    return String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
