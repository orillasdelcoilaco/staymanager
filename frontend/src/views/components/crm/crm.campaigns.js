// frontend/src/views/components/crm/crm.campaigns.js
import { fetchAPI } from '../../../api.js';

const SEGMENTOS = ['🏆 Campeones', '❤️ Leales', '🤝 Potenciales', '😟 En Riesgo', '🥶 Hibernando', 'Sin Reservas'];

const formatDate = (d) => d ? new Date(d).toLocaleDateString('es-CL') : '—';

function _renderHistorialHtml(campanasRecientes) {
    if (!(campanasRecientes || []).length) return '<p class="text-sm text-gray-400 text-center py-8">Aún no has creado campañas.</p>';
    return campanasRecientes.map(c => {
        const convRate = c.totalEnviados > 0 ? Math.round((c.conversiones / c.totalEnviados) * 100) : 0;
        return `
        <div class="border border-gray-200 rounded-xl p-4 hover:border-primary-300 transition-colors">
            <div class="flex items-center justify-between mb-2">
                <h4 class="font-semibold text-gray-900">${c.nombre}</h4>
                <span class="text-xs text-gray-500">${formatDate(c.fecha)}</span>
            </div>
            <div class="flex items-center gap-4 text-sm">
                <span class="text-gray-500">${c.segmento}</span>
                <span class="text-gray-500">${c.totalEnviados} enviados</span>
                <span class="font-semibold text-success-600 flex items-center gap-1"><i class="fa-solid fa-check text-xs"></i> ${c.conversiones} reservaron</span>
                <span class="text-primary-600 font-medium">${convRate}% conv.</span>
            </div>
            <div class="mt-3">
                <button class="campaign-expand-btn btn-outline text-xs" data-campana-id="${c.id}">Ver interacciones ▾</button>
                <div id="campaign-detail-${c.id}" class="hidden mt-3 border-t pt-3">
                    <p class="text-xs text-gray-400">Cargando...</p>
                </div>
            </div>
        </div>`;
    }).join('');
}

function _renderFormCrearCampana() {
    return `
    <div class="bg-white rounded-xl border border-gray-200 p-6">
        <h3 class="text-lg font-semibold text-gray-900 mb-4">Crear Campaña</h3>
        <div class="space-y-4">
            <div>
                <label for="camp-nombre" class="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
                <input type="text" id="camp-nombre" class="form-input w-full" placeholder="Ej: Oferta Fin de Semana Largo">
            </div>
            <div>
                <label for="camp-segmento" class="block text-sm font-medium text-gray-700 mb-1">Segmento</label>
                <select id="camp-segmento" class="form-select w-full">
                    ${SEGMENTOS.map(s => `<option value="${s}">${s}</option>`).join('')}
                </select>
            </div>
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Mensaje</label>
                <div class="flex gap-2 mb-2">
                    <input type="text" id="camp-ia-idea" class="form-input flex-1 text-sm"
                           placeholder="Describe tu idea... Ej: 15% descuento para fines de semana de julio">
                    <button id="camp-ia-btn" class="btn-outline text-sm whitespace-nowrap flex items-center gap-1.5"><i class="fa-solid fa-wand-magic-sparkles"></i> Redactar con IA</button>
                </div>
                <textarea id="camp-mensaje" rows="4" class="form-input w-full"
                          placeholder="Hola [NOMBRE_CLIENTE], tenemos una oferta especial para ti..."></textarea>
                <p class="text-xs text-gray-500 mt-1">
                    Variables: <code class="font-bold">[NOMBRE_CLIENTE]</code> · <code class="font-bold">[CUPON_DESCUENTO]</code>
                </p>
            </div>
            <div class="border-t pt-4">
                <div class="flex items-center justify-between mb-2">
                    <label class="text-sm font-medium text-gray-700">🎟️ Generar cupones para el segmento</label>
                    <label class="flex items-center gap-2 text-sm">
                        <input type="checkbox" id="camp-cupon-toggle" class="rounded">
                        <span>Incluir cupón</span>
                    </label>
                </div>
                <div id="camp-cupon-options" class="hidden space-y-3">
                    <div class="grid grid-cols-2 gap-3">
                        <div>
                            <label for="camp-cupon-descuento" class="text-xs text-gray-600">% Descuento</label>
                            <input type="number" id="camp-cupon-descuento" class="form-input text-sm" min="1" max="100" value="10">
                        </div>
                        <div>
                            <label for="camp-cupon-limite" class="text-xs text-gray-600">Usos máximos</label>
                            <input type="number" id="camp-cupon-limite" class="form-input text-sm" min="1" value="1">
                        </div>
                    </div>
                    <div class="grid grid-cols-2 gap-3">
                        <div>
                            <label for="camp-cupon-desde" class="text-xs text-gray-600">Vigencia desde <span class="text-gray-400">(opc.)</span></label>
                            <input type="date" id="camp-cupon-desde" class="form-input text-sm">
                        </div>
                        <div>
                            <label for="camp-cupon-hasta" class="text-xs text-gray-600">Vigencia hasta <span class="text-gray-400">(opc.)</span></label>
                            <input type="date" id="camp-cupon-hasta" class="form-input text-sm">
                        </div>
                    </div>
                </div>
            </div>
            <div id="camp-preview" class="hidden bg-gray-50 rounded-lg p-3 border">
                <p class="text-xs text-gray-500 mb-1 uppercase tracking-wide">Preview del mensaje</p>
                <p id="camp-preview-text" class="text-sm text-gray-700"></p>
            </div>
            <div class="flex items-center justify-between pt-2">
                <span id="camp-count" class="text-sm text-gray-500"></span>
                <button id="camp-crear-btn" class="btn-primary">Crear Campaña</button>
            </div>
            <div id="camp-status" class="text-sm"></div>
        </div>
    </div>`;
}

