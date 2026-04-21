// frontend/src/views/components/resenas/resenas.modal.js

const SCORES = [
    { id: 'punt_general',      label: '⭐ General',               required: true },
    { id: 'punt_limpieza',     label: '🧹 Limpieza',              required: false },
    { id: 'punt_ubicacion',    label: '📍 Ubicación',             required: false },
    { id: 'punt_llegada',      label: '🛎️ Llegada / Check-in',   required: false },
    { id: 'punt_comunicacion', label: '💬 Comunicación',          required: false },
    { id: 'punt_equipamiento', label: '🏡 Equipamiento',          required: false },
    { id: 'punt_valor',        label: '💲 Relación calidad/precio', required: false },
];

function renderStarPicker(id, label, required) {
    return `
        <div class="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
            <span class="text-sm text-gray-700">${label}${required ? ' <span class="text-danger-500">*</span>' : ''}</span>
            <div id="sp-${id}" data-value="" class="flex gap-0.5 cursor-pointer">
                ${[1,2,3,4,5].map(n =>
                    `<span data-v="${n}" class="text-xl text-gray-300 hover:text-warning-400 transition-colors">★</span>`
                ).join('')}
            </div>
        </div>`;
}

export function renderModalManual() {
    return `
    <div id="modal-resena-manual" class="fixed inset-0 bg-black/50 z-50 hidden items-center justify-center p-4">
        <div class="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[92vh] flex flex-col">

            <div class="flex items-center justify-between px-6 py-4 border-b flex-shrink-0">
                <h3 class="text-base font-semibold text-gray-900">📝 Cargar Reseña Manual</h3>
                <button id="modal-resena-close" class="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
            </div>

            <div class="overflow-y-auto flex-1 px-6 py-5 space-y-5">

                <!-- Buscar reserva -->
                <div>
                    <p class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">1. Buscar reserva</p>
                    <div class="flex gap-2">
                        <select id="m-canal" class="form-select text-sm flex-1">
                            <option value="">Canal...</option>
                        </select>
                        <input id="m-termino" type="text" class="form-input text-sm flex-1"
                            placeholder="ID reserva o nombre...">
                        <button id="m-buscar" class="btn-outline text-sm px-3">Buscar</button>
                    </div>
                    <div id="m-resultados" class="mt-2 space-y-1 max-h-40 overflow-y-auto"></div>
                </div>

                <!-- Datos auto-rellenados -->
                <div class="grid grid-cols-2 gap-3">
                    <div>
                        <label class="block text-xs text-gray-500 mb-1">Cliente</label>
                        <input id="m-cliente" type="text" class="form-input text-sm bg-gray-50" readonly>
                    </div>
                    <div>
                        <label class="block text-xs text-gray-500 mb-1">Alojamiento</label>
                        <input id="m-alojamiento" type="text" class="form-input text-sm bg-gray-50" readonly>
                    </div>
                </div>
                <input type="hidden" id="m-reservaId">
                <input type="hidden" id="m-propiedadId">
                <input type="hidden" id="m-canalId">

                <!-- Fecha + puntajes -->
                <div>
                    <p class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">2. Fecha y puntajes</p>
                    <div class="mb-3">
                        <label class="block text-xs text-gray-500 mb-1">Fecha de la reseña <span class="text-danger-500">*</span></label>
                        <input id="m-fecha" type="date" class="form-input text-sm w-48">
                    </div>
                    <div class="border border-gray-100 rounded-lg px-4 py-1">
                        ${SCORES.map(s => renderStarPicker(s.id, s.label, s.required)).join('')}
                    </div>
                </div>

                <!-- Comentario -->
                <div>
                    <p class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">3. Comentario</p>
                    <textarea id="m-texto-pos" rows="3" class="form-input text-sm w-full"
                        placeholder="Pega aquí el comentario del huésped desde el canal..."></textarea>
                    <textarea id="m-texto-neg" rows="2" class="form-input text-sm w-full mt-2"
                        placeholder="Aspectos negativos (opcional)..."></textarea>
                </div>

                <!-- Fotos -->
                <div>
                    <p class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">4. Fotos (opcional)</p>
                    <div class="grid grid-cols-2 gap-3">
                        <div>
                            <label class="block text-xs text-gray-500 mb-1">Foto 1</label>
                            <input id="m-foto1" type="file" accept="image/*" class="form-input-file text-sm">
                        </div>
                        <div>
                            <label class="block text-xs text-gray-500 mb-1">Foto 2</label>
                            <input id="m-foto2" type="file" accept="image/*" class="form-input-file text-sm">
                        </div>
                    </div>
                </div>
            </div>

            <div class="flex justify-end gap-2 px-6 py-4 border-t flex-shrink-0">
                <button id="modal-resena-cancel" class="btn-outline text-sm">Cancelar</button>
                <button id="modal-resena-submit" class="btn-primary text-sm">Guardar Reseña</button>
            </div>
        </div>
    </div>`;
}

