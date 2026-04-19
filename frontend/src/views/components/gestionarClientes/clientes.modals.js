// frontend/src/views/components/gestionarClientes/clientes.modals.js
import { fetchAPI } from '../../../api.js';
import { AVATAR_COLORS_RGB, pickAvatarRgb } from '../../../shared/colorAvatar.js';

let onSaveCallback = null;
let editandoCliente = null;

/** @deprecated usar pickAvatarRgb; se mantiene alias para compatibilidad */
export const AVATAR_COLORS = AVATAR_COLORS_RGB;

export function getIniciales(nombre) {
    if (!nombre?.trim()) return '?';
    const partes = nombre.trim().split(/\s+/);
    if (partes.length === 1) return partes[0][0].toUpperCase();
    return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

export function getColorAvatar(nombre) {
    return pickAvatarRgb(nombre);
}

function actualizarAvatar(nombre) {
    const el = document.getElementById('cliente-avatar');
    if (!el) return;
    el.textContent = getIniciales(nombre);
    el.style.background = getColorAvatar(nombre);
}

function renderEstrellas(valor = 0) {
    const textos = ['Sin calificar', 'Malo', 'Regular', 'Bueno', 'Muy bueno', 'Excelente'];
    document.querySelectorAll('.star-btn').forEach(btn => {
        btn.classList.toggle('text-warning-400', parseInt(btn.dataset.val) <= valor);
        btn.classList.toggle('text-gray-300', parseInt(btn.dataset.val) > valor);
    });
    const txt = document.getElementById('cal-text');
    if (txt) txt.textContent = textos[valor] || 'Sin calificar';
    const input = document.getElementById('calificacion');
    if (input) input.value = valor;
}

export const renderModalCliente = () => `
    <div id="cliente-modal" class="modal hidden">
        <div class="modal-content !max-w-lg">
            <div class="flex items-center gap-4 mb-6 pb-5 border-b">
                <div id="cliente-avatar"
                     class="w-16 h-16 rounded-full flex items-center justify-center text-white text-xl font-bold flex-shrink-0 select-none bg-gray-400">?</div>
                <div>
                    <h3 id="modal-cliente-title" class="text-xl font-semibold text-gray-900">Nuevo Cliente</h3>
                    <p id="modal-cliente-subtitle" class="text-sm text-gray-500">Completa los datos del huésped</p>
                </div>
            </div>

            <form id="cliente-form" novalidate>
                <p class="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Datos del Cliente</p>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                    <div>
                        <label class="label">Nombre completo <span class="text-danger-500">*</span></label>
                        <input type="text" id="nombre" name="nombre" required class="form-input mt-1" placeholder="Ej: Juan Pérez García">
                    </div>
                    <div>
                        <label class="label">Teléfono <span class="text-danger-500">*</span></label>
                        <input type="tel" id="telefono" name="telefono" required class="form-input mt-1" placeholder="+56 9 6614 8390">
                    </div>
                    <div>
                        <label class="label">Email <span class="text-gray-400 font-normal text-xs">(Opcional)</span></label>
                        <input type="email" id="email" name="email" class="form-input mt-1" placeholder="ejemplo@correo.com">
                    </div>
                    <div>
                        <label class="label">País <span class="text-gray-400 font-normal text-xs">(Opcional)</span></label>
                        <div class="flex gap-2 mt-1">
                            <span class="flex items-center justify-center w-10 rounded-lg bg-gray-100 text-base border border-gray-200">🌐</span>
                            <input type="text" id="pais" name="pais" class="form-input flex-1" placeholder="cl, ar, br...">
                        </div>
                    </div>
                    <div>
                        <label class="label">Ubicación <span class="text-gray-400 font-normal text-xs">(Opcional)</span></label>
                        <input type="text" id="ubicacion" name="ubicacion" class="form-input mt-1" placeholder="Ej: Santiago, Chile">
                    </div>
                    <div>
                        <label class="label">Calificación <span class="text-gray-400 font-normal text-xs">(Opcional)</span></label>
                        <div class="flex items-center gap-0.5 mt-1">
                            ${[1,2,3,4,5].map(i =>
                                `<button type="button" class="star-btn text-2xl text-gray-300 hover:text-warning-400 transition-colors leading-none" data-val="${i}"><i class="fa-solid fa-star"></i></button>`
                            ).join('')}
                            <span id="cal-text" class="text-xs text-gray-500 ml-2">Sin calificar</span>
                        </div>
                        <input type="hidden" id="calificacion" name="calificacion" value="0">
                    </div>
                </div>

                <div id="bloqueo-section" class="mb-4 p-4 rounded-lg border-2 border-danger-200 bg-danger-50 hidden">
                    <div class="flex items-center justify-between mb-3">
                        <div>
                            <p class="font-semibold text-danger-800"><i class="fa-solid fa-ban mr-1"></i>Cliente Bloqueado</p>
                            <p class="text-xs text-danger-600">Un cliente bloqueado no puede realizar reservas en el sistema ni en el sitio web.</p>
                        </div>
                        <label class="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" id="bloqueado-toggle" name="bloqueado" class="sr-only peer">
                            <div class="w-11 h-6 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:bg-danger-600 transition-colors"></div>
                            <div class="absolute left-0.5 top-0.5 w-5 h-5 bg-white rounded-full transition-transform peer-checked:translate-x-5"></div>
                        </label>
                    </div>
                    <div id="motivo-bloqueo-container" class="hidden">
                        <label class="label text-danger-800">Motivo del bloqueo <span class="text-danger-500">*</span></label>
                        <textarea id="motivo-bloqueo" name="motivoBloqueo" rows="2"
                                  class="form-input mt-1 border-danger-300 focus:ring-danger-500"
                                  placeholder="Describe el motivo del bloqueo (daños, mal comportamiento, impago, etc.)..."></textarea>
                    </div>
                </div>

                <div class="mb-2">
                    <label class="label">Notas <span class="text-gray-400 font-normal text-xs">(Opcional)</span></label>
                    <textarea id="notas" name="notas" rows="3" class="form-input mt-1"
                              placeholder="Observaciones internas, preferencias, historial..."></textarea>
                </div>

                <div class="flex items-center justify-between pt-4 mt-4 border-t">
                    <p class="text-xs text-gray-400">* Campos obligatorios</p>
                    <div class="flex gap-2">
                        <button type="button" id="cancel-cliente-btn" class="btn-outline">Cancelar</button>
                        <button type="submit" class="btn-primary">Guardar cliente</button>
                    </div>
                </div>
            </form>
        </div>
    </div>
`;

export const abrirModalCliente = (cliente = null) => {
    const modal = document.getElementById('cliente-modal');
    const form  = document.getElementById('cliente-form');
    if (!modal || !form) return;

    const bloqueoSection = document.getElementById('bloqueo-section');
    const bloqueadoToggle = document.getElementById('bloqueado-toggle');
    const motivoContainer = document.getElementById('motivo-bloqueo-container');
    const motivoBloqueo   = document.getElementById('motivo-bloqueo');

    if (cliente) {
        editandoCliente = cliente;
        document.getElementById('modal-cliente-title').textContent = 'Editar Cliente';
        document.getElementById('modal-cliente-subtitle').textContent = cliente.nombre || '';
        form.nombre.value    = cliente.nombre    || '';
        form.email.value     = cliente.email     || '';
        form.telefono.value  = cliente.telefono  || '';
        form.pais.value      = cliente.pais      || '';
        form.ubicacion.value = cliente.ubicacion || '';
        form.notas.value     = cliente.notas     || '';
        actualizarAvatar(cliente.nombre);
        renderEstrellas(parseInt(cliente.calificacion) || 0);

        if (bloqueoSection) bloqueoSection.classList.remove('hidden');
        if (bloqueadoToggle) bloqueadoToggle.checked = !!cliente.bloqueado;
        if (motivoContainer) motivoContainer.classList.toggle('hidden', !cliente.bloqueado);
        if (motivoBloqueo) motivoBloqueo.value = cliente.motivoBloqueo || '';
    } else {
        editandoCliente = null;
        document.getElementById('modal-cliente-title').textContent = 'Nuevo Cliente';
        document.getElementById('modal-cliente-subtitle').textContent = 'Completa los datos del huésped';
        form.reset();
        actualizarAvatar('');
        renderEstrellas(0);

        if (bloqueoSection) bloqueoSection.classList.add('hidden');
        if (bloqueadoToggle) bloqueadoToggle.checked = false;
        if (motivoContainer) motivoContainer.classList.add('hidden');
        if (motivoBloqueo) motivoBloqueo.value = '';
    }

    modal.classList.remove('hidden');
};

export const cerrarModalCliente = () => {
    document.getElementById('cliente-modal')?.classList.add('hidden');
    editandoCliente = null;
};

export const setupModalCliente = (callback) => {
    onSaveCallback = callback;

    const form = document.getElementById('cliente-form');
    if (!form) return;

    const newForm = form.cloneNode(true);
    form.parentNode.replaceChild(newForm, form);

    document.getElementById('cancel-cliente-btn')?.addEventListener('click', cerrarModalCliente);

    // Avatar en tiempo real al escribir el nombre
    document.getElementById('nombre')?.addEventListener('input', e => {
        actualizarAvatar(e.target.value);
        const sub = document.getElementById('modal-cliente-subtitle');
        if (sub && !editandoCliente) sub.textContent = e.target.value || 'Completa los datos del huésped';
    });

    const toggle = document.getElementById('bloqueado-toggle');
    const motivoContainer = document.getElementById('motivo-bloqueo-container');
    if (toggle && motivoContainer) {
        toggle.addEventListener('change', () => {
            motivoContainer.classList.toggle('hidden', !toggle.checked);
            if (!toggle.checked) document.getElementById('motivo-bloqueo').value = '';
        });
    }

    // Estrellas interactivas
    document.querySelectorAll('.star-btn').forEach(btn => {
        btn.addEventListener('click', () => renderEstrellas(parseInt(btn.dataset.val)));
        btn.addEventListener('mouseenter', () => {
            document.querySelectorAll('.star-btn').forEach(b => {
                b.classList.toggle('text-warning-300', parseInt(b.dataset.val) <= parseInt(btn.dataset.val));
            });
        });
        btn.addEventListener('mouseleave', () => {
            const val = parseInt(document.getElementById('calificacion').value) || 0;
            renderEstrellas(val);
        });
    });

    newForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const f = e.target;
        const submitBtn = newForm.querySelector('[type="submit"]');
        const original = submitBtn.textContent;
        submitBtn.disabled = true;
        submitBtn.textContent = 'Guardando...';

        const bloqueado    = document.getElementById('bloqueado-toggle')?.checked || false;
        const motivoBloqueo = document.getElementById('motivo-bloqueo')?.value?.trim() || '';

        if (bloqueado && !motivoBloqueo) {
            alert('Debes ingresar un motivo para bloquear al cliente.');
            submitBtn.disabled = false;
            submitBtn.textContent = original;
            return;
        }

        const datos = {
            nombre:       f.nombre.value.trim(),
            telefono:     f.telefono.value.trim(),
            email:        f.email.value.trim(),
            pais:         f.pais.value.trim(),
            calificacion: parseInt(f.calificacion.value) || 0,
            ubicacion:    f.ubicacion.value.trim(),
            notas:        f.notas.value.trim(),
            bloqueado,
            motivoBloqueo
        };

        try {
            const endpoint = editandoCliente ? `/clientes/${editandoCliente.id}` : '/clientes';
            const method   = editandoCliente ? 'PUT' : 'POST';
            await fetchAPI(endpoint, { method, body: datos });
            cerrarModalCliente();
            if (onSaveCallback) onSaveCallback();
        } catch (error) {
            alert(`Error al guardar: ${error.message}`);
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = original;
        }
    });
};

// Para abrir el modal de edición directamente por ID (usado desde Gestión Diaria)
export const abrirEdicionCliente = async (clienteId) => {
    if (!clienteId) return;
    try {
        const cliente = await fetchAPI(`/clientes/${clienteId}`);
        abrirModalCliente(cliente);
    } catch (e) {
        console.error('Error al cargar cliente:', e.message);
    }
};