export function renderCampaigns(campanasRecientes) {
    const historialHtml = _renderHistorialHtml(campanasRecientes);
    return `
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
            ${_renderFormCrearCampana()}
            <div>
                <h3 class="text-lg font-semibold text-gray-900 mb-4">Historial de Campañas</h3>
                <div id="campaigns-list" class="space-y-3">${historialHtml}</div>
            </div>
        </div>
        <div id="camp-result-modal" class="modal hidden">
            <div class="modal-content !max-w-3xl">
                <div class="flex items-center gap-4 mb-6 pb-5 border-b">
                    <div class="w-12 h-12 rounded-xl bg-success-100 flex items-center justify-center text-success-600 text-xl flex-shrink-0"><i class="fa-solid fa-check"></i></div>
                    <div>
                        <h3 class="text-xl font-semibold text-gray-900">Campaña Creada</h3>
                        <p class="text-sm text-gray-500">Envía por WhatsApp, email o copia el mensaje</p>
                    </div>
                </div>
                <div id="camp-result-list" class="space-y-3 max-h-[60vh] overflow-y-auto"></div>
                <div class="text-right mt-4 pt-4 border-t">
                    <button id="camp-result-close" class="btn-outline">Cerrar</button>
                </div>
            </div>
        </div>`;
}

function _setupIaWriter() {
    document.getElementById('camp-ia-btn')?.addEventListener('click', async () => {
        const idea = document.getElementById('camp-ia-idea')?.value.trim();
        const btn = document.getElementById('camp-ia-btn');
        if (!idea) { alert('Escribe una idea para que la IA redacte el mensaje.'); return; }
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Generando...';
        try {
            const segmento = document.getElementById('camp-segmento')?.value || '';
            const { mensaje } = await fetchAPI('/crm/redactar-promocion', { method: 'POST', body: { idea, segmento } });
            const input = document.getElementById('camp-mensaje');
            input.value = mensaje;
            input.dispatchEvent(new Event('input'));
        } catch (err) {
            alert(`Error IA: ${err.message}`);
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> Redactar con IA';
        }
    });
}

function _setupPreviewEnVivo(msgInput, preview, previewText) {
    msgInput?.addEventListener('input', () => {
        const msg = msgInput.value;
        if (msg.length > 10) {
            preview.classList.remove('hidden');
            previewText.textContent = msg
                .replace(/\[NOMBRE_CLIENTE\]/g, 'Juan')
                .replace(/\[CUPON_DESCUENTO\]/g, 'JP10-X3KA');
        } else {
            preview.classList.add('hidden');
        }
    });
}

async function _setupSegmentoLoader(segSelect, countEl, state) {
    async function loadSegmento() {
        countEl.textContent = 'Cargando...';
        try {
            state.clientes = await fetchAPI(`/crm/segmento/${encodeURIComponent(segSelect.value)}`);
            countEl.textContent = `${state.clientes.length} clientes en este segmento`;
        } catch {
            countEl.textContent = 'Error al cargar clientes';
            state.clientes = [];
        }
    }
    segSelect?.addEventListener('change', loadSegmento);
    await loadSegmento();
}