function _setupStarPickers() {
    document.querySelectorAll('[id^="sp-"]').forEach(picker => {
        const stars = picker.querySelectorAll('[data-v]');
        stars.forEach(star => {
            star.addEventListener('click', () => {
                const val = parseInt(star.dataset.v);
                picker.dataset.value = val;
                stars.forEach(s => {
                    const filled = parseInt(s.dataset.v) <= val;
                    s.classList.toggle('text-warning-500', filled);
                    s.classList.toggle('text-gray-300', !filled);
                });
            });
        });
    });
}

function _getScore(id) {
    const val = document.getElementById(`sp-${id}`)?.dataset.value;
    return val ? parseInt(val) : null;
}

function _resetModal() {
    ['m-reservaId', 'm-propiedadId', 'm-canalId'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    ['m-cliente', 'm-alojamiento', 'm-termino', 'm-texto-pos', 'm-texto-neg', 'm-fecha'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    ['m-foto1', 'm-foto2'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    document.querySelectorAll('[id^="sp-"]').forEach(picker => {
        picker.dataset.value = '';
        picker.querySelectorAll('[data-v]').forEach(s => {
            s.classList.remove('text-warning-500');
            s.classList.add('text-gray-300');
        });
    });
    const res = document.getElementById('m-resultados');
    if (res) res.innerHTML = '';
}

function _openModal() {
    const m = document.getElementById('modal-resena-manual');
    m.classList.remove('hidden');
    m.classList.add('flex');
}

function _closeModal() {
    const m = document.getElementById('modal-resena-manual');
    m.classList.add('hidden');
    m.classList.remove('flex');
    _resetModal();
}

export function setupModalManual(canales, fetchAPI, onSuccess) {
    _setupStarPickers();

    // Poblar canales
    const canalSel = document.getElementById('m-canal');
    canales.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.textContent = c.nombre;
        canalSel.appendChild(opt);
    });

    // Cerrar
    document.getElementById('modal-resena-close').addEventListener('click', _closeModal);
    document.getElementById('modal-resena-cancel').addEventListener('click', _closeModal);
    document.getElementById('modal-resena-manual').addEventListener('click', (e) => {
        if (e.target === e.currentTarget) _closeModal();
    });

    // Buscar reserva
    document.getElementById('m-buscar').addEventListener('click', async () => {
        const canalId = document.getElementById('m-canal').value;
        const termino = document.getElementById('m-termino').value.trim();
        if (!canalId || !termino) return;
        const resultados = document.getElementById('m-resultados');
        resultados.innerHTML = '<p class="text-xs text-gray-400 py-1">Buscando...</p>';
        try {
            const reservas = await fetchAPI(`/resenas/buscar-reserva?canalId=${encodeURIComponent(canalId)}&termino=${encodeURIComponent(termino)}`);
            if (!reservas?.length) {
                resultados.innerHTML = '<p class="text-xs text-gray-400 py-1">Sin resultados.</p>';
                return;
            }
            resultados.innerHTML = reservas.map(r => `
                <button class="w-full text-left text-xs px-3 py-2 rounded-lg border border-gray-200 hover:border-primary-300 hover:bg-primary-50 transition-colors"
                    data-id="${r.id}" data-propid="${r.propiedadId || ''}"
                    data-canal="${canalId}" data-idcanal="${r.idReservaCanal}"
                    data-cliente="${r.clienteNombre}" data-aloj="${r.alojamientoNombre || ''}">
                    <span class="font-semibold text-gray-800">${r.idReservaCanal}</span>
                    <span class="text-gray-500 ml-2">${r.clienteNombre}</span>
                    <span class="text-gray-400 ml-2">· ${r.alojamientoNombre || '—'}</span>
                    <span class="text-gray-400 ml-2">· ${r.fechaLlegada || ''}</span>
                </button>`).join('');

            resultados.querySelectorAll('button').forEach(btn => {
                btn.addEventListener('click', () => {
                    document.getElementById('m-reservaId').value  = btn.dataset.id;
                    document.getElementById('m-propiedadId').value = btn.dataset.propid;
                    document.getElementById('m-canalId').value    = btn.dataset.canal;
                    document.getElementById('m-cliente').value    = btn.dataset.cliente;
                    document.getElementById('m-alojamiento').value = btn.dataset.aloj;
                    resultados.innerHTML = `<p class="text-xs text-success-600 py-1">✓ Reserva seleccionada: ${btn.dataset.idcanal}</p>`;
                });
            });
        } catch (e) {
            resultados.innerHTML = `<p class="text-xs text-danger-500 py-1">Error: ${e.message}</p>`;
        }
    });

    // Submit
    document.getElementById('modal-resena-submit').addEventListener('click', async () => {
        const reservaId  = document.getElementById('m-reservaId').value;
        const fechaResena = document.getElementById('m-fecha').value;
        const puntGeneral = _getScore('punt_general');

        if (!reservaId) { alert('Selecciona una reserva primero.'); return; }
        if (!puntGeneral) { alert('El puntaje general es requerido.'); return; }
        if (!fechaResena) { alert('La fecha de la reseña es requerida.'); return; }

        const btn = document.getElementById('modal-resena-submit');
        btn.disabled = true;
        btn.textContent = 'Guardando...';

        try {
            const fd = new FormData();
            fd.append('reservaId',    reservaId);
            fd.append('propiedadId',  document.getElementById('m-propiedadId').value);
            fd.append('clienteNombre', document.getElementById('m-cliente').value);
            fd.append('canalId',      document.getElementById('m-canalId').value);
            fd.append('fechaResena',  fechaResena);
            fd.append('punt_general', puntGeneral);
            SCORES.slice(1).forEach(s => {
                const v = _getScore(s.id);
                if (v) fd.append(s.id, v);
            });
            const textoPos = document.getElementById('m-texto-pos').value.trim();
            const textoNeg = document.getElementById('m-texto-neg').value.trim();
            if (textoPos) fd.append('texto_positivo', textoPos);
            if (textoNeg) fd.append('texto_negativo', textoNeg);
            const foto1 = document.getElementById('m-foto1').files[0];
            const foto2 = document.getElementById('m-foto2').files[0];
            if (foto1) fd.append('foto1', foto1);
            if (foto2) fd.append('foto2', foto2);

            const token = localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
            const res = await fetch('/api/resenas/manual', {
                method: 'POST',
                headers: token ? { Authorization: `Bearer ${token}` } : {},
                body: fd,
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || 'Error al guardar');
            }
            _closeModal();
            onSuccess();
        } catch (e) {
            alert('Error: ' + e.message);
        } finally {
            btn.disabled = false;
            btn.textContent = 'Guardar Reseña';
        }
    });

    // Exponer apertura
    return { open: _openModal };
}
