// Modal: configuración de envío por correo (disparadores futuros + interruptor general)
import { fetchAPI } from '../../../api.js';

export const DISPARADOR_OPCIONES = [
    { key: 'reserva_confirmada', label: 'Confirmación de reserva', hint: 'Cuando el motor envíe correo al confirmar.' },
    { key: 'reserva_cancelada', label: 'Cancelación de reserva', hint: 'Acuse tras cancelar (web o gestión).' },
    { key: 'reserva_modificada', label: 'Cambios en la reserva', hint: 'Fechas, huéspedes o alojamiento modificados.' },
    { key: 'recordatorio_pre_llegada', label: 'Recordatorio pre‑llegada', hint: 'Ej. 24–72 h antes del check‑in.' },
    { key: 'post_estadia_evaluacion', label: 'Evaluación / reseña post‑estancia', hint: 'Solicitud con reenvíos (ver backlog 1.7).' },
    { key: 'consulta_contacto', label: 'Consulta desde web', hint: 'Formulario de contacto público.' },
    { key: 'notificacion_interna', label: 'Notificación interna', hint: 'Copia al equipo (operación).' },
];

let plantillaActual = null;
let onSaved = null;

function buildDisparadoresHtml(emailConfig) {
    const d = emailConfig?.disparadores || {};
    return DISPARADOR_OPCIONES.map((op) => `
        <label class="flex items-start gap-3 p-3 rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer">
            <input type="checkbox" class="disparador-cb mt-1 h-4 w-4 text-primary-600 border-gray-300 rounded" data-key="${op.key}" ${d[op.key] ? 'checked' : ''}>
            <span>
                <span class="block text-sm font-medium text-gray-900">${op.label}</span>
                <span class="block text-xs text-gray-500 mt-0.5">${op.hint}</span>
            </span>
        </label>
    `).join('');
}

export function renderModalPlantillaEmailConfig() {
    return `
        <div id="plantilla-email-config-modal" class="modal hidden">
            <div class="modal-content !max-w-lg">
                <div class="flex items-center justify-between mb-4 pb-3 border-b">
                    <div>
                        <h3 class="text-lg font-semibold text-gray-900">Correo y disparadores</h3>
                        <p id="plantilla-email-config-subtitle" class="text-sm text-gray-500 truncate max-w-md"></p>
                    </div>
                    <button type="button" id="plantilla-email-config-close" class="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
                </div>
                <p class="text-xs text-gray-600 mb-4">Define si esta plantilla podrá usarse cuando exista el <strong>envío automático</strong> por evento. La propuesta por correo sigue dependiendo del checkbox al guardar.</p>
                <div class="mb-4">
                    <label class="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" id="plantilla-email-permitir" class="h-4 w-4 text-primary-600 border-gray-300 rounded" checked>
                        <span class="text-sm font-medium text-gray-800">Permitir envío por correo con esta plantilla</span>
                    </label>
                </div>
                <p class="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">Disparadores automáticos (cuando el sistema los implemente)</p>
                <div id="plantilla-email-disparadores" class="space-y-2 max-h-[50vh] overflow-y-auto pr-1 mb-6"></div>
                <div class="flex justify-end gap-2 pt-3 border-t">
                    <button type="button" id="plantilla-email-config-cancel" class="btn-outline">Cerrar</button>
                    <button type="button" id="plantilla-email-config-save" class="btn-primary">Guardar</button>
                </div>
            </div>
        </div>
    `;
}

export function cerrarModalPlantillaEmailConfig() {
    document.getElementById('plantilla-email-config-modal')?.classList.add('hidden');
    plantillaActual = null;
}

export function abrirModalPlantillaEmailConfig(plantilla, callback) {
    plantillaActual = plantilla;
    onSaved = callback;
    const modal = document.getElementById('plantilla-email-config-modal');
    const sub = document.getElementById('plantilla-email-config-subtitle');
    const cont = document.getElementById('plantilla-email-disparadores');
    const permitir = document.getElementById('plantilla-email-permitir');
    if (!modal || !cont || !plantilla) return;

    const ec = plantilla.emailConfig || { permitirEnvioCorreo: true, disparadores: {} };
    if (sub) sub.textContent = plantilla.nombre || '';
    permitir.checked = ec.permitirEnvioCorreo !== false;
    cont.innerHTML = buildDisparadoresHtml(ec);
    modal.classList.remove('hidden');
}

export function setupPlantillaEmailConfigModal() {
    const modal = document.getElementById('plantilla-email-config-modal');
    if (!modal) return;

    const close = () => cerrarModalPlantillaEmailConfig();

    document.getElementById('plantilla-email-config-close')?.addEventListener('click', close);
    document.getElementById('plantilla-email-config-cancel')?.addEventListener('click', close);

    modal.addEventListener('click', (e) => {
        if (e.target === modal) close();
    });

    document.getElementById('plantilla-email-config-save')?.addEventListener('click', async () => {
        if (!plantillaActual?.id) return;
        const disparadores = {};
        document.querySelectorAll('#plantilla-email-disparadores .disparador-cb').forEach((cb) => {
            disparadores[cb.dataset.key] = cb.checked;
        });
        const emailConfig = {
            permitirEnvioCorreo: document.getElementById('plantilla-email-permitir')?.checked !== false,
            disparadores,
        };
        try {
            await fetchAPI(`/plantillas/${plantillaActual.id}`, { method: 'PUT', body: { emailConfig } });
            close();
            if (onSaved) await onSaved();
        } catch (err) {
            alert(err.message || 'Error al guardar');
        }
    });
}