async function _generarCupones(clientes) {
    const descuento = parseInt(document.getElementById('camp-cupon-descuento')?.value || '10', 10);
    const usosMaximos = parseInt(document.getElementById('camp-cupon-limite')?.value || '1', 10);
    const vigenciaDesde = document.getElementById('camp-cupon-desde')?.value || null;
    const vigenciaHasta = document.getElementById('camp-cupon-hasta')?.value || null;
    const cupones = {};
    for (const c of clientes) {
        try {
            const cupon = await fetchAPI('/crm/cupones', { method: 'POST', body: { clienteId: c.id, porcentajeDescuento: descuento, usosMaximos, vigenciaDesde, vigenciaHasta } });
            cupones[c.id] = cupon.codigo;
        } catch { cupones[c.id] = null; }
    }
    return cupones;
}

function _renderResultItems(clientes, interacciones, cuponesPorCliente, mensaje) {
    return clientes.map(c => {
        const inter = interacciones.find(i => i.clienteId === c.id);
        const cuponCode = cuponesPorCliente[c.id] || '';
        const msgFinal = mensaje
            .replace(/\[NOMBRE_CLIENTE\]/g, (c.nombre || '').split(' ')[0])
            .replace(/\[CUPON_DESCUENTO\]/g, cuponCode);
        const tel = (c.telefono || '').replace(/\D/g, '');
        const waUrl = tel ? `https://wa.me/${tel}?text=${encodeURIComponent(msgFinal)}` : '';
        return `
        <div class="flex flex-col gap-2 p-3 border rounded-lg bg-gray-50">
            <div class="flex items-center justify-between">
                <div>
                    <p class="font-medium text-sm">${c.nombre}</p>
                    <p class="text-xs text-gray-500">${c.telefono || '—'} · ${c.email || 'Sin email'}</p>
                    ${cuponCode ? `<p class="text-xs text-primary-600 font-mono mt-0.5">🎟️ ${cuponCode}</p>` : ''}
                </div>
                ${inter ? `<select data-interaccion-id="${inter.id}" class="camp-estado-select form-select text-xs py-1 w-auto">
                    <option value="Enviado" ${inter.estado === 'Enviado' ? 'selected' : ''}>📬 Enviado</option>
                    <option value="Respondio" ${inter.estado === 'Respondio' ? 'selected' : ''}>💬 Respondió</option>
                    <option value="NoInteresado" ${inter.estado === 'NoInteresado' ? 'selected' : ''}>🚫 No Interesado</option>
                    <option value="Reservo" ${inter.estado === 'Reservo' ? 'selected' : ''}>✅ Reservó</option>
                    <option value="SinRespuesta" ${inter.estado === 'SinRespuesta' ? 'selected' : ''}>⏳ Sin Respuesta</option>
                </select>` : ''}
            </div>
            <div class="flex gap-2">
                ${waUrl ? `<a href="${waUrl}" target="_blank" class="btn-primary text-xs py-1 px-3 flex items-center gap-1"><i class="fa-brands fa-whatsapp"></i> WhatsApp</a>` : '<span class="text-xs text-gray-400 py-1">Sin teléfono</span>'}
                ${c.email ? `<button class="camp-email-btn btn-outline text-xs py-1 px-3 flex items-center gap-1" data-email="${c.email}" data-msg="${encodeURIComponent(msgFinal)}"><i class="fa-solid fa-envelope"></i> Email</button>` : ''}
                <button class="camp-copy-btn btn-outline text-xs py-1 px-3 flex items-center gap-1" data-msg="${encodeURIComponent(msgFinal)}"><i class="fa-solid fa-clipboard"></i> Copiar</button>
            </div>
        </div>`;
    }).join('');
}

function _setupCrearCampanaBtn(msgInput, preview, segSelect, state) {
    document.getElementById('camp-crear-btn')?.addEventListener('click', async () => {
        const nombre = document.getElementById('camp-nombre')?.value.trim();
        const mensaje = msgInput?.value.trim();
        const statusEl = document.getElementById('camp-status');
        const btn = document.getElementById('camp-crear-btn');
        if (!nombre) { statusEl.innerHTML = '<span class="text-danger-500">Dale un nombre a tu campaña.</span>'; return; }
        if (!mensaje) { statusEl.innerHTML = '<span class="text-danger-500">Escribe un mensaje.</span>'; return; }
        if (!state.clientes.length) { statusEl.innerHTML = '<span class="text-danger-500">No hay clientes en este segmento.</span>'; return; }
        btn.disabled = true; btn.textContent = 'Creando...'; statusEl.textContent = '';
        try {
            const cuponesPorCliente = document.getElementById('camp-cupon-toggle')?.checked
                ? await _generarCupones(state.clientes) : {};
            const campana = await fetchAPI('/crm/campanas', { method: 'POST', body: { nombre, segmento: segSelect.value, mensaje, clientes: state.clientes } });
            const interacciones = await fetchAPI(`/crm/campanas/${campana.id}/interacciones`);
            document.getElementById('camp-result-list').innerHTML = _renderResultItems(state.clientes, interacciones, cuponesPorCliente, mensaje);
            document.getElementById('camp-result-modal').classList.remove('hidden');
            statusEl.innerHTML = '<span class="text-success-600 flex items-center gap-1"><i class="fa-solid fa-check"></i> Campaña creada exitosamente</span>';
            document.getElementById('camp-nombre').value = '';
            msgInput.value = ''; preview.classList.add('hidden');
        } catch (err) {
            statusEl.innerHTML = `<span class="text-danger-500">Error: ${err.message}</span>`;
        } finally { btn.disabled = false; btn.textContent = 'Crear Campaña'; }
    });
}

function _setupResultModalHandlers() {
    document.getElementById('camp-result-close')?.addEventListener('click', () => {
        document.getElementById('camp-result-modal').classList.add('hidden');
    });
    document.getElementById('camp-result-list')?.addEventListener('click', async e => {
        if (e.target.closest('.camp-copy-btn')) {
            const msg = decodeURIComponent(e.target.closest('.camp-copy-btn').dataset.msg);
            try {
                await navigator.clipboard.writeText(msg);
                const btn = e.target.closest('.camp-copy-btn');
                btn.innerHTML = '<i class="fa-solid fa-check"></i> Copiado';
                setTimeout(() => { btn.innerHTML = '<i class="fa-solid fa-clipboard"></i> Copiar'; }, 2000);
            } catch { alert('No se pudo copiar. Selecciona el texto manualmente.'); }
        }
        if (e.target.closest('.camp-email-btn')) {
            const el = e.target.closest('.camp-email-btn');
            const msg = decodeURIComponent(el.dataset.msg);
            const subject = document.getElementById('camp-nombre')?.value || 'Oferta especial para ti';
            window.open(`mailto:${el.dataset.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(msg)}`);
        }
    });
    document.getElementById('camp-result-list')?.addEventListener('change', async e => {
        if (e.target.classList.contains('camp-estado-select')) {
            try {
                await fetchAPI(`/crm/interacciones/${e.target.dataset.interaccionId}`, { method: 'PUT', body: { estado: e.target.value } });
            } catch (err) { alert(`Error: ${err.message}`); }
        }
    });
}

function _setupCampaignExpandHandler() {
    document.getElementById('campaigns-list')?.addEventListener('click', async e => {
        const btn = e.target.closest('.campaign-expand-btn');
        if (!btn) return;
        const campanaId = btn.dataset.campanaId;
        const detailDiv = document.getElementById(`campaign-detail-${campanaId}`);
        if (!detailDiv) return;
        if (!detailDiv.classList.contains('hidden')) {
            detailDiv.classList.add('hidden'); btn.textContent = 'Ver interacciones ▾'; return;
        }
        btn.textContent = 'Cargando...';
        try {
            const ints = await fetchAPI(`/crm/campanas/${campanaId}/interacciones`);
            detailDiv.innerHTML = ints.length === 0
                ? '<p class="text-xs text-gray-400">Sin interacciones registradas.</p>'
                : `<div class="space-y-1">${ints.map(i => `<div class="flex items-center justify-between text-xs py-1"><span class="font-medium">${i.clienteNombre}</span><span class="px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">${i.estado}</span></div>`).join('')}</div>`;
            detailDiv.classList.remove('hidden'); btn.textContent = 'Ocultar ▴';
        } catch {
            detailDiv.innerHTML = '<p class="text-xs text-danger-500">Error al cargar.</p>';
            detailDiv.classList.remove('hidden'); btn.textContent = 'Ver interacciones ▾';
        }
    });
}

export async function setupCampaigns() {
    const state = { clientes: [] };
    const msgInput = document.getElementById('camp-mensaje');
    const preview = document.getElementById('camp-preview');
    const previewText = document.getElementById('camp-preview-text');
    const segSelect = document.getElementById('camp-segmento');
    const countEl = document.getElementById('camp-count');

    _setupIaWriter();
    document.getElementById('camp-cupon-toggle')?.addEventListener('change', (e) => {
        document.getElementById('camp-cupon-options').classList.toggle('hidden', !e.target.checked);
    });
    _setupPreviewEnVivo(msgInput, preview, previewText);
    await _setupSegmentoLoader(segSelect, countEl, state);
    _setupCrearCampanaBtn(msgInput, preview, segSelect, state);
    _setupResultModalHandlers();
    _setupCampaignExpandHandler();
}
